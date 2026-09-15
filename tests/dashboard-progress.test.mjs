import test from 'node:test';
import assert from 'node:assert/strict';
import { createAccountProgressStore } from '../src/account-progress.mjs';
import { filterQuestions } from '../shared/questions.mjs';
import { emptyProgress, importedProgress, mergeImportedProgress } from '../shared/progress.mjs';

const questions = [
  { slug: 'easy', number: 1, title: 'Easy joins', difficulty: 'Easy' },
  { slug: 'medium', number: 2, title: 'Running total', difficulty: 'Medium' },
  { slug: 'hard', number: 3, title: 'Hard joins', difficulty: 'Hard' },
];
test('dashboard combines search, difficulty, solved status and bookmarks', () => {
  const progress = { easy: { solved: true }, medium: { bookmarked: true }, hard: { solved: true, bookmarked: true } };
  assert.deepEqual(filterQuestions(questions, progress, { difficulty: 'medium', status: 'unsolved', bookmarked: true }).map(p => p.slug), ['medium']);
  assert.deepEqual(filterQuestions(questions, progress, { search: ' JOINS ', status: 'solved' }).map(p => p.slug), ['easy', 'hard']);
  assert.deepEqual(filterQuestions(questions, progress, { search: '2' }).map(p => p.slug), ['medium']);
  assert.equal(filterQuestions(questions, progress, { difficulty: 'hard', status: 'unsolved' }).length, 0);
});

function fixture(userId = 'user-a') {
  const values = new Map(), calls = [], server = { one: emptyProgress() };
  const storage = { getItem: key => values.get(key) || null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
  let unavailable = false;
  const api = async (path, options = {}) => {
    calls.push({ path, options });
    if (unavailable) throw new Error('Offline');
    if (options.method === 'PATCH') server.one = { ...server.one, ...JSON.parse(options.body) };
    if (path.endsWith('/bookmark')) server.one = { ...server.one, bookmarked: !server.one.bookmarked };
    return structuredClone(path === '/api/progress' ? server : server.one);
  };
  return { values, storage, api, calls, server, store: createAccountProgressStore({ api, userId, storage: () => storage, delay: 5 }), setOffline: value => { unavailable = value; } };
}

test('account drafts debounce, flush in order and recover their last keystroke', async () => {
  const f = fixture();
  const first = f.store.saveDraft('one', 'SELECT 1', 'first');
  const second = f.store.saveDraft('one', 'SELECT 12', 'latest');
  assert.equal(f.store.hasPending(), true);
  assert.equal(JSON.parse(f.values.get('queryroom-account-user-a-draft-one')).draft, 'SELECT 12');
  await f.store.flush(); await Promise.all([first, second]);
  assert.equal(f.calls.filter(c => c.options.method === 'PATCH').length, 1);
  assert.equal(f.server.one.draft, 'SELECT 12'); assert.equal(f.values.size, 0); assert.equal(f.store.hasPending(), false);
  const pending = f.store.saveDraft('one', 'SELECT 123', 'next');
  await f.store.patch('one', { solved: true }); await pending;
  assert.equal(f.server.one.draft, 'SELECT 123'); assert.equal(f.server.one.solved, true);
});

test('failed sync keeps a recovery copy scoped to its Google account', async () => {
  const f = fixture(); f.setOffline(true);
  await assert.rejects(f.store.saveDraft('one', 'recover this', 'my note'), /Offline/);
  assert.equal(f.values.size, 1);
  f.setOffline(false);
  const otherAccount = createAccountProgressStore({ api: f.api, userId: 'user-b', storage: () => f.storage });
  assert.equal((await otherAccount.read(['one'])).one.draft, null);
  const reloaded = createAccountProgressStore({ api: f.api, userId: 'user-a', storage: () => f.storage });
  assert.equal((await reloaded.read(['one'])).one.draft, 'recover this'); assert.equal(f.values.size, 0);
});

test('guest import preserves existing account drafts and deduplicates submissions', () => {
  const submission = { id: 'one', date: '2026-09-15T12:00:00Z', sql: 'SELECT 1', verdict: 'Accepted', engine: 'mysql', passed: 1, total: 1, runtime: 10 };
  const account = { ...emptyProgress(), draft: 'account SQL', submissions: [submission] };
  const guest = importedProgress({ ...emptyProgress(), draft: 'guest SQL', notes: 'guest note', solved: true, submissions: [submission] });
  const merged = mergeImportedProgress(account, guest);
  assert.equal(merged.draft, 'account SQL'); assert.equal(merged.notes, 'guest note'); assert.equal(merged.solved, true); assert.equal(merged.submissions.length, 1);
  assert.throws(() => importedProgress({ ...emptyProgress(), userId: 'another-account' }), /Unsupported/);
  assert.throws(() => importedProgress({ ...emptyProgress(), draft: 'x'.repeat(20001) }), /20,000/);
});
