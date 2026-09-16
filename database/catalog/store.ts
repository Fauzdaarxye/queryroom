import pg, { type PoolConfig, type PoolClient } from 'pg';
import { readFile } from 'node:fs/promises';
import type {
  AdminQuestion,
  Problem,
  PublicProblem,
  QuestionSummary,
  TestCase,
  ValidationReport,
} from '../../shared/types.ts';
import { readSeed } from './seed.ts';

const failure = (status: number, message: string) => Object.assign(new Error(message), { status });
export function publicProblem(problem: Problem): PublicProblem {
  const { submissionCases, references, ...details } = problem;
  return {
    ...details,
    practiceCases: details.practiceCases.map(({ expected, ...test }) => test),
    totalTests: submissionCases.length,
  };
}

export async function createCatalog(config: PoolConfig) {
  const pool = new pg.Pool({ ...config, max: 5, statement_timeout: 15_000 });
  pool.on('error', (error) =>
    console.error('Catalog connection interrupted:', (error as NodeJS.ErrnoException).code),
  );
  async function transaction<T>(action: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await action(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
  async function writeRevision(
    client: PoolClient,
    problem: Problem,
    revision: number,
    actor: string | null,
  ) {
    const { submissionCases, practiceCases, references, revision: previous, ...document } = problem;
    await client.query(
      'INSERT INTO queryroom_catalog.revisions(question_id,revision,document,created_by) VALUES($1,$2,$3,$4)',
      [problem.id, revision, document, actor],
    );
    const visible = new Set(practiceCases.map((test) => test.id));
    for (const [position, test] of submissionCases.entries()) {
      await client.query(
        `INSERT INTO queryroom_catalog.test_cases(question_id,revision,id,position,name,kind,description,input,expected,visible)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [
          problem.id,
          revision,
          test.id,
          position,
          test.name,
          test.kind,
          test.description || '',
          test.input,
          test.expected || null,
          visible.has(test.id),
        ],
      );
    }
    for (const engine of ['mysql', 'postgresql'] as const)
      await client.query('INSERT INTO queryroom_catalog.reference_solutions VALUES($1,$2,$3,$4)', [
        problem.id,
        revision,
        engine,
        references[engine] || '',
      ]);
  }
  try {
    await transaction(async (client) => {
      // Serialize first boot across replicas; never reseed or overwrite admin edits on restart.
      await client.query('SELECT pg_advisory_xact_lock(781903241)');
      await client.query(
        await readFile(new URL('../migrations/001_catalog.sql', import.meta.url), 'utf8'),
      );
      const applied = await client.query(
        "SELECT 1 FROM queryroom_catalog.migrations WHERE name='catalog-v1'",
      );
      if (!applied.rowCount) {
        for (const problem of await readSeed()) {
          const inserted = await client.query(
            'INSERT INTO queryroom_catalog.questions(id,slug,position,draft_revision,published_revision) VALUES($1,$2,$3,1,1) ON CONFLICT DO NOTHING RETURNING id',
            [problem.id, problem.slug, problem.position],
          );
          if (inserted.rowCount) await writeRevision(client, problem, 1, null);
        }
        await client.query("INSERT INTO queryroom_catalog.migrations(name) VALUES('catalog-v1')");
      }
    });
  } catch (error) {
    await pool.end();
    throw error;
  }

  async function getQuestion(id: string, draft = false): Promise<AdminQuestion | null> {
    // A single SQL statement gives a consistent revision and its fixtures, even during publishing.
    const { rows } = await pool.query(
      `SELECT q.*,r.document,r.revision,r.validation,
      COALESCE((SELECT jsonb_agg(jsonb_build_object('id',t.id,'name',t.name,'kind',t.kind,'description',t.description,'input',t.input,'expected',t.expected,'visible',t.visible) ORDER BY t.position)
        FROM queryroom_catalog.test_cases t WHERE t.question_id=q.id AND t.revision=r.revision),'[]') AS tests,
      COALESCE((SELECT jsonb_object_agg(engine,sql) FROM queryroom_catalog.reference_solutions s WHERE s.question_id=q.id AND s.revision=r.revision),'{}') AS references
      FROM queryroom_catalog.questions q JOIN queryroom_catalog.revisions r ON r.question_id=q.id AND r.revision=CASE WHEN $2 THEN q.draft_revision ELSE q.published_revision END
      WHERE q.id=$1 OR q.slug=$1`,
      [id, draft],
    );
    if (!rows.length) return null;
    const row = rows[0];
    const cleanTest = ({ visible, ...test }: TestCase & { visible: boolean }) => test;
    const problem: Problem = {
      ...row.document,
      id: row.id,
      slug: row.slug,
      revision: row.revision,
      submissionCases: row.tests.map(cleanTest),
      practiceCases: row.tests
        .filter((test: TestCase & { visible: boolean }) => test.visible)
        .map(cleanTest),
      references: row.references,
    };
    return {
      problem,
      draftRevision: row.draft_revision,
      publishedRevision: row.published_revision,
      validation: row.validation,
    };
  }
  return {
    async list(): Promise<PublicProblem[]> {
      const { rows } = await pool.query(`SELECT r.document,r.revision,
        (SELECT count(*)::integer FROM queryroom_catalog.test_cases t WHERE t.question_id=q.id AND t.revision=r.revision) AS total,
        COALESCE((SELECT jsonb_agg(jsonb_build_object('id',t.id,'name',t.name,'kind',t.kind,'description',t.description,'input',t.input) ORDER BY t.position)
          FROM queryroom_catalog.test_cases t WHERE t.question_id=q.id AND t.revision=r.revision AND t.visible),'[]') AS tests
        FROM queryroom_catalog.questions q JOIN queryroom_catalog.revisions r ON r.question_id=q.id AND r.revision=q.published_revision ORDER BY q.position,q.id`);
      return rows.map((row) => ({
        ...row.document,
        revision: row.revision,
        practiceCases: row.tests,
        totalTests: row.total,
      }));
    },
    async slugs(): Promise<string[]> {
      return (
        await pool.query(
          'SELECT slug FROM queryroom_catalog.questions WHERE published_revision IS NOT NULL',
        )
      ).rows.map((row) => row.slug);
    },
    async summaries(): Promise<QuestionSummary[]> {
      return (
        await pool.query(`SELECT q.id,q.slug,r.document->>'title' AS title,r.document->>'difficulty' AS difficulty,q.draft_revision AS "draftRevision",q.published_revision AS "publishedRevision",q.updated_at AS "updatedAt"
        FROM queryroom_catalog.questions q JOIN queryroom_catalog.revisions r ON r.question_id=q.id AND r.revision=q.draft_revision ORDER BY q.updated_at DESC,q.position`)
      ).rows;
    },
    getQuestion,
    async published(slug: string): Promise<Problem | null> {
      return (await getQuestion(slug))?.problem || null;
    },
    async save(problem: Problem, expectedRevision: number, actor: string): Promise<AdminQuestion> {
      await transaction(async (client) => {
        if (expectedRevision === 0) {
          await client.query(
            'INSERT INTO queryroom_catalog.questions(id,slug,position,draft_revision,created_by) VALUES($1,$2,(SELECT COALESCE(max(position),-1)+1 FROM queryroom_catalog.questions),1,$3)',
            [problem.id, problem.slug, actor],
          );
        } else {
          const updated = await client.query(
            'UPDATE queryroom_catalog.questions SET draft_revision=draft_revision+1,updated_at=now() WHERE id=$1 AND slug=$2 AND draft_revision=$3 RETURNING id',
            [problem.id, problem.slug, expectedRevision],
          );
          if (!updated.rowCount)
            throw failure(
              409,
              'This question changed in another tab. Reload the draft before editing.',
            );
        }
        await writeRevision(client, problem, expectedRevision + 1, actor);
        await client.query(
          "INSERT INTO queryroom_catalog.audit_log(actor_id,question_id,revision,action) VALUES($1,$2,$3,'save')",
          [actor, problem.id, expectedRevision + 1],
        );
      }).catch((error) => {
        if (error.code === '23505')
          throw failure(
            409,
            'A question with this ID or link already exists. Open its draft to edit it.',
          );
        throw error;
      });
      return (await getQuestion(problem.id, true))!;
    },
    async validated(problem: Problem, report: ValidationReport, actor: string) {
      await transaction(async (client) => {
        const current = await client.query(
          'SELECT 1 FROM queryroom_catalog.questions WHERE id=$1 AND draft_revision=$2 FOR UPDATE',
          [problem.id, problem.revision],
        );
        if (!current.rowCount)
          throw failure(409, 'The draft changed during validation. Validate the latest revision.');
        if (report.passed)
          for (const test of problem.submissionCases)
            await client.query(
              'UPDATE queryroom_catalog.test_cases SET expected=$4 WHERE question_id=$1 AND revision=$2 AND id=$3',
              [problem.id, problem.revision, test.id, test.expected],
            );
        await client.query(
          'UPDATE queryroom_catalog.revisions SET validation=$3 WHERE question_id=$1 AND revision=$2',
          [problem.id, problem.revision, report],
        );
        await client.query(
          "INSERT INTO queryroom_catalog.audit_log(actor_id,question_id,revision,action) VALUES($1,$2,$3,'validate')",
          [actor, problem.id, problem.revision],
        );
      });
    },
    async publish(id: string, revision: number, actor: string) {
      await transaction(async (client) => {
        const changed = await client.query(
          `UPDATE queryroom_catalog.questions q SET published_revision=$2,updated_at=now()
          WHERE id=$1 AND draft_revision=$2 AND EXISTS(SELECT 1 FROM queryroom_catalog.revisions r WHERE r.question_id=q.id AND r.revision=$2 AND r.validation->>'passed'='true') RETURNING id`,
          [id, revision],
        );
        if (!changed.rowCount)
          throw failure(
            409,
            'Save and validate the current draft on both engines before publishing.',
          );
        await client.query(
          "INSERT INTO queryroom_catalog.audit_log(actor_id,question_id,revision,action) VALUES($1,$2,$3,'publish')",
          [actor, id, revision],
        );
      });
      return getQuestion(id, true);
    },
    async health() {
      await pool.query('SELECT 1');
    },
    close: () => pool.end(),
  };
}
export type Catalog = Awaited<ReturnType<typeof createCatalog>>;
