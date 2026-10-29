// Private file storage + short-lived download links.
//
// Customers upload ID proofs and certificates, so files must not sit behind
// permanent public URLs. When PRIVATE_BLOB_READ_WRITE_TOKEN is set (a private
// Vercel Blob store), new uploads go there; nothing is readable without our
// token. The print agent never gets a blob URL: it gets a link to
// /api/files/<code> that is signed and expires in 10 minutes.
//
// With the token unset, everything keeps working exactly as before (public
// store), and files already uploaded to the old public store stay readable.
//
// The v2 SDK is installed under the alias "blob2" so the original public-store
// code path (@vercel/blob 0.27) is left untouched.
import crypto from 'crypto';
import { get as getPrivate, del as delPrivate } from 'blob2';

const token = () => process.env.PRIVATE_BLOB_READ_WRITE_TOKEN || '';
export const privateEnabled = () => !!token();
export const privateToken = token;

const BLOB_HOST_SUFFIX = '.blob.vercel-storage.com';
export function isBlobUrl(u) {
  try { const x = new URL(u); return x.protocol === 'https:' && x.hostname.endsWith(BLOB_HOST_SUFFIX); }
  catch { return false; }
}

// ---- signed, expiring download links for the print agent ----
function secret() {
  return process.env.FILE_LINK_SECRET || process.env.AGENT_KEY || '';
}
function mac(code, exp) {
  return crypto.createHmac('sha256', secret()).update(`${code}.${exp}`).digest('hex');
}
export function signFileLink(baseUrl, code, ttlSeconds = 600) {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  return `${baseUrl.replace(/\/$/, '')}/api/files/${encodeURIComponent(code)}?e=${exp}&s=${mac(code, exp)}`;
}
export function verifyFileLink(code, exp, sig) {
  if (!secret()) return false;
  const e = parseInt(exp, 10);
  if (!e || e < Math.floor(Date.now() / 1000)) return false;
  const a = Buffer.from(String(sig || ''));
  const b = Buffer.from(mac(code, e));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// ---- reading ----
// Streams a file from the PRIVATE store. Returns null when the URL is not in
// the private store (e.g. an older public upload) or the file is gone.
export async function readPrivate(urlOrPathname) {
  if (!privateEnabled()) return null;
  try {
    const r = await getPrivate(urlOrPathname, { access: 'private', token: token() });
    if (!r || r.statusCode !== 200 || !r.stream) return null;
    return { stream: r.stream, size: r.blob?.size ?? null, contentType: r.blob?.contentType || 'application/octet-stream' };
  } catch {
    return null;
  }
}

// Whole file as a Buffer, from whichever store holds it.
export async function readBytes(blobUrl) {
  const priv = await readPrivate(blobUrl);
  if (priv) return Buffer.from(await new Response(priv.stream).arrayBuffer());
  // Public store (older uploads / private storage not enabled). Only ever
  // fetch our own Blob hosts, never an arbitrary URL a client sends.
  if (!isBlobUrl(blobUrl)) throw new Error('File location is not allowed');
  const r = await fetch(blobUrl);
  if (!r.ok) throw new Error(`File could not be read (HTTP ${r.status})`);
  return Buffer.from(await r.arrayBuffer());
}

// ---- deleting ----
// Tries the private store first (when enabled); the caller then also tries the
// public path, so one call cleans up either kind.
export async function deletePrivate(url) {
  if (!privateEnabled() || !url) return false;
  try { await delPrivate(url, { token: token() }); return true; } catch { return false; }
}
