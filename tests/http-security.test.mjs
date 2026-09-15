import test from 'node:test';
import assert from 'node:assert/strict';
import { setImmediate } from 'node:timers/promises';
import { requestUrl } from '../server/http-security.mjs';
import { createQueryApi } from '../server/query-api.mjs';

test('malformed and authority-changing request targets are rejected safely', () => {
  for (const path of ['//[', '//other.example/api/session', '/\\other.example/', 'http://other.example/', '/', '/api/health?ok=1']) {
    if (path === '/' || path.startsWith('/api/')) assert.equal(requestUrl(path).pathname, path.split('?')[0]);
    else assert.throws(() => requestUrl(path), error => error.status === 400);
  }
  for (const path of ['', null, '*', '/#fragment']) assert.throws(() => requestUrl(path), error => error.status === 400);
  assert.equal(requestUrl('/questions?search=a%26b').searchParams.get('search'), 'a&b');
});

const url = new URL('http://localhost/api/query');
const request = { slug: 'question', sql: 'SELECT 1', engine: 'postgresql' };
const auth = { session: async () => null };
const req = { method: 'POST', headers: {} };
const base = { auth, store: {}, problems: new Map(), body: async () => request, json: () => {} };

test('query capacity is shared by requests, rejects overload immediately, and releases on success', async () => {
  const pending = [];
  let calls = 0;
  const api = createQueryApi({ ...base, maxConcurrent: 2, execute: () => {
    calls++;
    return new Promise(resolve => pending.push(resolve));
  }});
  const first = api(req, {}, url), second = api(req, {}, url);
  await setImmediate();
  await assert.rejects(api(req, {}, url), error => error.status === 429 && error.retryAfter === 1);
  assert.equal(calls, 2, 'overload must not start another worker');
  pending.shift()({ verdict: 'Wrong Answer' });
  await first;
  const third = api(req, {}, url);
  await setImmediate();
  assert.equal(calls, 3);
  for (const resolve of pending) resolve({ verdict: 'Accepted' });
  await Promise.all([second, third]);
  assert.equal(await api({ ...req, method: 'GET' }, {}, url), false);
});

test('runner and database failures cannot permanently consume query capacity', async () => {
  const account = { user: { id: 'learner' } };
  let failures = 0;
  const api = createQueryApi({ ...base, maxConcurrent: 1,
    auth: { session: async () => account, requireWrite() {}, requireProfile() {} },
    body: async () => ({ ...request, mode: 'submit' }),
    execute: async () => {
      if (failures++ === 0) throw new Error('Worker failed');
      return { verdict: 'Accepted', engine: 'postgresql' };
    },
    store: { recordSubmission: async () => { if (failures === 2) throw new Error('Database failed'); return {}; } },
  });
  await assert.rejects(api(req, {}, url), /Worker failed/);
  await assert.rejects(api(req, {}, url), /Database failed/);
  assert.equal(await api(req, {}, url), true);
});

test('invalid query payloads and expired-account requests never start a worker', async () => {
  let calls = 0;
  for (const input of [null, [], 'text', { engine: 'sqlite' }]) {
    const api = createQueryApi({ ...base, body: async () => input, execute: async () => { calls++; } });
    await assert.rejects(api(req, {}, url));
  }
  const api = createQueryApi({ ...base,
    auth: { ...auth, requireWrite: () => { throw Object.assign(new Error('Expired'), { status: 401 }); } },
    execute: async () => { calls++; },
  });
  await assert.rejects(api({ ...req, headers: { 'x-queryroom-account': 'expired' } }, {}, url), error => error.status === 401);
  assert.equal(calls, 0);
});
