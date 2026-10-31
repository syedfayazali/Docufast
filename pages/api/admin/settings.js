import { authStaff } from '@/lib/staff';
import { pinProblem } from '@/lib/auth';
import { setShopPrices, setShopRetention, setStaffPin, getShopSettings } from '@/lib/db';
import { validatePrices, normalizePrices } from '@/lib/pricing';

// A shop owner manages their OWN shop only. Everything here is keyed to the shop
// that signed in with its code and PIN; there is no way to name another shop.
export default async function handler(req, res) {
  const auth = await authStaff(req);
  if (!auth.shop) return res.status(auth.status || 401).json({ error: auth.error });
  const id = auth.shop.id;
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'GET') {
    const s = await getShopSettings(id);
    return res.status(200).json({ prices: normalizePrices(s.prices), retentionMinutes: s.retention_minutes });
  }
  if (req.method === 'PATCH') {
    const { prices, retentionMinutes, newPin } = req.body || {};
    if (prices) {
      let clean; try { clean = validatePrices(prices); } catch (e) { return res.status(400).json({ error: e.message }); }
      await setShopPrices(id, clean);
      return res.status(200).json({ ok: true, prices: clean });
    }
    if (retentionMinutes !== undefined) {
      const m = retentionMinutes === null || retentionMinutes === '' ? null : Number(retentionMinutes);
      if (m !== null && (!Number.isInteger(m) || m < 5 || m > 1440)) return res.status(400).json({ error: 'Keep files between 5 minutes and 24 hours' });
      await setShopRetention(id, m);
      return res.status(200).json({ ok: true, retentionMinutes: m });
    }
    if (newPin !== undefined) {
      const bad = pinProblem(newPin);
      if (bad) return res.status(400).json({ error: bad });
      await setStaffPin(id, String(newPin).trim());
      return res.status(200).json({ ok: true });
    }
    return res.status(400).json({ error: 'Nothing to change' });
  }
  return res.status(405).json({ error: 'Method not allowed' });
}
