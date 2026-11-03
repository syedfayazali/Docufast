export function getBaseUrl(req) {
  if (process.env.BASE_URL) return process.env.BASE_URL;
  const proto = req.headers['x-forwarded-proto'] || 'https';
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  if (/vercel\.app$/.test(host || '')) return 'https://print.docufastindia.com';
  return `${proto}://${host}`;
}
