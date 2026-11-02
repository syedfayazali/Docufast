import { appSession } from '@/lib/appauth';
import { createPlanSignup, hasUsedTrial, rateLimit, clientIp, setAppUserName } from '@/lib/db';
import { isConfigured } from '@/lib/razorpay';
import { newSubscription } from '@/lib/billing';
import { getPlan, planAmount, termMonths, TRIAL_DAYS } from '@/lib/plans';

const clean = (v, max) => String(v == null ? '' : v).replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max);

// A signed-in owner without a shop registers it and starts the AutoPay subscription (7-day trial
// or pay now). The shop itself is created only once Razorpay confirms.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const s = await appSession(req);
  if (!s) return res.status(401).json({ error: 'Please sign in again.' });
  if (s.shop_id) return res.status(409).json({ error: 'You already have a shop.' });
  if (!isConfigured()) return res.status(503).json({ error: 'Online payment is not available right now.' });
  if (!(await rateLimit('appreg:' + clientIp(req), 10, 600))) return res.status(429).json({ error: 'Too many tries. Please wait a few minutes.' });

  const b = req.body || {};
  const shopName = clean(b.shopName, 80), ownerName = clean(b.ownerName, 80), city = clean(b.city, 60);
  const phone = clean(b.phone, 20).replace(/[\s-]/g, '').replace(/^(\+91|91|0)(?=\d{10}$)/, '');
  const plan = getPlan(b.plan), term = b.term === 'yearly' ? 'yearly' : 'monthly', trial = !!b.trial;
  if (!plan) return res.status(400).json({ error: 'Choose a plan.' });
  if (shopName.length < 2) return res.status(400).json({ error: 'Enter your shop name.' });
  if (ownerName.length < 2) return res.status(400).json({ error: 'Enter your name.' });
  if (!/^[6-9]\d{9}$/.test(phone)) return res.status(400).json({ error: 'Enter a valid 10-digit mobile number.' });
  if (trial && (await hasUsedTrial(phone, s.email))) return res.status(409).json({ error: 'The free trial was already used with this email or mobile number. Please subscribe to continue.' });

  const amountPaise = planAmount(plan, term) * 100;
  const startAt = trial ? Math.floor(Date.now() / 1000) + TRIAL_DAYS * 86400 + 3600 : null;
  try {
    const subId = await newSubscription(plan, term, { shop: shopName, email: s.email }, startAt);
    await createPlanSignup({ orderId: subId, shopName, ownerName, phone, email: s.email, city, plan: plan.id, months: termMonths(term), amountPaise, trial, userId: s.id });
    await setAppUserName(s.id, ownerName);
    return res.status(201).json({
      razorpayKeyId: process.env.RAZORPAY_KEY_ID, subscriptionId: subId, trial,
      description: trial ? `${TRIAL_DAYS}-day free trial, then ${plan.name} plan` : `${plan.name} plan`,
      prefill: { name: ownerName, email: s.email, contact: phone },
    });
  } catch (e) {
    console.error('app register failed:', e?.error?.description || e.message);
    return res.status(502).json({ error: 'Could not start the subscription. Please try again.' });
  }
}
