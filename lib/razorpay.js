// Razorpay backend integration.
// KEY_SECRET never leaves this file — it is used only for HMAC signing
// on the server. The KEY_ID is safe to expose to the frontend.
//
// Environment variables (set in Vercel → Settings → Environment Variables):
//   RAZORPAY_KEY_ID     — your Key ID  (safe to expose to frontend)
//   RAZORPAY_KEY_SECRET — your Key Secret (NEVER expose to frontend)

import Razorpay from 'razorpay';
import crypto from 'crypto';

export function isConfigured() {
  return !!(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
}

function getRazorpay() {
  return new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });
}

// Creates a Razorpay order. Amount must be in paise (₹1 = 100 paise).
// Returns { id, amount, currency } — pass `id` to the frontend as `order_id`.
export async function createOrder({ amountPaise, receipt }) {
  if (amountPaise < 100) throw new Error('Minimum order amount is ₹1 (100 paise)');
  const instance = getRazorpay();
  const order = await instance.orders.create({
    amount: amountPaise,
    currency: 'INR',
    receipt,
  });
  return { orderId: order.id, amount: order.amount, currency: order.currency };
}

// Verifies the payment signature that Razorpay sends back after a successful
// payment. This is the security-critical step — DO NOT mark a payment as
// successful without this verification passing.
//
// Algorithm: HMAC-SHA256(razorpay_order_id + "|" + razorpay_payment_id, KEY_SECRET)
// The generated digest must match razorpay_signature exactly.
export function verifySignature({ razorpay_order_id, razorpay_payment_id, razorpay_signature }) {
  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return false;
  }
  const body = razorpay_order_id + '|' + razorpay_payment_id;
  const expected = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(body)
    .digest('hex');
  return expected === razorpay_signature;
}

// Verifies a webhook delivery from Razorpay. This uses a DIFFERENT secret
// (RAZORPAY_WEBHOOK_SECRET, set separately in the Razorpay dashboard under
// Settings -> Webhooks) and a different algorithm from checkout signature
// verification above: it signs the raw request body bytes, not an
// order_id|payment_id pair. rawBody must be the untouched request body
// string/buffer — signing a re-serialized JSON object will not match.
export function verifyWebhookSignature(rawBody, signatureHeader) {
  if (!signatureHeader || !process.env.RAZORPAY_WEBHOOK_SECRET) return false;
  const expected = crypto
    .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET)
    .update(rawBody)
    .digest('hex');
  // Constant-time compare to avoid leaking the expected signature via timing.
  const a = Buffer.from(expected);
  const b = Buffer.from(signatureHeader);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

// Asks Razorpay directly whether an order has a captured payment. Safety net
// for when BOTH the customer's browser call and the webhook were missed.
// Returns the captured payment id, or null.
export async function findCapturedPayment(orderId) {
  const instance = getRazorpay();
  const list = await instance.orders.fetchPayments(orderId);
  const hit = (list?.items || []).find(p => p.status === 'captured');
  return hit ? hit.id : null;
}

// Refunds a captured payment (full amount unless amountPaise is given).
// Returns the Razorpay refund id. Throws with Razorpay's own message on failure.
export async function refundPayment(paymentId, amountPaise) {
  const instance = getRazorpay();
  const body = { speed: 'normal' };
  if (amountPaise) body.amount = amountPaise;
  const r = await instance.payments.refund(paymentId, body);
  return r.id;
}

// ---- Subscriptions (recurring AutoPay: UPI AutoPay / card / eNACH) ----
// Needs "Subscriptions" switched on in the Razorpay dashboard.
export async function createRzpPlan({ period, name, amountPaise }) {
  const p = await getRazorpay().plans.create({ period, interval: 1, item: { name, amount: amountPaise, currency: 'INR' } });
  return p.id;
}
export async function createRzpSubscription({ planId, totalCount, notes }) {
  const sub = await getRazorpay().subscriptions.create({ plan_id: planId, total_count: totalCount, customer_notify: 1, notes: notes || {} });
  return sub.id;
}
// Note the order of the two ids differs from a normal payment: payment_id | subscription_id.
export function verifySubscriptionSignature({ razorpay_payment_id, razorpay_subscription_id, razorpay_signature }) {
  if (!razorpay_payment_id || !razorpay_subscription_id || !razorpay_signature) return false;
  const expected = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET).update(razorpay_payment_id + '|' + razorpay_subscription_id).digest('hex');
  const a = Buffer.from(expected), b = Buffer.from(String(razorpay_signature));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
// Stops future charges; the shop keeps what it already paid for.
export async function cancelRzpSubscription(subscriptionId) {
  return getRazorpay().subscriptions.cancel(subscriptionId, true);
}
