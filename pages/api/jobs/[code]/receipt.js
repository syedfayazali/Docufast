import { getJob, getJobStatusExtras } from '@/lib/db';

// Customer receipt data. Only for orders that were actually paid. This is a
// payment receipt, NOT a tax invoice (the business has no GSTIN), and the page
// says so. The payment id is shortened to its last 4 characters.
export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const job = await getJob(String(req.query.code || '').trim().toUpperCase());
  if (!job || !['paid', 'printed', 'refunded'].includes(job.status)) {
    return res.status(404).json({ error: 'No paid order found with that code' });
  }
  let extras = {};
  try { extras = await getJobStatusExtras(job); } catch { /* receipt still works without shop details */ }
  const fee = job.service_fee || 0;
  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json({
    receipt: {
      code: job.code,
      date: job.created_at,
      shopName: extras.shopName || 'DocuFast India',
      shopAddress: [extras.shopAddress, extras.shopCity].filter(Boolean).join(', '),
      filename: job.filename,
      pages: job.pages,
      copies: job.copies,
      colorMode: job.color_mode,
      duplex: !!job.duplex,
      serviceName: job.service_name || null,
      serviceFee: fee,
      printCharge: job.amount - fee,
      total: job.amount,
      paymentRef: job.razorpay_payment_id ? '…' + String(job.razorpay_payment_id).slice(-4) : null,
      status: job.status,
      refundedAmount: job.refund_amount || 0,
    },
  });
}
