import { getJob, markPaid } from '@/lib/db';
import * as paytm from '@/lib/paytm';
import { getBaseUrl } from '@/lib/baseUrl';

export default async function handler(req, res) {
  const { code } = req.query;
  const baseUrl = getBaseUrl(req);

  const redirect = (paid) => {
    res.writeHead(302, { Location: `${baseUrl}/?code=${encodeURIComponent(code)}&paid=${paid ? '1' : '0'}` });
    res.end();
  };

  if (req.method !== 'POST') {
    res.status(405).end();
    return;
  }

  const job = await getJob(code);
  if (!job) return redirect(false);

  try {
    // Next.js automatically parses application/x-www-form-urlencoded bodies
    // (what Paytm posts here) into a plain object on req.body.
    const params = req.body || {};
    const signatureOk = await paytm.verifyCallback(params);
    if (!signatureOk) {
      console.error(`Paytm callback signature mismatch for ${code}`);
      return redirect(false);
    }

    // Never trust the redirect alone — independently confirm with Paytm's
    // Transaction Status API before marking anything paid.
    const status = await paytm.checkTransactionStatus(code);
    if (status && status.resultInfo && status.resultInfo.resultStatus === 'TXN_SUCCESS') {
      await markPaid(code, status.txnId);
      return redirect(true);
    }
    return redirect(false);
  } catch (e) {
    console.error('Paytm callback error:', e.message);
    return redirect(false);
  }
}
