import { retryPrint } from '@/lib/db';
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!process.env.AGENT_KEY || req.headers['x-agent-key'] !== process.env.AGENT_KEY)
    return res.status(401).json({ error: 'Unauthorized' });
  await retryPrint(req.query.code);
  return res.status(200).json({ ok: true });
}
