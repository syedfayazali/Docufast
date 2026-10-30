// Software plans offered to shop owners. Edit prices/features here only —
// the landing page and the signup API both read this file.
export const TRIAL_DAYS = 14;
export const PLANS = [
  {
    id: 'starter', name: 'Starter', price: 499, // rupees per month
    blurb: 'One shop, one printer.',
    features: ['Your own customer QR code and link', 'UPI payments with Razorpay', 'Live order board for the counter', 'Automatic printing on your printer', 'Your own prices and reports'],
  },
  {
    id: 'pro', name: 'Pro', price: 999, featured: true,
    blurb: 'For busy shops and small chains.',
    features: ['Everything in Starter', 'Up to 5 printers per shop', 'Coupons and referral codes', 'Business accounts with monthly billing', 'Priority WhatsApp support'],
  },
];
export const planIds = PLANS.map(p => p.id);
