import { listServices } from '@/lib/db';

// Public: the document checklists the owner has switched on.
export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const rows = await listServices({ onlyActive: true });
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ services: rows.map(r => ({ id: r.id, name: r.name, fee: r.fee, slots: r.slots })) });
  } catch {
    return res.status(200).json({ services: [] }); // the page must work without services
  }
}
