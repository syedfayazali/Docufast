import { createJob, createAccountJob, newDeleteToken, lookupAccount, getJob, publicView, rateLimit, clientIp } from '@/lib/db';
import { generateCode } from '@/lib/pricing';
import { quoteOrder } from '@/lib/quote';
import { createOrder, isConfigured } from '@/lib/razorpay';
import { readBytes } from '@/lib/privateBlob';
import { countPdfPages, countDocxPages, countDocPages, fileProblem } from '@/lib/pagecount';
export const config = { api: { bodyParser: { sizeLimit: '1mb' } } };
import { maskAadhaar } from '@/lib/mask';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    // Each order reads the uploaded file and opens a payment order, so cap how fast one address can create them.
    if (!(await rateLimit('jobs:' + clientIp(req), 20, 600))) {
      return res.status(429).json({ error: 'Too many orders from this connection. Please wait a few minutes.' });
    }
    const { filename: rawFilename, blobUrl, pages, copies, colorMode, duplex, shopSlug, serviceId, couponCode, consent, accountCode, exactSize } = req.body || {};
    const filename = maskAadhaar(rawFilename);
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

    return createJobAndRespond({ res, filename, blobUrl, buffer, pages, copies, colorMode, duplex, shopSlug, serviceId, couponCode, accountCode, exactSize: exactSize === true, consent: consent === true });

  } catch (err) {
    console.error('Unhandled error in /api/jobs:', err.message, err.stack);
    return res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
}

async function createJobAndRespond({ res, filename, blobUrl, buffer, pages, copies, colorMode, duplex, shopSlug, serviceId, couponCode, accountCode, exactSize, consent }) {
  // Auto-detect page count from file bytes server-side — this is the
  // authoritative count used for billing, regardless of what the client sent.
  const claimed = Math.min(100000, Math.max(1, parseInt(pages, 10) || 1));
  const ext = filename.toLowerCase().split('.').pop();
  const problem = fileProblem(ext, buffer);
  if (problem) return res.status(400).json({ error: problem });

  let pageCount = claimed;
  if (ext === 'pdf') {
    // Never fall back to the customer's number for a PDF: that would let a
    // 100-page file be billed as 1 page.
    const n = await countPdfPages(buffer);
    if (!n) return res.status(400).json({ error: 'We could not read the page count of this PDF. Please save it again as a normal PDF and upload.' });
    pageCount = n;
  } else if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'tiff', 'tif'].includes(ext)) {
    pageCount = 1;
  } else if (ext === 'docx' || ext === 'doc') {
    // Word page counts are only estimates, so bill the higher of ours and the customer's.
    const n = ext === 'docx' ? countDocxPages(buffer) : countDocPages(buffer);
    pageCount = Math.max(claimed, n || 1);
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
    consent: !!consent, deleteTokenHash: deleteToken.hash, exactSize: !!exactSize,
  };

  // Business account: bill to the account instead of taking payment now.
  if (accountCode) {
    const acc = await lookupAccount(accountCode);
    if (!acc) return res.status(400).json({ error: 'That business account code is not valid.' });
    if (amount > acc.available) return res.status(402).json({ error: 'This order is over the account credit limit. Please pay online or contact the shop.' });
    const made = await createAccountJob(baseJob, acc.id);
    if (made.over) return res.status(402).json({ error: 'This order is over the account credit limit. Please pay online or contact the shop.' });
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
      return res.status(502).json({ error: 'Payment setup failed. Please try again.' });
    }
  }

  // No Razorpay keys: the test (mock) payment is for development only. In
  // production it would let anyone print for free, so refuse instead.
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_MOCK_PAYMENTS !== '1') {
    return res.status(503).json({ error: 'Online payment is not available right now. Please ask the shop.' });
  }
  await createJob({ ...baseJob, paymentProvider: 'mock' });
  return res.status(201).json({ code, amount, deleteToken: deleteToken.token, razorpayEnabled: false });
}
