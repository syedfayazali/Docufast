import { retryPrint } from '@/lib/db';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Reuses the same shared secret as the print agent — fine for a single-
  // owner shop; split into a separate ADMIN_KEY if you ever have staff who
  // shouldn't have agent-level access.
  if (!process.env.AGENT_KEY || req.headers['x-agent-key'] !== process.env.AGENT_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { code } = req.query;
  await retryPrint(code);
  return res.status(200).json({ ok: true });
}
