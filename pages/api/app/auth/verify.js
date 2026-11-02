import { checkEmailCode, createAppSession, normEmail, rateLimit, clientIp } from '@/lib/db';

// Step 2: the code proves the e-mail address. The session returned works only on this computer.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const b = req.body || {};
  const email = normEmail(b.email), machineId = String(b.machineId || '').slice(0, 100);
  if (!email || !machineId) return res.status(400).json({ error: 'Missing details.' });
  if (!(await rateLimit('otpv:' + clientIp(req), 20, 900))) return res.status(429).json({ error: 'Too many tries. Please wait a few minutes.' });
  const user = await checkEmailCode(email, b.code);
  if (!user) return res.status(401).json({ error: 'That code is wrong or has expired.' });
  const token = await createAppSession(user.id, machineId, String(b.machineName || '').slice(0, 80));
  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json({ ok: true, token, email: user.email, hasShop: !!user.shop_id });
}
