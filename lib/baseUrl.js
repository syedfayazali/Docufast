// Derives the app's own public URL from the incoming request. On Vercel this
// is automatically correct for the production domain, any custom domain, and
// preview deployments alike — no env var to keep in sync. BASE_URL can still
// be set manually to override (e.g. if you put this behind another proxy).
export function getBaseUrl(req) {
  if (process.env.BASE_URL) return process.env.BASE_URL;
  const proto = req.headers['x-forwarded-proto'] || 'https';
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  return `${proto}://${host}`;
}
