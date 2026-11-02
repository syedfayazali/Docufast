// Authenticates a shop's staff for the dashboard. Preferred: shop code + PIN
// (x-staff-slug / x-staff-pin). The older shop key (x-shop-key / x-agent-key)
// still works so nothing breaks while shops move over to PINs.
import { verifyStaffPin, getShopByApiKey, clientIp, getAppSession, getShopById } from '@/lib/db';

// -> { shop } | { error, status }
export async function authStaff(req) {
  // The desktop app signs in with an emailed code and carries a session bound to its computer.
  const bearer = /^Bearer (\S+)$/.exec(req.headers.authorization || '');
  if (bearer) {
    const s = await getAppSession(bearer[1], req.headers['x-machine-id']);
    if (!s || !s.shop_id) return { error: 'Please sign in again', status: 401 };
    const shop = await getShopById(s.shop_id);
    if (shop && shop.active) return { shop };
    return { error: 'This shop is switched off', status: 403 };
  }
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
