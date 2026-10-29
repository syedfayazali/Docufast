// Customer-requested deletion of their uploaded file (DPDP right to erasure).
//
// Proof it is the customer: the secret delete token their browser received
// when the order was created, OR the full Razorpay payment id (only the payer
// has it). The job record stays for accounting; the file and its storage
// reference are removed.
//
// An order that is paid but not yet printed cannot be deleted here, because
// that would leave a paid order that can never print. The customer is told to
// ask the shop to cancel and refund it instead.
import { getJob, canDeleteJob, markJobDeleted, CUSTOMER_DELETABLE } from '@/lib/db';
import { deleteFile } from '@/lib/blob';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const code = String(req.query.code || '').trim().toUpperCase();
  const { token, paymentId } = req.body || {};
  const job = await getJob(code);

  // Same answer for "no such order" and "wrong proof" so codes cannot be probed.
  if (!job || !canDeleteJob(job, { token, paymentId })) {
    return res.status(403).json({ error: 'We could not verify this request. Use the same phone you ordered from, or enter your full Razorpay payment ID.' });
  }
  if (!CUSTOMER_DELETABLE.includes(job.status)) {
    return res.status(409).json({ error: 'This order is paid and still waiting to print. Please ask the shop to cancel and refund it first; your file is then removed.' });
  }
  if (!job.blob_url) {
    return res.status(200).json({ ok: true, alreadyDeleted: true });
  }

  try {
    await deleteFile(job.blob_url);
  } catch (err) {
    console.error('Customer delete failed:', err.message);
    return res.status(502).json({ error: 'The file could not be deleted right now. Please try again in a minute.' });
  }
  await markJobDeleted(code);
  return res.status(200).json({ ok: true });
}
