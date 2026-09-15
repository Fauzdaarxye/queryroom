import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';
import { randomBytes, createHash } from 'node:crypto';
import { generateKeyPair, exportJWK, SignJWT, createLocalJWKSet } from 'jose';
import { createAccountStore } from '../server/account-store.mjs';
import { createGoogleAuth, verifyGoogleIdentity, googleConfig } from '../server/google-auth.mjs';
import { createAccountApi } from '../server/account-api.mjs';
import { adminConnection, engineConfig } from '../server/engines.mjs';
import { runQuery } from '../server/runner.mjs';
import { problems } from '../server/problems/index.mjs';

test('Google sign-in, account isolation, progress and sign-out', { timeout: 30000 }, async t => {
  const schema = `qr_auth_${randomBytes(8).toString('hex')}`;
  const dbConfig = (await engineConfig()).postgresql;
  const store = await createAccountStore({ config: dbConfig, schema });
  const admin = await adminConnection('postgresql');
  const { publicKey, privateKey } = await generateKeyPair('RS256');
  const key = { ...await exportJWK(publicKey), kid: 'google-test-key', alg: 'RS256' };
  const jwks = createLocalJWKSet({ keys: [key] });
  const clientId = 'test-client.apps.googleusercontent.com', clientSecret = randomBytes(32).toString('hex');
  const codes = new Map(), exchanges = [];
  const sign = (claims = {}) => new SignJWT({ nonce: 'nonce', email: 'test@example.com', email_verified: true, name: 'SQL Learner', ...claims })
    .setProtectedHeader({ alg: 'RS256', kid: key.kid }).setSubject(claims.sub || 'google-user-a')
    .setIssuer(claims.iss || 'https://accounts.google.com').setAudience(claims.aud || clientId)
    .setIssuedAt().setExpirationTime(claims.exp || '5m').sign(privateKey);
  const json = (res, value, status = 200) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(value)); };
  const body = async req => { const chunks = []; for await (const chunk of req) chunks.push(chunk); return JSON.parse(Buffer.concat(chunks).toString() || '{}'); };
  let accountApi;
  const server = http.createServer(async (req, res) => {
    try { if (!await accountApi(req, res, new URL(req.url, base))) json(res, { error: 'Not found.' }, 404); }
    catch (error) { json(res, { error: error.message }, error.status || 400); }
  }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  const config = { enabled: true, clientId, clientSecret, redirectUri: `${base}/api/auth/google/callback`, origin: base, secure: false };
  const auth = createGoogleAuth({ store, config, jwks, fetchImpl: async (url, options) => {
    const form = new URLSearchParams(options.body);
    exchanges.push(form);
    const code = codes.get(form.get('code'));
    assert.ok(code, 'only a test authorization code can be exchanged');
    assert.equal(form.get('client_id'), clientId); assert.equal(form.get('client_secret'), clientSecret);
    assert.equal(form.get('redirect_uri'), config.redirectUri);
    assert.equal(createHash('sha256').update(form.get('code_verifier')).digest('base64url'), code.challenge);
    codes.delete(form.get('code'));
    return Response.json({ id_token: await sign({ nonce: code.nonce, sub: code.sub, name: code.name }) });
  } });
  accountApi = createAccountApi({ auth, store, problems, json, body, hosted: false });
  async function request(path, { session, method = 'GET', data, headers = {} } = {}) {
    return fetch(base + path, { method, redirect: 'manual', headers: { ...(session ? { Cookie: session.cookie, 'X-Queryroom-Account': session.info.user.id, 'X-Queryroom-CSRF': session.info.csrfToken } : {}),
      ...(method !== 'GET' ? { Origin: base, 'Content-Type': 'application/json' } : {}), ...headers }, ...(data === undefined ? {} : { body: JSON.stringify(data) }) });
  }
  async function begin(sub = 'google-user-a', name = 'Alice') {
    const response = await request('/api/auth/google');
    assert.equal(response.status, 303);
    const location = new URL(response.headers.get('location'));
    assert.equal(location.origin, 'https://accounts.google.com');
    assert.equal(location.searchParams.get('scope'), 'openid email profile');
    assert.equal(location.searchParams.get('code_challenge_method'), 'S256');
    assert.equal(location.searchParams.get('redirect_uri'), config.redirectUri);
    const cookie = response.headers.getSetCookie()[0].split(';')[0];
    const code = randomBytes(16).toString('hex');
    codes.set(code, { sub, name, nonce: location.searchParams.get('nonce'), challenge: location.searchParams.get('code_challenge') });
    return { cookie, state: location.searchParams.get('state'), code };
  }
  async function login(sub = 'google-user-a', name = 'Alice', complete = true) {
    const flow = await begin(sub, name);
    const response = await request(`/api/auth/google/callback?state=${flow.state}&code=${flow.code}`, { headers: { Cookie: flow.cookie } });
    const cookieHeader = response.headers.getSetCookie().find(cookie => cookie.startsWith('queryroom_session='));
    assert.match(cookieHeader, /HttpOnly/); assert.match(cookieHeader, /SameSite=Lax/); assert.match(cookieHeader, /Path=\//);
    const cookie = cookieHeader.split(';')[0];
    let info = await (await request('/api/session', { headers: { Cookie: cookie } })).json();
    assert.equal(info.authenticated, true);
    assert.equal(response.headers.get('location'), info.user.profileComplete ? '/dashboard?signed_in=1' : '/onboarding?signed_in=1');
    const session = {cookie, info, flow};
    if (complete && !info.user.profileComplete) {
      const saved = await request('/api/profile', {session, method:'PUT', data:{username:sub.replaceAll('-','_'), fullName:name+' Learner', age:22, profession:'Student'}});
      assert.equal(saved.status,200);
      info = await (await request('/api/session', {headers:{Cookie:cookie}})).json();
    }
    return { cookie, info, flow };
  }
  let alice, bob;
  try {
    await t.test('guests remain welcome and cannot access account progress', async () => {
      const info = await (await request('/api/session')).json();
      assert.equal(info.required, false); assert.equal(info.authenticated, false); assert.equal(info.googleConfigured, true);
      assert.equal((await request('/api/progress')).status, 401);
      assert.equal((await request('/api/progress', { headers: { Cookie: 'queryroom_session=forged' } })).status, 401);
    });
    await t.test('signed identity, nonce, code verifier and one-use callback are validated', async () => {
      alice = await login();
      assert.equal(exchanges.length, 1);
      const replay = await request(`/api/auth/google/callback?state=${alice.flow.state}&code=${alice.flow.code}`, { headers: { Cookie: alice.flow.cookie } });
      assert.equal(replay.headers.get('location'), '/?auth_error=expired'); assert.equal(exchanges.length, 1);
      assert.ok(!JSON.stringify(alice.info).includes(clientSecret));
    });
    await t.test('new users complete four profile fields before account writes; usernames are unique', async () => {
      const newUser = await login('profile-user', 'New', false);
      assert.equal(newUser.info.user.profileComplete, false);
      assert.equal((await request('/api/progress/rectangles-area', {session:newUser, method:'PATCH', data:{solved:true}})).status,403);
      const profile={username:'sql_profile', fullName:'New Learner', age:25, profession:'Data analyst'};
      assert.equal((await request('/api/profile',{session:newUser,method:'PUT',data:profile,headers:{'X-Queryroom-CSRF':'wrong'}})).status,403);
      assert.equal((await request('/api/profile',{session:newUser,method:'PUT',data:{...profile,age:0}})).status,400);
      const saved=await (await request('/api/profile',{session:newUser,method:'PUT',data:profile})).json();
      assert.equal(saved.user.profileComplete,true); assert.equal(saved.user.fullName,'New Learner');
      assert.equal(saved.user.username,'sql_profile'); assert.equal(saved.user.age,25);
      assert.equal((await request('/api/progress/rectangles-area', {session:newUser,method:'PATCH',data:{solved:true}})).status,200);
      const returning=await login('profile-user','Changed Google Name');
      assert.equal(returning.info.user.fullName,'New Learner','Google must not overwrite the selected full name');
      const competitor=await login('profile-other','Another',false);
      const attempts=await Promise.all([request('/api/profile',{session:newUser,method:'PUT',data:{...profile,username:'contested_name'}}),request('/api/profile',{session:competitor,method:'PUT',data:{...profile,username:'CONTESTED_NAME'}})]);
      assert.deepEqual(attempts.map(r=>r.status).sort(),[200,409]);
      assert.equal((await request('/api/profile',{headers:{Cookie:newUser.cookie,'X-Queryroom-Account':competitor.info.user.id}})).status,409);
      assert.equal((await request('/api/profile')).status,401);
    });
    await t.test('wrong state, browser binding, cancellation and expiry fail safely', async () => {
      const flow = await begin();
      const noCookie = await request(`/api/auth/google/callback?state=${flow.state}&code=${flow.code}`);
      assert.equal(noCookie.headers.get('location'), '/?auth_error=expired');
      const wrong = await request(`/api/auth/google/callback?state=wrong&code=${flow.code}`, { headers: { Cookie: flow.cookie } });
      assert.equal(wrong.headers.get('location'), '/?auth_error=expired');
      const cancelled = await request(`/api/auth/google/callback?state=${flow.state}&error=access_denied`, { headers: { Cookie: flow.cookie } });
      assert.equal(cancelled.headers.get('location'), '/?auth_error=cancelled');
      const expired = await begin();
      await admin.query(`UPDATE "${schema}".oauth_flows SET expires_at=now()-interval '1 second'`);
      assert.equal((await request(`/api/auth/google/callback?state=${expired.state}&code=${expired.code}`, { headers: { Cookie: expired.cookie } })).headers.get('location'), '/?auth_error=expired');
    });
    await t.test('Google subject, not email, owns progress; account and CSRF checks protect writes', async () => {
      bob = await login('google-user-b', 'Bob');
      assert.notEqual(alice.info.user.id, bob.info.user.id);
      assert.equal(alice.info.user.email, bob.info.user.email);
      const path = '/api/progress/rectangles-area';
      assert.equal((await request(path, { session: alice, method: 'PATCH', data: { solved: true, draft: 'SELECT 1', notes: 'Alice only' } })).status, 200);
      assert.equal((await request(path, { session: alice, method: 'PATCH', data: { solved: false }, headers: { Origin: 'https://attacker.example' } })).status, 403);
      assert.equal((await request(path, { session: alice, method: 'PATCH', data: { solved: false }, headers: { 'X-Queryroom-CSRF': 'forged' } })).status, 403);
      assert.equal((await request(path, { session: bob, method: 'PATCH', data: { solved: false }, headers: { 'X-Queryroom-Account': alice.info.user.id } })).status, 409);
      assert.equal((await request(path, { session: alice, method: 'PATCH', data: { submissions: [] } })).status, 400);
      const aliceSaved = await (await request('/api/progress', { session: alice })).json();
      const bobSaved = await (await request('/api/progress', { session: bob })).json();
      assert.equal(aliceSaved['rectangles-area'].notes, 'Alice only'); assert.equal(bobSaved['rectangles-area'].draft, null);
      assert.equal((await request('/api/progress', { session: bob, headers: { 'X-Queryroom-Account': alice.info.user.id } })).status, 409);
    });
    await t.test('manual status, accepted submissions and concurrent saves survive a new connection', async () => {
      const userId = alice.info.user.id, slug = 'rectangles-area';
      await request(`/api/progress/${slug}`, { session: alice, method: 'PATCH', data: { solved: false } });
      await store.recordSubmission(userId, problems.get(slug), { id: 'wrong', date: new Date().toISOString(), verdict: 'Wrong Answer' });
      assert.equal((await store.readProgress(userId, [slug]))[slug].solved, false);
      await Promise.all([store.patchProgress(userId, slug, { notes: 'concurrent note' }), store.recordSubmission(userId, problems.get(slug), { id: 'accepted', date: new Date().toISOString(), verdict: 'Accepted' })]);
      const another = await createAccountStore({ config: dbConfig, schema });
      try { const saved = (await another.readProgress(userId, [slug]))[slug]; assert.equal(saved.solved, true); assert.equal(saved.notes, 'concurrent note'); assert.equal(saved.submissions.length, 2); }
      finally { await another.close(); }
      await request(`/api/progress/${slug}`, { session: alice, method: 'PATCH', data: { solved: false } });
      assert.equal((await store.readProgress(userId, [slug]))[slug].solved, false);
    });
    await t.test('guest import preserves account edits, is optional and is idempotent', async () => {
      const data = { progress: { 'rectangles-area': { draft: 'guest SQL', notes: 'guest notes', solved: true, bookmarked: true, submissions: [] } } };
      const response = await request('/api/progress/import', { session: alice, method: 'POST', data });
      const result = await response.json();
      assert.equal(result.user.guestImportDone, true); assert.equal(result.progress['rectangles-area'].draft, 'SELECT 1');
      assert.equal(result.progress['rectangles-area'].solved, true); assert.equal(result.progress['rectangles-area'].bookmarked, true);
      await request('/api/progress/rectangles-area', { session: alice, method: 'PATCH', data: { solved: false } });
      await request('/api/progress/import', { session: alice, method: 'POST', data });
      assert.equal((await store.readProgress(alice.info.user.id, ['rectangles-area']))['rectangles-area'].solved, false);
      const skipped = await (await request('/api/progress/import', { session: bob, method: 'POST', data: { skip: true } })).json();
      assert.equal(skipped.user.guestImportDone, true); assert.equal(skipped.progress['rectangles-area'].solved, false);
    });
    await t.test('practice SQL cannot read Google profiles, sessions or progress', async () => {
      for (const table of ['users', 'sessions', 'progress', 'oauth_flows', 'verified_solves']) {
        const result = await runQuery({ slug: 'rectangles-area', engine: 'postgresql', sql: `SELECT * FROM "${schema}".${table}` });
        assert.equal(result.verdict, 'Runtime Error'); assert.match(result.results[0].error, /permission denied/i);
      }
    });
    await t.test('logout revokes that browser session and leaves other devices signed in', async () => {
      const anotherDevice = await login();
      const response = await request('/api/auth/logout', { session: alice, method: 'POST' });
      assert.equal(response.status, 200); assert.match(response.headers.getSetCookie()[0], /Max-Age=0/);
      assert.equal((await request('/api/progress', { session: alice })).status, 401);
      assert.equal((await request('/api/progress', { session: anotherDevice })).status, 200);
    });
    await t.test('bad JWT audience, issuer, nonce, email verification, signature and expiry are rejected', async () => {
      for (const claims of [{ aud: 'another-client' }, { iss: 'https://attacker.example' }, { nonce: 'wrong' }, { email_verified: false }, { exp: Math.floor(Date.now() / 1000) - 60 }]) {
        await assert.rejects(verifyGoogleIdentity(await sign(claims), { clientId, nonce: 'nonce', jwks }));
      }
      const token = await sign(); const parts = token.split('.'); parts[2] = `${parts[2][0] === 'a' ? 'b' : 'a'}${parts[2].slice(1)}`;
      await assert.rejects(verifyGoogleIdentity(parts.join('.'), { clientId, nonce: 'nonce', jwks }));
    });
    await t.test('OAuth uses secure host-only cookies on HTTPS and accepts only exact callback URLs', async () => {
      const production = await googleConfig({ deployed: true, port: 4317 }, { GOOGLE_CLIENT_ID: clientId, GOOGLE_CLIENT_SECRET: clientSecret });
      assert.equal(production.secure, true); assert.equal(production.redirectUri, 'https://queryroom.duckdns.org/api/auth/google/callback');
      await assert.rejects(googleConfig({ deployed: true }, { GOOGLE_REDIRECT_URI: 'http://attacker.example/api/auth/google/callback' }));
      const secureAuth = createGoogleAuth({ store, config: production, jwks });
      const headers = new Map();
      const res = { getHeader: name => headers.get(name), setHeader: (name, value) => headers.set(name, value), writeHead() {}, end() {} };
      await secureAuth.handle({ method: 'GET', headers: { host: 'queryroom.duckdns.org' } }, res, new URL('https://queryroom.duckdns.org/api/auth/google'));
      assert.match(headers.get('Set-Cookie')[0], /^__Host-queryroom_oauth=/); assert.match(headers.get('Set-Cookie')[0], /; Secure$/);
    });
  } finally {
    await new Promise(resolve => server.close(resolve));
    await store.close(); await admin.query(`DROP SCHEMA "${schema}" CASCADE`); await admin.end();
  }
});
