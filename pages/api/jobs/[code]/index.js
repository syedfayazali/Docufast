import { getJob, publicView, getJobStatusExtras } from '@/lib/db';

// Customer-facing status. `stage` is the one word the UI keys off:
//   unpaid | waiting (paid, shop's computer offline) | queued | printed | problem | expired
export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const code = String(req.query.code || '').trim().toUpperCase();
  const job = await getJob(code);
  if (!job) return res.status(404).json({ error: 'No job found' });
  const view = publicView(job);
  let extras = {};
  try { extras = await getJobStatusExtras(job); } catch { /* status still works without the extras */ }

  let stage;
  if (job.status === 'pending_payment') stage = 'unpaid';
  else if (job.status === 'printed') stage = 'printed';
  else if (job.status === 'expired') stage = 'expired';
  else if (job.status === 'refunded') stage = 'refunded';
  else if (job.status === 'paid' && job.print_error && (job.print_attempts || 0) >= 3) stage = 'problem';
  else if (job.status === 'paid' && extras.shopOnline === false) stage = 'waiting';
  else stage = 'queued';

  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json({ job: view, stage, ...extras });
}
