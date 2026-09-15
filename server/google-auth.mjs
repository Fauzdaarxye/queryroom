import { randomBytes, createHash, timingSafeEqual } from 'node:crypto';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { setting } from './engine-settings.mjs';

const GOOGLE = {
  authorization: 'https://accounts.google.com/o/oauth2/v2/auth',
  token: 'https://oauth2.googleapis.com/token',
  jwks: 'https://www.googleapis.com/oauth2/v3/certs',
};
const same = (a, b) => typeof a === 'string' && typeof b === 'string' && Buffer.byteLength(a) === Buffer.byteLength(b) && timingSafeEqual(Buffer.from(a), Buffer.from(b));
const randomToken = () => randomBytes(32).toString('base64url');
const fail = (status, message) => Object.assign(new Error(message), { status });

export async function googleConfig(access, env = process.env) {
  const clientId = (await setting('GOOGLE_CLIENT_ID', env) || '').trim();
  const clientSecret = (await setting('GOOGLE_CLIENT_SECRET', env) || '').trim();
  const redirectUri = env.GOOGLE_REDIRECT_URI || (access.deployed
    ? 'https://queryroom.duckdns.org/api/auth/google/callback'
    : `http://localhost:${access.port}/api/auth/google/callback`);
  const url = new URL(redirectUri);
  if (url.pathname !== '/api/auth/google/callback' || url.search || url.hash || url.username || url.password
    || (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname)))) {
    throw new Error('GOOGLE_REDIRECT_URI must be your HTTPS /api/auth/google/callback URL, or HTTP localhost for development.');
  }
  return { clientId, clientSecret, redirectUri, origin: url.origin, secure: url.protocol === 'https:', enabled: Boolean(clientId && clientSecret) };
}

export async function verifyGoogleIdentity(token, { clientId, nonce, jwks }) {
  const { payload } = await jwtVerify(token, jwks, {
    algorithms: ['RS256'], issuer: ['https://accounts.google.com', 'accounts.google.com'], audience: clientId,
    requiredClaims: ['sub', 'iat', 'exp', 'nonce', 'email', 'email_verified'], clockTolerance: 5,
  });
  if ((payload.azp && payload.azp !== clientId) || !same(payload.nonce, nonce) || payload.email_verified !== true || typeof payload.sub !== 'string' || payload.sub.length > 255
    || typeof payload.email !== 'string' || payload.email.length > 320) throw new Error('Google identity could not be verified.');
  return { sub: payload.sub, email: payload.email, name: String(payload.name || payload.email.split('@')[0]).slice(0, 120) };
}

export function createGoogleAuth({ store, config, provider = GOOGLE, fetchImpl = fetch, jwks = createRemoteJWKSet(new URL(provider.jwks)) }) {
  const sessionCookie = config.secure ? '__Host-queryroom_session' : 'queryroom_session';
  const flowCookie = config.secure ? '__Host-queryroom_oauth' : 'queryroom_oauth';
  function cookies(req) {
    return Object.fromEntries((req.headers.cookie || '').split(';').map(part => {
      const equals = part.indexOf('=');
      return equals < 0 ? ['', ''] : [part.slice(0, equals).trim(), part.slice(equals + 1).trim()];
    }));
  }
  function setCookie(res, name, value, age) {
    const item = `${name}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${age}${config.secure ? '; Secure' : ''}`;
    res.setHeader('Set-Cookie', [...(res.getHeader('Set-Cookie') || []), item]);
  }
  function redirect(res, location) {
    res.writeHead(303, { Location: location, 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' });
    res.end();
  }
  const cachedSession = Symbol('queryroomSession');
  async function session(req) {
    if (!(cachedSession in req)) req[cachedSession] = await store.session(cookies(req)[sessionCookie]);
    return req[cachedSession];
  }
  function checkAccount(req, value) {
    if (!value) throw fail(401, 'Your session has expired. Sign in again to save to your account.');
    if (req.headers['x-queryroom-account'] !== value.user.id) throw fail(409, 'Your account changed in another tab. Reload this page before continuing.');
    return value;
  }
  function requireWrite(req, value) {
    checkAccount(req, value);
    if (req.headers.origin !== config.origin || !same(req.headers['x-queryroom-csrf'], value.csrfToken)) {
      throw fail(403, 'This request could not be verified. Reload the page and try again.');
    }
  }
  function requireProfile(value) {
    if (!value?.user.profileComplete) throw fail(403, 'Complete your profile before saving account progress.');
  }
  return {
    config, session, checkAccount, requireWrite, requireProfile,
    async sessionInfo(req, hosted) {
      const current = await session(req);
      return { required: false, authenticated: Boolean(current), hosted, googleConfigured: config.enabled,
        user: current?.user || null, csrfToken: current?.csrfToken || null };
    },
    async handle(req, res, url) {
      if (req.method === 'GET' && url.pathname === '/api/auth/google') {
        if (!config.enabled) { redirect(res, '/?auth_error=unavailable'); return true; }
        // Always start on the same origin as the callback so its binding cookie follows.
        if (req.headers.host !== new URL(config.redirectUri).host) { redirect(res, `${config.origin}/api/auth/google`); return true; }
        const state = randomToken(), binding = randomToken(), nonce = randomToken(), verifier = randomToken();
        await store.createFlow({ state, binding, nonce, verifier, redirectUri: config.redirectUri });
        setCookie(res, flowCookie, binding, 600);
        const location = new URL(provider.authorization);
        location.search = new URLSearchParams({ client_id: config.clientId, redirect_uri: config.redirectUri,
          response_type: 'code', scope: 'openid email profile', state, nonce, prompt: 'select_account',
          code_challenge: createHash('sha256').update(verifier).digest('base64url'), code_challenge_method: 'S256' }).toString();
        redirect(res, location.href);
        return true;
      }
      if (req.method === 'GET' && url.pathname === '/api/auth/google/callback') {
        setCookie(res, flowCookie, '', 0);
        try {
          if (!config.enabled) throw new Error('Sign-in is not configured.');
          const flow = await store.consumeFlow(url.searchParams.get('state'), cookies(req)[flowCookie]);
          if (!flow) { redirect(res, '/?auth_error=expired'); return true; }
          if (url.searchParams.has('error')) { redirect(res, '/?auth_error=cancelled'); return true; }
          const code = url.searchParams.get('code');
          if (!code || code.length > 4096) throw new Error('Missing authorization code.');
          const response = await fetchImpl(provider.token, { method: 'POST', signal: AbortSignal.timeout(10000),
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ code,
              client_id: config.clientId, client_secret: config.clientSecret, redirect_uri: flow.redirect_uri,
              grant_type: 'authorization_code', code_verifier: flow.verifier }) });
          if (!response.ok) throw new Error('Token exchange failed.');
          const tokens = await response.json();
          const identity = await verifyGoogleIdentity(tokens.id_token, { clientId: config.clientId, nonce: flow.nonce, jwks });
          const user = await store.upsertGoogleUser(identity);
          await store.deleteSession(cookies(req)[sessionCookie]);
          const signedIn = await store.createSession(user.id);
          setCookie(res, sessionCookie, signedIn.token, 30 * 86400);
          redirect(res, user.profileComplete ? '/dashboard?signed_in=1' : '/onboarding?signed_in=1');
        } catch {
          // Do not expose OAuth codes, provider responses, or credentials in errors or logs.
          redirect(res, '/?auth_error=failed');
        }
        return true;
      }
      if (req.method === 'POST' && url.pathname === '/api/auth/logout') {
        const current = await session(req);
        requireWrite(req, current);
        await store.deleteSession(cookies(req)[sessionCookie]);
        setCookie(res, sessionCookie, '', 0);
        res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
        res.end(JSON.stringify({ signedOut: true }));
        return true;
      }
      return false;
    },
  };
}
