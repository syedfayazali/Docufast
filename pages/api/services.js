import { listServices } from '@/lib/db';

// Public: the document checklists the owner has switched on.
export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const rows = await listServices({ onlyActive: true });
    res.setHeader('Cache-Control', 'no-store');
    const pick = r => ({ id: r.id, name: r.name, fee: r.fee, slots: r.slots });
    // 'tool-*' rows are the built-in print tools (passport photos, ID / passport copy): only their fee matters.
    return res.status(200).json({
      services: rows.filter(r => !r.id.startsWith('tool-')).map(pick),
      tools: rows.filter(r => r.id.startsWith('tool-')).map(pick),
    });
  } catch {
    return res.status(200).json({ services: [], tools: null }); // the page must work without services
  }
}
