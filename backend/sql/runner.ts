import { fork } from 'node:child_process';
import type { Problem, QueryRequest, QueryResult } from '../../shared/types.ts';
let lookup: (slug: string) => Promise<Problem | null> = async () => null;
export function configureRunner(resolve: typeof lookup) {
  lookup = resolve;
}
import { randomBytes } from 'node:crypto';
import { cleanupNative } from '../../database/connections/native-workspace.mjs';
import { engineMode } from '../../database/connections/engine-settings.mjs';

import { validateInput } from '../../shared/input.mjs';
export { validateInput } from '../../shared/input.mjs';

export async function runQuery(
  { slug, sql, engine = 'mysql', mode = 'run', caseId = 'example', customInput }: QueryRequest,
  snapshot?: Problem,
): Promise<QueryResult> {
  const problem = snapshot || (await lookup(slug));
  if (!problem) throw new Error('Problem not found.');
  if (typeof sql !== 'string' || sql.length > 20000)
    throw new Error('Your query must contain at most 20,000 characters.');
  if (!['run', 'submit'].includes(mode)) throw new Error('Choose Run or Submit.');
  if (!['mysql', 'postgresql', 'sqlite'].includes(engine))
    throw new Error('Choose MySQL or PostgreSQL.');
  let cases;
  if (mode === 'submit') cases = problem.submissionCases;
  else if (customInput !== undefined)
    cases = [
      {
        id: 'custom',
        name: 'Custom case',
        kind: 'Your test case',
        input: validateInput(problem, customInput),
      },
    ];
  else {
    const test = problem.practiceCases.find((item) => item.id === caseId);
    if (!test) throw new Error('Test case not found.');
    cases = [test];
  }
  const workspace = `qr_${randomBytes(12).toString('hex')}`;
  // Hosted submissions include remote fixture setup; each individual SQL query still has a 3-second limit.
  const requestLimit = engine === 'sqlite' ? 3000 : engineMode() === 'external' ? 60000 : 15000;
  return new Promise<QueryResult>((resolve, reject) => {
    const worker = fork(new URL('./sql-worker.ts', import.meta.url), [], {
      stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
      execArgv: ['--import', 'tsx', '--max-old-space-size=128'],
    });
    let finished = false;
    const finish = async (fn: (value: any) => void, value: any) => {
      if (finished) return;
      finished = true;
      clearTimeout(timeout);
      if (worker.exitCode === null && worker.signalCode === null)
        await new Promise<void>((done) => {
          worker.once('exit', done);
          worker.kill('SIGKILL');
        });
      if (engine !== 'sqlite') {
        try {
          await cleanupNative(engine, workspace);
        } catch {
          return reject(
            new Error('The database connection was interrupted. Restart Queryroom and try again.'),
          );
        }
      }
      fn(
        value && typeof value === 'object' && !(value instanceof Error)
          ? { ...value, engine }
          : value,
      );
    };
    const timeout = setTimeout(
      () =>
        finish(resolve, {
          verdict: 'Time Limit Exceeded',
          passed: 0,
          total: cases.length,
          runtime: requestLimit,
          results: [],
          error:
            'Your query exceeded the execution limit. Check for an unbounded join or recursive query.',
        }),
      requestLimit,
    );
    worker.on('message', (result) => finish(resolve, result));
    worker.on('error', () =>
      finish(
        reject,
        new Error('The query exceeded the available resources or could not be executed.'),
      ),
    );
    worker.on('exit', (code) => {
      if (!finished && code !== 0)
        finish(reject, new Error('The SQL runner stopped unexpectedly. Please try again.'));
    });
    worker.send({
      problem,
      sql,
      cases,
      engine,
      workspace,
      password: randomBytes(24).toString('hex'),
    });
  });
}
