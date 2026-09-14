import mysql from 'mysql2/promise';
import pg from 'pg';
import { adminConnection, engineConfig } from './engines.mjs';
import { engineMode } from './engine-settings.mjs';

const q = (engine, name) => engine === 'mysql' ? '`' + name.replaceAll('`', '``') + '`' : '"' + name.replaceAll('"', '""') + '"';
const checked = name => { if (!/^qr_[a-f0-9]{24}$/.test(name)) throw new Error('Invalid practice workspace.'); return name; };
const mysqlUserHost = () => engineMode()==='external' ? '%' : 'localhost';
function columnType(column, engine) {
  const type = column.displayType?.toLowerCase();
  if (type === 'date') return 'DATE';
  if (type === 'datetime') return engine === 'mysql' ? 'DATETIME' : 'TIMESTAMP';
  if (column.type === 'INTEGER') return 'BIGINT';
  if (column.type === 'REAL') return 'DECIMAL(30,10)';
  return 'TEXT';
}

export async function cleanupNative(engine, name) {
  checked(name);
  const admin = await adminConnection(engine);
  try {
    if (engine === 'mysql') {
      const [sessions] = await admin.query('SELECT ID FROM information_schema.PROCESSLIST WHERE USER = ?', [name]);
      for (const row of sessions) await admin.query(`KILL CONNECTION ${Number(row.ID)}`).catch(()=>{});
      await admin.query(`DROP DATABASE IF EXISTS ${q(engine,name)}`);
      await admin.query(`DROP USER IF EXISTS '${name}'@'${mysqlUserHost()}'`);
    } else {
      await admin.query('SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE usename = $1', [name]);
      await admin.query(`DROP SCHEMA IF EXISTS ${q(engine,name)} CASCADE`);
      await admin.query(`DROP ROLE IF EXISTS ${q(engine,name)}`);
    }
  } finally { await admin.end(); }
}

export async function createNativeWorkspace(engine, name, password) {
  checked(name);
  const admin = await adminConnection(engine);
  const config = (await engineConfig())[engine];
  if (engine === 'mysql') {
    await admin.query(`CREATE DATABASE ${q(engine,name)} CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci`);
    await admin.query(`CREATE USER '${name}'@'${mysqlUserHost()}' IDENTIFIED BY ?`, [password]);
    await admin.query(`GRANT SELECT ON ${q(engine,name)}.* TO '${name}'@'${mysqlUserHost()}'`);
  } else {
    await admin.query(`CREATE ROLE ${q(engine,name)} LOGIN PASSWORD '${password}' NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT CONNECTION LIMIT 1`);
    await admin.query(`CREATE SCHEMA ${q(engine,name)}`);
    await admin.query(`GRANT USAGE ON SCHEMA ${q(engine,name)} TO ${q(engine,name)}`);
  }
  return {
    async seed(problem, input) {
      for (const table of problem.schema) {
        // PostgreSQL folds unquoted identifiers to lowercase; MySQL retains the published spelling.
        const tableName = engine === 'postgresql' ? table.name.toLowerCase() : table.name;
        const qualified = `${q(engine,name)}.${q(engine,tableName)}`;
        await admin.query(`DROP TABLE IF EXISTS ${qualified}`);
        await admin.query(`CREATE TABLE ${qualified} (${table.columns.map(c=>`${q(engine,engine==='postgresql'?c.name.toLowerCase():c.name)} ${columnType(c,engine)}`).join(', ')})`);
        const rows = input[table.name];
        if (rows.length) {
          let index = 0;
          const placeholders = rows.map(row=>'('+row.map(()=>engine==='mysql'?'?':`$${++index}`).join(',')+')').join(',');
          await admin.query(`INSERT INTO ${qualified} VALUES ${placeholders}`, rows.flat());
        }
        if (engine === 'postgresql') await admin.query(`GRANT SELECT ON ${qualified} TO ${q(engine,name)}`);
      }
    },
    async execute(sql) {
      let reader;
      if (engine === 'mysql') {
        reader = await mysql.createConnection({...config, user:name, password, database:name, rowsAsArray:true});
        await reader.query('SET SESSION max_execution_time = 3000');
        await reader.query('START TRANSACTION READ ONLY');
      } else {
        // Preserve SQL date/timestamp values instead of converting them through the browser's timezone.
        const types = { getTypeParser(oid, format) { return [1082,1114,1184].includes(oid) ? value=>value : pg.types.getTypeParser(oid,format); } };
        reader = new pg.Client({...config, user:name, password, types, statement_timeout:3000, application_name:'queryroom-practice'});
        await reader.connect();
        await reader.query(`SET search_path TO ${q(engine,name)}, pg_catalog`);
        await reader.query('BEGIN READ ONLY');
      }
      try {
        return await new Promise((resolve,reject)=>{
          const result = {columns:[],rows:[]};
          const began = performance.now();
          let finished = false;
          const finish = (error) => {
            if (finished) return;
            finished = true;
            clearTimeout(timer);
            if (error) reject(error); else resolve(result);
          };
          const cancel = async error => {
            finish(error);
            if (engine === 'mysql') { reader.destroy(); }
            else await admin.query('SELECT pg_terminate_backend($1)', [reader.processID]).catch(()=>{});
          };
          const timer = setTimeout(()=>cancel(new Error('Your query exceeded the 3-second time limit.')), 3000);
          const stream = engine === 'mysql' ? reader.connection.query(sql) : reader.query(new pg.Query({text:sql,rowMode:'array',queryMode:'extended'}));
          stream.on(engine === 'mysql' ? 'result' : 'row', row=>{
            if (finished) return;
            if (result.rows.length >= 5000) { void cancel(new Error('Output is limited to 5,000 rows. Check for an unintended join.')); return; }
            result.rows.push(row);
          });
          if (engine === 'mysql') stream.on('fields', fields=>{result.columns=fields.map(f=>f.name);});
          stream.on('error', finish);
          stream.on('end', data=>{
            if(engine==='postgresql') result.columns=data.fields.map(f=>f.name);
            // MySQL SLEEP() returns 1 when the server interrupts it instead of raising an error.
            finish(performance.now()-began >= 3000 ? new Error('Your query exceeded the 3-second time limit.') : null);
          });
        });
      } finally { await reader.end().catch(()=>{}); }
    },
    async close() { await admin.end(); },
  };
}
