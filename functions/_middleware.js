/* Runs on every request to the site: serves only the app and its API, and adds security headers. */
const ALLOWED = /^\/(?:$|index\.html$|app(?:\/.*)?$|api\/.*$|favicon\.ico$)/;
const CSP = [
  "default-src 'self'",
  "script-src 'self' https://cdn.jsdelivr.net",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data:",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join('; ');

export async function onRequest({ request, next }) {
  const url = new URL(request.url);
  if (!ALLOWED.test(url.pathname)) return new Response('Not found', { status: 404, headers: { 'content-type': 'text/plain' } });
  const res = await next();
  const out = new Response(res.body, res);
  const h = out.headers;
  h.set('strict-transport-security', 'max-age=31536000; includeSubDomains');
  h.set('x-content-type-options', 'nosniff');
  h.set('x-frame-options', 'DENY');
  h.set('referrer-policy', 'strict-origin-when-cross-origin');
  h.set('permissions-policy', 'camera=(), microphone=(), geolocation=(), payment=()');
  if ((h.get('content-type') || '').includes('text/html')) h.set('content-security-policy', CSP);
  return out;
}
