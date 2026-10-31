import { PLANS, TRIAL_DAYS, yearlyPrice } from '@/lib/plans';

// Public: plans and trial length for the landing page.
export default function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  res.setHeader('Cache-Control', 'public, max-age=300');
  return res.status(200).json({ plans: PLANS.map(p => ({ ...p, yearly: yearlyPrice(p) })), trialDays: TRIAL_DAYS, whatsapp: (process.env.SUPPORT_WHATSAPP || '').replace(/\D/g, '') || null });
}
