import { isOwner } from '@/lib/auth';
import { listSubscriptions, setShopTrial, recordShopPayment, clearShopPlan } from '@/lib/db';
import { PLANS, TRIAL_DAYS, YEARLY_MONTHS_PAID, billingState, getPlan } from '@/lib/plans';

// Owner-only: every shop's plan, trial / paid-until date, and the payments recorded.
export default async function handler(req, res) {
  if (!isOwner(req)) return res.status(401).json({ error: 'Unauthorized' });
  try {
    if (req.method === 'GET') {
      const { shops, payments } = await listSubscriptions();
      return res.status(200).json({
        plans: PLANS.map(p => ({ id: p.id, name: p.name, price: p.price })), trialDays: TRIAL_DAYS, yearlyMonthsPaid: YEARLY_MONTHS_PAID,
        shops: shops.map(s => ({ id: s.id, name: s.name, active: s.active, ...billingState(s), trial: !!s.plan_trial,
          payments: payments.filter(p => p.shop_id === s.id).slice(0, 5) })),
      });
    }
    if (req.method === 'POST') {
      const { shopId, action, plan, days, months, amount, note } = req.body || {};
      if (action === 'clear') { await clearShopPlan(shopId); return res.status(200).json({ ok: true }); }
      if (!getPlan(plan)) return res.status(400).json({ error: 'Plan must be starter or pro' });
      if (action === 'trial') { await setShopTrial(shopId, plan, days); return res.status(200).json({ ok: true }); }
      if (action === 'payment') { await recordShopPayment(shopId, plan, months, Math.round(Number(amount) * 100), note); return res.status(200).json({ ok: true }); }
      return res.status(400).json({ error: 'Unknown action' });
    }
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e) { return res.status(400).json({ error: e.message }); }
}
