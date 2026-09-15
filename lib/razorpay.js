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
