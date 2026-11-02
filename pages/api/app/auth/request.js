import { createEmailCode, normEmail, rateLimit, clientIp } from '@/lib/db';
import { sendLoginCode } from '@/lib/mail';

// Step 1 of sign-in: e-mail a 6-digit code. The answer never says whether the address is known.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const email = normEmail(req.body && req.body.email);
  if (!/^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/.test(email)) return res.status(400).json({ error: 'Enter a valid email address.' });
  if (!(await rateLimit('otp:' + email, 4, 900)) || !(await rateLimit('otpip:' + clientIp(req), 12, 900)))
    return res.status(429).json({ error: 'Too many codes requested. Please wait a few minutes.' });
  try {
    const { code } = await createEmailCode(email);
    await sendLoginCode(email, code);
  } catch (e) {
    console.error('send code failed:', e.message);
    return res.status(503).json({ error: 'We could not send the email right now. Please try again shortly.' });
  }
  return res.status(200).json({ ok: true });
}
