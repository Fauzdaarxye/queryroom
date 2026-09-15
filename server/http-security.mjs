export function securityHeaders(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Content-Security-Policy', "frame-ancestors 'none'; object-src 'none'; base-uri 'self'");
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
}

export function requestUrl(target) {
  try {
    // A request path cannot replace the authority with //host or an absolute URL.
    if (typeof target !== 'string' || !target.startsWith('/') || target.startsWith('//')) throw new Error();
    const url = new URL(target, 'http://queryroom.invalid');
    if (url.origin !== 'http://queryroom.invalid' || url.hash) throw new Error();
    return url;
  } catch {
    throw Object.assign(new Error('Invalid request URL.'), { status: 400 });
  }
}
