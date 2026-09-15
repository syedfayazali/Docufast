import { createJob } from '@/lib/db';
import { uploadFile } from '@/lib/blob';
import { generateCode, RATES } from '@/lib/pricing';
import { createOrder, isConfigured } from '@/lib/razorpay';
// pdf-parse is imported dynamically inside the handler to avoid
// Vercel edge runtime issues with native modules

export const config = { api: { bodyParser: { sizeLimit: '4mb' } } };

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { filename, fileData, pages, copies, colorMode, duplex } = req.body || {};
    if (!filename || !fileData || !pages || !copies) {
      return res.status(400).json({ error: 'Missing filename, fileData, pages, or copies' });
    }

    const base64 = fileData.includes(',') ? fileData.split(',')[1] : fileData;
    const buffer = Buffer.from(base64, 'base64');

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

    const code = generateCode();
    const shopId = req.query.shop || req.body.shopId || null;

    console.log('Uploading file to Blob...', filename, buffer.length, 'bytes');
    let blobUrl;
    try {
      blobUrl = await uploadFile(`${code}-${filename}`, buffer);
      console.log('Blob upload success:', blobUrl);
    } catch (err) {
      console.error('Blob upload failed:', err.message, err.stack);
      return res.status(500).json({ error: 'File upload failed: ' + err.message });
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

  } catch (err) {
    console.error('Unhandled error in /api/jobs:', err.message, err.stack);
    return res.status(500).json({ error: 'Internal server error: ' + err.message });
  }
}
