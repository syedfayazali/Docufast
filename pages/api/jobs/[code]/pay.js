import { getJob, markPaid, publicView } from '@/lib/db';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { code } = req.query;
  const job = await getJob(code);
  if (!job) return res.status(404).json({ error: 'Job not found' });

  if (job.payment_provider !== 'mock') {
    // Safety net: a real-money job must only ever be marked paid via the
    // verified Paytm callback, never this shortcut endpoint.
    return res.status(403).json({ error: 'This job requires real Paytm payment confirmation, not mock confirm' });
  }
  if (job.status !== 'pending_payment') {
    return res.status(409).json({ error: `Job is already ${job.status}` });
  }

  await markPaid(code, null);
  const updated = await getJob(code);
  return res.status(200).json({ job: publicView(updated) });
}
