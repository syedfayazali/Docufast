import { isOwner } from '@/lib/auth';
import { listShopLeads, setLeadStatus } from '@/lib/db';

// Owner-only: software trial requests from the landing page.
export default async function handler(req, res) {
  if (!isOwner(req)) return res.status(401).json({ error: 'Unauthorized' });
  if (req.method === 'GET') return res.status(200).json({ leads: await listShopLeads() });
  if (req.method === 'PATCH') {
    try {
      const l = await setLeadStatus(Number(req.body?.id), String(req.body?.status || ''));
      return l ? res.status(200).json({ lead: l }) : res.status(404).json({ error: 'Not found' });
    } catch (e) { return res.status(400).json({ error: e.message }); }
  }
  return res.status(405).json({ error: 'Method not allowed' });
}
