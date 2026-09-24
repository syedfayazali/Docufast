// Server-to-server payment confirmation — the safety net that
// /api/verify-payment can't provide on its own.
//
// /api/verify-payment only runs if the CUSTOMER'S BROWSER successfully
// calls it after checkout. If their tab crashes, they lose signal, or the
// app gets backgrounded on a flaky phone connection right after paying —
// all common at a walk-in print counter — Razorpay has the money and this
// app never finds out. This webhook is Razorpay calling US directly,
// independent of the customer's browser, so a job still gets marked paid
// even if the client-side call never happens.
//
// Setup required (one-time, in the Razorpay dashboard):
//   Settings -> Webhooks -> Add New Webhook
//   URL:    https://<your-domain>/api/webhooks/razorpay
//   Secret: generate any random string, set it as RAZORPAY_WEBHOOK_SECRET
//           in Vercel's env vars (this is DIFFERENT from RAZORPAY_KEY_SECRET)
//   Events: payment.captured  (required)
//
// bodyParser must be OFF here — Razorpay signs the raw request bytes, and
// even a byte-identical JSON.stringify() of the parsed body can fail
// signature verification if key order or whitespace differs.
export const config = { api: { bodyParser: false } };

import { verifyWebhookSignature } from '@/lib/razorpay';
import { getJobByRazorpayOrder, markPaid } from '@/lib/db';

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const rawBody = await readRawBody(req);
  const signature = req.headers['x-razorpay-signature'];

  if (!verifyWebhookSignature(rawBody, signature)) {
    console.error('Webhook signature mismatch — rejecting delivery');
    return res.status(400).json({ error: 'Invalid signature' });
  }

  let event;
  try {
    event = JSON.parse(rawBody.toString('utf8'));
  } catch {
    return res.status(400).json({ error: 'Invalid JSON' });
  }

  // payment.captured is the one that matters — it fires once Razorpay has
  // actually captured the funds, which is the same trust boundary
  // /api/verify-payment relies on.
  if (event.event === 'payment.captured') {
    const payment = event.payload?.payment?.entity;
    const orderId = payment?.order_id;
    const paymentId = payment?.id;

    if (orderId && paymentId) {
      const job = await getJobByRazorpayOrder(orderId);
      if (job) {
        // markPaid's SQL only updates rows still in 'pending_payment', so
        // this is safe to call even if /api/verify-payment already marked
        // it paid moments earlier — whichever gets there first wins, and
        // the other becomes a harmless no-op. Razorpay also retries
        // webhook deliveries on non-2xx responses, so this must stay
        // idempotent regardless.
        await markPaid(job.code, paymentId);
      } else {
        // Not necessarily an error — could be a job created by a different
        // integration, or the DB write for createJob raced with this
        // webhook. Logged for visibility rather than failing the delivery.
        console.warn('Webhook: no job found for Razorpay order', orderId);
      }
    }
  }

  // Always 200 on anything we don't specifically act on too — Razorpay
  // retries deliveries that don't get a 2xx, and there's nothing gained by
  // failing on event types we don't care about.
  return res.status(200).json({ ok: true });
}
