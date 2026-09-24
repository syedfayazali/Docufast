import { getShopBySlug } from '@/lib/db';

// Public, read-only lookup — used by the signage/poster page to show a shop's
// display name next to its QR code. Only ever returns non-sensitive fields
// (never api_key), so it's safe to call without authentication.
export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { slug } = req.query;
  if (!slug) return res.status(400).json({ error: 'Missing slug' });

  const shop = await getShopBySlug(slug);
  if (!shop || !shop.active) return res.status(404).json({ error: 'Shop not found' });

  return res.status(200).json({
    name: shop.name,
    slug: shop.slug,
    city: shop.city || null,
  });
}
