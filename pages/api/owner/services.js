import { isOwner } from '@/lib/auth';
import { listServices, updateService } from '@/lib/db';

// Owner-only: see every service (including switched-off ones) and edit name,
// fee (paise), on/off and the list of required documents.
export default async function handler(req, res) {
  if (!isOwner(req)) return res.status(401).json({ error: 'Unauthorized' });
  if (req.method === 'GET') return res.status(200).json({ services: await listServices() });
  if (req.method === 'PATCH') {
    const { id, name, fee, active, slots } = req.body || {};
    if (!id) return res.status(400).json({ error: 'id is required' });
    if (slots && (!Array.isArray(slots) || !slots.some(s => s && String(s.label || '').trim()))) {
      return res.status(400).json({ error: 'Add at least one document to the checklist' });
    }
    const row = await updateService(id, { name, fee, active, slots });
    if (!row) return res.status(404).json({ error: 'Service not found' });
    return res.status(200).json({ ok: true, service: row });
  }
  return res.status(405).json({ error: 'Method not allowed' });
}
