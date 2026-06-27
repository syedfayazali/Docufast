import { getJob, markPrinted, markPrintFailed } from '@/lib/db';
import { deleteFile } from '@/lib/blob';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!process.env.AGENT_KEY || req.headers['x-agent-key'] !== process.env.AGENT_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { code } = req.query;
  const { success, error } = req.body || {};

  if (success) {
    const job = await getJob(code);
    await markPrinted(code);
    if (job) await deleteFile(job.blob_url); // file served its purpose — don't keep customer documents around
  } else {
    await markPrintFailed(code, error || 'Unknown print error');
  }

  return res.status(200).json({ ok: true });
}
