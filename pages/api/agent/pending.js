import {
  getShopByApiKey, listPendingPrintJobs, assignPrinter, checkAndBindMachine,
  claimUnassignedJobs, listRecentUnpaidRazorpayJobs, markPaid,
  findExpiredPrintedBlobs, clearJobBlob,
} from '@/lib/db';
import { findCapturedPayment, isConfigured } from '@/lib/razorpay';
import { deleteFile } from '@/lib/blob';
import { privateEnabled, signFileLink } from '@/lib/privateBlob';
import { getBaseUrl } from '@/lib/baseUrl';

// Per-shop throttle for the Razorpay reconcile below (best effort — resets
// on cold start, which only means one extra check).
const lastReconcile = new Map();
const RECONCILE_EVERY_MS = 45 * 1000;

async function reconcilePayments(shopId) {
  if (!isConfigured()) return;
  const now = Date.now();
  if (now - (lastReconcile.get(shopId) || 0) < RECONCILE_EVERY_MS) return;
  lastReconcile.set(shopId, now);
  try {
    const unpaid = await listRecentUnpaidRazorpayJobs(shopId, 60);
    for (const j of unpaid) {
      const paymentId = await findCapturedPayment(j.razorpay_order_id).catch(() => null);
      if (paymentId) await markPaid(j.code, paymentId);
    }
  } catch (err) {
    console.error('reconcilePayments failed:', err.message);
  }
}

const lastPurge = new Map();
async function purgePrinted(shopId) {
  const now = Date.now();
  if (now - (lastPurge.get(shopId) || 0) < 5 * 60 * 1000) return;
  lastPurge.set(shopId, now);
  try {
    for (const j of await findExpiredPrintedBlobs(shopId)) {
      await deleteFile(j.blob_url).catch(() => {});
      await clearJobBlob(j.code);
    }
  } catch (err) { console.error('purgePrinted failed:', err.message); }
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const agentKey = req.headers['x-agent-key'];
  const printerId = req.headers['x-printer-id'] || null;
  const machineId = req.headers['x-machine-id'] || null;

  let shopId = null;
  if (agentKey !== process.env.AGENT_KEY) {
    const shop = await getShopByApiKey(agentKey);
    if (!shop) return res.status(401).json({ error: 'Invalid agent key' });
    shopId = shop.id;

    // One-shop-key-one-computer enforcement (same as heartbeat.js).
    const bind = await checkAndBindMachine(shopId, machineId, null);
    if (!bind.ok) {
      return res.status(409).json({
        error: 'duplicate_key',
        message: 'This shop key is already active on another computer. If you\'ve moved to a new PC, ask the platform owner to reset it for this shop.',
      });
    }

    // Rescue jobs that were paid but never reached this shop (see db.js).
    await claimUnassignedJobs(shopId).catch(() => {});
    // Rescue payments that Razorpay captured but we never heard about.
    await reconcilePayments(shopId);
    // Remove printed files whose reprint window has passed (the daily cron
    // alone would leave customer documents sitting for up to a day).
    purgePrinted(shopId);
  }

  const jobs = await listPendingPrintJobs(shopId);

  if (printerId) {
    await Promise.all(jobs.map(j => assignPrinter(j.code, printerId)));
  }

  return res.status(200).json({
    serverTime: Date.now(),
    jobs: jobs.map(j => ({
      code: j.code,
      filename: j.filename,
      // With private storage on, the agent gets a 10-minute signed link to
      // our download route instead of a permanent file address.
      blobUrl: privateEnabled() ? signFileLink(getBaseUrl(req), j.code) : j.blob_url,
      copies: j.copies,
      pages: j.pages,
      amount: j.amount,
      colorMode: j.color_mode,
      duplex: j.duplex,
      attempt: (j.print_attempts || 0) + 1,
    })),
  });
}
