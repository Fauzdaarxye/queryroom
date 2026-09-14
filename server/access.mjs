import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { setting } from './engine-settings.mjs';

const digest = value => createHash('sha256').update(value).digest();
export async function createAccess(env=process.env) {
  const port=Number(env.PORT || 4317),host=env.HOST || '127.0.0.1';
  const password=await setting('QUERYROOM_ACCESS_PASSWORD',env);
  // The single-host Compose setup accepts its HTTP address automatically while
  // still requiring login and rejecting browser requests from other origins.
  const automaticOrigin=env.QUERYROOM_AUTO_ORIGIN==='true';
  const deployed=env.QUERYROOM_ENGINE_MODE==='external' || !['localhost','127.0.0.1','::1'].includes(host);
  if(deployed && (!password || password.length<16)) throw new Error('Set QUERYROOM_ACCESS_PASSWORD to at least 16 characters for a deployed workspace.');
  if(deployed && !env.QUERYROOM_ALLOWED_ORIGINS && !automaticOrigin) throw new Error('Set QUERYROOM_ALLOWED_ORIGINS to the exact URL(s) where you will open Queryroom.');
  const origins=new Set([`http://localhost:${port}`,`http://127.0.0.1:${port}`]);
  for(const item of (env.QUERYROOM_ALLOWED_ORIGINS || '').split(',').map(s=>s.trim()).filter(Boolean)) {
    const url=new URL(item);
    if(url.origin!==item || !['http:','https:'].includes(url.protocol) || url.username || url.password) throw new Error('Allowed origins must be complete origins such as https://queryroom.example.com, with no path.');
    if(url.protocol!=='https:' && !['localhost','127.0.0.1','[::1]'].includes(url.hostname)) throw new Error('Use HTTPS for public Queryroom origins.');
    origins.add(url.origin);
  }
  const hosts=new Set([...origins].map(origin=>new URL(origin).host));
  const secure=[...origins].some(origin=>origin.startsWith('https://'));
  const sign=value=>createHmac('sha256',password).update(value).digest('hex');
  let failures=[];
  return {
    port,host,deployed,required:Boolean(password),
    accepts(req) {
      const requestHost=req.headers.host || '';
      if(!automaticOrigin) return hosts.has(requestHost) && (!req.headers.origin || origins.has(req.headers.origin));
      try {
        const url=new URL(`http://${requestHost}`);
        if(!requestHost || url.host!==requestHost || url.pathname!=='/' || url.username || url.password || url.search || url.hash) return false;
        return !req.headers.origin || req.headers.origin===url.origin;
      } catch {return false;}
    },
    authenticated(req) {
      if(!password) return true;
      const token=(req.headers.cookie || '').split(';').map(s=>s.trim()).find(s=>s.startsWith('queryroom_session='))?.slice('queryroom_session='.length);
      if(!token) return false;
      const [expires,nonce,signature,...extra]=token.split('.');
      if(extra.length || !/^\d+$/.test(expires) || !/^[a-f0-9]{32}$/.test(nonce || '') || !/^[a-f0-9]{64}$/.test(signature || '') || Number(expires)<Date.now() || Number(expires)>Date.now()+7*86400000+1000) return false;
      return timingSafeEqual(Buffer.from(signature,'hex'),Buffer.from(sign(`${expires}.${nonce}`),'hex'));
    },
    login(candidate) {
      failures=failures.filter(time=>time>Date.now()-60000);
      if(failures.length>=10) return {status:429,error:'Too many attempts. Wait a minute and try again.'};
      if(!password || typeof candidate!=='string' || !timingSafeEqual(digest(candidate),digest(password))) {failures.push(Date.now());return {status:401,error:'Incorrect workspace password.'};}
      failures=[];
      const payload=`${Date.now()+7*86400000}.${randomBytes(16).toString('hex')}`;
      return {cookie:`queryroom_session=${payload}.${sign(payload)}; Path=/api; HttpOnly; SameSite=Lax; Max-Age=604800${secure?'; Secure':''}`};
    },
    logoutCookie:`queryroom_session=; Path=/api; HttpOnly; SameSite=Lax; Max-Age=0${secure?'; Secure':''}`,
  };
}
