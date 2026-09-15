import './env.mjs';
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { problems, publicProblem } from './problems/index.mjs';
import { ensureEngines, engineStatus, stopEngines, engineConfig } from './engines.mjs';
import { createAccess } from './access.mjs';
import { createAccountStore } from './account-store.mjs';
import { createGoogleAuth, googleConfig } from './google-auth.mjs';
import { createAccountApi } from './account-api.mjs';
import { createQueryApi } from './query-api.mjs';
import { securityHeaders, requestUrl } from './http-security.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const access=await createAccess();
const authConfig = await googleConfig(access);
await ensureEngines();
const accountStore = await createAccountStore({ config: (await engineConfig()).postgresql });
const auth = createGoogleAuth({ store: accountStore, config: authConfig });
const accountApi = createAccountApi({ auth, store: accountStore, problems, json, body, hosted: access.deployed });
const queryApi = createQueryApi({ auth, store: accountStore, problems, body, json });
async function body(req, limit = 1000000) {
  let size = 0; const chunks = [];
  for await (const chunk of req) { size += chunk.length; if (size > limit) throw new Error('Request is too large.'); chunks.push(chunk); }
  try { return JSON.parse(Buffer.concat(chunks).toString()); } catch { throw new Error('Invalid JSON.'); }
}
function json(res, value, status = 200) { res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store', 'CDN-Cache-Control':'no-store', 'X-Content-Type-Options': 'nosniff' }); res.end(JSON.stringify(value)); }
const port = access.port;
let vite;
const server = http.createServer(async (req, res) => {
  securityHeaders(res);
  if (!access.accepts(req)) return json(res, { error: 'This address is not allowed for this workspace.' }, 403);
  let url;
  try { url = requestUrl(req.url); }
  catch (error) { return json(res, { error: error.message }, 400); }
  if (url.pathname.startsWith('/api/')) {
    try {
      if(req.method==='GET' && url.pathname==='/api/health') return json(res,{ready:true});
      if (await accountApi(req, res, url)) return;
      if (req.method === 'GET' && url.pathname === '/api/problems') return json(res, [...problems.values()].map(publicProblem));
      if (req.method === 'GET' && url.pathname === '/api/engines') {
        try { await ensureEngines(); } catch {}
        return json(res, await engineStatus());
      }
      if (url.pathname === '/api/state' || url.pathname.startsWith('/api/state/')) {
        return json(res, { error: 'Progress is now stored in your browser. Refresh the page to load the updated app.' }, 410);
      }
      if (await queryApi(req, res, url)) return;
      return json(res, { error: 'Not found.' }, 404);
    } catch (error) {
      if (error.retryAfter) res.setHeader('Retry-After', String(error.retryAfter));
      return json(res, { error: error.message || 'Something went wrong. Please try again.' }, error.status || 400);
    }
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
server.listen(port, access.host, () => console.log(`\n  Queryroom is ready at http://localhost:${port}\n  MySQL and PostgreSQL are ready.\n  Google sign-in: ${authConfig.enabled ? 'configured' : 'not configured — set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env, then restart'}\n`));
for (const signal of ['SIGTERM','SIGINT']) process.once(signal,async()=>{await vite?.close();await new Promise(resolve=>server.close(resolve));await accountStore.close();await stopEngines();process.exit();});
server.on('error', e => { console.error(e.code === 'EADDRINUSE' ? `Port ${port} is already in use. Set PORT to choose another port.` : e.message); process.exit(1); });
