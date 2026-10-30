// Authenticates a shop's staff for the dashboard. Preferred: shop code + PIN
// (x-staff-slug / x-staff-pin). The older shop key (x-shop-key / x-agent-key)
// still works so nothing breaks while shops move over to PINs.
import { verifyStaffPin, getShopByApiKey, clientIp } from '@/lib/db';

// -> { shop } | { error, status }
export async function authStaff(req) {
  const slug = req.headers['x-staff-slug'];
  const pin = req.headers['x-staff-pin'];
  if (slug && pin) return verifyStaffPin(slug, pin, clientIp(req));
  const key = req.headers['x-shop-key'] || req.headers['x-agent-key'];
  if (key) {
    const shop = await getShopByApiKey(key);
    if (shop) return { shop };
  }
  return { error: 'Unauthorized', status: 401 };
}
