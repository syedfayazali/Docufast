import { isOwner, isLegacyAgentKey } from '@/lib/auth';
import { getOwnerStats, listPrinters, ensureSchema } from '@/lib/db';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!isOwner(req)) return res.status(401).json({ error: 'Unauthorized' });

  await ensureSchema();
  const [stats, printers] = await Promise.all([getOwnerStats(), listPrinters()]);
  return res.status(200).json({ ...stats, printers });
}
