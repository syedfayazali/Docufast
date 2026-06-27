// paytm.js — Paytm Payment Gateway integration (Web Checkout, Redirect flow).
// Same approach as the original laptop-only version: relies on Paytm's own
// `paytmchecksum` package for signing (never hand-rolled), built-in fetch for
// HTTP calls. On Vercel, PAYTM_MID / PAYTM_MERCHANT_KEY / PAYTM_ENV are set as
// project environment variables — no .env file needed in production.
import PaytmChecksum from 'paytmchecksum';

export function isConfigured() {
  return !!(process.env.PAYTM_MID && process.env.PAYTM_MERCHANT_KEY);
}

export function missingReason() {
  if (!process.env.PAYTM_MID || !process.env.PAYTM_MERCHANT_KEY) {
    return 'PAYTM_MID / PAYTM_MERCHANT_KEY not set';
  }
  return null;
}

export function config() {
  const isProd = (process.env.PAYTM_ENV || 'staging') === 'production';
  return {
    mid: process.env.PAYTM_MID,
    key: process.env.PAYTM_MERCHANT_KEY,
    website: process.env.PAYTM_WEBSITE || (isProd ? 'DEFAULT' : 'WEBSTAGING'),
    host: isProd ? 'secure.paytmpayments.com' : 'securestage.paytmpayments.com',
    isProd,
  };
}

async function httpsPostJSON(host, reqPath, body) {
  const res = await fetch(`https://${host}${reqPath}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    cache: 'no-store', // avoid Next.js trying to write a fetch-cache entry on Vercel's read-only filesystem
  });
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error('Unexpected response from Paytm: ' + text.slice(0, 200));
  }
}

export async function initiateTransaction({ orderId, amountRupees, callbackUrl }) {
  const cfg = config();
  const body = {
    requestType: 'Payment',
    mid: cfg.mid,
    websiteName: cfg.website,
    orderId,
    callbackUrl,
    txnAmount: { value: amountRupees.toFixed(2), currency: 'INR' },
    userInfo: { custId: 'GUEST_' + orderId },
  };
  const signature = await PaytmChecksum.generateSignature(JSON.stringify(body), cfg.key);
  const payload = { body, head: { signature } };
  const result = await httpsPostJSON(cfg.host, `/theia/api/v1/initiateTransaction?mid=${cfg.mid}&orderId=${orderId}`, payload);

  if (!result.body || result.body.resultInfo.resultStatus !== 'S') {
    const msg = result.body && result.body.resultInfo ? result.body.resultInfo.resultMsg : 'Unknown error';
    throw new Error('Paytm initiateTransaction failed: ' + msg);
  }
  return {
    txnToken: result.body.txnToken,
    txnUrl: `https://${cfg.host}/theia/api/v1/showPaymentPage`,
    mid: cfg.mid,
  };
}

export async function checkTransactionStatus(orderId) {
  const cfg = config();
  const body = { mid: cfg.mid, orderId };
  const signature = await PaytmChecksum.generateSignature(JSON.stringify(body), cfg.key);
  const payload = { body, head: { signature } };
  const result = await httpsPostJSON(cfg.host, '/v3/order/status', payload);
  return result.body;
}

export async function verifyCallback(params) {
  const cfg = config();
  const checksum = params.CHECKSUMHASH;
  const rest = { ...params };
  delete rest.CHECKSUMHASH;
  return PaytmChecksum.verifySignature(rest, cfg.key, checksum);
}
