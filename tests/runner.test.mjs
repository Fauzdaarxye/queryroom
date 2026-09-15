import test from 'node:test';
import assert from 'node:assert/strict';
import { runQuery as internalRunQuery, validateInput } from '../server/runner.mjs';
import { problems, publicProblem } from '../server/problems/index.mjs';

const runQuery = args => internalRunQuery({...args,engine:'sqlite'});
const slug = 'rectangles-area';
const problem = problems.get(slug);
// This reference stays in backend tests and is never sent to the practice editor.
const solution = `SELECT a.id AS p1, b.id AS p2,
ABS((a.x_value-b.x_value)*(a.y_value-b.y_value)) AS area
FROM Points a JOIN Points b ON a.id < b.id
WHERE a.x_value <> b.x_value AND a.y_value <> b.y_value
ORDER BY area DESC, p1 ASC, p2 ASC;`;

test('published sample has the exact expected rows', () => {
  assert.deepEqual(problem.example.input.Points, [[1,2,7], [2,4,8], [3,2,10]]);
  assert.deepEqual(problem.example.output, { columns: ['p1', 'p2', 'area'], rows: [[2,3,4], [1,2,2]] });
  assert.equal(publicProblem(problem).expected, undefined);
  assert.equal(publicProblem(problem).submissionCases, undefined);
});
test('a correct query passes the entire local suite', async () => {
  const result = await runQuery({ slug, sql: solution, mode: 'submit' });
  assert.equal(result.verdict, 'Accepted', JSON.stringify(result.results.filter(r => !r.passed)));
  assert.equal(result.passed, problem.submissionCases.length);
});
test('a CTE solution is accepted', async () => {
  const result = await runQuery({ slug, sql: `WITH rectangles AS (${solution.trim().slice(0, -1)}) SELECT * FROM rectangles ORDER BY area DESC, p1, p2;` });
  assert.equal(result.verdict, 'Accepted');
});
test('right values in the wrong order are rejected', async () => {
  const result = await runQuery({ slug, sql: solution.replace('area DESC', 'area ASC') });
  assert.equal(result.verdict, 'Wrong Answer');
  assert.match(result.results[0].reason, /row order/);
});
test('missing aliases and zero area rectangles are rejected', async () => {
  const aliasResult = await runQuery({ slug, sql: solution.replace('AS p1', 'AS first_point').replace('p1 ASC', 'first_point ASC') });
  assert.equal(aliasResult.verdict, 'Wrong Answer');
  const zeroResult = await runQuery({ slug, sql: solution.replace('WHERE a.x_value <> b.x_value AND a.y_value <> b.y_value', '') });
  assert.equal(zeroResult.verdict, 'Wrong Answer');
});
test('single point and empty tables produce zero rows with the expected columns', async () => {
  for (const caseId of ['one-point', 'empty', 'same-x', 'same-y']) {
    const result = await runQuery({ slug, sql: solution, caseId });
    assert.equal(result.verdict, 'Accepted');
    assert.deepEqual(result.results[0].actual.rows, []);
  }
});
test('custom input is evaluated with an independently generated expected result', async () => {
  const result = await runQuery({ slug, sql: solution, customInput: { Points: [[9,-2,3], [1,3,-4]] } });
  assert.equal(result.verdict, 'Accepted');
  assert.deepEqual(result.results[0].expected.rows, [[1,9,35]]);
});
test('bad custom inputs, missing cases and unknown problems are rejected', async () => {
  assert.throws(() => validateInput(problem, { Points: [[1,0,0], [1,2,3]] }), /unique/);
  assert.throws(() => validateInput(problem, { Points: [[1,null,3]] }), /integer/);
  assert.throws(() => validateInput(problem, { Points: [[1,2]] }), /3 values/);
  assert.throws(() => validateInput(problem, { Points: [], Unknown: [] }), /exactly/);
  await assert.rejects(runQuery({ slug, sql: solution, caseId: 'missing' }), /not found/);
  await assert.rejects(runQuery({ slug: 'missing', sql: solution }), /not found/);
});
test('blank queries and syntax errors give useful failures', async () => {
  const blank = await runQuery({ slug, sql: '-- Write your query\n' });
  assert.equal(blank.verdict, 'Runtime Error');
  assert.match(blank.error, /Write a SELECT/);
  const invalid = await runQuery({ slug, sql: 'SELECT missing FROM Points' });
  assert.equal(invalid.verdict, 'Runtime Error');
  assert.match(invalid.results[0].error, /no such column/);
});
test('read-only enforcement blocks writes, multiple statements, and file attachment', async () => {
  for (const sql of ['DROP TABLE Points', 'SELECT 1; DELETE FROM Points;', "ATTACH DATABASE '/tmp/other.db' AS other", 'WITH x AS (SELECT 1) DELETE FROM Points']) {
    const result = await runQuery({ slug, sql });
    assert.equal(result.verdict, 'Runtime Error', sql);
  }
  const fresh = await runQuery({ slug, sql: solution });
  assert.equal(fresh.verdict, 'Accepted');
});
test('semicolons inside comments and strings are allowed', async () => {
  const result = await runQuery({ slug, sql: `-- test ; comment\n${solution}\n/* trailing ; comment */` });
  assert.equal(result.verdict, 'Accepted');
  const literal = await runQuery({ slug, sql: "SELECT ';' AS p1, 1 AS p2, 2 AS area" });
  assert.equal(literal.verdict, 'Wrong Answer');
});
test('unbounded queries are interrupted within the time limit', async () => {
  const result = await runQuery({ slug, sql: 'WITH RECURSIVE t(n) AS (SELECT 1 UNION ALL SELECT n+1 FROM t) SELECT sum(n) FROM t' });
  assert.equal(result.verdict, 'Time Limit Exceeded');
});
