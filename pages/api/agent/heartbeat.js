// Each shop's agent calls this on startup and periodically thereafter.
// It identifies itself with the shop's api_key (x-agent-key header),
// registers its printer by name, and gets back a printerId to stamp on jobs.
//
// It also enforces one-shop-key-one-computer: the agent sends a stable
// x-machine-id header with every call (heartbeat AND pending, see
// pending.js). The FIRST computer to call in with a given shop key claims
// it; any OTHER computer using the same key gets rejected with 409 instead
// of silently running alongside the original and racing it for jobs.
import { getShopByApiKey, registerPrinter, heartbeatPrinter, checkAndBindMachine } from '@/lib/db';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const agentKey = req.headers['x-agent-key'];
  const machineId = req.headers['x-machine-id'] || null;
  const machineName = req.headers['x-machine-name'] || null;
  const { printerName, printerId } = req.body || {};

  // Support both old AGENT_KEY (single-shop) and per-shop api_key
  let shopId = null;
  if (agentKey === process.env.AGENT_KEY) {
    // Legacy single-shop mode — no shopId, so no machine-binding to check.
  } else {
    const shop = await getShopByApiKey(agentKey);
    if (!shop) return res.status(401).json({ error: 'Invalid agent key' });
    shopId = shop.id;

    const bind = await checkAndBindMachine(shopId, machineId, machineName);
    if (!bind.ok) {
      return res.status(409).json({
        error: 'duplicate_key',
        message: 'This shop key is already active on another computer. If you\'ve moved to a new PC, ask the platform owner to reset it for this shop.',
      });
    }
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
