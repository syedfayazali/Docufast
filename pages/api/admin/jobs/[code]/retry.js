import { retryPrint, getJob, getShopByApiKey } from '@/lib/db';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const agentKey = req.headers['x-agent-key'];
  const isLegacy = process.env.AGENT_KEY && agentKey === process.env.AGENT_KEY;

  if (!isLegacy) {
    const shop = await getShopByApiKey(agentKey);
    if (!shop) return res.status(401).json({ error: 'Unauthorized' });

    // A shop key must only be able to retry its own jobs, never another shop's.
    const job = await getJob(req.query.code);
    if (!job || job.shop_id !== shop.id) {
      return res.status(404).json({ error: 'Job not found' });
    }
  }

  await retryPrint(req.query.code);
  return res.status(200).json({ ok: true });
}
