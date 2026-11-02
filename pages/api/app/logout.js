import { revokeAppSession } from '@/lib/db';
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const m = /^Bearer (\S+)$/.exec(req.headers.authorization || '');
  if (m) await revokeAppSession(m[1]);
  return res.status(200).json({ ok: true });
}
