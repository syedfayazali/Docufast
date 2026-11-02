import { getAppSession } from '@/lib/db';

// -> session { id, email, name, shop_id } or null. Needs Authorization: Bearer <token> + x-machine-id.
export async function appSession(req) {
  const m = /^Bearer (\S+)$/.exec(req.headers.authorization || '');
  if (!m) return null;
  return getAppSession(m[1], String(req.headers['x-machine-id'] || '').slice(0, 100));
}
