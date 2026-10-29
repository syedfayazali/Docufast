import { isOwner, isLegacyAgentKey } from '@/lib/auth';
import { listRecentJobs, publicView } from '@/lib/db';
import { authStaff } from '@/lib/staff';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  // Shop dashboard: authenticate with shop's own API key
  const shopKey = req.headers['x-shop-key'];
  const ownerKey = req.headers['x-owner-key'];

  let shopId = null;
  let shopName = null;
  let shopSlug = null;

  const hasStaffCreds = (req.headers['x-staff-slug'] && req.headers['x-staff-pin']) || shopKey;
  if (hasStaffCreds) {
    // Shop-scoped view — only show this shop's jobs
    const auth = await authStaff(req);
    if (!auth.shop) return res.status(auth.status || 401).json({ error: auth.error });
    shopId = auth.shop.id;
    shopName = auth.shop.name;
    shopSlug = auth.shop.slug;
  } else if (!isOwner(req)) {
    // Neither staff login nor owner key — unauthorized
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const jobs = (await listRecentJobs({ shopId, limit: 100 })).map(publicView);
  const revenue = jobs.filter(j => j.status === 'printed').reduce((s, j) => s + j.amount, 0);

  return res.status(200).json({ jobs, revenueToday: revenue, shopName, shopSlug });
}
