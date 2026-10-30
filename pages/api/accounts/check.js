import { lookupAccount, rateLimit, clientIp } from '@/lib/db';

// Customer-facing: confirm a business account code and show its name and
// remaining credit. Unknown codes get the same generic answer.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!(await rateLimit('acct:' + clientIp(req), 15, 600))) return res.status(429).json({ error: 'Too many tries. Please wait a few minutes.' });
  const acc = await lookupAccount(req.body?.code);
  if (!acc) return res.status(404).json({ error: 'That account code is not valid.' });
  return res.status(200).json({ name: acc.name, available: acc.available });
}
