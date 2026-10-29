// Change the owner password. POST { current, next }. Needs a signed-in session
// AND the current password, so a left-open browser can't be used to take over.
import { verifyOwnerPassword, setOwnerPassword } from '@/lib/db';
import { isOwner, safeEqual } from '@/lib/auth';

const MIN_LENGTH = 10;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!isOwner(req)) return res.status(401).json({ error: 'Unauthorized' });
  res.setHeader('Cache-Control', 'no-store');

  const { current, next } = req.body || {};
  if (typeof next !== 'string' || next.length < MIN_LENGTH) {
    return res.status(400).json({ error: `New password must be at least ${MIN_LENGTH} characters.` });
  }
  if (safeEqual(next, process.env.OWNER_KEY)) {
    return res.status(400).json({ error: 'Choose a password different from the old shared key.' });
  }

  const check = await verifyOwnerPassword(current);
  if (!check.ok) return res.status(check.status || 401).json({ error: check.error === 'Wrong password' ? 'Current password is wrong' : check.error });

  await setOwnerPassword(next);
  return res.status(200).json({ ok: true });
}
