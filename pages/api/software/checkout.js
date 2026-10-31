import { createPlanSignup, rateLimit, clientIp } from '@/lib/db';
import { createOrder, isConfigured } from '@/lib/razorpay';
import { getPlan, planAmount, termMonths } from '@/lib/plans';

const clean = (v, max) => String(v == null ? '' : v).replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max);

// Public: a shop owner buys a plan from the landing page. Nothing is created until
// Razorpay confirms the payment; the price is set here, never by the browser.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!isConfigured()) return res.status(503).json({ error: 'Online payment is not available right now. Please request a free trial instead.' });
  if (!(await rateLimit('buy:' + clientIp(req), 8, 600))) return res.status(429).json({ error: 'Too many tries. Please wait a few minutes.' });

  const b = req.body || {};
  if (b.website) return res.status(200).json({ ok: true });  // honeypot
  const shopName = clean(b.shopName, 80), ownerName = clean(b.ownerName, 80), city = clean(b.city, 60), email = clean(b.email, 120);
  const phone = clean(b.phone, 20).replace(/[\s-]/g, '').replace(/^(\+91|91|0)(?=\d{10}$)/, '');
  const plan = getPlan(b.plan), term = b.term === 'yearly' ? 'yearly' : 'monthly';
  if (!plan) return res.status(400).json({ error: 'Choose a plan.' });
  if (shopName.length < 2) return res.status(400).json({ error: 'Enter your shop name.' });
  if (ownerName.length < 2) return res.status(400).json({ error: 'Enter your name.' });
  if (!/^[6-9]\d{9}$/.test(phone)) return res.status(400).json({ error: 'Enter a valid 10-digit mobile number.' });
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'That email address does not look right.' });

  const amountPaise = planAmount(plan, term) * 100;
  try {
    const { orderId } = await createOrder({ amountPaise, receipt: 'buy-' + Date.now().toString(36) });
    await createPlanSignup({ orderId, shopName, ownerName, phone, email, city, plan: plan.id, months: termMonths(term), amountPaise });
    return res.status(201).json({ razorpayKeyId: process.env.RAZORPAY_KEY_ID, razorpayOrderId: orderId, amount: amountPaise,
      description: `${plan.name} plan — ${term === 'yearly' ? '12 months' : '1 month'}`, prefill: { name: ownerName, contact: phone, email } });
  } catch (e) {
    console.error('buy checkout failed:', e.message);
    return res.status(502).json({ error: 'Payment setup failed. Please try again.' });
  }
}
