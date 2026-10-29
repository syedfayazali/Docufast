import { isOwner } from '@/lib/auth';
import { listCoupons, createCoupon, setCouponActive } from '@/lib/db';

// Owner-only coupon / referral code management.
export default async function handler(req, res) {
  if (!isOwner(req)) return res.status(401).json({ error: 'Unauthorized' });
  if (req.method === 'GET') return res.status(200).json({ coupons: await listCoupons() });
  if (req.method === 'POST') {
    try { return res.status(201).json({ coupon: await createCoupon(req.body || {}) }); }
    catch (e) { return res.status(e.code === '23505' ? 409 : 400).json({ error: e.code === '23505' ? 'That code already exists' : e.message }); }
  }
  if (req.method === 'PATCH') {
    const c = await setCouponActive(req.body?.code, !!req.body?.active);
    return c ? res.status(200).json({ coupon: c }) : res.status(404).json({ error: 'Code not found' });
  }
  return res.status(405).json({ error: 'Method not allowed' });
}
