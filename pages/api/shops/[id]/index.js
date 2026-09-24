import { toggleShop, resetShopMachine } from '@/lib/db';

export default async function handler(req, res) {
  if (req.method !== 'PATCH') return res.status(405).json({ error: 'Method not allowed' });
  if (req.headers['x-owner-key'] !== process.env.OWNER_KEY) return res.status(401).json({ error: 'Unauthorized' });
  const { id } = req.query;
  const { active, resetMachine } = req.body || {};

  if (resetMachine) {
    // Frees up this shop's key so the next computer to heartbeat with it
    // (e.g. after a PC replacement) can claim it again.
    await resetShopMachine(id);
    return res.status(200).json({ ok: true, machineReset: true });
  }

  await toggleShop(id, !!active);
  return res.status(200).json({ ok: true });
}
