import test from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs/promises';
import os from 'node:os';
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import mysql from 'mysql2/promise';
import pg from 'pg';
import { randomBytes } from 'node:crypto';
import { once } from 'node:events';
import { engineConfig, adminConnection, databaseBinary } from '../server/engines.mjs';
import { engineMode } from '../server/engine-settings.mjs';
import { initializeCredentials } from '../scripts/docker-init.mjs';
import { createAccountStore } from '../server/account-store.mjs';

async function availablePort() {
  const server = net.createServer().listen(0, '127.0.0.1');
  await once(server, 'listening');
  const port = server.address().port;
  await new Promise(resolve => server.close(resolve));
  return port;
}
async function stopProcess(child) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  const exited = once(child, 'exit');
  child.kill('SIGTERM');
  const timer = setTimeout(() => child.kill('SIGKILL'), 10000);
  try { await exited; } finally { clearTimeout(timer); }
}
async function temporaryMySQL() {
  const binary = await databaseBinary('mysqld');
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'qr-tcp-'));
  const password = randomBytes(24).toString('hex');
  const port = await availablePort();
  let child;
  async function close() { await stopProcess(child); await fs.rm(directory, {recursive: true, force: true}); }
  try {
    const data = path.join(directory, 'data');
    await promisify(execFile)(binary, ['--no-defaults', '--initialize-insecure', `--datadir=${data}`, '--lower-case-table-names=1'], {timeout: 30000});
    const initFile = path.join(directory, 'init.sql');
    await fs.writeFile(initFile, `ALTER USER 'root'@'localhost' IDENTIFIED BY '${password}';\n`, {mode: 0o600});
    child = spawn(binary, ['--no-defaults', `--datadir=${data}`, `--socket=${path.join(directory, 'mysql.sock')}`, '--bind-address=127.0.0.1', `--port=${port}`, '--lower-case-table-names=1', `--init-file=${initFile}`, '--mysqlx=0', '--local-infile=OFF', '--secure-file-priv=NULL', '--innodb-buffer-pool-size=64M', '--max-connections=30', '--performance-schema=OFF'], {stdio: 'ignore'});
    const config = {host: '127.0.0.1', port, user: 'root', password, connectTimeout: 500};
    for (let attempt = 0; attempt < 100; attempt++) {
      if (child.exitCode !== null) throw new Error('Temporary MySQL did not start.');
      try { const client = await mysql.createConnection(config); await client.end(); return {config, close}; } catch {}
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    throw new Error('Temporary MySQL did not become ready.');
  } catch (error) { await close(); throw error; }
}

async function proxy(socketPath) {
  const sockets = new Set();
  const server = net.createServer(incoming => {
    const outgoing = net.connect(socketPath);
    for (const socket of [incoming, outgoing]) {
      sockets.add(socket);
      socket.on('close', () => sockets.delete(socket));
      socket.on('error', () => { incoming.destroy(); outgoing.destroy(); });
    }
    incoming.pipe(outgoing).pipe(incoming);
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  return {
    port: server.address().port,
    async close() {
      for (const socket of sockets) socket.destroy();
      await new Promise(resolve => server.close(resolve));
    },
  };
}

test('hosted workspace supports guests and private account submissions while preserving legacy data', {skip: engineMode() !== 'local', timeout: 60000}, async () => {
  const config = await engineConfig();
  const database = `qr_deploy_${randomBytes(10).toString('hex')}`;
  const admin = await adminConnection('postgresql');
  const proxies = [];
  let child, mysqlServer, secretDirectory, legacyClient, accountStore;
  const stop = () => stopProcess(child);
  try {
    await admin.query(`CREATE DATABASE "${database}"`);
    legacyClient = new pg.Client({...config.postgresql, database});
    await legacyClient.connect();
    assert.equal((await legacyClient.query("SELECT 1 FROM pg_namespace WHERE nspname='queryroom_state'")).rowCount, 0);
    // An upgrade must leave old shared records untouched and inaccessible to visitors.
    await legacyClient.query('CREATE SCHEMA queryroom_state');
    await legacyClient.query('REVOKE ALL ON SCHEMA queryroom_state FROM PUBLIC');
    await legacyClient.query('CREATE TABLE queryroom_state.progress (slug TEXT PRIMARY KEY, data JSONB NOT NULL)');
    const original = {draft:'previous shared draft', notes:'private legacy note', solved:true, submissions:[]};
    await legacyClient.query('INSERT INTO queryroom_state.progress VALUES ($1,$2)', ['rectangles-area', original]);
    // A real TCP listener is necessary: MySQL treats wildcard grants differently on Unix sockets.
    mysqlServer = await temporaryMySQL();
    proxies.push(await proxy(path.join(config.postgresql.host, `.s.PGSQL.${config.postgresql.port}`)));
    const port = await availablePort();
    const origin = `http://127.0.0.1:${port}`;
    const password = randomBytes(24).toString('hex');
    secretDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'qr-http-credentials-'));
    await initializeCredentials(secretDirectory, {MYSQL_PASSWORD:mysqlServer.config.password, POSTGRES_PASSWORD:config.postgresql.password});
    // Old deployed volumes and environment settings must not restore the login gate.
    await fs.writeFile(path.join(secretDirectory, 'workspace_password'), password);
    const env = {
      ...process.env, HOST: '127.0.0.1', PORT: String(port),
      QUERYROOM_ENGINE_MODE: 'external', QUERYROOM_STATE_STORE: 'postgres',
      GOOGLE_CLIENT_ID: '', GOOGLE_CLIENT_SECRET: '', GOOGLE_REDIRECT_URI: `${origin}/api/auth/google/callback`, QUERYROOM_ACCESS_PASSWORD: '', QUERYROOM_ALLOWED_ORIGINS: '', QUERYROOM_AUTO_ORIGIN: 'true',
      MYSQL_HOST: '127.0.0.1', MYSQL_PORT: String(mysqlServer.config.port),
      MYSQL_USER: mysqlServer.config.user, MYSQL_PASSWORD: '', MYSQL_SSL: 'false',
      POSTGRES_HOST: '127.0.0.1', POSTGRES_PORT: String(proxies[0].port),
      POSTGRES_USER: config.postgresql.user, POSTGRES_PASSWORD: '',
      POSTGRES_DB: database, POSTGRES_SSL: 'false',
    };
    // Parent machine secrets must not override this test's isolated settings.
    for (const key of Object.keys(env)) if (key.endsWith('_FILE')) delete env[key];
    env.QUERYROOM_ACCESS_PASSWORD_FILE = path.join(secretDirectory, 'workspace_password');
    env.MYSQL_PASSWORD_FILE = path.join(secretDirectory, 'mysql_password');
    env.POSTGRES_PASSWORD_FILE = path.join(secretDirectory, 'postgres_password');
    async function start() {
      let output = '';
      child = spawn(process.execPath, ['server/index.mjs'], {env, stdio: ['ignore', 'pipe', 'pipe']});
      child.stdout.on('data', chunk => { output += chunk; });
      child.stderr.on('data', chunk => { output += chunk; });
      child.on('error', error => { output += error.message; });
      for (let attempt = 0; attempt < 100; attempt++) {
        if (child.exitCode !== null) throw new Error(`Hosted test server exited: ${output}`);
        try { if ((await fetch(`${origin}/api/health`)).ok) return; } catch {}
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      throw new Error(`Hosted test server did not become ready: ${output}`);
    }
    await start();
    for (const target of ['//[', '//other.example/api/session', '/\\other.example/']) {
      const status = await new Promise((resolve, reject) => {
        http.get(`${origin}`, { path: target }, response => { response.resume(); resolve(response.statusCode); }).on('error', reject);
      });
      assert.equal(status, 400);
      assert.equal((await fetch(`${origin}/api/health`)).status, 200, 'bad URLs must not terminate the server');
    }
    for (const route of ['/api/health', '/api/session', '/api/leaderboard', '/missing.png']) {
      const response = await fetch(`${origin}${route}`);
      assert.equal(response.headers.get('x-frame-options'), 'DENY');
      assert.match(response.headers.get('content-security-policy'), /frame-ancestors 'none'/);
      assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
    }
    assert.equal((await fetch(`${origin}/api/health`, {headers: {Host: '203.0.113.25'}})).status, 200);
    assert.deepEqual(await (await fetch(`${origin}/api/session`)).json(), {required: false, authenticated: false, hosted: true, googleConfigured: false, user: null, csrfToken: null});
    assert.equal((await fetch(`${origin}/api/state`)).status, 410);
    assert.equal((await fetch(`${origin}/api/problems`)).status, 200);
    assert.equal((await fetch(`${origin}/api/login`, {method:'POST'})).status, 404);
    const headers = {'Content-Type': 'application/json'};
    assert.equal((await fetch(`${origin}/api/state`, {headers: {...headers, Origin: 'https://unrelated.example'}})).status, 403);
    const slug = 'rectangles-area';
    const sql = 'SELECT a.id AS p1,b.id AS p2,ABS((a.x_value-b.x_value)*(a.y_value-b.y_value)) AS area FROM Points a JOIN Points b ON a.id<b.id WHERE a.x_value<>b.x_value AND a.y_value<>b.y_value ORDER BY area DESC,p1,p2';
    for (const engine of ['mysql', 'postgresql']) {
      const response = await fetch(`${origin}/api/query`, {method: 'POST', headers, body: JSON.stringify({slug, sql, engine, mode: 'submit'})});
      const result = await response.json();
      assert.equal(result.verdict, 'Accepted', result.results?.find(r => r.error)?.error || result.error);
      assert.equal(result.passed, 36);
      assert.equal(result.submission.verdict, 'Accepted');
      assert.equal(result.submission.sql, sql);
      assert.equal(result.solved, undefined);
      assert.equal(result.submissions, undefined);
    }
    accountStore = await createAccountStore({config: {...config.postgresql, database}});
    const user = await accountStore.upsertGoogleUser({sub: 'http-test-user', email: 'learner@example.com', name: 'HTTP Learner'});
    await accountStore.saveProfile(user.id, {username:'http_learner',fullName:'HTTP Learner',age:25,profession:'Developer'});
    const session = await accountStore.createSession(user.id);
    const accountHeaders = {...headers, Origin: origin, Cookie: `queryroom_session=${session.token}`, 'X-Queryroom-Account': user.id, 'X-Queryroom-CSRF': session.csrfToken};
    const submit = customHeaders => fetch(`${origin}/api/query`, {method: 'POST', headers: customHeaders, body: JSON.stringify({slug, sql, engine: 'postgresql', mode: 'submit'})});
    const signedIn = await (await submit(accountHeaders)).json();
    assert.equal(signedIn.verdict, 'Accepted');
    assert.equal(signedIn.progress.solved, true);
    assert.equal(signedIn.progress.submissions[0].sql, sql);
    assert.equal((await accountStore.readProgress(user.id, [slug]))[slug].solved, true);
    await accountStore.deleteSession(session.token);
    assert.equal((await submit(accountHeaders)).status, 401, 'expired account tab must not silently submit as a guest');
    const freshGuest = await (await submit({...headers, Cookie: accountHeaders.Cookie})).json();
    assert.equal(freshGuest.verdict, 'Accepted', 'new guest view can practise despite an expired cookie');
    assert.equal(freshGuest.progress, undefined);
    const forbidden = await (await fetch(`${origin}/api/query`, {method: 'POST', headers, body: JSON.stringify({slug, engine: 'postgresql', sql: 'SELECT * FROM queryroom_state.progress'})})).json();
    assert.match(forbidden.results[0].error, /permission denied/i);
    assert.equal((await fetch(`${origin}/api/state/${slug}`, {method: 'PUT', headers, body: JSON.stringify({draft: 'my saved draft', notes: 'my saved notes'})})).status, 410);
    await stop();
    await start();
    assert.equal((await fetch(`${origin}/api/state`)).status, 410);
    assert.deepEqual((await legacyClient.query('SELECT slug,data FROM queryroom_state.progress')).rows, [{slug, data:original}]);
  } finally {
    await stop();
    await mysqlServer?.close();
    for (const item of proxies) await item.close();
    await legacyClient?.end();
    await accountStore?.close();
    await admin.query(`DROP DATABASE IF EXISTS "${database}" WITH (FORCE)`);
    await admin.end();
    if (secretDirectory) await fs.rm(secretDirectory, {recursive:true,force:true});
  }
});
