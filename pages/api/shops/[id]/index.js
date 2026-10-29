import { isOwner, isLegacyAgentKey } from '@/lib/auth';
import { toggleShop, resetShopMachine, rotateShopKey, setStaffPin, setShopPrices } from '@/lib/db';
import { validatePrices } from '@/lib/pricing';

export default async function handler(req, res) {
  if (req.method !== 'PATCH') return res.status(405).json({ error: 'Method not allowed' });
  if (!isOwner(req)) return res.status(401).json({ error: 'Unauthorized' });
  const { id } = req.query;
  const { active, resetMachine, rotateKey, newStaffPin, prices } = req.body || {};

  if (prices) {
    let clean;
    try { clean = validatePrices(prices); } catch (e) { return res.status(400).json({ error: e.message }); }
    const r = await setShopPrices(id, clean);
    if (!r) return res.status(404).json({ error: 'Shop not found' });
    return res.status(200).json({ ok: true, prices: r.prices });
  }

  if (newStaffPin) {
    const r = await setStaffPin(id);
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
