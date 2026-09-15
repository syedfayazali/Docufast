import { getShopByApiKey, getJob, markPrinted, markPrintFailed } from '@/lib/db';
import { deleteFile } from '@/lib/blob';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const agentKey = req.headers['x-agent-key'];
  const isLegacy = agentKey === process.env.AGENT_KEY;
  if (!isLegacy) {
    const shop = await getShopByApiKey(agentKey);
    if (!shop) return res.status(401).json({ error: 'Invalid agent key' });
  }

  const { code } = req.query;
  const { success, error } = req.body || {};

  if (success) {
    const job = await getJob(code);
    await markPrinted(code);
    if (job?.blob_url) await deleteFile(job.blob_url);
  } else {
    await markPrintFailed(code, error || 'Unknown print error');
  }

  return res.status(200).json({ ok: true });
}
