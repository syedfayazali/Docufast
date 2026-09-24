// Scheduled cleanup — deletes uploaded documents that are just sitting in
// Blob storage for no good reason, which is both a privacy problem
// (customer documents can be ID proofs, certificates, etc.) and a storage
// cost that grows forever unless something deletes them.
//
// Two cases handled:
//   1. Uploaded but checkout was abandoned (never paid) — safe to delete
//      quickly, nothing was promised to anyone.
//   2. Paid, but printing permanently failed and was never retried
//      successfully — given a generous grace window for the shop to
//      retry or the customer to follow up, then cleaned up. The job
//      record itself is kept (for the shop's history/accounting), only
//      the underlying file is removed.
//
// Runs on Vercel Cron (see vercel.json) — set CRON_SECRET in your env vars
// and Vercel automatically sends it as a Bearer token on every cron
// invocation, which is what the check below verifies.
import { findAbandonedJobs, findStaleFailedJobs, markJobExpired, clearJobBlob } from '@/lib/db';
import { deleteFile } from '@/lib/blob';

export default async function handler(req, res) {
  if (process.env.CRON_SECRET) {
    const auth = req.headers['authorization'];
    if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  const results = { abandoned: 0, staleFailed: 0, errors: [] };

  try {
    const abandoned = await findAbandonedJobs(2); // 2 hours
    for (const job of abandoned) {
      try {
        await deleteFile(job.blob_url);
        await markJobExpired(job.code);
        results.abandoned++;
      } catch (err) {
        results.errors.push(`${job.code}: ${err.message}`);
      }
    }

    const staleFailed = await findStaleFailedJobs(48); // 48 hours
    for (const job of staleFailed) {
      try {
        await deleteFile(job.blob_url);
        await clearJobBlob(job.code);
        results.staleFailed++;
      } catch (err) {
        results.errors.push(`${job.code}: ${err.message}`);
      }
    }
  } catch (err) {
    console.error('Cleanup cron error:', err.message);
    return res.status(500).json({ error: err.message, ...results });
  }

  console.log('Cleanup cron ran:', results);
  return res.status(200).json({ ok: true, ...results });
}
