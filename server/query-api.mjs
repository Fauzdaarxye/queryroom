import { randomUUID } from 'node:crypto';
import { runQuery } from './runner.mjs';

export function createQueryApi({ auth, store, problems, body, json, execute = runQuery, maxConcurrent = 4 }) {
  if (!Number.isInteger(maxConcurrent) || maxConcurrent < 1 || maxConcurrent > 32) throw new Error('Invalid query capacity.');
  let active = 0;
  return async (req, res, url) => {
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
      const result = await execute(request);
      if (request.mode === 'submit') {
        const submission = { id: randomUUID(), date: new Date().toISOString(), sql: request.sql, engine: result.engine,
          verdict: result.verdict, passed: result.passed, total: result.total, runtime: result.runtime };
        result.submission = submission;
        if (current) Object.assign(result, await store.recordSubmission(current.user.id, problems.get(request.slug), submission));
      }
      json(res, result);
    } finally {
      active--;
    }
    return true;
  };
}
