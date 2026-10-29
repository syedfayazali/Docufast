// Owner sign-in. POST { password } -> sets a 12-hour HttpOnly session cookie.
// Wrong passwords are counted; 5 misses lock sign-in for 10 minutes.
import { verifyOwnerPassword } from '@/lib/db';
import { createOwnerSession, ownerCookie, sessionsConfigured } from '@/lib/auth';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  res.setHeader('Cache-Control', 'no-store');

  if (!sessionsConfigured()) {
    return res.status(500).json({ error: 'Owner login is not set up. Add OWNER_KEY (or SESSION_SECRET) in Vercel environment variables.' });
  }

  const { password } = req.body || {};
  const result = await verifyOwnerPassword(password);
  if (!result.ok) return res.status(result.status || 401).json({ error: result.error });

  res.setHeader('Set-Cookie', ownerCookie(createOwnerSession()));
  return res.status(200).json({ ok: true });
}
