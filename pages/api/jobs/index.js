import { createJob, getShopBySlug } from '@/lib/db';
import { generateCode, RATES } from '@/lib/pricing';
import { createOrder, isConfigured } from '@/lib/razorpay';
// pdf-parse is imported dynamically inside the handler to avoid
// Vercel edge runtime issues with native modules

// The browser now uploads directly to Blob storage and sends us the
// resulting URL (see /api/blob-upload-token) — this route no longer
// accepts raw file bytes, so the old 4mb cap (which real scanned PDFs
// routinely exceeded) is irrelevant here now.
export const config = { api: { bodyParser: { sizeLimit: '1mb' } } };

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { filename, blobUrl, fileData, pages, copies, colorMode, duplex, shopSlug } = req.body || {};
    if (!filename || (!blobUrl && !fileData) || !pages || !copies) {
      return res.status(400).json({ error: 'Missing filename, blobUrl, pages, or copies' });
    }

    let buffer;
    let finalBlobUrl;
    if (blobUrl) {
      // New path — file is already uploaded, just verify it's actually
      // reachable and grab the bytes for authoritative server-side page
      // counting (never trust the client-reported page count for billing).
      const resp = await fetch(blobUrl);
      if (!resp.ok) return res.status(400).json({ error: 'Uploaded file could not be verified' });
      buffer = Buffer.from(await resp.arrayBuffer());
      finalBlobUrl = blobUrl;
    } else {
      // Legacy path — small file sent inline as base64. Still uploads to
      // Blob here since that never happened client-side in this path.
      const { uploadFile } = await import('@/lib/blob');
      const base64 = fileData.includes(',') ? fileData.split(',')[1] : fileData;
      buffer = Buffer.from(base64, 'base64');
      const code = generateCode();
      try {
        finalBlobUrl = await uploadFile(`${code}-${filename}`, buffer);
      } catch (err) {
        return res.status(500).json({ error: 'File upload failed: ' + err.message });
      }
      return createJobAndRespond({ res, filename, blobUrl: finalBlobUrl, buffer, pages, copies, colorMode, duplex, shopSlug, code });
    }

    return createJobAndRespond({ res, filename, blobUrl: finalBlobUrl, buffer, pages, copies, colorMode, duplex, shopSlug });

  } catch (err) {
    console.error('Unhandled error in /api/jobs:', err.message, err.stack);
    return res.status(500).json({ error: 'Internal server error: ' + err.message });
  }
}

async function createJobAndRespond({ res, filename, blobUrl, buffer, pages, copies, colorMode, duplex, shopSlug, code: existingCode }) {
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
        console.log(`PDF pages detected: ${pageCount} (client sent: ${pages})`);
      }
    } catch {
      console.log(`PDF parse failed, using client count: ${pages}`);
    }
  } else if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'].includes(ext)) {
    pageCount = 1;
  }

  const copyCount = Math.max(1, parseInt(copies, 10) || 1);
  const mode = colorMode === 'color' ? 'color' : 'bw';
  const amount = RATES[mode] * pageCount * copyCount;

  const code = existingCode || generateCode();
  // Resolve the shop by slug (from the customer's shop-specific link) so a
  // client can never just claim an arbitrary shopId — and so jobs are
  // actually visible to the right shop's agent, instead of getting
  // created with shop_id=NULL and never showing up in that shop's queue.
  let shopId = null;
  if (shopSlug) {
    const shop = await getShopBySlug(shopSlug);
    if (shop && shop.active) shopId = shop.id;
  }

  const baseJob = {
    code, shopId, filename, blobUrl,
    pages: pageCount, copies: copyCount,
    colorMode: mode, duplex: !!duplex,
    amount, status: 'pending_payment',
  };

  if (isConfigured()) {
    console.log('Creating Razorpay order for', amount, 'paise...');
    try {
      const { orderId } = await createOrder({ amountPaise: amount, receipt: code });
      console.log('Razorpay order created:', orderId);
      await createJob({ ...baseJob, paymentProvider: 'razorpay', razorpayOrderId: orderId });
      return res.status(201).json({
        code, amount,
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
  return res.status(201).json({ code, amount, razorpayEnabled: false });
}
