import { isOwner } from '@/lib/auth';
import { createFreeAccount, listFreeAccounts } from '@/lib/db';

// Owner-only: accounts that never need a subscription. "owner" = your own shop (Pro, no end date);
// "test" = a Pro account for N days to try or demo the app. Both sign in to the desktop app by email code.
export default async function handler(req, res) {
  if (!isOwner(req)) return res.status(401).json({ error: 'Unauthorized' });
  try {
    if (req.method === 'GET') return res.status(200).json({ accounts: await listFreeAccounts() });
    if (req.method === 'POST') {
      const { email, shopName, type, days } = req.body || {};
      if (!['owner', 'test'].includes(type)) return res.status(400).json({ error: 'Type must be owner or test' });
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim())) return res.status(400).json({ error: 'Enter a valid email address' });
      const name = String(shopName || '').trim().slice(0, 80);
      if (name.length < 2) return res.status(400).json({ error: 'Enter a shop name' });
      return res.status(201).json({ ok: true, account: await createFreeAccount({ email, shopName: name, type, days }) });
    }
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e) { return res.status(400).json({ error: e.message }); }
}
