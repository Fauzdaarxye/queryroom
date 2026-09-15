import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {problems,publicProblem} from '../server/problems/index.mjs';
import {validateInput} from '../shared/input.mjs';
import {compareResult} from '../server/compare.mjs';
import {createNativeWorkspace,cleanupNative} from '../server/native-database.mjs';
import {playlistQuery} from './playlist-queries.mjs';
import {additionalQueries} from '../server/problems/additional-checkers.mjs';

const byNumber=number=>[...problems.values()].find(p=>p.number===number);
const edge=(number,index)=>byNumber(number).practiceCases.find(f=>f.id===`edge-${index}`);

test('every question has eight distinct new selectable edge cases with valid inputs and independent answers',()=>{
  let count=0;
  for(const p of problems.values()){
    const extra=p.submissionCases.filter(f=>f.id.startsWith('edge-'));
    assert.equal(extra.length,8,p.slug);
    assert.equal(new Set(p.submissionCases.map(f=>f.id)).size,p.submissionCases.length,p.slug);
    const inputs=new Set();
    for(const f of extra){
      count++;validateInput(p,f.input);
      assert.ok(p.practiceCases.some(c=>c.id===f.id));
      assert.ok(f.description.length>40&&f.name.length>=3,`${p.number}/${f.id}: missing case description`);
      const normalized=JSON.stringify(Object.fromEntries(Object.entries(f.input).sort().map(([name,rows])=>[name,rows.map(r=>JSON.stringify(r)).sort()])));
      assert.ok(!inputs.has(normalized),`${p.number}/${f.id} duplicates another new fixture`);inputs.add(normalized);
      assert.ok(f.expected.rows.length<=5000);
      assert.equal(compareResult(p,p.expected(f.input),f.expected).passed,true,`${p.number}/${f.id}`);
    }
    assert.ok(publicProblem(p).practiceCases.every(f=>f.expected===undefined));
  }
  assert.equal(count,632);
});

test('new tests honor problem-specific data constraints',()=>{
  for(const p of problems.values())for(const f of p.submissionCases.filter(f=>f.id.startsWith('edge-'))){
    const input=f.input;
    if(p.number===1767){
      const tasks=new Map(input.Tasks);for(const [,n] of input.Tasks)assert.ok(n>=2&&n<=20);
      for(const [id,n] of input.Executed)assert.ok(n>=1&&n<=tasks.get(id));
    }
    if(p.number===2010)assert.equal(new Set(input.Candidates.map(r=>r[2])).size,input.Candidates.length);
    if(p.number===2793)assert.equal(new Set(input.Passengers.map(r=>r[2])).size,input.Passengers.length);
    if(p.number===618){const n=c=>input.Student.filter(r=>r[1]===c).length;assert.ok(n('America')>=n('Asia')&&n('America')>=n('Europe'));}
    if(p.number===1204){for(const column of [0,3])assert.deepEqual(input.Queue.map(r=>r[column]).sort((a,b)=>a-b),Array.from({length:input.Queue.length},(_,i)=>i+1));assert.ok(input.Queue.find(r=>r[3]===1)[2]<=1000);}
    if(p.number===1709)assert.ok(input.UserVisits.every(r=>r[1]<='2021-01-01'));
    if(p.number===2994)assert.ok(input.Purchases.every(r=>r[1]>='2023-11-01'&&r[1]<='2023-11-30'));
    if([1919,1917].includes(p.number))assert.ok(input.Friendship.every(([a,b])=>a<b));
    if(p.number===1699)assert.ok(input.Calls.every(([a,b])=>a!==b));
    if(p.number===2238)assert.ok(input.Rides.every(([,a,b])=>a!==b));
    if(p.number===3268)assert.ok(input.EmployeeShifts.every(r=>r[1]<r[2]&&r[1].slice(0,10)===r[2].slice(0,10)));
    if(p.number===1336)assert.ok(input.Transactions.every(([id,date])=>input.Visits.some(r=>r[0]===id&&r[1]===date)));
    if(p.number===1393){for(const name of new Set(input.Stocks.map(r=>r[0]))){let balance=0;for(const r of input.Stocks.filter(r=>r[0]===name).sort((a,b)=>a[2]-b[2])){balance+=r[1]==='Buy'?1:-1;assert.ok(balance>=0);}assert.equal(balance,0);}}
    if([1635,1645,1651].includes(p.number))for(const [ride,driver] of input.AcceptedRides){const requested=input.Rides.find(r=>r[0]===ride);assert.ok(requested);assert.ok(input.Drivers.some(r=>r[0]===driver&&r[1]<=requested[2]));}
    if([1596,1532,1159,2752].includes(p.number)){
      const rows=input.Orders||input.Transactions;
      const keys=rows.map(r=>JSON.stringify(p.number===1596?[r[2],r[3],r[1]]:p.number===1532?[r[2],r[1]]:p.number===1159?[r[4],r[1]]:[r[1],r[2]]));
      assert.equal(new Set(keys).size,keys.length);
    }
  }
});

test('hand-calculated regressions cover checker corrections and strict boundaries',()=>{
  assert.deepEqual(edge(569,3).expected.rows,[[2,'Company 0',50]]);
  assert.deepEqual(byNumber(569).practiceCases.find(f=>f.id==='reordered').expected.rows.filter(r=>r[1]==='C'),[[14,'C',2645]]);
  assert.deepEqual(edge(1194,1).expected.rows.toSorted((a,b)=>a[0]-b[0]),[[1,1],[2,4],[3,7]]);
  assert.deepEqual(edge(1892,1).expected.rows,[]);
  assert.deepEqual(edge(3188,1).expected.rows,[[1]]);
  assert.deepEqual(edge(3188,6).expected.rows,[[1]]);
  assert.deepEqual(edge(3188,7).expected.rows,[]);
  assert.deepEqual(edge(3188,8).expected.rows,[]);
  assert.deepEqual(edge(3673,1).expected.rows,[]);
  assert.deepEqual(edge(3673,2).expected.rows,[['S3',7,30,5]]);
  assert.deepEqual(edge(3673,4).expected.rows,[]);
  assert.deepEqual(edge(3673,5).expected.rows,[['S3',7,40,6]]);
  assert.deepEqual(edge(3268,5).expected.rows,[[1,3,240]]);
  assert.deepEqual(edge(571,7).expected.rows,[[5]]);
  assert.deepEqual(edge(3060,1).expected.rows,[[1]]);
  assert.deepEqual(edge(3060,2).expected.rows,[]);
  assert.equal(edge(1459,6).expected.rows.length,4950);
});

// Every mutation must execute successfully and produce a wrong answer on a NEW
// fixture; a SQL syntax error does not count as catching an incorrect algorithm.
const mutations=[
  [569,5,q=>q.replace('ORDER BY salary,id','ORDER BY salary,id DESC')],
  [1194,1,q=>q.replace('LEFT JOIN scores','JOIN scores')],
  [2004,8,q=>q.replaceAll('ORDER BY salary,employee_id ROWS UNBOUNDED PRECEDING','ORDER BY salary')],
  [1892,1,q=>q.replace('JOIN Likes AS l','LEFT JOIN Likes AS l')],
  [3188,8,q=>q.replace('COUNT(DISTINCT c.course_id)','COUNT(c.course_id)')],
  [3673,1,q=>q.replace('>1800','>=1800')],
  [3673,4,q=>q.replace('<0.20','<=0.20')],
  [1412,3,q=>q.replace('score=lo OR score=hi','score=lo')],
  [2793,2,q=>q.replace('rn<=capacity','rn<capacity')],
  [1767,1,q=>q.replace('subtask_id > 1','subtask_id > 2')],
  [571,2,q=>q.replace('AVG(num*1.0)','MIN(num)')],
  [1919,3,q=>q.replace('COUNT(DISTINCT l1.song_id)','COUNT(l1.song_id)')],
  [1917,3,q=>q.replace('COUNT(DISTINCT l1.song_id)','COUNT(l1.song_id)')],
  [2752,5,q=>q.replace('ORDER BY customer_id','ORDER BY customer_id LIMIT 1')],
  [3384,1,q=>q.replaceAll("time_stamp<='45:00'","time_stamp<'45:00'")],
  [3060,1,q=>q.replace('<=43200','<43200')],
  [3832,1,q=>q.replace('COUNT(*)>=5','COUNT(*)>=4')],
  [1831,3,q=>q.replace('DENSE_RANK()','ROW_NUMBER()')],
  [1468,2,q=>q.replace('highest<1000','highest<=1000')],
  [1783,1,q=>q.replaceAll('UNION ALL','UNION')],
  [2041,2,q=>q.replace('SUM(r.score)>15','SUM(r.score)>=15')],
  [1867,3,q=>q.replace('maximum>','maximum>=')],
  [1077,3,q=>q.replace('DENSE_RANK()','ROW_NUMBER()')],
  [2238,3,q=>q.replace('SELECT DISTINCT driver_id','SELECT driver_id')],
  [1204,2,q=>q.replace('total<=1000','total<1000')],
  [1112,3,q=>q.replace('grade DESC,course_id','grade DESC,course_id DESC')],
  [1532,5,q=>q.replace('ranking<=3','ranking<=4')],
];
for(const engine of ['mysql','postgresql'])test(`${engine}: new edge cases reject common incorrect algorithms`,async()=>{
  const id=`qr_${randomBytes(12).toString('hex')}`,workspace=await createNativeWorkspace(engine,id,randomBytes(24).toString('hex'));
  try{
    for(const [number,index,mutate] of mutations){
      const p=byNumber(number),fixture=edge(number,index),query=p.playlist?playlistQuery(p,engine):additionalQueries[number];
      const wrong=mutate(query);assert.notEqual(wrong,query,`Mutation missing: ${number}`);
      await workspace.seed(p,fixture.input);
      const actual=await workspace.execute(wrong);
      assert.equal(compareResult(p,actual,fixture.expected).passed,false,`Uncaught ${engine}/${number}/${fixture.name}`);
    }
  }finally{await workspace.close();await cleanupNative(engine,id);}
});
