import { authStaff } from '@/lib/staff';
import { createPlanOrder, getShopPlanRow, setSubscriptionStatus } from '@/lib/db';
import { createOrder, isConfigured, cancelRzpSubscription } from '@/lib/razorpay';
import { newSubscription } from '@/lib/billing';
import { PLANS, billingState, getPlan, planAmount, termMonths, yearlyPrice } from '@/lib/plans';

// A shop pays for its own plan. GET shows where it stands; POST starts a payment for the
// plan and term chosen (price is set here, never by the browser): mode "auto" (default) is a
// recurring AutoPay subscription, mode "once" is a single payment. DELETE stops auto-renew.
export default async function handler(req, res) {
  const auth = await authStaff(req);
  if (!auth.shop) return res.status(auth.status || 401).json({ error: auth.error });
  const shop = await getShopPlanRow(auth.shop.id);
  res.setHeader('Cache-Control', 'no-store');
  const autoOn = !!shop.rzp_sub_id && shop.sub_status === 'active';

  if (req.method === 'GET') {
    return res.status(200).json({
      billing: billingState(shop), payEnabled: isConfigured(),
      auto: { on: autoOn, status: shop.sub_status || null, term: shop.sub_term || null },
      plans: PLANS.map(p => ({ id: p.id, name: p.name, monthly: p.price, yearly: yearlyPrice(p), maxPrinters: p.maxPrinters })),
    });
  }
  if (req.method === 'POST') {
    if (!isConfigured()) return res.status(503).json({ error: 'Online payment is not available right now. Please contact DocuFast India.' });
    const { plan, term, mode } = req.body || {};
    const p = getPlan(plan);
    if (!p || !['monthly', 'yearly'].includes(term)) return res.status(400).json({ error: 'Choose a plan and monthly or yearly.' });
    const amountPaise = planAmount(p, term) * 100;
    const description = `${p.name} plan — ${term === 'yearly' ? '12 months' : '1 month'}`;
    try {
      if (mode !== 'once') {
        if (autoOn) return res.status(409).json({ error: 'Auto-renew is already on. Stop it first if you want to change plan.' });
        const subId = await newSubscription(p, term, { shop: shop.name });
        await createPlanOrder({ orderId: subId, shopId: shop.id, plan: p.id, months: termMonths(term), amountPaise, kind: 'sub' });
        return res.status(201).json({ autopay: true, razorpayKeyId: process.env.RAZORPAY_KEY_ID, razorpaySubscriptionId: subId, amount: amountPaise, description, shopName: shop.name });
      }
      const { orderId } = await createOrder({ amountPaise, receipt: 'plan-' + Date.now().toString(36) });
      await createPlanOrder({ orderId, shopId: shop.id, plan: p.id, months: termMonths(term), amountPaise });
      return res.status(201).json({ autopay: false, razorpayKeyId: process.env.RAZORPAY_KEY_ID, razorpayOrderId: orderId, amount: amountPaise, description, shopName: shop.name });
    } catch (e) {
      console.error('plan payment failed:', e?.error?.description || e.message);
      return res.status(502).json({ error: mode !== 'once' ? 'Auto-renew could not be started. You can pay once instead, or contact DocuFast India.' : 'Payment setup failed. Please try again.' });
    }
  }
  if (req.method === 'DELETE') {
    if (!shop.rzp_sub_id || !autoOn) return res.status(400).json({ error: 'Auto-renew is not on.' });
    try {
      await cancelRzpSubscription(shop.rzp_sub_id);
      await setSubscriptionStatus(shop.rzp_sub_id, 'cancelled');
      return res.status(200).json({ ok: true });
    } catch (e) {
      console.error('cancel subscription failed:', e?.error?.description || e.message);
      return res.status(502).json({ error: 'Could not stop auto-renew right now. Please try again or contact DocuFast India.' });
    }
  }
  return res.status(405).json({ error: 'Method not allowed' });
}
