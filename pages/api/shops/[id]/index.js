import { isOwner, pinProblem } from '@/lib/auth';
import { toggleShop, resetShopMachine, rotateShopKey, setStaffPin, setShopPrices, setShopRetention, linkEmailToShop, normEmail, getShopById, deleteShop } from '@/lib/db';
import { validatePrices } from '@/lib/pricing';

export default async function handler(req, res) {
  if (req.method !== 'PATCH' && req.method !== 'DELETE') return res.status(405).json({ error: 'Method not allowed' });
  if (!isOwner(req)) return res.status(401).json({ error: 'Unauthorized' });
  const { id } = req.query;

  if (req.method === 'DELETE') {
    // Permanent. The owner must type the shop's name to confirm.
    const shop = await getShopById(id);
    if (!shop) return res.status(404).json({ error: 'Shop not found' });
    const typed = String((req.body && req.body.confirm) || '').trim().toLowerCase();
    if (typed !== String(shop.name).trim().toLowerCase()) return res.status(400).json({ error: 'Type the shop name exactly to confirm.' });
    try { await deleteShop(id); } catch (e) { console.error('delete shop failed:', e.message); return res.status(500).json({ error: 'Could not delete the shop.' }); }
    return res.status(200).json({ ok: true, deleted: shop.name });
  }
  const { ownerEmail, active, resetMachine, rotateKey, newStaffPin, staffPin, prices, retentionMinutes } = req.body || {};

  if (ownerEmail) {
    const e = normEmail(ownerEmail);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return res.status(400).json({ error: 'That email does not look right' });
    await linkEmailToShop(e, id);
    return res.status(200).json({ ok: true, ownerEmail: e });
  }

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
      const bad = pinProblem(chosen);
      if (bad) return res.status(400).json({ error: bad });
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
