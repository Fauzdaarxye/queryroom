// IndexedDB belongs to this browser profile and website origin, never the server.
export const emptyProgress = () => ({ draft: null, notes: '', bookmarked: false, solved: false, submissions: [] });
export const storageError = 'Could not save in this browser. Allow site storage or free some space, then try again.';

export function createBrowserProgressStore({ indexedDB = globalThis.indexedDB, storage = () => globalThis.localStorage } = {}) {
  let opening;
  function open() {
    if (!opening) opening = new Promise((resolve, reject) => {
      const request = indexedDB.open('queryroom-progress', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('problems');
      request.onsuccess = () => {
        const db = request.result;
        db.onversionchange = () => { db.close(); opening = undefined; };
        resolve(db);
      };
      request.onerror = () => reject(new Error('Could not open saved progress. Allow browser site storage, then reload.'));
    }).catch(error => { opening = undefined; throw error; });
    return opening;
  }
  async function mutate(slug, update) {
    const db = await open();
    return new Promise((resolve, reject) => {
      // Read and merge in one transaction, including across tabs.
      const transaction = db.transaction('problems', 'readwrite');
      const store = transaction.objectStore('problems');
      const request = store.get(slug);
      let next;
      request.onsuccess = () => {
        next = update({ ...emptyProgress(), ...request.result }, request.result !== undefined);
        store.put(next, slug);
      };
      transaction.oncomplete = () => resolve(next);
      transaction.onabort = () => reject(new Error(storageError));
      transaction.onerror = () => {}; // onabort reports failed commits as well as failed writes.
    });
  }
  async function read(slugs) {
    const db = await open();
    // Recover only this browser's existing drafts, including edits interrupted by a reload.
    for (const slug of slugs) {
      const key = `queryroom-draft-${slug}`;
      let raw, backup;
      try { raw = storage().getItem(key); backup = JSON.parse(raw); } catch { continue; }
      if (typeof backup?.value !== 'string') continue;
      await mutate(slug, (current, exists) => !exists || backup.dirty ? {
        ...current, draft: backup.value, notes: typeof backup.notes === 'string' ? backup.notes : current.notes,
      } : current);
      try { if (storage().getItem(key) === raw) storage().removeItem(key); } catch {}
    }
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('problems', 'readonly');
      const store = transaction.objectStore('problems');
      const saved = {};
      for (const slug of slugs) {
        const request = store.get(slug);
        request.onsuccess = () => { saved[slug] = { ...emptyProgress(), ...request.result }; };
      }
      transaction.oncomplete = () => resolve(saved);
      transaction.onabort = () => reject(new Error('Could not read saved browser progress. Reload to try again.'));
    });
  }
  return {
    read,
    patch: (slug, patch) => mutate(slug, current => ({ ...current, ...patch })),
    toggleBookmark: slug => mutate(slug, current => ({ ...current, bookmarked: !current.bookmarked })),
    recordSubmission: (slug, submission) => mutate(slug, current => ({
      ...current, solved: current.solved || submission.verdict === 'Accepted',
      submissions: [submission, ...current.submissions.filter(item => item.id !== submission.id)].slice(0, 100),
    })),
    saveDraft(slug, draft, notes) {
      const key = `queryroom-draft-${slug}`, raw = JSON.stringify({ value: draft, notes, dirty: true });
      // Synchronous recovery copy protects the last keystroke if the page closes mid-transaction.
      // If localStorage is full, IndexedDB can still commit successfully.
      try { storage().setItem(key, raw); } catch {}
      return mutate(slug, current => ({ ...current, draft, notes })).then(saved => {
        try { if (storage().getItem(key) === raw) storage().removeItem(key); } catch {}
        return saved;
      });
    },
    async close() { if (opening) (await opening).close(); opening = undefined; },
  };
}
