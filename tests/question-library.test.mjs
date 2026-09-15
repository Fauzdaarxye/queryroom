import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultLibraryOptions, questionPage, readLibraryOptions, libraryQuery, practiceOverview, hasQuestionWork } from '../shared/questions.mjs';
import { resolvePage } from '../shared/navigation.mjs';

const questions=Array.from({length:25},(_,i)=>({slug:`q${i}`,number:100+i,title:`Question ${String(i).padStart(2,'0')}`,difficulty:i<9?'Medium':'Hard',starter:'-- Write your query'}));
test('question pages cover the collection without duplication and clamp after filtering',()=>{
  const pages=[1,2,3,4].map(page=>questionPage(questions,{}, {...defaultLibraryOptions,page}));
  assert.deepEqual(pages.map(p=>p.items.length),[8,8,8,1]);
  assert.deepEqual(pages.flatMap(p=>p.items.map(q=>q.slug)),questions.map(q=>q.slug));
  assert.deepEqual([pages[3].start,pages[3].end,pages[3].total],[25,25,25]);
  const filtered=questionPage(questions,{}, {...defaultLibraryOptions,page:4,difficulty:'medium'});
  assert.equal(filtered.page,2);assert.equal(filtered.items.length,1);
  const empty=questionPage(questions,{}, {...defaultLibraryOptions,page:4,search:'no match'});
  assert.deepEqual([empty.page,empty.pages,empty.start,empty.end,empty.total],[1,1,0,0,0]);
});
test('filtering and sorting happen across all questions before pagination',()=>{
  const progress={q20:{solved:true,bookmarked:true},q24:{solved:true,bookmarked:true},q0:{solved:true},q3:{draft:'SELECT 1'}};
  const result=questionPage(questions,progress,{...defaultLibraryOptions,status:'solved',bookmarked:true,sort:'number'});
  assert.deepEqual(result.items.map(p=>p.slug),['q20','q24']);
  assert.deepEqual(questionPage(questions,progress,{...defaultLibraryOptions,status:'in-progress'}).items.map(p=>p.slug),['q3']);
  assert.deepEqual(questionPage([...questions].reverse(),{}, {...defaultLibraryOptions,sort:'title'}).items.map(p=>p.slug),questions.slice(0,8).map(p=>p.slug));
});
test('library URLs preserve filters, sorting and pagination while rejecting invalid values',()=>{
  const options={search:'joins & sales',difficulty:'hard',status:'in-progress',bookmarked:true,sort:'number',page:2,pageSize:16};
  assert.deepEqual(readLibraryOptions(libraryQuery(options)),options);
  assert.deepEqual(readLibraryOptions('?difficulty=fake&status=unknown&page=-4&size=999&sort=random'),defaultLibraryOptions);
  assert.equal(resolvePage('/questions',null),'questions');
  assert.equal(resolvePage('/questions',{profileComplete:true}),'questions');
  assert.equal(resolvePage('/questions',{profileComplete:false}),'onboarding');
});
test('overview counts real work and recommends unfinished questions',()=>{
  assert.equal(hasQuestionWork(questions[0],{draft:'-- Write your query'}),false);
  assert.equal(hasQuestionWork(questions[0],{draft:'   '}),false);
  const progress={q0:{solved:true},q1:{draft:'SELECT 1',bookmarked:true},q20:{submissions:[{id:'attempt',date:'2026-09-16T00:00:00Z',verdict:'Wrong Answer'}]}};
  const overview=practiceOverview(questions,progress,'q0');
  assert.equal(overview.solved.length,1);assert.equal(overview.inProgress.length,2);assert.equal(overview.bookmarked.length,1);assert.equal(overview.history.length,1);
  assert.equal(overview.next.slug,'q20');assert.equal(overview.resuming,true);
  assert.equal(practiceOverview(questions,progress,'q1').next.slug,'q1');
  assert.equal(practiceOverview(questions,{q0:{solved:true}},'q0').next.slug,'q1');
  assert.equal(practiceOverview(questions,{},'q20').next.slug,'q0');
  const complete=practiceOverview(questions,Object.fromEntries(questions.map(p=>[p.slug,{solved:true}])), 'q4');
  assert.equal(complete.completed,true);assert.equal(complete.resuming,false);assert.equal(complete.next.slug,'q4');
});
