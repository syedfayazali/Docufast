import { recordAgentHeartbeat, getAgentStatus } from '@/lib/db';

// The print agent calls this on every poll cycle (whether or not there's a
// job to print) so the admin dashboard can tell "agent is running fine" apart
// from "agent has been silently dead since this morning." GET returns the
// last known status for the dashboard to display.
export default async function handler(req, res) {
  if (!process.env.AGENT_KEY || req.headers['x-agent-key'] !== process.env.AGENT_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (req.method === 'POST') {
    const { printerOk, printerMessage, agentVersion } = req.body || {};
    await recordAgentHeartbeat({ printerOk: !!printerOk, printerMessage, agentVersion });
    return res.status(200).json({ ok: true });
  }

  if (req.method === 'GET') {
    const status = await getAgentStatus();
    return res.status(200).json({ status });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
