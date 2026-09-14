import { DatabaseSync } from 'node:sqlite';

export const quote = name => `"${name.replaceAll('"', '""')}"`;
const asDate = value => value === null ? null : new Date(String(value).includes('T') ? value : String(value).replace(' ', 'T') + (String(value).length === 10 ? 'T00:00:00Z' : 'Z'));

export function createDatabase(problem, input) {
  const db = new DatabaseSync(':memory:', { enableLoadExtension: false });
  db.exec('PRAGMA hard_heap_limit = 67108864; PRAGMA trusted_schema = OFF;');
  const scalar = (name, fn) => db.function(name, { deterministic: true }, fn);
  scalar('regexp', (pattern, value) => pattern === null || value === null ? null : Number(new RegExp(String(pattern), 'i').test(String(value))));
  scalar('regexp_like', (value, pattern) => value === null || pattern === null ? null : Number(new RegExp(String(pattern), 'i').test(String(value))));
  scalar('substring_index', (value, separator, count) => {
    if (value === null || separator === null || count === null) return null;
    if (!count || !separator) return '';
    const parts = String(value).split(String(separator));
    return (count > 0 ? parts.slice(0, count) : parts.slice(count)).join(separator);
  });
  scalar('year', value => value === null ? null : asDate(value).getUTCFullYear());
  scalar('month', value => value === null ? null : asDate(value).getUTCMonth() + 1);
  scalar('day_of_week', value => value === null ? null : asDate(value).getUTCDay() + 1);
  scalar('dayofweek', value => value === null ? null : asDate(value).getUTCDay() + 1);
  scalar('day_of_month', value => value === null ? null : asDate(value).getUTCDate());
  scalar('day', value => value === null ? null : asDate(value).getUTCDate());
  scalar('datediff', (a, b) => a === null || b === null ? null : Math.round((asDate(String(a).slice(0, 10)) - asDate(String(b).slice(0, 10))) / 86400000));
  scalar('regexp_replace', (value, pattern, replacement) => value === null ? null : String(value).replace(new RegExp(String(pattern), 'g'), String(replacement)));
  for (const table of problem.schema) {
    db.exec(`CREATE TABLE ${quote(table.name)} (${table.columns.map(c => `${quote(c.name)} ${c.type}`).join(', ')})`);
    const insert = db.prepare(`INSERT INTO ${quote(table.name)} VALUES (${table.columns.map(() => '?').join(', ')})`);
    for (const row of input[table.name]) insert.run(...row);
  }
  db.exec('PRAGMA query_only = ON;');
  return db;
}

export function execute(db, sql) {
  const statement = db.prepare(sql);
  statement.setReturnArrays(true);
  const result = { columns: statement.columns().map(c => c.name), rows: [] };
  for (const row of statement.iterate()) {
    if (result.rows.length >= 5000) throw new Error('Output is limited to 5,000 rows. Check for an unintended join.');
    result.rows.push(row);
  }
  return result;
}

export function referenceResult(problem, input) {
  const db = createDatabase(problem, input);
  try { return execute(db, problem.referenceSql); } finally { db.close(); }
}
