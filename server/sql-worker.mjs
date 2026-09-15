import { createDatabase, execute } from './database.mjs';
import { compareResult } from './compare.mjs';
import { performance } from 'node:perf_hooks';
import { problems } from './problems/index.mjs';
import { checkStatement } from './check-statement.mjs';
import { createNativeWorkspace } from './native-database.mjs';

const { slug, sql, cases, engine, workspace, password } = await new Promise(resolve => process.once('message', resolve));
const problem = problems.get(slug);
const results = [];
let outputBytes = 0;
const started = performance.now();
let native;
try {
  checkStatement(sql, engine);
  if (engine !== 'sqlite') native = await createNativeWorkspace(engine, workspace, password);
  for (const test of cases) {
    const expected = test.expected || problem.expected(test.input);
    const db = native ? null : createDatabase(problem, test.input);
    let actual = { columns: [], rows: [] };
    let error = null;
    const start = performance.now();
    try {
      if (native) { await native.seed(problem, test.input); actual = await native.execute(sql); }
      else actual = execute(db, sql);
    } catch (err) { error = err.message; }
    finally { db?.close(); }
    outputBytes += Buffer.byteLength(JSON.stringify(actual));
    if (outputBytes > 4 * 1024 * 1024) {
      error = 'Output is limited to 4 MB across all tests. Select fewer or smaller values.';
      actual = { columns: [], rows: [] };
    }
    const comparison = error ? { passed: false, reason: error } : compareResult(problem, actual, expected);
    const { passed, reason } = comparison;
    results.push({ ...test, expected, actual, passed, error, reason, runtime: Math.round((performance.now() - start) * 100) / 100 });
    if (error && /timeout|time.*limit|canceling statement|maximum statement execution time|interrupted|Output is limited/i.test(error)) break;
  }
  const passed = results.filter(r => r.passed).length;
  const timeout = results.some(r=>r.error && /timeout|time.*limit|canceling statement|maximum statement execution time|interrupted/i.test(r.error));
  process.send({ verdict: timeout ? 'Time Limit Exceeded' : results.some(r => r.error) ? 'Runtime Error' : passed === cases.length ? 'Accepted' : 'Wrong Answer', passed, total: cases.length, runtime: Math.round((performance.now() - started) * 100) / 100, results });
} catch (error) {
  process.send({ verdict: 'Runtime Error', passed: 0, total: cases.length, runtime: Math.round(performance.now() - started), results: [], error: error.message });
} finally { await native?.close(); }
