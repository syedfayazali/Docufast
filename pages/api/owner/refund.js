import { isOwner } from '@/lib/auth';
import { getJob, markRefunded } from '@/lib/db';
import { refundPayment, isConfigured } from '@/lib/razorpay';
import { deleteFile } from '@/lib/blob';

// Owner-only. Refunds a paid job in full through Razorpay, removes the file,
// and marks the job refunded so it can never print or be refunded twice.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!isOwner(req)) return res.status(401).json({ error: 'Unauthorized' });
  if (!isConfigured()) return res.status(400).json({ error: 'Razorpay is not configured' });

  const code = String(req.body?.code || '').trim().toUpperCase();
  const job = await getJob(code);
  if (!job) return res.status(404).json({ error: 'Job not found' });
  if (job.status === 'refunded') return res.status(409).json({ error: 'Already refunded' });
  if (!['paid', 'printed'].includes(job.status)) return res.status(400).json({ error: 'Only paid jobs can be refunded' });
  if (!job.razorpay_payment_id) return res.status(400).json({ error: 'This job has no Razorpay payment to refund' });

  let refundId;
  try {
    refundId = await refundPayment(job.razorpay_payment_id, job.amount);
  } catch (err) {
    const msg = err?.error?.description || err?.message || 'Razorpay refused the refund';
    return res.status(502).json({ error: msg });
  }
  // Money has moved: record it first, then best-effort file removal.
  const updated = await markRefunded(code, refundId, job.amount);
  try { await deleteFile(job.blob_url); } catch (e) { console.error('Blob delete after refund failed:', e.message); }
  return res.status(200).json({ ok: true, refundId, amount: job.amount, job: updated ? { code, status: 'refunded' } : null });
}
