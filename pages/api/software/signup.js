import { createShopLead } from '@/lib/db';
import { planIds } from '@/lib/plans';

const clean = (v, max) => String(v == null ? '' : v).replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max);

// Public: a shop owner asks for a free trial from the landing page.
// It only records a lead for the owner to follow up; nothing is created or charged here.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const b = req.body || {};
  if (b.website) return res.status(200).json({ ok: true });   // honeypot: real people leave this blank

  const yearly = b.term === 'yearly';
  const shopName = clean(b.shopName, 80), ownerName = clean(b.ownerName, 80), city = clean(b.city, 60), note = (yearly ? 'Wants YEARLY billing. ' : '') + clean(b.note, 380);
  const phone = clean(b.phone, 20).replace(/[\s-]/g, '').replace(/^(\+91|91|0)(?=\d{10}$)/, '');
  const email = clean(b.email, 120);
  const printers = Math.round(Number(b.printers) || 1);
  const plan = planIds.includes(b.plan) ? b.plan : planIds[0];

  if (shopName.length < 2) return res.status(400).json({ error: 'Enter your shop name.' });
  if (ownerName.length < 2) return res.status(400).json({ error: 'Enter your name.' });
  if (!/^[6-9]\d{9}$/.test(phone)) return res.status(400).json({ error: 'Enter a valid 10-digit mobile number.' });
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'That email address does not look right.' });
  if (printers < 1 || printers > 50) return res.status(400).json({ error: 'Printers must be between 1 and 50.' });

  try {
    const r = await createShopLead({ shopName, ownerName, phone, email, city, printers, plan, note });
    if (r.limited) return res.status(429).json({ error: 'We already have your requests. We will call you soon.' });
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error('signup error:', e.message);
    return res.status(500).json({ error: 'Could not save your request. Please try again.' });
  }
}
