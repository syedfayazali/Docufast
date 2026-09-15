// Each shop's agent calls this on startup and every 15s.
// It identifies itself with the shop's api_key (x-agent-key header),
// registers its printer by name, and gets back a printerId to stamp on jobs.
import { getShopByApiKey, registerPrinter, heartbeatPrinter } from '@/lib/db';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const agentKey = req.headers['x-agent-key'];
  const { printerName, printerId } = req.body || {};

  // Support both old AGENT_KEY (single-shop) and per-shop api_key
  let shopId = null;
  if (agentKey === process.env.AGENT_KEY) {
    // Legacy single-shop mode — no shopId
  } else {
    const shop = await getShopByApiKey(agentKey);
    if (!shop) return res.status(401).json({ error: 'Invalid agent key' });
    shopId = shop.id;
  }

  if (shopId && printerName) {
    const printer = await registerPrinter({ shopId, printerId, name: printerName });
    return res.status(200).json({ ok: true, printerId: printer.id, shopId });
  }

  if (printerId) {
    await heartbeatPrinter(printerId).catch(() => {});
  }

  return res.status(200).json({ ok: true, ts: Date.now() });
}
