import { listRecentJobs, publicView } from '@/lib/db';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (req.headers['x-owner-key'] !== process.env.OWNER_KEY) return res.status(401).json({ error: 'Unauthorized' });
  const jobs = (await listRecentJobs({ limit: 200 })).map(publicView);
  return res.status(200).json({ jobs });
}
