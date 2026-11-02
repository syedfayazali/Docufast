import { appSession } from '@/lib/appauth';
import { getShopPlanRow, getShopById } from '@/lib/db';
import { billingState, getPlan, TRIAL_DAYS } from '@/lib/plans';

// Who is signed in, and (if they have one) their shop and plan. The printer key is handed to the
// app here so nobody ever copies it by hand.
export default async function handler(req, res) {
  const s = await appSession(req);
  if (!s) return res.status(401).json({ error: 'Please sign in again.' });
  res.setHeader('Cache-Control', 'no-store');
  let shop = null;
  if (s.shop_id) {
    const row = await getShopById(s.shop_id);
    const pr = row && await getShopPlanRow(row.id);
    if (row) {
      const p = getPlan(pr.plan);
      shop = { id: row.id, name: row.name, slug: row.slug, city: row.city, active: row.active, agentKey: row.api_key,
        billing: billingState(pr), maxPrinters: p ? p.maxPrinters : 1, planName: p ? p.name : null };
    }
  }
  return res.status(200).json({ user: { email: s.email, name: s.name }, shop, trialDays: TRIAL_DAYS });
}
