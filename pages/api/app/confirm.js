import { completeSignup } from '@/lib/db';
import { verifySubscriptionSignature } from '@/lib/razorpay';

// Called by the in-app payment window after Razorpay approves the AutoPay. The webhook does
// the same; whichever arrives first creates the shop, and the signed-in e-mail owns it.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const b = req.body || {};
  if (!verifySubscriptionSignature({ razorpay_payment_id: b.razorpay_payment_id, razorpay_subscription_id: b.razorpay_subscription_id, razorpay_signature: b.razorpay_signature }))
    return res.status(400).json({ error: 'Payment signature verification failed' });
  try {
    const r = await completeSignup(b.razorpay_subscription_id, b.razorpay_payment_id);
    return res.status(r.found ? 200 : 404).json({ ok: r.found });
  } catch (e) {
    console.error('app confirm failed:', e.message);
    return res.status(500).json({ error: 'Setting up your shop is taking a moment. The app will finish it automatically.' });
  }
}
