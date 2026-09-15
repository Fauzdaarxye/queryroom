import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { runQuery } from '../server/runner.mjs';
import { problems } from '../server/problems/index.mjs';
import { createNativeWorkspace, cleanupNative } from '../server/native-database.mjs';
import { adminConnection, engineStatus } from '../server/engines.mjs';

const solution = `SELECT a.id AS p1,b.id AS p2,ABS((a.x_value-b.x_value)*(a.y_value-b.y_value)) AS area FROM Points a JOIN Points b ON a.id<b.id WHERE a.x_value<>b.x_value AND a.y_value<>b.y_value ORDER BY area DESC,p1,p2`;
const slug = 'rectangles-area';

test('both real database servers are available', async()=>{
  const status = await engineStatus();
  assert.deepEqual(status.map(e=>[e.id,e.available]),[['mysql',true],['postgresql',true]]);
});

for (const engine of ['mysql','postgresql']) {
  test(`${engine}: a correct solution passes all 36 tests, including large areas`,async()=>{
    const result = await runQuery({slug,sql:solution,mode:'submit',engine});
    assert.equal(result.verdict,'Accepted',JSON.stringify(result));
    assert.equal(result.passed,36);
    assert.equal(result.engine,engine);
  });
  test(`${engine}: custom data, wrong answers, and native SQL functions`,async()=>{
    const custom = await runQuery({slug,sql:solution,engine,customInput:{Points:[[9,-2,3],[1,3,-4]]}});
    assert.equal(custom.verdict,'Accepted');
    const wrong = await runQuery({slug,sql:solution.replace('area DESC','area ASC'),engine});
    assert.equal(wrong.verdict,'Wrong Answer');
    const sql = engine==='mysql' ? "# MySQL comment\nSELECT DATE_FORMAT('2026-09-13','%Y-%m-%d') AS day, GROUP_CONCAT(id ORDER BY id SEPARATOR ':') AS ids FROM Points" : "SELECT to_char(DATE '2026-09-13','YYYY-MM-DD') AS day, string_agg(id::text,':' ORDER BY id) AS ids FROM Points";
    const result = await runQuery({slug,engine,sql});
    assert.equal(result.results[0].error,null);
    assert.deepEqual(result.results[0].actual.rows,[['2026-09-13','1:2:3']]);
  });
  test(`${engine}: multi-table and date questions accept window queries`,async()=>{
    const p=[...problems.values()].find(p=>p.number===1369);
    const sql='WITH ranked AS (SELECT *, ROW_NUMBER() OVER (PARTITION BY username ORDER BY startDate DESC) AS rn, COUNT(*) OVER (PARTITION BY username) AS cnt FROM UserActivity) SELECT username,activity,startDate,endDate FROM ranked WHERE rn=2 OR cnt=1';
    const result=await runQuery({slug:p.slug,engine,sql,mode:'submit'});
    assert.equal(result.verdict,'Accepted',JSON.stringify(result));
    const sales=[...problems.values()].find(p=>p.number===1479);
    const days=['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
    const day=engine==='mysql'?'WEEKDAY(o.order_date)+1':'EXTRACT(ISODOW FROM o.order_date)';
    const pivot=`SELECT i.item_category AS Category, ${days.map((name,i)=>`SUM(CASE WHEN ${day}=${i+1} THEN o.quantity ELSE 0 END) AS ${name}`).join(', ')} FROM Items i LEFT JOIN Orders o ON i.item_id=o.item_id GROUP BY i.item_category ORDER BY Category`;
    const joined=await runQuery({slug:sales.slug,engine,sql:pivot,mode:'submit'});
    assert.equal(joined.verdict,'Accepted',JSON.stringify(joined));
  });
  test(`${engine}: dates, timestamps, decimal precision and nulls retain their values`,async()=>{
    const id=`qr_${randomBytes(12).toString('hex')}`;
    const workspace=await createNativeWorkspace(engine,id,randomBytes(24).toString('hex'));
    try {
      const schema=[{name:'Data',columns:[{name:'day',type:'TEXT',displayType:'date'},{name:'moment',type:'TEXT',displayType:'datetime'},{name:'amount',type:'REAL',displayType:'decimal'},{name:'note',type:'TEXT'}]}];
      await workspace.seed({schema},{Data:[['2026-09-13','2026-09-13 03:45:00',12.375,null]]});
      const result=await workspace.execute('SELECT day,moment,ROUND(amount,2) AS amount,note FROM Data');
      assert.deepEqual(result.rows.map(row=>[row[0],row[1],Number(row[2]),row[3]]),[['2026-09-13','2026-09-13 03:45:00',12.38,null]]);
    } finally {await workspace.close();await cleanupNative(engine,id);}
  });
  test(`${engine}: all registered fixtures load with native types and readable tables`,async()=>{
    const id=`qr_${randomBytes(12).toString('hex')}`;
    const workspace=await createNativeWorkspace(engine,id,randomBytes(24).toString('hex'));
    try {
      for(const p of problems.values()) for(const fixture of p.submissionCases){
        await workspace.seed(p,fixture.input);
        const query=p.schema.map(t=>`SELECT COUNT(*) AS n FROM ${engine==='mysql'?'`'+t.name+'`':'"'+t.name.toLowerCase()+'"'}`).join(' UNION ALL ');
        const result=await workspace.execute(query);
        assert.deepEqual(result.rows.map(row=>Number(row[0])),p.schema.map(t=>fixture.input[t.name].length),`${p.number}/${fixture.id}`);
      }
    } finally {await workspace.close();await cleanupNative(engine,id);}
  });
  test(`${engine}: query role blocks writes, stacked statements, and file access`,async()=>{
    const forbidden=['DELETE FROM Points','SELECT 1; DELETE FROM Points','WITH x AS (SELECT 1) DELETE FROM Points'];
    if(engine==='mysql') forbidden.push("SELECT * FROM Points INTO OUTFILE '/private/tmp/queryroom-must-not-create'");
    else forbidden.push("SELECT pg_read_file('/etc/passwd')",'WITH deleted AS (DELETE FROM Points RETURNING *) SELECT * FROM deleted');
    for(const sql of forbidden){
      const result=await runQuery({slug,sql,engine});
      assert.equal(result.verdict,'Runtime Error',sql);
    }
    const fresh=await runQuery({slug,sql:solution,engine});
    assert.equal(fresh.verdict,'Accepted');
  });
  test(`${engine}: statement timeout cancels the database query`,async()=>{
    const start=Date.now();
    const result=await runQuery({slug,engine,sql:engine==='mysql'?'SELECT SLEEP(10)':'SELECT pg_sleep(10)'});
    assert.equal(result.verdict,'Time Limit Exceeded',JSON.stringify(result));
    assert.ok(Date.now()-start<6500);
    const admin=await adminConnection(engine);
    try {
      const result=engine==='mysql' ? (await admin.query("SELECT ID FROM information_schema.PROCESSLIST WHERE INFO LIKE '%SLEEP(10)%' AND USER <> 'root'"))[0] : (await admin.query("SELECT pid FROM pg_stat_activity WHERE query LIKE '%pg_sleep(10)%' AND usename <> 'queryroom_admin'")).rows;
      assert.equal(result.length,0);
    } finally {await admin.end();}
  });
  test(`${engine}: oversized values and cumulative submission output are bounded`, async () => {
    const huge = await runQuery({ slug, engine, sql: "SELECT REPEAT('x', 1100000) AS value", mode: 'submit' });
    assert.equal(huge.verdict, 'Runtime Error');
    assert.equal(huge.results.length, 1, 'stop submitting after an output limit');
    assert.match(huge.results[0].error, /1 MB/);
    const cumulative = await runQuery({ slug, engine, sql: "SELECT REPEAT('x', 300000) AS value", mode: 'submit' });
    assert.equal(cumulative.verdict, 'Runtime Error');
    assert.ok(cumulative.results.length < cumulative.total);
    assert.match(cumulative.results.at(-1).error, /4 MB/);
    assert.deepEqual(cumulative.results.at(-1).actual.rows, []);
    assert.equal((await runQuery({ slug, engine, sql: solution })).verdict, 'Accepted');
  });
  test(`${engine}: result size is limited without crashing the runner`,async()=>{
    const sql=engine==='mysql'?'SELECT a.id FROM Points a CROSS JOIN Points b CROSS JOIN Points c CROSS JOIN Points d CROSS JOIN Points e CROSS JOIN Points f CROSS JOIN Points g CROSS JOIN Points h':'SELECT generate_series(1,6000) AS id';
    const result=await runQuery({slug,engine,sql});
    assert.equal(result.verdict,'Runtime Error');
    assert.match(result.results[0].error,/5,000/);
  });
}
