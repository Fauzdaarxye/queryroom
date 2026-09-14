export async function createAccess(env=process.env) {
  const port=Number(env.PORT || 4317),host=env.HOST || '127.0.0.1';
  // The single-host Compose setup accepts its public address automatically while
  // rejecting browser requests from other origins.
  const automaticOrigin=env.QUERYROOM_AUTO_ORIGIN==='true';
  // Enable only behind our proxy, with the app port unpublished. Caddy overwrites
  // X-Forwarded-Proto; direct/local servers must not trust a client-supplied value.
  const trustProxy=env.QUERYROOM_TRUST_PROXY==='true';
  const deployed=env.QUERYROOM_ENGINE_MODE==='external' || !['localhost','127.0.0.1','::1'].includes(host);
  if(deployed && !env.QUERYROOM_ALLOWED_ORIGINS && !automaticOrigin) throw new Error('Set QUERYROOM_ALLOWED_ORIGINS to the exact URL(s) where you will open Queryroom.');
  const origins=new Set([`http://localhost:${port}`,`http://127.0.0.1:${port}`]);
  for(const item of (env.QUERYROOM_ALLOWED_ORIGINS || '').split(',').map(s=>s.trim()).filter(Boolean)) {
    const url=new URL(item);
    if(url.origin!==item || !['http:','https:'].includes(url.protocol) || url.username || url.password) throw new Error('Allowed origins must be complete origins such as https://queryroom.example.com, with no path.');
    if(url.protocol!=='https:' && !['localhost','127.0.0.1','[::1]'].includes(url.hostname)) throw new Error('Use HTTPS for public Queryroom origins.');
    origins.add(url.origin);
  }
  const hosts=new Set([...origins].map(origin=>new URL(origin).host));
  return {
    port,host,deployed,
    accepts(req) {
      const requestHost=req.headers.host || '';
      if(!automaticOrigin) return hosts.has(requestHost) && (!req.headers.origin || origins.has(req.headers.origin));
      try {
        const protocol=trustProxy ? (req.headers['x-forwarded-proto'] || 'http') : 'http';
        if(!['http','https'].includes(protocol)) return false;
        const url=new URL(`${protocol}://${requestHost}`);
        if(!requestHost || url.host!==requestHost || url.pathname!=='/' || url.username || url.password || url.search || url.hash) return false;
        return !req.headers.origin || req.headers.origin===url.origin;
      } catch {return false;}
    },
  };
}
