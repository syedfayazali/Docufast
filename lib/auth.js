// One place for every secret comparison and for the owner login session.
// Constant-time, and an empty or missing secret NEVER matches (previously
// `undefined === undefined` let a request with no key through whenever the
// env variable was unset).
import crypto from 'crypto';

export function safeEqual(a, b) {
  if (!a || !b) return false;
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

export function isLegacyAgentKey(key) {
  return safeEqual(key, process.env.AGENT_KEY);
}

// ---- Owner login session ----
// The owner signs in with a password; the server then sets a signed,
// HttpOnly cookie that lasts 12 hours. The password is never kept in the
// browser, and the old x-owner-key header is no longer accepted.
export const OWNER_COOKIE = 'df_owner';
export const OWNER_SESSION_SECONDS = 12 * 60 * 60;

// Key used to sign the cookie: SESSION_SECRET if set (16+ characters),
// otherwise derived from OWNER_KEY so nothing new has to be configured.
// Changing either one signs the owner out everywhere.
function signingSecret() {
  const s = process.env.SESSION_SECRET;
  if (s && s.length >= 16) return s;
  const k = process.env.OWNER_KEY;
  if (k) return crypto.createHmac('sha256', 'docufast-owner-session').update(k).digest('hex');
  return null;
}

export function sessionsConfigured() {
  return !!signingSecret();
}

const sign = (secret, payload) => crypto.createHmac('sha256', secret).update(`owner:${payload}`).digest('base64url');

export function createOwnerSession() {
  const secret = signingSecret();
  if (!secret) return null;
  const payload = Buffer.from(JSON.stringify({ exp: Date.now() + OWNER_SESSION_SECONDS * 1000 })).toString('base64url');
  return `${payload}.${sign(secret, payload)}`;
}

function cookieValue(req, name) {
  for (const part of String(req.headers.cookie || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i).trim() === name) return part.slice(i + 1).trim();
  }
  return '';
}

export function ownerCookie(token, maxAgeSeconds = OWNER_SESSION_SECONDS) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `${OWNER_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAgeSeconds}${secure}`;
}

export function isOwner(req) {
  const secret = signingSecret();
  const [payload, sig] = cookieValue(req, OWNER_COOKIE).split('.');
  if (!secret || !payload || !sig || !safeEqual(sig, sign(secret, payload))) return false;
  try {
    return Number(JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')).exp) > Date.now();
  } catch {
    return false;
  }
}

// A staff PIN is exactly 6 digits and not an easy guess. Returns an error text or null.
export function pinProblem(pin) {
  const p = String(pin == null ? '' : pin).trim();
  if (!/^\d{6}$/.test(p)) return 'PIN must be exactly 6 digits';
  if (/^(\d)\1{5}$/.test(p) || '0123456789012345'.includes(p) || '9876543210987654'.includes(p)) return 'Too easy to guess. Avoid 123456 or 111111.';
  return null;
}
