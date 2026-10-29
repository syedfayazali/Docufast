import { lookupAccount } from '@/lib/db';

// Customer-facing: confirm a business account code and show its name and
// remaining credit. Unknown codes get the same generic answer.
const hits = new Map();
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'x';
  const now = Date.now(); const h = (hits.get(ip) || []).filter(t => now - t < 10 * 60000);
  if (h.length >= 15) return res.status(429).json({ error: 'Too many tries. Please wait a few minutes.' });
  h.push(now); hits.set(ip, h);
  const acc = await lookupAccount(req.body?.code);
  if (!acc) return res.status(404).json({ error: 'That account code is not valid.' });
  return res.status(200).json({ name: acc.name, available: acc.available });
}
