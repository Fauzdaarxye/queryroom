import { progressPatch, importedProgress } from '../shared/progress.mjs';
import { readLeaderboardOptions } from '../shared/leaderboard.mjs';

export function createAccountApi({ auth, store, problems, json, body, hosted }) {
  return async (req, res, url) => {
    if (await auth.handle(req, res, url)) return true;
    if (req.method === 'GET' && url.pathname === '/api/session') {
      json(res, await auth.sessionInfo(req, hosted)); return true;
    }
    if (req.method === 'GET' && url.pathname === '/api/leaderboard') {
      const current = await auth.session(req);
      if (current || req.headers['x-queryroom-account']) auth.checkAccount(req, current);
      json(res, await store.leaderboard({ ...readLeaderboardOptions(url.search), userId: current?.user.id || null }));
      return true;
    }
    if (url.pathname === '/api/profile') {
      const current = await auth.session(req);
      auth.checkAccount(req, current);
      if (req.method === 'GET') { json(res, {user: current.user}); return true; }
      if (req.method === 'PUT') {
        auth.requireWrite(req, current);
        json(res, {user: await store.saveProfile(current.user.id, await body(req, 10000))}); return true;
      }
      json(res, {error: 'Not found.'}, 404); return true;
    }
    if (url.pathname !== '/api/progress' && !url.pathname.startsWith('/api/progress/')) return false;
    const current = await auth.session(req);
    auth.checkAccount(req, current);
    const slugs = [...problems.keys()];
    if (req.method === 'GET' && url.pathname === '/api/progress') {
      json(res, await store.readProgress(current.user.id, slugs)); return true;
    }
    auth.requireWrite(req, current);
    auth.requireProfile(current);
    if (req.method === 'POST' && url.pathname === '/api/progress/import') {
      const input = await body(req, 5000000);
      const imported = {};
      if (!input.skip) {
        if (!input.progress || typeof input.progress !== 'object' || Array.isArray(input.progress)) throw new Error('Choose browser progress to import.');
        for (const [slug, data] of Object.entries(input.progress)) {
          if (!problems.has(slug)) throw new Error('A question in this import is not available.');
          imported[slug] = importedProgress(data);
        }
      }
      const user = await store.importGuest(current.user.id, imported);
      json(res, { user, progress: await store.readProgress(user.id, slugs) }); return true;
    }
    const parts = url.pathname.split('/');
    const slug = parts[3];
    if (!problems.has(slug)) { json(res, { error: 'Problem not found.' }, 404); return true; }
    if (req.method === 'PATCH' && parts.length === 4) {
      json(res, await store.patchProgress(current.user.id, slug, progressPatch(await body(req)))); return true;
    }
    if (req.method === 'POST' && parts.length === 5 && parts[4] === 'bookmark') {
      json(res, await store.toggleBookmark(current.user.id, slug)); return true;
    }
    json(res, { error: 'Not found.' }, 404); return true;
  };
}
