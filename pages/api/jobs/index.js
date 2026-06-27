import { createJob } from '@/lib/db';
import { uploadFile } from '@/lib/blob';
import { generateCode, RATES } from '@/lib/pricing';
import { getBaseUrl } from '@/lib/baseUrl';
import * as paytm from '@/lib/paytm';

// Vercel's serverless functions cap total request size well below the 25MB
// the original laptop-only version allowed. 4MB of base64 (~3MB of actual
// file) covers the vast majority of documents people print. Bigger files
// would need direct browser-to-Blob uploads instead of this JSON route.
export const config = { api: { bodyParser: { sizeLimit: '4mb' } } };

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { filename, fileData, pages, copies, colorMode, duplex } = req.body || {};
  if (!filename || !fileData || !pages || !copies) {
    return res.status(400).json({ error: 'Missing filename, fileData, pages, or copies' });
  }

  const pageCount = Math.max(1, parseInt(pages, 10) || 1);
  const copyCount = Math.max(1, parseInt(copies, 10) || 1);
  const mode = colorMode === 'color' ? 'color' : 'bw';
  const amount = RATES[mode] * pageCount * copyCount;

  const base64 = fileData.includes(',') ? fileData.split(',')[1] : fileData;
  const buffer = Buffer.from(base64, 'base64');

  const code = generateCode();
  let blobUrl;
  try {
    blobUrl = await uploadFile(`${code}-${filename}`, buffer);
  } catch (err) {
    return res.status(500).json({ error: 'Upload failed: ' + err.message });
  }

  const baseJob = {
    code,
    filename,
    blobUrl,
    pages: pageCount,
    copies: copyCount,
    colorMode: mode,
    duplex: !!duplex,
    amount,
    status: 'pending_payment',
  };

  if (paytm.isConfigured()) {
    try {
      const baseUrl = getBaseUrl(req);
      const { txnToken, txnUrl, mid } = await paytm.initiateTransaction({
        orderId: code,
        amountRupees: amount / 100,
        callbackUrl: `${baseUrl}/api/jobs/${code}/paytm-callback`,
      });
      await createJob({ ...baseJob, paymentProvider: 'paytm', orderId: code, txnToken });
      return res.status(201).json({ code, amount, paytmEnabled: true, txnToken, txnUrl, mid });
    } catch (err) {
      return res.status(502).json({ error: 'Paytm error: ' + err.message });
    }
  } else {
    const orderId = 'mock_order_' + Math.random().toString(36).slice(2, 10);
    await createJob({ ...baseJob, paymentProvider: 'mock', orderId });
    return res.status(201).json({ code, amount, paytmEnabled: false, orderId });
  }
}
