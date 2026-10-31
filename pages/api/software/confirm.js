import { completeSignup, takeSignupCredentials } from '@/lib/db';
import { verifySignature } from '@/lib/razorpay';

const wait = ms => new Promise(r => setTimeout(r, ms));

// After paying: Razorpay's signature proves the payment, the shop is created (or already was,
// via the webhook), and the login details are shown ONCE.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body || {};
  if (!verifySignature({ razorpay_order_id, razorpay_payment_id, razorpay_signature })) {
    return res.status(400).json({ error: 'Payment signature verification failed' });
  }
  try {
    let r = await completeSignup(razorpay_order_id, razorpay_payment_id);
    if (!r.found) return res.status(404).json({ error: 'Order not found' });
    for (let i = 0; i < 6 && !r.created && !r.ready; i++) { await wait(700); r = await completeSignup(razorpay_order_id, razorpay_payment_id); }
    const c = await takeSignupCredentials(razorpay_order_id);
    res.setHeader('Cache-Control', 'no-store');
    if (!c) return res.status(200).json({ ok: true, delivered: true });   // already shown once
    return res.status(200).json({ ok: true, shopCode: c.shop_code, pin: c.pin_once, agentKey: c.agent_key, shopName: c.shop_name, plan: c.plan });
  } catch (e) {
    console.error('signup confirm failed:', e.message);
    return res.status(500).json({ error: 'We received your payment but could not finish setting up. We will call you shortly.' });
  }
}
