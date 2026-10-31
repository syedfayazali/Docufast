import { authStaff } from '@/lib/staff';
import { finalizePlanOrder, getShopPlanRow } from '@/lib/db';
import { verifySignature } from '@/lib/razorpay';
import { billingState } from '@/lib/plans';

// Browser confirmation after a plan payment. The signature proves Razorpay took the money.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const auth = await authStaff(req);
  if (!auth.shop) return res.status(auth.status || 401).json({ error: auth.error });
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body || {};
  if (!verifySignature({ razorpay_order_id, razorpay_payment_id, razorpay_signature })) {
    return res.status(400).json({ error: 'Payment signature verification failed' });
  }
  const r = await finalizePlanOrder(razorpay_order_id, razorpay_payment_id, auth.shop.id);
  if (!r.found) return res.status(404).json({ error: 'Order not found for this shop' });
  return res.status(200).json({ ok: true, billing: billingState(await getShopPlanRow(auth.shop.id)) });
}
