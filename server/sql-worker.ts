import { createDatabase, execute } from './database.mjs';
import { compareResult } from './compare.mjs';
import { performance } from 'node:perf_hooks';
import type { Problem, TestCase, Engine, CaseResult, ResultTable } from '../shared/types.ts';
import { checkStatement } from './check-statement.mjs';
import { createNativeWorkspace } from './native-database.mjs';

const { problem, sql, cases, engine, workspace, password } = await new Promise<{problem: Problem; sql: string; cases: TestCase[]; engine: Engine | 'sqlite'; workspace: string; password: string}>(resolve => process.once('message', resolve));
const results: CaseResult[] = [];
let outputBytes = 0;
const started = performance.now();
let native;
try {
  checkStatement(sql, engine);
  if (engine !== 'sqlite') native = await createNativeWorkspace(engine, workspace, password);
  for (const test of cases) {
    let expected = test.expected;
    const db = native ? null : createDatabase(problem, test.input);
    let actual: ResultTable = { columns: [], rows: [] };
    let error = null;
    const start = performance.now();
    try {
      if (native) await native.seed(problem, test.input);
      if (!expected) {
        const reference = problem.references[engine === 'sqlite' ? 'mysql' : engine];
        checkStatement(reference, engine);
        expected = native ? await native.execute(reference) : execute(db, reference);
      }
      actual = native ? await native.execute(sql) : execute(db, sql);
    } catch (err: any) { error = err.message; }
    finally { db?.close(); }
    outputBytes += Buffer.byteLength(JSON.stringify(actual));
    if (outputBytes > 4 * 1024 * 1024) {
      error = 'Output is limited to 4 MB across all tests. Select fewer or smaller values.';
      actual = { columns: [], rows: [] };
    }
    expected ||= { columns: [], rows: [] };
    const comparison = error ? { passed: false, reason: error } : compareResult(problem, actual, expected);
    const { passed, reason } = comparison;
    results.push({ ...test, expected, actual, passed, error, reason, runtime: Math.round((performance.now() - start) * 100) / 100 });
    if (error && /timeout|time.*limit|canceling statement|maximum statement execution time|interrupted|Output is limited/i.test(error)) break;
  }
  const passed = results.filter(r => r.passed).length;
  const timeout = results.some(r=>r.error && /timeout|time.*limit|canceling statement|maximum statement execution time|interrupted/i.test(r.error));
  process.send!({ verdict: timeout ? 'Time Limit Exceeded' : results.some(r => r.error) ? 'Runtime Error' : passed === cases.length ? 'Accepted' : 'Wrong Answer', passed, total: cases.length, runtime: Math.round((performance.now() - started) * 100) / 100, results });
} catch (error: any) {
  process.send!({ verdict: 'Runtime Error', passed: 0, total: cases.length, runtime: Math.round(performance.now() - started), results: [], error: error.message });
} finally { await native?.close(); }
