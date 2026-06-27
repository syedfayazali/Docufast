import { listRecentJobs, publicView, getAgentStatus } from '@/lib/db';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const jobs = await listRecentJobs(100);
  const list = jobs.map(publicView);
  const revenue = list.filter((j) => j.status === 'printed').reduce((sum, j) => sum + j.amount, 0);

  const agent = await getAgentStatus();
  // "Online" means it has checked in within the last 30s — a bit more than
  // 5x the agent's default 5s poll interval, so one slow poll or a brief
  // network hiccup doesn't flash the dashboard red.
  const agentOnline = !!(agent && agent.last_seen && Date.now() - new Date(agent.last_seen).getTime() < 30000);

  return res.status(200).json({
    jobs: list,
    revenueToday: revenue,
    agent: agent
      ? {
          online: agentOnline,
          lastSeen: agent.last_seen,
          printerOk: agent.printer_ok,
          printerMessage: agent.printer_message,
          agentVersion: agent.agent_version,
        }
      : null,
  });
}
