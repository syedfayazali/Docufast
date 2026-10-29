import { isOwner, isLegacyAgentKey } from '@/lib/auth';
import { retryPrint, reprintJob, getJob } from '@/lib/db';
import { authStaff } from '@/lib/staff';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const agentKey = req.headers['x-agent-key'];
  const isLegacy = isLegacyAgentKey(agentKey);

  if (!isLegacy) {
    const auth = await authStaff(req);
    if (!auth.shop) return res.status(auth.status || 401).json({ error: auth.error });
    const shop = auth.shop;

    // A shop key must only be able to retry its own jobs, never another shop's.
    const job = await getJob(req.query.code);
    if (!job || job.shop_id !== shop.id) {
      return res.status(404).json({ error: 'Job not found' });
    }
  }

  // ?reprint=1 puts an already-PRINTED job back in the queue (bad print,
  // jam). Allowed only while the file is still kept (30 min after printing).
  if (req.query.reprint) {
    const ok = await reprintJob(req.query.code);
    if (!ok) return res.status(410).json({ error: 'Reprint window has passed (file already removed). Ask the customer to upload again.' });
    return res.status(200).json({ ok: true, reprint: true });
  }

  await retryPrint(req.query.code);
  return res.status(200).json({ ok: true });
}
