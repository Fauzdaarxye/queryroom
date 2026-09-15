import test from 'node:test';
import assert from 'node:assert/strict';
import { problems, publicProblem } from '../server/problems/index.mjs';
import { additionalProblems } from '../server/problems/additional.mjs';
import { additionalQueries } from '../server/problems/additional-checkers.mjs';
import { runQuery, validateInput } from '../server/runner.mjs';
import { compareResult } from '../server/compare.mjs';

const requested = ['apples-oranges','drop-type-1-orders-for-customers-with-type-0-orders','capital-gainloss','grand-slam-titles','running-total-for-different-genders','find-the-start-and-end-number-of-continuous-ranges','all-people-report-to-the-given-manager','number-of-calls-between-two-persons','account-balance','the-most-frequently-ordered-products-for-each-customer','maximum-transaction-each-day','calculate-salaries','game-play-analysis-iii','customers-who-bought-products-a-and-b-but-not-c','count-apples-and-oranges','accepted-candidates-from-the-interviews','confirmation-rate','orders-with-maximum-quantity-above-average','project-employees-iii','number-of-times-a-driver-was-a-passenger','activity-participants','biggest-window-between-visits','last-person-to-fit-in-the-bus','highest-grade-for-each-student','the-most-recent-three-orders'];

test('all 25 added URLs have complete questions, examples and fourteen selectable tests',()=>{
  assert.deepEqual(additionalProblems.map(p=>p.slug),requested);
  assert.equal(problems.size,79);
  assert.equal([...problems.values()].reduce((sum,p)=>sum+p.submissionCases.length,0),1032);
  for(const p of additionalProblems){
    assert.equal(p.source,`https://leetcode.com/problems/${p.slug}/description/`);
    assert.equal(p.difficulty,'Medium');
    assert.equal(p.practiceCases.length,14);
    assert.equal(p.collection,'Added questions');
    assert.ok(p.statementHtml.includes('Example 1:'));
    assert.equal(p.videos,undefined);
    assert.equal(publicProblem(p).referenceSql,undefined);
    assert.equal(publicProblem(p).expected,undefined);
    assert.ok(publicProblem(p).practiceCases.every(f=>f.expected===undefined));
    for(const fixture of p.practiceCases) {
      validateInput(p,fixture.input);
      assert.equal(compareResult(p,p.expected(fixture.input),fixture.expected).passed,true,`${p.number}/${fixture.id}`);
    }
    assert.ok(p.schema.every(t=>t.note.length>0));
    assert.ok(!/<(?:script|iframe)|onerror=|onclick=/i.test(p.statementHtml));
    assert.equal(compareResult(p,p.expected(p.example.input),p.example.output).passed,true);
  }
});

for(const p of additionalProblems) for(const engine of ['mysql','postgresql','sqlite']){
  test(`#${p.number}: ${engine} passes the example and all edge cases`,async()=>{
    const result=await runQuery({slug:p.slug,engine,sql:typeof additionalQueries[p.number]==='string'?additionalQueries[p.number]:additionalQueries[p.number][engine],mode:'submit'});
    assert.equal(result.verdict,'Accepted',JSON.stringify(result));
    assert.equal(result.passed,p.submissionCases.length);
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


test('new daily, company, player, and customer checkers keep groups independent',()=>{
  assert.deepEqual(edge(1831,'daily-ties'),[[2],[3],[7]]);
  assert.deepEqual(edge(1831,'different-months'),[[10],[20],[30]]);
  assert.deepEqual(edge(1468,'tax-boundaries'),[[1,1,'Low',999],[2,1,'Threshold',760],[2,2,'Colleague',380],[3,1,'Upper threshold',7600],[4,1,'Above threshold',5101],[4,2,'Small salary',510]]);
  assert.deepEqual(edge(1468,'rounding'),[[1,1,'High',5126],[1,2,'Half',26],[1,3,'Fraction',52],[2,1,'Middle',760],[2,2,'Down',77],[2,3,'Up',78]]);
  assert.deepEqual(edge(534,'device-switch'),[[1,'2024-01-01',3],[1,'2024-01-03',3],[1,'2024-01-05',7],[2,'2024-01-01',8],[2,'2024-01-05',9]]);
  assert.deepEqual(edge(1398,'duplicate-products'),[[2,'Two']]);
  assert.deepEqual(edge(1398,'sorted-customers'),[[3,'Same'],[8,'Same']]);
});

test('chests, thresholds, rates and global order averages follow their exact definitions',()=>{
  assert.deepEqual(edge(1715,'reused-chest'),[[28,47]]);
  assert.deepEqual(edge(1715,'no-chests'),[[4,12]]);
  assert.deepEqual(edge(2041,'thresholds'),[[2]]);
  assert.deepEqual(edge(2041,'round-sums'),[[8]]);
  assert.deepEqual(edge(1934,'rounding'),[[1,0.33],[2,0.67],[3,0.13]]);
  assert.deepEqual(edge(1934,'no-messages'),[[6,0],[2,0]]);
  assert.deepEqual(edge(1867,'global-average'),[[4]]);
  assert.deepEqual(edge(1867,'unequal-sizes'),[]);
  assert.deepEqual(edge(1867,'fractional-averages'),[[1],[2]]);
});

test('project ties, passenger counts and activity extremes are not deduplicated incorrectly',()=>{
  assert.deepEqual(edge(1077,'tied-experience'),[[1,1],[1,2],[2,3]]);
  assert.deepEqual(edge(2238,'repeated-rides'),[[1,3],[2,2],[3,0]]);
  assert.deepEqual(edge(2238,'never-passengers'),[[7,0],[8,0],[9,0]]);
  assert.deepEqual(edge(1355,'tied-extremes'),[['C']]);
  assert.deepEqual(edge(1355,'multiple-middle'),[['B'],['C']]);
  assert.deepEqual(edge(1355,'all-equal'),[]);
});

test('date gaps use the fixed deadline and bus admission stops at the first overflow',()=>{
  assert.deepEqual(edge(1709,'duplicate-visits'),[[1,19],[2,1],[3,0]]);
  assert.deepEqual(edge(1709,'final-window'),[[2,307],[8,365]]);
  assert.deepEqual(edge(1709,'leap-year'),[[1,365],[9,365]]);
  assert.deepEqual(edge(1204,'exact-capacity'),[['Second']]);
  assert.deepEqual(edge(1204,'stop-at-first-overflow'),[['Boards']]);
  assert.deepEqual(edge(1204,'all-fit'),[['Last']]);
});

test('grade and recent-order ties follow every required sorting key',()=>{
  assert.deepEqual(edge(1112,'tied-grades'),[[1,2,50],[2,3,99]]);
  assert.deepEqual(edge(1532,'same-name'),[['Alex',2,5,'2024-01-03'],['Alex',2,6,'2024-01-02'],['Alex',8,4,'2024-01-04'],['Alex',8,2,'2024-01-03'],['Alex',8,3,'2024-01-02'],['Zoe',1,7,'2024-01-01']]);
  assert.deepEqual(edge(1532,'date-not-id'),[['Three',3,2,'2024-03-01'],['Three',3,1,'2024-02-01'],['Three',3,50,'2024-01-15']]);
  for(const number of [1831,1398,1709,1112,1532]) {
    const p=additionalProblems.find(p=>p.number===number),fixture=p.practiceCases.find(f=>f.expected.rows.length>1);
    assert.equal(compareResult(p,{...fixture.expected,rows:[...fixture.expected.rows].reverse()},fixture.expected).passed,false,number);
  }
});

for(const engine of ['mysql','postgresql']) test(`${engine}: new fixtures reject tempting but incorrect solutions`,async()=>{
  const mutations=[
    [1831,q=>q.replace('DENSE_RANK()','ROW_NUMBER()')],
    [2041,q=>q.replace('SUM(r.score)>15','SUM(r.score)>=15')],
    [1867,q=>q.replace('MAX(average)','AVG(average)')],
    [2238,q=>q.replace('SELECT DISTINCT driver_id','SELECT driver_id')],
    [1112,q=>q.replace('grade DESC,course_id','grade DESC,course_id DESC')],
    [1532,q=>q.replace('ranking<=3','ranking<=2')],
  ];
  for(const [number,mutate] of mutations){
    const p=additionalProblems.find(p=>p.number===number);
    const checked=await runQuery({slug:p.slug,engine,sql:mutate(additionalQueries[number]),mode:'submit'});
    assert.equal(checked.verdict,'Wrong Answer',`${engine}/${number}: ${JSON.stringify(checked)}`);
  }
});
