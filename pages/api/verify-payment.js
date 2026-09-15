// This is the security-critical endpoint. Razorpay sends three fields after
// a successful payment; we verify their HMAC signature before marking anything
// as paid. A frontend-only "payment succeeded" message is never trusted here.
import { verifySignature } from '@/lib/razorpay';
import { getJobByRazorpayOrder, markPaid, publicView } from '@/lib/db';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body || {};

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return res.status(400).json({ error: 'Missing payment verification fields' });
  }

  const valid = verifySignature({ razorpay_order_id, razorpay_payment_id, razorpay_signature });
  if (!valid) {
    console.error('Razorpay signature mismatch for order', razorpay_order_id);
    return res.status(400).json({ error: 'Payment signature verification failed' });
  }

  const job = await getJobByRazorpayOrder(razorpay_order_id);
  if (!job) return res.status(404).json({ error: 'Job not found for this order' });

  await markPaid(job.code, razorpay_payment_id);

  // Return the job so the frontend can show the ticket immediately.
  const updated = await (await import('@/lib/db')).getJob(job.code);
  return res.status(200).json({ ok: true, job: publicView(updated) });
}
