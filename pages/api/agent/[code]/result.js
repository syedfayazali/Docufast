import { getShopByApiKey, getJob, markPrinted, markPrintFailed } from '@/lib/db';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const agentKey = req.headers['x-agent-key'];
  const isLegacy = process.env.AGENT_KEY && agentKey === process.env.AGENT_KEY;
  let shop = null;
  if (!isLegacy) {
    shop = await getShopByApiKey(agentKey);
    if (!shop) return res.status(401).json({ error: 'Invalid agent key' });
  }

  const { code } = req.query;
  const { success, error } = req.body || {};

  const job = await getJob(code);
  if (!job) return res.status(404).json({ error: 'Job not found' });
  // A shop key may only report on its own jobs.
  if (shop && job.shop_id && job.shop_id !== shop.id) return res.status(404).json({ error: 'Job not found' });

  // Idempotent: a repeated "printed" report (agent retried after a network
  // blip) must not fail or double-count.
  if (job.status === 'printed') return res.status(200).json({ ok: true, already: true });

  if (success) {
    // File is kept for the reprint window; pending.js / the cron remove it after.
    await markPrinted(code);
  } else {
    await markPrintFailed(code, String(error || 'Unknown print error').slice(0, 500));
  }
  return res.status(200).json({ ok: true });
}
