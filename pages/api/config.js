export default function handler(req, res) {
  const proto = req.headers['x-forwarded-proto'] || 'https';
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  return res.status(200).json({ baseUrl: process.env.BASE_URL || `${proto}://${host}` });
}
