import { toggleShop } from '@/lib/db';

export default async function handler(req, res) {
  if (req.method !== 'PATCH') return res.status(405).json({ error: 'Method not allowed' });
  if (req.headers['x-owner-key'] !== process.env.OWNER_KEY) return res.status(401).json({ error: 'Unauthorized' });
  const { id } = req.query;
  const { active } = req.body || {};
  await toggleShop(id, !!active);
  return res.status(200).json({ ok: true });
}
