import { isOwner, isLegacyAgentKey } from '@/lib/auth';
import { toggleShop, resetShopMachine, rotateShopKey, setStaffPin, setShopPrices, setShopRetention } from '@/lib/db';
import { validatePrices } from '@/lib/pricing';

export default async function handler(req, res) {
  if (req.method !== 'PATCH') return res.status(405).json({ error: 'Method not allowed' });
  if (!isOwner(req)) return res.status(401).json({ error: 'Unauthorized' });
  const { id } = req.query;
  const { active, resetMachine, rotateKey, newStaffPin, staffPin, prices, retentionMinutes } = req.body || {};

  if (retentionMinutes !== undefined) {
    const m = retentionMinutes === null ? null : Number(retentionMinutes);
    if (m !== null && (!Number.isInteger(m) || m < 5 || m > 1440)) return res.status(400).json({ error: 'Keep files between 5 minutes and 24 hours' });
    const r = await setShopRetention(id, m);
    if (!r) return res.status(404).json({ error: 'Shop not found' });
    return res.status(200).json({ ok: true, retentionMinutes: r.retention_minutes });
  }

  if (prices) {
    let clean;
    try { clean = validatePrices(prices); } catch (e) { return res.status(400).json({ error: e.message }); }
    const r = await setShopPrices(id, clean);
    if (!r) return res.status(404).json({ error: 'Shop not found' });
    return res.status(200).json({ ok: true, prices: r.prices });
  }

  if (newStaffPin || staffPin !== undefined) {
    let chosen;
    if (staffPin !== undefined && staffPin !== '') {
      chosen = String(staffPin).trim();
      if (!/^\d{6}$/.test(chosen)) return res.status(400).json({ error: 'PIN must be exactly 6 digits' });
      if (/^(\d)\1{5}$/.test(chosen) || '0123456789012345'.includes(chosen) || '9876543210987654'.includes(chosen)) {
        return res.status(400).json({ error: 'Too easy to guess. Avoid 123456 or 111111.' });
      }
    }
    const r = await setStaffPin(id, chosen);
    if (!r) return res.status(404).json({ error: 'Shop not found' });
    return res.status(200).json({ ok: true, shopCode: r.slug, pin: r.pin });
  }

  if (rotateKey) {
    const shop = await rotateShopKey(id);
    if (!shop) return res.status(404).json({ error: 'Shop not found' });
    return res.status(200).json({ ok: true, shopId: shop.id, apiKey: shop.api_key });
  }

  if (resetMachine) {
    // Frees up this shop's key so the next computer to heartbeat with it
    // (e.g. after a PC replacement) can claim it again.
    await resetShopMachine(id);
    return res.status(200).json({ ok: true, machineReset: true });
  }

  await toggleShop(id, !!active);
  return res.status(200).json({ ok: true });
}
