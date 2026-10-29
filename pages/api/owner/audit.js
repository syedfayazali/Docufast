// Owner-only audit view for one job: every status change and every time its
// file was opened. GET /api/owner/audit?code=ABC123
import { isOwner } from '@/lib/auth';
import { getJob, getJobHistory, getFileAccessLog } from '@/lib/db';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!isOwner(req)) return res.status(401).json({ error: 'Unauthorized' });
  const code = String(req.query.code || '').trim().toUpperCase();
  const job = await getJob(code);
  if (!job) return res.status(404).json({ error: 'Job not found' });
  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json({
    code,
    consentAt: job.consent_at,
    deletedAt: job.deleted_at,
    history: await getJobHistory(code),
    fileAccess: await getFileAccessLog(code),
  });
}
