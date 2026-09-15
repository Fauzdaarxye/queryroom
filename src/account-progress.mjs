// Recovery drafts are scoped to a Google account; they never enter guest storage.
export function createAccountProgressStore({ api, userId, storage = () => localStorage, delay = 400 }) {
  const batches = new Map(), chains = new Map();
  const key = slug => `queryroom-account-${userId}-draft-${slug}`;
  function queue(slug, action) {
    const pending = (chains.get(slug) || Promise.resolve()).catch(() => {}).then(action);
    chains.set(slug, pending);
    pending.finally(() => { if (chains.get(slug) === pending) chains.delete(slug); }).catch(() => {});
    return pending;
  }
  function send(slug) {
    const batch = batches.get(slug);
    if (!batch) return;
    clearTimeout(batch.timer); batches.delete(slug);
    queue(slug, () => api(`/api/progress/${slug}`, { method: 'PATCH', body: JSON.stringify(batch.snapshot) })).then(saved => {
      try { if (storage().getItem(key(slug)) === batch.raw) storage().removeItem(key(slug)); } catch {}
      batch.waiters.forEach(waiter => waiter.resolve(saved));
    }, error => batch.waiters.forEach(waiter => waiter.reject(error)));
  }
  async function flush() {
    for (const slug of [...batches.keys()]) send(slug);
    await Promise.all([...chains.values()]);
  }
  return {
    flush, hasPending: () => batches.size > 0 || chains.size > 0,
    async read(slugs) {
      await flush();
      const saved = await api('/api/progress');
      for (const slug of slugs) {
        let raw, backup;
        try { raw = storage().getItem(key(slug)); backup = JSON.parse(raw); } catch { continue; }
        if (typeof backup?.draft !== 'string' || typeof backup?.notes !== 'string') continue;
        saved[slug] = await queue(slug, () => api(`/api/progress/${slug}`, { method: 'PATCH', body: JSON.stringify(backup) }));
        try { if (storage().getItem(key(slug)) === raw) storage().removeItem(key(slug)); } catch {}
      }
      return saved;
    },
    saveDraft(slug, draft, notes) {
      const snapshot = { draft, notes }, raw = JSON.stringify(snapshot);
      try { storage().setItem(key(slug), raw); } catch {}
      let batch = batches.get(slug);
      if (!batch) { batch = { waiters: [] }; batches.set(slug, batch); }
      clearTimeout(batch.timer);
      Object.assign(batch, { snapshot, raw, timer: setTimeout(() => send(slug), delay) });
      return new Promise((resolve, reject) => batch.waiters.push({ resolve, reject }));
    },
    patch(slug, patch) {
      send(slug);
      return queue(slug, () => api(`/api/progress/${slug}`, { method: 'PATCH', body: JSON.stringify(patch) }));
    },
    toggleBookmark(slug) {
      send(slug);
      return queue(slug, () => api(`/api/progress/${slug}/bookmark`, { method: 'POST' }));
    },
  };
}
