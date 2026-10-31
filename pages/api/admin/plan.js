import { authStaff } from '@/lib/staff';
import { createPlanOrder, getShopPlanRow } from '@/lib/db';
import { createOrder, isConfigured } from '@/lib/razorpay';
import { PLANS, billingState, getPlan, planAmount, termMonths, yearlyPrice } from '@/lib/plans';

// A shop pays for its own plan. GET shows where it stands; POST opens a Razorpay
// order for the plan and term the shop chose (the price is set here, never by the browser).
export default async function handler(req, res) {
  const auth = await authStaff(req);
  if (!auth.shop) return res.status(auth.status || 401).json({ error: auth.error });
  const shop = await getShopPlanRow(auth.shop.id);
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'GET') {
    return res.status(200).json({
      billing: billingState(shop), payEnabled: isConfigured(),
      plans: PLANS.map(p => ({ id: p.id, name: p.name, monthly: p.price, yearly: yearlyPrice(p), maxPrinters: p.maxPrinters })),
    });
  }
  if (req.method === 'POST') {
    if (!isConfigured()) return res.status(503).json({ error: 'Online payment is not available right now. Please contact DocuFast India.' });
    const { plan, term } = req.body || {};
    const p = getPlan(plan);
    if (!p || !['monthly', 'yearly'].includes(term)) return res.status(400).json({ error: 'Choose a plan and monthly or yearly.' });
    const amountPaise = planAmount(p, term) * 100;
    try {
      const { orderId } = await createOrder({ amountPaise, receipt: 'plan-' + Date.now().toString(36) });
      await createPlanOrder({ orderId, shopId: shop.id, plan: p.id, months: termMonths(term), amountPaise });
      return res.status(201).json({ razorpayKeyId: process.env.RAZORPAY_KEY_ID, razorpayOrderId: orderId, amount: amountPaise, description: `${p.name} plan — ${term === 'yearly' ? '12 months' : '1 month'}`, shopName: shop.name });
    } catch (e) {
      console.error('plan order failed:', e.message);
      return res.status(502).json({ error: 'Payment setup failed. Please try again.' });
    }
  }
  return res.status(405).json({ error: 'Method not allowed' });
}
