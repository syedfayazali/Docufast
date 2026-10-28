// TEMPORARY: proves the private storage works end to end on the real
// deployment (write -> read back -> signed link -> download -> delete) so it
// can be checked without a customer. Protected by STORAGE_TEST_TOKEN; remove
// this file and that variable afterwards.
import crypto from 'crypto';
import { put } from 'blob2';
import { privateEnabled, privateToken, readBytes, signFileLink, verifyFileLink, deletePrivate } from '@/lib/privateBlob';
import { getBaseUrl } from '@/lib/baseUrl';

function same(a, b) {
  const x = Buffer.from(String(a || '')); const y = Buffer.from(String(b || ''));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

export default async function handler(req, res) {
  if (!process.env.STORAGE_TEST_TOKEN || !same(req.query.t, process.env.STORAGE_TEST_TOKEN)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const steps = [];
  const step = (name, ok, detail) => steps.push({ name, ok, detail });
  let url = null;
  try {
    step('private storage enabled', privateEnabled(), privateEnabled() ? 'token present' : 'PRIVATE_BLOB_READ_WRITE_TOKEN missing');
    if (!privateEnabled()) return res.status(200).json({ ok: false, steps });

    const body = `docufast-selftest-${Date.now()}`;
    const blob = await put(`selftest/${crypto.randomBytes(6).toString('hex')}.txt`, body, {
      access: 'private', token: privateToken(), addRandomSuffix: true, contentType: 'text/plain',
    });
    url = blob.url;
    step('upload to private store', true, blob.pathname);

    // 1. The raw blob URL must NOT be readable without our token.
    const anon = await fetch(blob.url).catch(e => ({ status: 0, err: e.message }));
    step('raw URL is not public', anon.status === 401 || anon.status === 403 || anon.status === 404, `anonymous fetch -> HTTP ${anon.status}`);

    // 2. We can read it with our token.
    const back = (await readBytes(blob.url)).toString('utf8');
    step('server can read it back', back === body, back === body ? 'content matches' : 'content differs');

    // 3. Signed link: valid link verifies, tampered or expired does not.
    const link = signFileLink(getBaseUrl(req), 'SELFTEST', 600);
    const u = new URL(link);
    step('signed link verifies', verifyFileLink('SELFTEST', u.searchParams.get('e'), u.searchParams.get('s')), 'valid link accepted');
    step('tampered link rejected', !verifyFileLink('OTHER', u.searchParams.get('e'), u.searchParams.get('s')), 'wrong code rejected');
    step('expired link rejected', !verifyFileLink('SELFTEST', 1, u.searchParams.get('s')), 'expired rejected');
  } catch (err) {
    step('unexpected error', false, err.message);
  } finally {
    if (url) { const d = await deletePrivate(url); step('cleanup', d, d ? 'test file deleted' : 'could not delete test file'); }
  }
  return res.status(200).json({ ok: steps.every(s => s.ok), steps });
}
