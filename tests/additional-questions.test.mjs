import test from 'node:test';
import assert from 'node:assert/strict';
import { problems, publicProblem } from '../server/problems/index.mjs';
import { additionalProblems } from '../server/problems/additional.mjs';
import { additionalQueries } from '../server/problems/additional-checkers.mjs';
import { runQuery, validateInput } from '../server/runner.mjs';
import { compareResult } from '../server/compare.mjs';

const requested = ['apples-oranges','drop-type-1-orders-for-customers-with-type-0-orders','capital-gainloss','grand-slam-titles','running-total-for-different-genders','find-the-start-and-end-number-of-continuous-ranges','all-people-report-to-the-given-manager','number-of-calls-between-two-persons','account-balance','the-most-frequently-ordered-products-for-each-customer'];

test('all ten requested URLs have complete questions, examples and six selectable tests',()=>{
  assert.deepEqual(additionalProblems.map(p=>p.slug),requested);
  assert.equal(problems.size,64);
  assert.equal([...problems.values()].reduce((sum,p)=>sum+p.submissionCases.length,0),310);
  for(const p of additionalProblems){
    assert.equal(p.source,`https://leetcode.com/problems/${p.slug}/description/`);
    assert.equal(p.difficulty,'Medium');
    assert.equal(p.practiceCases.length,6);
    assert.equal(p.collection,'Added questions');
    assert.ok(p.statementHtml.includes('Example 1:'));
    assert.equal(p.videos,undefined);
    assert.equal(publicProblem(p).referenceSql,undefined);
    assert.equal(publicProblem(p).expected,undefined);
    assert.ok(publicProblem(p).practiceCases.every(f=>f.expected===undefined));
    for(const fixture of p.practiceCases) validateInput(p,fixture.input);
    assert.equal(compareResult(p,p.expected(p.example.input),p.example.output).passed,true);
  }
});

for(const p of additionalProblems) for(const engine of ['mysql','postgresql','sqlite']){
  test(`#${p.number}: ${engine} passes the example and all edge cases`,async()=>{
    const result=await runQuery({slug:p.slug,engine,sql:additionalQueries[p.number],mode:'submit'});
    assert.equal(result.verdict,'Accepted',JSON.stringify(result));
    assert.equal(result.passed,6);
  });
}

const edge = (id,fixture) => {
  const p=additionalProblems.find(p=>p.number===id);
  return p.expected(p.practiceCases.find(f=>f.id===fixture).input).rows;
};
test('new checkers handle signs, independent groups, duplicate counts, ties and hierarchy depth',()=>{
  assert.deepEqual(edge(1445,'oranges-lead'),[['2024-02-01',-9]]);
  assert.deepEqual(edge(2084,'mixed-customers'),[[8,10,0],[9,10,0],[10,11,1],[11,11,1],[12,12,0]]);
  assert.deepEqual(edge(1393,'repeat-trades'),[['Repeat',5]]);
  assert.deepEqual(edge(1783,'all-four'),[[11,'Winner',4]]);
  assert.deepEqual(edge(1308,'same-days'),[['F','2024-05-01',3],['F','2024-05-02',12],['M','2024-05-01',11],['M','2024-05-02',12]]);
  assert.deepEqual(edge(1285,'large-ids'),[[5,6],[10,10],[999999998,1000000000]]);
  assert.deepEqual(edge(1270,'three-levels').flat().sort((a,b)=>a-b),[2,4,7]);
  assert.deepEqual(edge(1270,'other-branch'),[[2]]);
  assert.deepEqual(edge(1699,'duplicates'),[[2,5,3,27]]);
  assert.deepEqual(edge(2066,'zero-balance'),[[1,'2024-01-01',100],[1,'2024-01-02',0],[1,'2024-01-03',25]]);
  assert.deepEqual(edge(1596,'tied-favorites'),[[10,1,'Pen'],[10,2,'Book']]);
});

test('new questions respect their explicit output ordering',()=>{
  for(const number of [1445,1308,1285,2066]){
    const p=additionalProblems.find(p=>p.number===number);
    const reversed={...p.example.output,rows:[...p.example.output.rows].reverse()};
    assert.equal(compareResult(p,reversed,p.example.output).passed,false);
  }
  for(const p of additionalProblems.filter(p=>!p.orderMatters)){
    const reversed={...p.example.output,rows:[...p.example.output.rows].reverse()};
    assert.equal(compareResult(p,reversed,p.example.output).passed,true);
  }
});

test('a custom product tie is evaluated on both engines',async()=>{
  const p=additionalProblems.find(p=>p.number===1596);
  const customInput={Customers:[[99,'New customer']],Products:[[8,'Notebook',5],[12,'Pencil',2]],Orders:[[31,'2026-01-01',99,8],[32,'2026-01-01',99,12]]};
  for(const engine of ['mysql','postgresql']){
    const result=await runQuery({slug:p.slug,engine,sql:additionalQueries[p.number],customInput});
    assert.equal(result.verdict,'Accepted',JSON.stringify(result));
    assert.deepEqual(result.results[0].expected.rows,[[99,8,'Notebook'],[99,12,'Pencil']]);
  }
});
