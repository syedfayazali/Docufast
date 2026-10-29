// Lets the owner page ask "am I signed in?" and whether the owner has chosen
// a personal password yet (until then the shared OWNER_KEY is the password).
import { ownerPasswordIsSet } from '@/lib/db';
import { isOwner } from '@/lib/auth';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  res.setHeader('Cache-Control', 'no-store');
  if (!isOwner(req)) return res.status(401).json({ error: 'Not signed in' });
  return res.status(200).json({ ok: true, passwordSet: await ownerPasswordIsSet() });
}
