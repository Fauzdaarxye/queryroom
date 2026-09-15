import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';
import { randomBytes, randomUUID } from 'node:crypto';
import { createAccountStore } from '../server/account-store.mjs';
import { createAccountApi } from '../server/account-api.mjs';
import { createQueryApi } from '../server/query-api.mjs';
import { createGoogleAuth } from '../server/google-auth.mjs';
import { engineConfig, adminConnection } from '../server/engines.mjs';
import { problems } from '../server/problems/index.mjs';
import { runQuery } from '../server/runner.mjs';
import { backfillLeaderboard } from '../server/leaderboard-backfill.mjs';
import { verifiedPoints, readLeaderboardOptions, leaderboardQuery } from '../shared/leaderboard.mjs';
import { resolvePage } from '../shared/navigation.mjs';

const medium = problems.get('rectangles-area');
const hard = [...problems.values()].find(p => p.difficulty === 'Hard');
const full = (problem, engine = 'postgresql') => ({ id: randomUUID(), date: new Date().toISOString(), sql: 'SELECT 1',
  verdict: 'Accepted', engine, passed: problem.submissionCases.length, total: problem.submissionCases.length, runtime: 1 });
const solution = `SELECT a.id AS p1, b.id AS p2, ABS(CAST(a.x_value AS BIGINT)-b.x_value) * ABS(CAST(a.y_value AS BIGINT)-b.y_value) AS area
FROM Points a JOIN Points b ON a.id < b.id
WHERE a.x_value <> b.x_value AND a.y_value <> b.y_value ORDER BY area DESC, p1, p2`;
const mysqlSolution = solution.replaceAll('AS BIGINT', 'AS SIGNED');
async function fixture() {
  const schema = `qr_ranks_${randomBytes(8).toString('hex')}`;
  const config = (await engineConfig()).postgresql;
  const store = await createAccountStore({ config, schema });
  const admin = await adminConnection('postgresql');
  return { store, schema, config, async user(username, complete = true) {
    const u = await store.upsertGoogleUser({ sub: randomUUID(), email: `${username}@example.invalid`, name: 'Private test name' });
    return complete ? store.saveProfile(u.id, { username, fullName: 'Private test name', age: 22, profession: 'Private occupation' }) : u;
  }, async close() { await store.close(); await admin.query(`DROP SCHEMA "${schema}" CASCADE`); await admin.end(); } };
}

test('scoring requires every test and leaderboard URLs preserve global navigation', () => {
  for (const [difficulty, expected] of [['Easy',10],['Medium',25],['Hard',50]]) {
    const p = { ...medium, difficulty };
    assert.equal(verifiedPoints(p,full(p)), expected);
  }
  for (const patch of [{passed:1}, {total:1}, {engine:'sqlite'}, {verdict:'Wrong Answer'}]) assert.equal(verifiedPoints(medium,{...full(medium),...patch}),0);
  const opts = {search:'some_name',page:2};
  assert.deepEqual(readLeaderboardOptions(leaderboardQuery(opts)),opts);
  assert.deepEqual(readLeaderboardOptions('?page=-20'),{search:'',page:1});
  assert.equal(resolvePage('/leaderboard',null),'leaderboard');
  assert.equal(resolvePage('/leaderboard',{profileComplete:false}),'onboarding');
});

test('unique verified awards produce shared global ranks, stable pagination and private fields', {timeout:30000}, async () => {
  const f = await fixture();
  try {
    const [alpha,bravo,charlie,delta,zero] = await Promise.all(['alpha','bravo','charlie','delta','zero'].map(n=>f.user(n)));
    for (let i=0;i<12;i++) await f.user(`learner_${String(i).padStart(2,'0')}`);
    await f.user('unfinished',false);
    assert.equal((await f.store.leaderboard()).totalUsers,17);
    for (const [u,p] of [[alpha,medium],[alpha,hard],[bravo,hard],[delta,medium]]) await f.store.recordSubmission(u.id,p,full(p));
    const concurrent = await Promise.all(Array.from({length:12},(_,i)=>f.store.recordSubmission(charlie.id,hard,full(hard,i%2?'mysql':'postgresql'))));
    assert.equal(concurrent.reduce((n,r)=>n+r.pointsEarned,0),50,'concurrent and cross-engine solves earn points once');
    await f.store.patchProgress(alpha.id,medium.slug,{solved:false});
    await f.store.importGuest(zero.id,{[hard.slug]:{draft:'SELECT 1',notes:'private',solved:true,bookmarked:true,submissions:[full(hard)]}});
    const first = await f.store.leaderboard({userId:alpha.id});
    assert.deepEqual(first.entries.slice(0,4).map(r=>[r.username,r.points,r.rank]),[['alpha',75,1],['bravo',50,2],['charlie',50,2],['delta',25,4]]);
    assert.deepEqual([first.page,first.pages,first.entries.length],[1,2,10]);
    assert.equal(first.entries[4].rank,5);
    assert.equal(first.currentUser.points,75,'manual unmarking does not erase an award');
    const second = await f.store.leaderboard({page:2,userId:alpha.id});
    assert.equal(second.entries.length,7);assert.equal(second.currentUser.rank,1);
    assert.equal(new Set([...first.entries,...second.entries].map(r=>r.username)).size,17);
    const searched = await f.store.leaderboard({search:'CHAR',page:999,userId:alpha.id});
    assert.equal(searched.page,1);assert.equal(searched.entries[0].rank,2,'search must not recompute rank');
    assert.equal(searched.currentUser.username,'alpha');
    assert.equal((await f.store.leaderboard({search:'%'})).totalResults,0,'search is literal');
    assert.equal((await f.store.leaderboard({search:'zero'})).entries[0].points,0,'imported accepted labels are not proof');
    assert.deepEqual(Object.keys(first.entries[0]).sort(),['easy','hard','isYou','medium','points','rank','solved','username']);
    for (const privateValue of ['example.invalid','Private test name','Private occupation',alpha.id]) assert.ok(!JSON.stringify(first).includes(privateValue));
    await f.store.saveProfile(alpha.id,{username:'alpha_new',fullName:'Private test name',age:23,profession:'Private occupation'});
    const reopened = await createAccountStore({config:f.config,schema:f.schema});
    try { const row = (await reopened.leaderboard({search:'alpha_new'})).entries[0];assert.equal(row.rank,1);assert.equal(row.points,75); } finally { await reopened.close(); }
  } finally { await f.close(); }
});

test('real HTTP submissions award only the signed-in solver after all native tests pass', {timeout:60000}, async () => {
  const f=await fixture();let server;
  try {
    const user=await f.user('http_solver'), other=await f.user('other_solver');
    const signed=await f.store.createSession(user.id);
    const json=(res,value,status=200)=>{res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(value));};
    const body=async req=>{const parts=[];for await(const part of req)parts.push(part);return JSON.parse(Buffer.concat(parts).toString()||'{}');};
    let accountApi,queryApi,base;
    server=http.createServer(async(req,res)=>{try {const url=new URL(req.url,base);if(await accountApi(req,res,url)||await queryApi(req,res,url))return;json(res,{error:'Not found'},404);}catch(e){json(res,{error:e.message},e.status||400);}}).listen(0,'127.0.0.1');
    await once(server,'listening');base=`http://127.0.0.1:${server.address().port}`;
    const auth=createGoogleAuth({store:f.store,config:{enabled:false,secure:false,origin:base}});
    accountApi=createAccountApi({auth,store:f.store,problems,json,body,hosted:false});
    queryApi=createQueryApi({auth,store:f.store,problems,json,body});
    const request=(path,{method='GET',data,guest=false,headers={}}={})=>fetch(base+path,{method,headers:{'Content-Type':'application/json',Origin:base,...(!guest?{Cookie:`queryroom_session=${signed.token}`,'X-Queryroom-Account':user.id,'X-Queryroom-CSRF':signed.csrfToken}:{}),...headers},...(data===undefined?{}:{body:JSON.stringify(data)})});
    const query=data=>request('/api/query',{method:'POST',data:{slug:medium.slug,engine:'postgresql',sql:solution,mode:'submit',...data}});
    const run=await(await query({mode:'run'})).json();assert.equal(run.verdict,'Accepted');assert.equal(run.pointsEarned,undefined);
    assert.equal((await f.store.leaderboard({userId:user.id})).currentUser.points,0);
    const wrong=await(await query({sql:'SELECT 1',verdict:'Accepted',passed:36,total:36,points:99999})).json();
    assert.equal(wrong.pointsEarned,0);assert.notEqual(wrong.verdict,'Accepted');
    const accepted=await(await query({difficulty:'Hard',points:99999,userId:other.id})).json();
    assert.equal(accepted.verdict,'Accepted');assert.equal(accepted.pointsEarned,25);assert.equal(accepted.progress.solved,true);
    assert.equal((await f.store.leaderboard({userId:other.id})).currentUser.points,0);
    const repeat=await(await query({engine:'mysql',sql:mysqlSolution})).json();assert.equal(repeat.verdict,'Accepted');assert.equal(repeat.pointsEarned,0);
    const guest=await(await request('/api/query',{guest:true,method:'POST',data:{slug:medium.slug,engine:'postgresql',sql:solution,mode:'submit'}})).json();assert.equal(guest.verdict,'Accepted');assert.equal(guest.pointsEarned,undefined);
    assert.equal((await query({engine:'sqlite'})).status,400);
    assert.equal((await request('/api/query',{method:'POST',headers:{'X-Queryroom-CSRF':'wrong'},data:{slug:medium.slug,sql:solution,mode:'submit'}})).status,403);
    assert.equal((await request(`/api/progress/${medium.slug}`,{method:'PATCH',data:{points:1000,verified:true}})).status,400);
    assert.equal((await request('/api/leaderboard',{method:'POST',data:{points:1000}})).status,404);
    assert.equal((await request('/api/leaderboard',{headers:{'X-Queryroom-Account':other.id}})).status,409);
    const publicBoard=await(await request('/api/leaderboard',{guest:true})).json();assert.equal(publicBoard.currentUser,null);assert.equal(publicBoard.entries[0].points,25);
    assert.ok(publicBoard.entries.every(r=>!r.isYou));
    const ownBoard=await(await request('/api/leaderboard?q=other',{guest:false})).json();assert.equal(ownBoard.currentUser.points,25);assert.equal(ownBoard.entries[0].rank,2);
  } finally {if(server)await new Promise(resolve=>server.close(resolve));await f.close();}
});

test('old accepted history is re-executed before credit and backfill is idempotent', {timeout:30000}, async()=>{
  const f=await fixture();
  try {
    const [valid,invalid]=await Promise.all([f.user('older_valid'),f.user('older_invalid')]);
    for(const [u,sql]of[[valid,solution],[invalid,'SELECT 1']])await f.store.importGuest(u.id,{[medium.slug]:{draft:sql,notes:'',solved:true,bookmarked:false,submissions:[{...full(medium),sql}]}});
    assert.equal((await f.store.leaderboard()).entries[0].points,0);
    const result=await backfillLeaderboard({store:f.store,problems,runQuery});
    assert.deepEqual(result,{credited:1,points:25,unverified:1});
    assert.equal((await f.store.leaderboard({userId:valid.id})).currentUser.points,25);
    assert.equal((await f.store.leaderboard({userId:invalid.id})).currentUser.points,0);
    assert.deepEqual(await backfillLeaderboard({store:f.store,problems,runQuery}),{credited:0,points:0,unverified:1});
  } finally {await f.close();}
});
