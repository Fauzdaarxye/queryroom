import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { problems, publicProblem } from './problems/index.mjs';
import { runQuery } from './runner.mjs';
import { ensureEngines, engineStatus, stopEngines } from './engines.mjs';
import { createAccess } from './access.mjs';
import { createFileStateStore, createPostgresStateStore } from './state-store.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = process.env.QUERYROOM_DATA_DIR || path.join(root, '.data');
const access=await createAccess();
const stateMode=process.env.QUERYROOM_STATE_STORE || (access.deployed?'postgres':'file');
if(!['file','postgres'].includes(stateMode)) throw new Error('QUERYROOM_STATE_STORE must be file or postgres.');
if(access.deployed && stateMode!=='postgres') throw new Error('Deployed workspaces require QUERYROOM_STATE_STORE=postgres so progress survives container restarts.');
await ensureEngines();
const progressStore=stateMode==='postgres' ? await createPostgresStateStore() : await createFileStateStore(dataDir);
const emptyState = () => ({ draft: null, notes: '', bookmarked: false, solved: false, submissions: [] });
async function body(req) {
  let size = 0; const chunks = [];
  for await (const chunk of req) { size += chunk.length; if (size > 1_000_000) throw new Error('Request is too large.'); chunks.push(chunk); }
  try { return JSON.parse(Buffer.concat(chunks).toString()); } catch { throw new Error('Invalid JSON.'); }
}
function json(res, value, status = 200) { res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store', 'CDN-Cache-Control':'no-store', 'X-Content-Type-Options': 'nosniff' }); res.end(JSON.stringify(value)); }
const port = access.port;
let vite;
const server = http.createServer(async (req, res) => {
  const host = req.headers.host || '';
  if (!access.accepts(req)) return json(res, { error: 'This address is not allowed for this workspace.' }, 403);
  const url = new URL(req.url, `http://${host}`);
  if (url.pathname.startsWith('/api/')) {
    try {
      if(req.method==='GET' && url.pathname==='/api/health') return json(res,{ready:true});
      if(req.method==='GET' && url.pathname==='/api/session') return json(res,{required:access.required,authenticated:access.authenticated(req),hosted:access.deployed});
      if(req.method==='POST' && url.pathname==='/api/login') {
        const result=access.login((await body(req)).password);
        if(result.error) return json(res,{error:result.error},result.status);
        res.setHeader('Set-Cookie',result.cookie);
        return json(res,{authenticated:true});
      }
      if(req.method==='POST' && url.pathname==='/api/logout') {res.setHeader('Set-Cookie',access.logoutCookie);return json(res,{authenticated:false});}
      if(!access.authenticated(req)) return json(res,{error:'Unlock your workspace to continue.'},401);
      if (req.method === 'GET' && url.pathname === '/api/problems') return json(res, [...problems.values()].map(publicProblem));
      if (req.method === 'GET' && url.pathname === '/api/engines') return json(res, await engineStatus());
      if (req.method === 'GET' && url.pathname === '/api/state') {
        const state=await progressStore.read();
        return json(res, Object.fromEntries([...problems.keys()].map(slug => [slug, { ...emptyState(), ...state[slug] }])));
      }
      if (req.method === 'PUT' && url.pathname.startsWith('/api/state/')) {
        const slug = url.pathname.split('/').at(-1);
        if (!problems.has(slug)) return json(res, { error: 'Problem not found.' }, 404);
        const patch = await body(req);
        const update={};
        for (const key of ['draft', 'notes']) if (typeof patch[key] === 'string') { if (patch[key].length > 20000) throw new Error('Drafts and notes are limited to 20,000 characters.'); update[key] = patch[key]; }
        if (typeof patch.bookmarked === 'boolean') update.bookmarked = patch.bookmarked;
        await progressStore.patch(slug,update); return json(res, { saved: true });
      }
      if (req.method === 'POST' && url.pathname === '/api/query') {
        const request = await body(req);
        if (request.engine !== undefined && !['mysql','postgresql'].includes(request.engine)) throw new Error('Choose MySQL or PostgreSQL.');
        const result = await runQuery(request);
        if (request.mode === 'submit') {
          const submission = { id: randomUUID(), date: new Date().toISOString(), sql: request.sql, engine: result.engine, verdict: result.verdict, passed: result.passed, total: result.total, runtime: result.runtime };
          const saved=await progressStore.recordSubmission(request.slug,submission);
          result.submission = submission; result.solved = saved.solved;
        }
        return json(res, result);
      }
      return json(res, { error: 'Not found.' }, 404);
    } catch (error) { return json(res, { error: error.message || 'Something went wrong. Please try again.' }, 400); }
  }
  if (vite) return vite.middlewares(req, res);
  try {
    const pathname = decodeURIComponent(url.pathname);
    const dist = path.join(root, 'dist');
    let file = path.resolve(dist, `.${pathname}`);
    if (!file.startsWith(`${dist}/`) && file !== dist) return json(res, { error: 'Not found.' }, 404);
    if (pathname === '/' || !path.extname(pathname)) file = path.join(dist, 'index.html');
    const data = await fs.readFile(file);
    const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2' };
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'X-Content-Type-Options': 'nosniff', 'Cache-Control': file.includes('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache' }); res.end(data);
  } catch { res.writeHead(404); res.end('Page not found. Run npm run build before starting the app.'); }
});
if (process.argv.includes('--dev')) {
  const { createServer } = await import('vite');
  vite = await createServer({ root, server: { middlewareMode: true, hmr: { server } }, appType: 'spa' });
}
server.listen(port, access.host, () => console.log(`\n  Queryroom is ready on port ${port}\n  MySQL and PostgreSQL are ready. Progress storage: ${stateMode}.\n`));
for (const signal of ['SIGTERM','SIGINT']) process.once(signal,async()=>{await new Promise(resolve=>server.close(resolve));await progressStore.close();await stopEngines();process.exit();});
server.on('error', e => { console.error(e.code === 'EADDRINUSE' ? `Port ${port} is already in use. Set PORT to choose another port.` : e.message); process.exit(1); });
