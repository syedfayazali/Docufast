import { quoteOrder } from '@/lib/quote';

// Customer asks "does this code work on my order, and what do I save?".
// The subtotal is recomputed here from the shop's prices — never trusted from the browser.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const b = req.body || {};
  const q = await quoteOrder({ ...b, couponCode: b.code });
  res.setHeader('Cache-Control', 'no-store');
  if (q.error) return res.status(200).json({ valid: false, message: q.error });
  return res.status(200).json({ valid: true, code: q.coupon.code, discount: q.discount, total: q.total });
}
