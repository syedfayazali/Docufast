import { listRecentJobs, publicView } from '@/lib/db';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const jobs = await listRecentJobs(100);
  const list = jobs.map(publicView);
  const revenue = list.filter((j) => j.status === 'printed').reduce((sum, j) => sum + j.amount, 0);
  return res.status(200).json({ jobs: list, revenueToday: revenue });
}
