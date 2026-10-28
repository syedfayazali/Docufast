// One place for every secret comparison. Constant-time, and an empty or
// missing secret NEVER matches (previously `undefined === undefined` let a
// request with no key through whenever the env variable was unset).
import crypto from 'crypto';

export function safeEqual(a, b) {
  if (!a || !b) return false;
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

export function isOwner(req) {
  return safeEqual(req.headers['x-owner-key'], process.env.OWNER_KEY);
}

export function isLegacyAgentKey(key) {
  return safeEqual(key, process.env.AGENT_KEY);
}
