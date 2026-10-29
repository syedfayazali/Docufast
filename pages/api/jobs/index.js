import { createJob, newDeleteToken, lookupAccount, markPaid, getJob, publicView } from '@/lib/db';
import { generateCode } from '@/lib/pricing';
import { quoteOrder } from '@/lib/quote';
import { createOrder, isConfigured } from '@/lib/razorpay';
import { readBytes } from '@/lib/privateBlob';
// pdf-parse is imported dynamically inside the handler to avoid
// Vercel edge runtime issues with native modules

export const config = { api: { bodyParser: { sizeLimit: '1mb' } } };

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { filename, blobUrl, pages, copies, colorMode, duplex, shopSlug, serviceId, couponCode, consent, accountCode } = req.body || {};
    if (!filename || !blobUrl || !pages || !copies) {
      return res.status(400).json({ error: 'Missing filename, blobUrl, pages, or copies' });
    }

    // The browser uploads straight to Blob storage (see /api/blob-upload-token)
    // and sends us the URL. We re-read the file here for the authoritative page
    // count, so the client-reported count is never trusted for billing.
    let buffer;
    try {
      buffer = await readBytes(blobUrl);
    } catch (err) {
      return res.status(400).json({ error: 'Uploaded file could not be verified' });
    }

    return createJobAndRespond({ res, filename, blobUrl, buffer, pages, copies, colorMode, duplex, shopSlug, serviceId, couponCode, accountCode, consent: consent === true });

  } catch (err) {
    console.error('Unhandled error in /api/jobs:', err.message, err.stack);
    return res.status(500).json({ error: 'Internal server error: ' + err.message });
  }
}

async function createJobAndRespond({ res, filename, blobUrl, buffer, pages, copies, colorMode, duplex, shopSlug, serviceId, couponCode, accountCode, consent }) {
  // Auto-detect page count from file bytes server-side — this is the
  // authoritative count used for billing, regardless of what the client sent.
  let pageCount = Math.max(1, parseInt(pages, 10) || 1);
  const ext = filename.toLowerCase().split('.').pop();

  if (ext === 'pdf') {
    try {
      const pdfParse = (await import('pdf-parse')).default;
      const data = await pdfParse(buffer, { max: 0 });
      if (data.numpages > 0) {
        pageCount = data.numpages;
      }
    } catch {
    }
  } else if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'].includes(ext)) {
    pageCount = 1;
  }

  const copyCount = Math.min(500, Math.max(1, parseInt(copies, 10) || 1));
  const mode = colorMode === 'color' ? 'color' : 'bw';

  const code = generateCode();
  // Shop, prices, service fee and coupon are all resolved on the server by one
  // shared function — the client only names them, it never sets any money.
  const q = await quoteOrder({ shopSlug, serviceId, colorMode: mode, duplex, pages: pageCount, copies: copyCount, couponCode });
  if (q.error) return res.status(400).json({ error: q.error });
  const shopId = q.shop ? q.shop.id : null;
  const service = q.service;
  const amount = q.total;

  // Secret the customer's browser keeps so only they can delete this upload early.
  const deleteToken = newDeleteToken();

  const baseJob = {
    code, shopId, filename, blobUrl,
    pages: pageCount, copies: copyCount,
    colorMode: mode, duplex: !!duplex,
    amount, status: 'pending_payment',
    serviceId: service?.id, serviceName: service?.name, serviceFee: service ? service.fee : null,
    couponCode: q.coupon ? q.coupon.code : null, discount: q.discount || null,
    consent: !!consent, deleteTokenHash: deleteToken.hash,
  };

  // Business account: bill to the account instead of taking payment now.
  if (accountCode) {
    const acc = await lookupAccount(accountCode);
    if (!acc) return res.status(400).json({ error: 'That business account code is not valid.' });
    if (amount > acc.available) return res.status(402).json({ error: 'This order is over the account credit limit. Please pay online or contact the shop.' });
    await createJob({ ...baseJob, paymentProvider: 'account', accountId: acc.id });
    await markPaid(code, 'account:' + acc.id);
    const job = await getJob(code);
    return res.status(201).json({ code, amount, deleteToken: deleteToken.token, accountBilled: true, accountName: acc.name, job: publicView(job) });
  }

  if (isConfigured()) {
    try {
      const { orderId } = await createOrder({ amountPaise: amount, receipt: code });
      await createJob({ ...baseJob, paymentProvider: 'razorpay', razorpayOrderId: orderId });
      return res.status(201).json({
        code, amount, deleteToken: deleteToken.token,
        razorpayEnabled: true,
        razorpayOrderId: orderId,
        razorpayKeyId: process.env.RAZORPAY_KEY_ID,
      });
    } catch (err) {
      console.error('Razorpay/DB error:', err.message, err.stack);
      return res.status(502).json({ error: 'Payment setup failed: ' + err.message });
    }
  }

  await createJob({ ...baseJob, paymentProvider: 'mock' });
  return res.status(201).json({ code, amount, deleteToken: deleteToken.token, razorpayEnabled: false });
}
