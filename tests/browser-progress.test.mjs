import test from 'node:test';
import assert from 'node:assert/strict';
import { IDBFactory } from 'fake-indexeddb';
import { createBrowserProgressStore, emptyProgress } from '../src/progress-store.mjs';

function browser() {
  const values = new Map();
  const local = {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: key => values.delete(key),
  };
  const options = { indexedDB: new IDBFactory(), storage: () => local };
  return { local, options, store: createBrowserProgressStore(options) };
}
const accepted = { id:'accepted', verdict:'Accepted', sql:'SELECT 1', engine:'postgresql' };

test('each browser keeps its own solved status, history, drafts, notes and bookmarks after reload', async () => {
  const first = browser(), second = browser();
  await first.store.saveDraft('example', 'SELECT 2', 'remember ties');
  await first.store.toggleBookmark('example');
  await first.store.recordSubmission('example', accepted);
  await first.store.close();
  const reloaded = createBrowserProgressStore(first.options);
  assert.deepEqual((await reloaded.read(['example'])).example, {
    draft:'SELECT 2', notes:'remember ties', bookmarked:true, solved:true, submissions:[accepted],
  });
  assert.deepEqual((await second.store.read(['example'])).example, emptyProgress());
  await reloaded.close(); await second.store.close();
});

test('concurrent tab edits merge with submissions, and wrong answers do not undo solved status', async () => {
  const { store, options } = browser(), otherTab = createBrowserProgressStore(options);
  await Promise.all([
    store.saveDraft('one', 'SELECT 3', 'new note'),
    otherTab.toggleBookmark('one'),
    store.recordSubmission('one', accepted),
    otherTab.recordSubmission('one', {id:'wrong', verdict:'Wrong Answer'}),
  ]);
  const saved = (await store.read(['one', 'two']));
  assert.equal(saved.one.draft, 'SELECT 3');
  assert.equal(saved.one.notes, 'new note');
  assert.equal(saved.one.bookmarked, true);
  assert.equal(saved.one.solved, true);
  assert.equal(saved.one.submissions.length, 2);
  assert.deepEqual(saved.two, emptyProgress());
  await store.close(); await otherTab.close();
});

test('only browser draft backups are migrated, including interrupted edits without losing history', async () => {
  const { store, local } = browser();
  local.setItem('queryroom-draft-legacy', JSON.stringify({value:'old local SQL', notes:'local note', dirty:false}));
  await store.saveDraft('existing', 'older SQL', 'older note');
  await store.recordSubmission('existing', accepted);
  local.setItem('queryroom-draft-existing', JSON.stringify({value:'last keystroke', notes:'latest note', dirty:true}));
  const saved = await store.read(['legacy', 'existing', 'new']);
  assert.equal(saved.legacy.draft, 'old local SQL');
  assert.equal(saved.legacy.notes, 'local note');
  assert.equal(saved.legacy.solved, false);
  assert.equal(saved.existing.draft, 'last keystroke');
  assert.equal(saved.existing.notes, 'latest note');
  assert.deepEqual(saved.existing.submissions, [accepted]);
  assert.equal(local.getItem('queryroom-draft-existing'), null);
  assert.deepEqual(saved.new, emptyProgress());
  // A stale clean backup must not replace newer IndexedDB progress.
  local.setItem('queryroom-draft-existing', JSON.stringify({value:'stale SQL', dirty:false}));
  assert.equal((await store.read(['existing'])).existing.draft, 'last keystroke');
  await store.close();
});

test('rapid draft edits and reversions retain the final value and remove committed recovery copies', async () => {
  const { store, local } = browser();
  await Promise.all([store.saveDraft('one', 'SELECT 1', 'a'), store.saveDraft('one', 'SELECT 12', 'b'), store.saveDraft('one', 'SELECT 1', 'c')]);
  const saved = (await store.read(['one'])).one;
  assert.equal(saved.draft, 'SELECT 1');
  assert.equal(saved.notes, 'c');
  assert.equal(local.getItem('queryroom-draft-one'), null);
  await store.close();
});

test('submission history retains the latest 100 without duplicating a returned submission', async () => {
  const { store } = browser();
  await store.recordSubmission('one', accepted);
  for (let n=0; n<105; n++) await store.recordSubmission('one', {id:String(n), verdict:'Wrong Answer'});
  await store.recordSubmission('one', {id:'104', verdict:'Wrong Answer'});
  const saved = (await store.read(['one'])).one;
  assert.equal(saved.solved, true);
  assert.equal(saved.submissions.length, 100);
  assert.equal(saved.submissions[0].id, '104');
  assert.equal(new Set(saved.submissions.map(s=>s.id)).size, 100);
  await store.close();
});

test('unavailable storage rejects saves rather than reporting successful persistence', async () => {
  const unavailable = createBrowserProgressStore({indexedDB:{open(){throw new Error('Storage blocked');}}, storage:()=>({setItem(){throw new Error('Full');}})});
  await assert.rejects(unavailable.saveDraft('one','SQL','note'), /Storage blocked/);
  await assert.rejects(unavailable.recordSubmission('one', accepted), /Storage blocked/);
  await assert.rejects(unavailable.read(['one']), /Storage blocked/);
});

test('aborted IndexedDB commits report failure and preserve the draft recovery copy', async () => {
  const { store, options, local } = browser();
  await store.read(['one']);
  const request = options.indexedDB.open('queryroom-progress', 1);
  const db = await new Promise(resolve=>{request.onsuccess=()=>resolve(request.result);});
  const prototype = Object.getPrototypeOf(db.transaction('problems').objectStore('problems'));
  const put = prototype.put;
  prototype.put = function(...args) { const result = put.apply(this,args); this.transaction.abort(); return result; };
  try {
    await assert.rejects(store.saveDraft('one', 'recover me', 'note'), /Could not save in this browser/);
    assert.equal(JSON.parse(local.getItem('queryroom-draft-one')).value, 'recover me');
  } finally { prototype.put = put; db.close(); }
  assert.equal((await store.read(['one'])).one.draft, 'recover me');
  await store.close();
});
