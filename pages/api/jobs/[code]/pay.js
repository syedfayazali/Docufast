import { getJob, markPaid, publicView } from '@/lib/db';
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const job = await getJob(req.query.code);
  if (!job) return res.status(404).json({ error: 'Job not found' });
  if (job.payment_provider !== 'mock') return res.status(403).json({ error: 'Use Razorpay verify endpoint for real payments' });
  if (job.status !== 'pending_payment') return res.status(409).json({ error: `Job is already ${job.status}` });
  await markPaid(job.code, 'mock_payment');
  const updated = await getJob(job.code);
  return res.status(200).json({ job: publicView(updated) });
}
