import test from 'node:test';
import assert from 'node:assert/strict';
import { problems, publicProblem } from '../server/problems/index.mjs';
import { validateInput, runQuery as internalRunQuery } from '../server/runner.mjs';
import { compareResult } from '../server/compare.mjs';
import { referenceResult } from '../server/database.mjs';

const runQuery = args => internalRunQuery({...args,engine:'sqlite'});
const playlist=[...problems.values()].filter(p=>p.playlist);
test('every observed playlist video maps to a complete, unique question',()=>{
  assert.equal(problems.size,79);
  assert.equal(playlist.length,53);
  assert.equal(playlist.reduce((n,p)=>n+p.videos.length,0),54);
  assert.equal(playlist.find(p=>p.number===1767).videos.length,2);
  assert.deepEqual(playlist.flatMap(p=>p.videos.map(v=>v.playlistIndex)).sort((a,b)=>a-b),Array.from({length:54},(_,i)=>i+1));
  for (const p of playlist) {
    assert.ok(p.statementHtml.length>100);
    assert.ok(p.practiceCases.length>=4);
    assert.ok(p.schema.length>=1);
    assert.equal(publicProblem(p).referenceSql,undefined);
    assert.equal(publicProblem(p).expected,undefined);
    assert.equal(publicProblem(p).submissionCases,undefined);
    assert.ok(!p.statementHtml.includes('<!-- solution:'));
    for (const fixture of p.submissionCases) validateInput(p,fixture.input);
  }
});
for (const p of playlist) {
  test(`#${p.number}: published examples and local cases run through the real SQL runner`,async()=>{
    const result=await runQuery({slug:p.slug,sql:p.referenceSql,mode:'submit'});
    assert.equal(result.verdict,'Accepted',JSON.stringify(result.results.filter(r=>!r.passed)));
    assert.equal(result.passed,p.submissionCases.length);
  });
}
test('order-free questions allow permutations while preserving duplicate counts',()=>{
  const p={orderMatters:false};
  const expected={columns:['user_id'],rows:[[1],[1],[2]]};
  assert.equal(compareResult(p,{columns:['user_id'],rows:[[2],[1],[1]]},expected).passed,true);
  assert.equal(compareResult(p,{columns:['user_id'],rows:[[2],[2],[1]]},expected).passed,false);
});
test('sort keys reject incorrect order and allow unspecified order within a tie',()=>{
  const p={orderMatters:true,orderBy:[{column:'score',direction:'desc'}]};
  const expected={columns:['name','score'],rows:[['A',3],['B',3],['C',2]]};
  assert.equal(compareResult(p,{columns:['name','score'],rows:[['B',3],['A',3],['C',2]]},expected).passed,true);
  assert.equal(compareResult(p,{columns:['name','score'],rows:[['C',2],['A',3],['B',3]]},expected).passed,false);
});
test('text, decimals, nulls, dates and composite keys are accepted or rejected appropriately',()=>{
  const p={slug:'sample',schema:[{name:'Data',primaryKey:['id','day'],columns:[{name:'id',type:'INTEGER'},{name:'day',type:'TEXT',displayType:'date'},{name:'value',type:'REAL'},{name:'note',type:'TEXT'}]}]};
  validateInput(p,{Data:[[1,'2026-01-01',2.5,null],[1,'2026-01-02',3,'note']]});
  assert.throws(()=>validateInput(p,{Data:[[1,'2026-01-01',2,null],[1,'2026-01-01',3,null]]}),/unique/);
  assert.throws(()=>validateInput(p,{Data:[[1,'yesterday',2,null]]}),/date/);
  assert.throws(()=>validateInput(p,{Data:[[1,'2026-01-01','2',null]]}),/number/);
});
test('salary budgets handle equal salaries one candidate at a time',()=>{
  const p=playlist.find(p=>p.number===2004);
  const actual=referenceResult(p,{Candidates:[[1,'Senior',30000],[2,'Senior',30000],[3,'Senior',30000],[4,'Junior',5000],[5,'Junior',5000]]});
  assert.equal(compareResult(p,actual,{columns:['experience','accepted_candidates'],rows:[['Senior',2],['Junior',2]]}).passed,true);
});
test('keyword matching is case-insensitive, uses whole words and sorts topic IDs',()=>{
  const p=playlist.find(p=>p.number===2199);
  const actual=referenceResult(p,{Keywords:[[3,'WAR'],[1,'war'],[2,'vaccine']],Posts:[[1,'war and vaccine'],[2,'warning']]});
  assert.deepEqual(actual.rows,[[1,'1,2,3'],[2,'Ambiguous!']]);
});
test('capitalization preserves leading, trailing and repeated spaces',()=>{
  const p=playlist.find(p=>p.number===3368);
  assert.deepEqual(referenceResult(p,{user_content:[[1,'  hELLO   wORLD  ']]}).rows,[[1,'  hELLO   wORLD  ','  Hello   World  ']]);
});
test('a non-repeating study sequence is not accepted as a spiral',()=>{
  const p=playlist.find(p=>p.number===3617);
  const input={students:[[1,'Ada','Science']],study_sessions:[[1,1,'Math','2025-01-01',2],[2,1,'Physics','2025-01-02',2],[3,1,'Art','2025-01-03',2],[4,1,'Art','2025-01-04',2],[5,1,'Math','2025-01-05',2],[6,1,'Physics','2025-01-06',2]]};
  assert.deepEqual(referenceResult(p,input).rows,[]);
});
