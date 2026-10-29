import { privateEnabled } from '@/lib/privateBlob';
import { resolveShop } from '@/lib/db';
import { normalizePrices } from '@/lib/pricing';

// Public settings for the customer page. With ?shop=<slug> it also returns
// that shop's price list so the page shows the same numbers the server bills.
export default async function handler(req, res) {
  const proto = req.headers['x-forwarded-proto'] || 'https';
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const out = { baseUrl: process.env.BASE_URL || `${proto}://${host}`, privateUploads: privateEnabled() };
  try {
    const shop = await resolveShop(typeof req.query.shop === 'string' ? req.query.shop : null);
    out.prices = normalizePrices(shop?.prices);
    out.shopName = shop?.name || null;
  } catch {
    out.prices = normalizePrices(null);
  }
  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json(out);
}
