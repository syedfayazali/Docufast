// Software plans offered to shop owners. Edit prices/features here only: the
// landing page, the signup API and the limits enforced on each shop all read
// this file.
export const TRIAL_DAYS = 14;
export const GRACE_DAYS = 3;          // after a plan ends, orders keep flowing this long
export const YEARLY_MONTHS_PAID = 10; // pay 10 months, get 12

export const PLANS = [
  {
    id: 'starter', name: 'Starter', price: 499, // rupees per month
    maxPrinters: 1, coupons: false, accounts: false,
    blurb: 'One shop, one printer.',
    features: ['Your own customer QR code and link', 'UPI payments with Razorpay', 'Live order board for the counter', 'Automatic printing on your printer', 'Your own prices and reports', 'ID card, passport photo and passport copy sheets'],
  },
  {
    id: 'pro', name: 'Pro', price: 999, featured: true,
    maxPrinters: 5, coupons: true, accounts: true,
    blurb: 'For busy shops and small chains.',
    features: ['Everything in Starter', 'Up to 5 printers in the shop', 'Coupon and referral codes for customers', 'Business accounts with monthly billing', 'Priority WhatsApp support'],
  },
];
export const planIds = PLANS.map(p => p.id);
export const getPlan = id => PLANS.find(p => p.id === id) || null;

// Where a shop stands. A shop with no plan set (your own shops, or shops from
// before plans existed) is never limited.
//   free     no plan set
//   trial    free trial running
//   active   paid up
//   grace    plan ended in the last GRACE_DAYS: still working, please renew
//   expired  new customer orders are paused (paid jobs still print)
export function billingState(shop, now = Date.now()) {
  if (!shop || !shop.plan) return { state: 'free', plan: null };
  const until = shop.plan_until ? new Date(shop.plan_until).getTime() : 0;
  const daysLeft = Math.ceil((until - now) / 86400000);
  let state;
  if (now <= until) state = shop.plan_trial ? 'trial' : 'active';
  else if (now <= until + GRACE_DAYS * 86400000) state = 'grace';
  else state = 'expired';
  return { state, plan: shop.plan, until: shop.plan_until || null, daysLeft };
}
