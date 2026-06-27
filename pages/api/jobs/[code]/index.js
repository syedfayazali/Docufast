import { getJob, publicView } from '@/lib/db';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const { code } = req.query;
  const job = await getJob(code);
  if (!job) return res.status(404).json({ error: 'No job found with that code' });
  return res.status(200).json({ job: publicView(job) });
}
