import { listPendingPrintJobs } from '@/lib/db';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  if (!process.env.AGENT_KEY || req.headers['x-agent-key'] !== process.env.AGENT_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const jobs = await listPendingPrintJobs();
  return res.status(200).json({
    jobs: jobs.map((j) => ({
      code: j.code,
      filename: j.filename,
      blobUrl: j.blob_url,
      copies: j.copies,
      colorMode: j.color_mode,
      duplex: j.duplex,
    })),
  });
}
