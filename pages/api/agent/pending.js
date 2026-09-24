import { getShopByApiKey, listPendingPrintJobs, assignPrinter } from '@/lib/db';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const agentKey = req.headers['x-agent-key'];
  const printerId = req.headers['x-printer-id'] || null;

  let shopId = null;
  if (agentKey !== process.env.AGENT_KEY) {
    const shop = await getShopByApiKey(agentKey);
    if (!shop) return res.status(401).json({ error: 'Invalid agent key' });
    shopId = shop.id;
  }

  const jobs = await listPendingPrintJobs(shopId);

  // Stamp each job with which printer is about to handle it
  if (printerId) {
    await Promise.all(jobs.map(j => assignPrinter(j.code, printerId)));
  }

// Returns pending jobs with colorMode and duplex included
  return res.status(200).json({
    jobs: jobs.map(j => ({
      code: j.code,
      filename: j.filename,
      blobUrl: j.blob_url,
      copies: j.copies,
      colorMode: j.color_mode,
      duplex: j.duplex,
    })),
  });
}
