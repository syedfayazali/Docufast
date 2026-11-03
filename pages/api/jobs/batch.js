// Several files, one payment. Each file still becomes its own print job with its own code (so it
// prints, tracks and refunds on its own), but they share one Razorpay order and one total.
import { createJob, createAccountJob, newDeleteToken, lookupAccount, getJob, publicView, rateLimit, clientIp } from '@/lib/db';
import { generateCode } from '@/lib/pricing';
import { quoteBatch, MAX_BATCH_FILES } from '@/lib/quote';
import { createOrder, isConfigured } from '@/lib/razorpay';
import { readBytes } from '@/lib/privateBlob';
import { getPlan } from '@/lib/plans';
import { countPdfPages, countDocxPages, fileProblem } from '@/lib/pagecount';
import { maskAadhaar } from '@/lib/mask';
export const config = { api: { bodyParser: { sizeLimit: '1mb' } } };

const IMAGES = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'tiff', 'tif'];
// Authoritative page count from the file itself; the browser's number is never billed.
async function pagesOf(name, buffer) {
  const ext = name.toLowerCase().split('.').pop();
  const problem = fileProblem(ext, buffer);
  if (problem) return { error: problem };
  if (ext === 'pdf') { const n = await countPdfPages(buffer); return n ? { pages: n } : { error: 'We could not read the page count of this PDF. Please save it again as a normal PDF.' }; }
  if (IMAGES.includes(ext)) return { pages: 1 };
  if (ext === 'docx') { const n = countDocxPages(buffer); return n ? { pages: n } : { error: 'We could not read the page count of this Word file. Please save it as a PDF instead.' }; }
  return { error: 'This file type is not supported. Please upload a PDF, a Word (.docx) file or a photo.' };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    if (!(await rateLimit('jobs:' + clientIp(req), 20, 600))) return res.status(429).json({ error: 'Too many orders from this connection. Please wait a few minutes.' });
    const { items, shopSlug, couponCode, consent, accountCode } = req.body || {};
    if (!Array.isArray(items) || !items.length) return res.status(400).json({ error: 'Add at least one file.' });
    if (items.length > MAX_BATCH_FILES) return res.status(400).json({ error: `You can send up to ${MAX_BATCH_FILES} files in one order.` });

    // Verify every file and read its real page count before any money is asked for.
    const prepared = [];
    for (const it of items) {
      const filename = maskAadhaar(it && it.filename);
      if (!filename || !it.blobUrl) return res.status(400).json({ error: 'A file is missing its name or upload.' });
      let buffer;
      try { buffer = await readBytes(it.blobUrl); } catch { return res.status(400).json({ error: `${filename} could not be verified. Please upload it again.` }); }
      const p = await pagesOf(filename, buffer);
      if (p.error) return res.status(400).json({ error: `${filename}: ${p.error}` });
      prepared.push({ filename, blobUrl: it.blobUrl, pages: p.pages, copies: it.copies, colorMode: it.colorMode, duplex: !!it.duplex });
    }

    const q = await quoteBatch({ shopSlug, items: prepared, couponCode });
    if (q.error) return res.status(400).json({ error: q.error });
    const shopId = q.shop ? q.shop.id : null;
    const tokens = {};
    const jobs = prepared.map((p, i) => {
      const l = q.lines[i];
      const dt = newDeleteToken();
      const code = generateCode();
      tokens[code] = dt.token;
      return {
        code, shopId, filename: p.filename, blobUrl: p.blobUrl, pages: l.pages, copies: l.copies,
        colorMode: l.mode, duplex: l.duplex, amount: l.total, status: 'pending_payment',
        // The coupon is recorded once, on the first file, so it is counted as used once.
        couponCode: i === 0 && q.coupon ? q.coupon.code : null, discount: l.discount || null,
        consent: consent === true, deleteTokenHash: dt.hash,
      };
    });
    const summary = () => jobs.map(j => ({ code: j.code, filename: j.filename, pages: j.pages, copies: j.copies, colorMode: j.colorMode, duplex: j.duplex, amount: j.amount }));

    if (accountCode) {
      const pl = getPlan(q.shop?.plan);
      if (pl && !pl.accounts) return res.status(400).json({ error: 'Business accounts are not available at this shop.' });
      const acc = await lookupAccount(accountCode);
      if (!acc) return res.status(400).json({ error: 'That business account code is not valid.' });
      if (q.total > acc.available) return res.status(402).json({ error: 'This order is over the account credit limit. Please pay online or contact the shop.' });
      for (const j of jobs) {
        const made = await createAccountJob(j, acc.id);
        if (made.over) return res.status(402).json({ error: 'This order is over the account credit limit. Please pay online or contact the shop.' });
      }
      return res.status(201).json({ batch: true, accountBilled: true, accountName: acc.name, amount: q.total, tokens, jobs: summary() });
    }

    if (isConfigured()) {
      try {
        if (q.total < 100) return res.status(400).json({ error: 'The minimum order is ₹1.' });
        const { orderId } = await createOrder({ amountPaise: q.total, receipt: jobs[0].code });
        for (const j of jobs) await createJob({ ...j, paymentProvider: 'razorpay', razorpayOrderId: orderId });
        return res.status(201).json({ batch: true, amount: q.total, tokens, jobs: summary(), razorpayEnabled: true, razorpayOrderId: orderId, razorpayKeyId: process.env.RAZORPAY_KEY_ID });
      } catch (err) {
        console.error('Razorpay/DB error (batch):', err.message);
        return res.status(502).json({ error: 'Payment setup failed. Please try again.' });
      }
    }
    if (process.env.NODE_ENV === 'production' && process.env.ALLOW_MOCK_PAYMENTS !== '1') {
      return res.status(503).json({ error: 'Online payment is not available right now. Please ask the shop.' });
    }
    for (const j of jobs) await createJob({ ...j, paymentProvider: 'mock' });
    return res.status(201).json({ batch: true, amount: q.total, tokens, jobs: summary(), razorpayEnabled: false });
  } catch (err) {
    console.error('Unhandled error in /api/jobs/batch:', err.message, err.stack);
    return res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
}
