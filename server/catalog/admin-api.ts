import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Catalog } from './store.ts';
import type { Problem, QueryResult, User, ValidationReport } from '../../shared/types.ts';
import { parseDraft, requirePublishable } from './validation.ts';
import { importQuestion } from './import.ts';
import { runQuery } from '../runner.ts';

type Session = {user: User; csrfToken: string};
interface Dependencies {
  catalog: Catalog;
  auth: {session(req: IncomingMessage): Promise<Session | null>; checkAccount(req: IncomingMessage, session: Session | null): unknown; requireWrite(req: IncomingMessage, session: Session | null): void};
  body(req: IncomingMessage, limit?: number): Promise<any>;
  json(res: ServerResponse, value: unknown, status?: number): void;
  execute?: typeof runQuery;
}
export async function validateQuestion(problem: Problem, execute = runQuery): Promise<ValidationReport> {
  requirePublishable(problem);
  const checks: ValidationReport['checks'] = [];
  for (const engine of ['mysql', 'postgresql'] as const) {
    const result: QueryResult = await execute({slug: problem.slug, sql: problem.references[engine], engine, mode: 'submit'}, problem);
    checks.push({engine, passed: result.passed, total: result.total,
      ...(result.verdict !== 'Accepted' ? {error: result.error || result.results.find(item => !item.passed)?.reason || result.verdict} : {})});
    if (result.verdict !== 'Accepted') break;
    // Retain supplied expected outputs. Only missing outputs are calculated, then cross-checked on the other engine.
    problem.submissionCases = problem.submissionCases.map(test => ({...test, expected: test.expected || result.results.find(item => item.id === test.id)!.expected}));
  }
  return {passed: checks.length === 2 && checks.every(check => !check.error && check.passed === problem.submissionCases.length), checks, checkedAt: new Date().toISOString()};
}
export function createAdminApi({catalog, auth, body, json, execute = runQuery}: Dependencies) {
  let validating = false;
  return async (req: IncomingMessage, res: ServerResponse, url: URL) => {
    if (!url.pathname.startsWith('/api/admin/')) return false;
    const current = await auth.session(req);
    auth.checkAccount(req, current);
    if (current?.user.role !== 'admin') throw Object.assign(new Error('Admin access is required.'), {status: 403});
    if (req.method !== 'GET') auth.requireWrite(req, current);
    const actor = current.user.id;
    if (url.pathname === '/api/admin/questions' && req.method === 'GET') { json(res, await catalog.summaries()); return true; }
    if (url.pathname === '/api/admin/import' && req.method === 'POST') {
      const input = await body(req, 250000);
      if (!input || (input.url !== undefined && typeof input.url !== 'string') || (input.text !== undefined && typeof input.text !== 'string') || (input.title !== undefined && typeof input.title !== 'string')) throw new Error('Provide a question URL or pasted text.');
      const {problem, notice} = await importQuestion(input);
      json(res, {...await catalog.save(parseDraft(problem), 0, actor), notice}, 201); return true;
    }
    const match = url.pathname.match(/^\/api\/admin\/questions\/(qr[a-zA-Z0-9-]+)(?:\/(validate|publish))?$/);
    if (!match) { json(res, {error: 'Not found.'}, 404); return true; }
    const [, id, action] = match;
    if (req.method === 'GET' && !action) {
      const question = await catalog.getQuestion(id, true);
      json(res, question || {error: 'Question not found.'}, question ? 200 : 404); return true;
    }
    const input = await body(req, 8_000_000);
    if (!Number.isSafeInteger(input?.revision) || input.revision < 1) throw new Error('Provide the current draft revision.');
    if (req.method === 'PUT' && !action) {
      const problem = parseDraft(input.problem);
      if (problem.id !== id) throw new Error('Question IDs cannot change.');
      json(res, await catalog.save(problem, input.revision, actor)); return true;
    }
    if (req.method === 'POST' && action === 'publish') { json(res, await catalog.publish(id, input.revision, actor)); return true; }
    if (req.method === 'POST' && action === 'validate') {
      if (validating) throw Object.assign(new Error('Another draft is being validated. Try again shortly.'), {status: 429, retryAfter: 5});
      validating = true;
      try {
        const draft = await catalog.getQuestion(id, true);
        if (!draft || draft.draftRevision !== input.revision) throw Object.assign(new Error('Reload the latest draft before validating.'), {status: 409});
        const problem = parseDraft(draft.problem);
        const report = await validateQuestion(problem, execute);
        await catalog.validated(problem, report, actor);
        json(res, await catalog.getQuestion(id, true));
      } finally { validating = false; }
      return true;
    }
    json(res, {error: 'Not found.'}, 404); return true;
  };
}
