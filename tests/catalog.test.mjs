import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import pg from 'pg';
import {createCatalog} from '../server/catalog/store.ts';
import {readSeed} from '../server/catalog/seed.ts';
import {emptyDraft, importQuestion, sourceSlug, inferSchema, inferExamples} from '../server/catalog/import.ts';
import {parseDraft, cleanStatement} from '../server/catalog/validation.ts';
import {validateQuestion, createAdminApi} from '../server/catalog/admin-api.ts';
import {runQuery} from '../server/runner.ts';
import {adminConnection, engineConfig} from '../server/engines.mjs';
import {createAccountStore} from '../server/account-store.mjs';

test('question imports allow only source links and sanitize statements without executing content', async () => {
  for (const source of ['http://localhost/secret', 'https://leetcode.com.evil.test/problems/a/', 'https://127.0.0.1/problems/a/', 'https://user:pass@leetcode.com/problems/a/', 'https://leetcode.com:4430/problems/a/', 'file:///etc/passwd']) assert.throws(() => sourceSlug(source));
  assert.equal(sourceSlug('https://leetcode.com/problems/confirmation-rate/description/?x=1'), 'confirmation-rate');
  assert.doesNotMatch(cleanStatement('<script>bad()</script><img src=x onerror=bad()><a href="javascript:bad()">x</a><p>Safe</p>'), /script|onerror|javascript|src="x"/);
  const {problem, notice} = await importQuestion({url: 'https://leetcode.com/problems/sample-question/'}, async (url, options) => {
    assert.equal(url, 'https://leetcode.com/graphql/'); assert.equal(options.redirect, 'error');
    return new Response(JSON.stringify({data: {question: {questionFrontendId: '99999', title: 'Sample question', titleSlug: 'sample-question', difficulty: 'Hard', content: '<p>Table: <code>Items</code></p><pre>+----+------+\n| id | int |\n+----+------+</pre>'}}}));
  });
  assert.equal(problem.id, 'qr99999'); assert.equal(problem.schema[0].name, 'Items'); assert.equal(problem.schema[0].columns[0].type, 'INTEGER'); assert.match(notice, /Imported/);
  const fallback = await importQuestion({url: 'https://leetcode.com/problems/unavailable/', text: 'Pasted statement'}, async () => new Response('', {status: 403}));
  assert.match(fallback.problem.statementHtml, /Pasted statement/); assert.match(fallback.notice, /did not provide/);
});

test('all migrated questions remain editable and public HTML examples can be extracted', async () => {
  const seed = await readSeed();
  for (const problem of seed) assert.doesNotThrow(() => parseDraft(problem), problem.slug);
  const sample = seed.find(problem => problem.number === 1369);
  assert.deepEqual(inferExamples(sample.statementHtml, inferSchema(sample.statementHtml))[0].input, sample.example.input);
  assert.deepEqual(inferExamples(sample.statementHtml, inferSchema(sample.statementHtml))[0].expected, sample.example.output);
  const ascii = 'Table: <code>Items</code><pre>| id | int |</pre><pre>Input:\nItems table:\n| id |\n| 1 |\nOutput:\n| total |\n| 1 |</pre>';
  assert.deepEqual(inferExamples(ascii, inferSchema(ascii))[0].expected, {columns: ['total'], rows: [[1]]});
});

test('admin routes reject guests and non-admins and require CSRF for writes', async () => {
  let role = null, writes = 0, reads = 0;
  const auth = {session: async () => role ? {user: {id: 'u', role}, csrfToken: 'csrf'} : null,
    checkAccount: (_, session) => {if (!session) throw Object.assign(new Error('Sign in'), {status: 401});},
    requireWrite: () => {writes++; throw Object.assign(new Error('Invalid CSRF'), {status: 403});}};
  const api = createAdminApi({auth, catalog: {summaries: async () => {reads++; return [];}}, body: async () => ({}), json: () => {}});
  await assert.rejects(api({method: 'GET'}, {}, new URL('http://test/api/admin/questions')), {status: 401});
  role = 'user'; await assert.rejects(api({method: 'GET'}, {}, new URL('http://test/api/admin/questions')), {status: 403});
  role = 'admin'; await api({method: 'GET'}, {}, new URL('http://test/api/admin/questions')); assert.equal(reads, 1);
  await assert.rejects(api({method: 'POST'}, {}, new URL('http://test/api/admin/import')), {status: 403}); assert.equal(writes, 1);
});

test('database migration preserves all fixtures and account data; reviewed revisions publish atomically', {timeout: 120000}, async () => {
  const database = `qr_catalog_${randomBytes(8).toString('hex')}`;
  const admin = await adminConnection('postgresql'); let catalog, accounts;
  try {
    await admin.query(`CREATE DATABASE "${database}"`);
    const config = {...(await engineConfig()).postgresql, database};
    accounts = await createAccountStore({config});
    const user = await accounts.upsertGoogleUser({sub: 'migration-test', name: 'Learner', email: 'learner@example.com'});
    const previous = {draft: 'SELECT existing_draft', notes: 'Keep my notes', bookmarked: true, solved: true};
    await accounts.patchProgress(user.id, 'rectangles-area', previous);
    catalog = await createCatalog(config);
    const seed = await readSeed(); const published = await catalog.list();
    assert.equal(published.length, 79); assert.equal(published.reduce((n,p) => n + p.totalTests, 0), 1032);
    for (const original of seed) {
      const saved = await catalog.published(original.slug);
      assert.equal(saved.id, original.id); assert.deepEqual(saved.submissionCases, original.submissionCases.map(test => ({...test, description: test.description || ''})));
      assert.deepEqual(saved.references, original.references);
    }
    assert.ok(published.every(problem => !problem.references && !problem.submissionCases && problem.practiceCases.every(test => !test.expected)));
    let problem = emptyDraft('Count positive values', 'count-positive-values');
    problem.statementHtml = '<p>Return the count of positive values as total.</p>';
    problem.schema = [{name: 'Numbers', columns: [{name: 'value', type: 'INTEGER'}]}];
    problem.references = {mysql: 'SELECT COUNT(*) AS total FROM Numbers WHERE value > 0', postgresql: 'SELECT COUNT(*) AS total FROM Numbers WHERE value > 0'};
    problem.submissionCases = [{id: 'example', name: 'Example', kind: 'Example', input: {Numbers: [[1],[-1],[0],[2]]}, expected: {columns: ['total'], rows: [[2]]}}, {id: 'empty', name: 'Empty table', kind: 'Edge case', input: {Numbers: []}}];
    problem.practiceCases = [problem.submissionCases[0]];
    const saved = await catalog.save(parseDraft(problem), 0, user.id);
    assert.equal(await catalog.published(problem.slug), null);
    await assert.rejects(catalog.publish(problem.id, 1, user.id), {status: 409});
    problem = saved.problem;
    const report = await validateQuestion(problem);
    assert.equal(report.passed, true, JSON.stringify(report));
    await catalog.validated(problem, report, user.id); await catalog.publish(problem.id, 1, user.id);
    assert.equal((await catalog.list()).length, 80);
    const snapshot = await catalog.published(problem.slug);
    for (const engine of ['mysql', 'postgresql']) {
      const checked = await runQuery({slug: problem.slug, engine, sql: problem.references[engine], customInput: {Numbers: [[-3],[8],[9]]}}, snapshot);
      assert.equal(checked.verdict, 'Accepted'); assert.equal(Number(checked.results[0].expected.rows[0][0]), 2);
    }
    const changed = await catalog.save({...problem, title: 'An edited draft'}, 1, user.id);
    assert.equal((await catalog.published(problem.slug)).title, 'Count positive values');
    assert.equal(changed.validation, null);
    await assert.rejects(catalog.save(problem, 1, user.id), {status: 409});
    await assert.rejects(catalog.publish(problem.id, 2, user.id), {status: 409});
    await assert.rejects(catalog.validated(problem, report, user.id), {status: 409});
    await catalog.close(); catalog = await createCatalog(config);
    assert.equal((await catalog.list()).length, 80); assert.equal((await catalog.getQuestion(problem.id, true)).problem.title, 'An edited draft');
    const progress = (await accounts.readProgress(user.id, ['rectangles-area']))['rectangles-area'];
    for (const [key, value] of Object.entries(previous)) assert.equal(progress[key], value);
    const reader = new pg.Client(config); await reader.connect();
    try {assert.equal((await reader.query("SELECT has_schema_privilege('public','queryroom_catalog','USAGE') AS allowed")).rows[0].allowed, false);} finally {await reader.end();}
  } finally {await catalog?.close(); await accounts?.close(); await admin.query(`DROP DATABASE IF EXISTS "${database}" WITH (FORCE)`); await admin.end();}
});
