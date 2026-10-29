// Download route for the PRINT AGENT. The agent is given a link to this route
// (not a blob URL). The link is signed and expires in 10 minutes, so a leaked
// or logged link stops working almost immediately and the file itself never
// has a public address.
import { Readable } from 'stream';
import { getJob } from '@/lib/db';
import { privateEnabled, readPrivate, verifyFileLink, isBlobUrl } from '@/lib/privateBlob';

// Big scans take a while to stream to the shop; raise the function time limit.
export const config = { api: { responseLimit: false }, maxDuration: 60 };

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { code, e, s } = req.query;
  if (!verifyFileLink(code, e, s)) return res.status(403).json({ error: 'Link expired or invalid' });

  const job = await getJob(code);
  if (!job || !job.blob_url) return res.status(404).json({ error: 'File not found' });

  // Access log (who opened which file, when). A table for this comes later;
  // for now it is in the function logs.
  console.log(`file-access code=${code} shop=${job.shop_id || '-'} ip=${req.headers['x-forwarded-for'] || '-'}`);

  if (privateEnabled()) {
    const f = await readPrivate(job.blob_url);
    if (f) {
      res.setHeader('Content-Type', f.contentType);
      if (f.size) res.setHeader('Content-Length', String(f.size));
      res.setHeader('Cache-Control', 'no-store');
      return Readable.fromWeb(f.stream).pipe(res);
    }
  }

  // Older upload that still lives in the public store: send the agent there.
  if (isBlobUrl(job.blob_url)) {
    res.setHeader('Cache-Control', 'no-store');
    return res.redirect(302, job.blob_url);
  }
  return res.status(404).json({ error: 'File not found' });
}
