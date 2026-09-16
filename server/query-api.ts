import type {IncomingMessage, ServerResponse} from 'node:http';
import type {ApiDependencies} from './api-types.ts';
import { randomUUID } from 'node:crypto';
import { runQuery } from './runner.ts';

export function createQueryApi({ auth, store, problems = new Map(), catalog = undefined, body, json, execute = runQuery, maxConcurrent = 4 }: ApiDependencies & {execute?: typeof runQuery; maxConcurrent?: number}) {
  if (!Number.isInteger(maxConcurrent) || maxConcurrent < 1 || maxConcurrent > 32) throw new Error('Invalid query capacity.');
  let active = 0;
  return async (req: IncomingMessage, res: ServerResponse, url: URL) => {
    if (req.method !== 'POST' || url.pathname !== '/api/query') return false;
    const request = await body(req);
    const current = await auth.session(req);
    if (current || req.headers['x-queryroom-account']) { auth.requireWrite(req, current); auth.requireProfile(current); }
    if (!request || typeof request !== 'object' || Array.isArray(request)) throw new Error('Send a query object.');
    if (request.engine !== undefined && !['mysql','postgresql'].includes(request.engine)) throw new Error('Choose MySQL or PostgreSQL.');
    // Bound workers and temporary database connections across guests and accounts.
    // Reject excess work immediately rather than keeping an unbounded queue.
    if (active >= maxConcurrent) throw Object.assign(new Error('All query slots are busy. Please try again in a moment.'), { status: 429, retryAfter: 1 });
    active++;
    try {
      const problem = catalog ? await catalog.published(request.slug) : problems.get(request.slug);
      if (!problem) throw new Error('Problem not found.');
      if (request.revision !== undefined && request.revision !== problem.revision) throw Object.assign(new Error('This question was updated. Your draft is saved; refresh the page to load its current schema and tests.'), {status: 409});
      const result = await execute(request, problem);
      if (request.mode === 'submit') {
        const submission = { id: randomUUID(), date: new Date().toISOString(), sql: request.sql, engine: result.engine || request.engine || 'mysql',
          verdict: result.verdict, passed: result.passed, total: result.total, runtime: result.runtime };
        result.submission = submission;
        if (current) Object.assign(result, await store.recordSubmission(current.user.id, problem, submission));
      }
      json(res, result);
    } finally {
      active--;
    }
    return true;
  };
}
