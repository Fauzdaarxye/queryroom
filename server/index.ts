import './env.mjs';
import http, {type IncomingMessage, type ServerResponse} from 'node:http';
import next from 'next';
import { ensureEngines, engineStatus, stopEngines, engineConfig } from './engines.mjs';
import { createAccess } from './access.mjs';
import { createAccountStore } from './account-store.mjs';
import { createGoogleAuth, googleConfig } from './google-auth.mjs';
import { createAccountApi } from './account-api.ts';
import { createQueryApi } from './query-api.ts';
import { securityHeaders, requestUrl } from './http-security.mjs';
import { createCatalog } from './catalog/store.ts';
import { createAdminApi } from './catalog/admin-api.ts';
import { configureRunner } from './runner.ts';

const access = await createAccess();
const authConfig = await googleConfig(access);
await ensureEngines();
const config = (await engineConfig()).postgresql;
const accountStore = await createAccountStore({config});
const catalog = await createCatalog(config);
configureRunner(catalog.published);
const auth = createGoogleAuth({store: accountStore, config: authConfig});
const accountApi = createAccountApi({auth, store: accountStore, catalog, json, body, hosted: access.deployed});
const queryApi = createQueryApi({auth, store: accountStore, catalog, body, json});
const adminApi = createAdminApi({auth, catalog, body, json});
const app = next({dev: process.argv.includes('--dev'), hostname: access.host, port: access.port});
await app.prepare();
const handle = app.getRequestHandler();

async function body(req: IncomingMessage, limit = 1_000_000) {
  let size = 0; const chunks: Buffer[] = [];
  for await (const chunk of req) { size += chunk.length; if (size > limit) throw Object.assign(new Error('Request is too large.'), {status: 413}); chunks.push(chunk); }
  try { return JSON.parse(Buffer.concat(chunks).toString()); } catch { throw new Error('Invalid JSON.'); }
}
function json(res: ServerResponse, value: unknown, status = 200) {
  res.writeHead(status, {'Content-Type': 'application/json', 'Cache-Control': 'private, no-store', 'CDN-Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff'});
  res.end(JSON.stringify(value));
}
const server = http.createServer(async (req, res) => {
  securityHeaders(res);
  if (!access.accepts(req)) return json(res, {error: 'This address is not allowed for this workspace.'}, 403);
  try {
    const url = requestUrl(req.url);
    if (!url.pathname.startsWith('/api/')) { await handle(req, res); return; }
    if (req.method === 'GET' && url.pathname === '/api/health') { await catalog.health(); return json(res, {ready: true}); }
    if (await accountApi(req, res, url)) return;
    if (await adminApi(req, res, url)) return;
    if (req.method === 'GET' && url.pathname === '/api/problems') return json(res, await catalog.list());
    if (req.method === 'GET' && url.pathname === '/api/engines') {
      try { await ensureEngines(); } catch {}
      return json(res, await engineStatus());
    }
    if (url.pathname === '/api/state' || url.pathname.startsWith('/api/state/')) return json(res, {error: 'Refresh the page to use the current progress storage.'}, 410);
    if (await queryApi(req, res, url)) return;
    json(res, {error: 'Not found.'}, 404);
  } catch (error: any) {
    if (res.headersSent) { res.end(); return; }
    if (error.retryAfter) res.setHeader('Retry-After', String(error.retryAfter));
    // PostgreSQL errors can contain query text or private row data.
    const databaseError = typeof error.code === 'string' && /^[0-9A-Z]{5}$/.test(error.code);
    json(res, {error: databaseError ? 'The database request could not be completed. Please try again.' : error.message || 'Something went wrong. Please try again.'}, error.status || (databaseError ? 500 : 400));
  }
});
server.listen(access.port, access.host, () => console.log(`Queryroom is ready at http://localhost:${access.port}\nNext.js, question catalog, MySQL and PostgreSQL are ready.`));
for (const signal of ['SIGTERM', 'SIGINT'] as const) process.once(signal, async () => {
  await new Promise<void>(resolve => server.close(() => resolve()));
  await app.close(); await catalog.close(); await accountStore.close(); await stopEngines(); process.exit();
});
server.on('error', (error: NodeJS.ErrnoException) => { console.error(error.code === 'EADDRINUSE' ? `Port ${access.port} is already in use.` : error.message); process.exit(1); });
