import { listRecentJobs, publicView, getShopByApiKey } from '@/lib/db';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  // Shop dashboard: authenticate with shop's own API key
  const shopKey = req.headers['x-shop-key'];
  const ownerKey = req.headers['x-owner-key'];

  let shopId = null;
  let shopName = null;
  let shopSlug = null;

  if (shopKey) {
    // Shop-scoped view — only show this shop's jobs
    const shop = await getShopByApiKey(shopKey);
    if (!shop) return res.status(401).json({ error: 'Invalid shop key' });
    shopId = shop.id;
    shopName = shop.name;
    shopSlug = shop.slug;
  } else if (ownerKey !== process.env.OWNER_KEY) {
    // Neither shop key nor owner key — unauthorized
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const jobs = (await listRecentJobs({ shopId, limit: 100 })).map(publicView);
  const revenue = jobs.filter(j => j.status === 'printed').reduce((s, j) => s + j.amount, 0);

  return res.status(200).json({ jobs, revenueToday: revenue, shopName, shopSlug });
}
