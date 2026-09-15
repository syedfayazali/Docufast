import { listShops, createShop, ensureSchema } from '@/lib/db';

function isOwner(req) {
  return req.headers['x-owner-key'] === process.env.OWNER_KEY;
}

export default async function handler(req, res) {
  if (!isOwner(req)) return res.status(401).json({ error: 'Unauthorized' });
  await ensureSchema();

  if (req.method === 'GET') {
    const shops = await listShops();
    return res.status(200).json({ shops });
  }

  if (req.method === 'POST') {
    const { name, slug, city, address } = req.body || {};
    if (!name || !slug) return res.status(400).json({ error: 'name and slug are required' });
    if (!/^[a-z0-9-]+$/.test(slug)) return res.status(400).json({ error: 'slug must be lowercase letters, numbers, hyphens only' });
    try {
      const shop = await createShop({ name, slug, city, address });
      return res.status(201).json({ shop });
    } catch (err) {
      if (err.message.includes('unique')) return res.status(409).json({ error: 'A shop with that slug already exists' });
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
