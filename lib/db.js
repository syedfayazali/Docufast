import { Pool } from 'pg';
import { sendWake } from '@/lib/wake';

let pool;
// Which database to use. Normally DATABASE_URL. During the move to Supabase,
// SUPABASE_DB_URL holds the new connection string and USE_SUPABASE=1 switches
// the whole app over; removing USE_SUPABASE switches straight back (rollback).
function connectionString() {
  if (process.env.USE_SUPABASE === '1' && process.env.SUPABASE_DB_URL) return process.env.SUPABASE_DB_URL;
  return process.env.DATABASE_URL || process.env.POSTGRES_URL;
}
function getPool() {
  if (!pool) {
    const cs = connectionString();
    if (!cs) throw new Error('DATABASE_URL not set. Connect a Postgres database in Vercel Storage tab.');
    // Serverless: every function instance opens its own pool, so keep it small
    // (Supabase's pooler on port 6543 multiplexes these).
    pool = new Pool({ connectionString: cs, ssl: { rejectUnauthorized: false }, max: 3 });
  }
  return pool;
}
async function query(text, params) { return getPool().query(text, params); }

let schemaReady = false;
export async function ensureSchema() {
  if (schemaReady) return;
  await query(`
    CREATE TABLE IF NOT EXISTS shops (
      id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
      name        TEXT NOT NULL,
      slug        TEXT NOT NULL UNIQUE,
      city        TEXT,
      address     TEXT,
      api_key     TEXT NOT NULL UNIQUE,
      active      BOOLEAN NOT NULL DEFAULT TRUE,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS printers (
      id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
      shop_id     TEXT NOT NULL REFERENCES shops(id),
      name        TEXT NOT NULL,
      status      TEXT NOT NULL DEFAULT 'offline',
      last_seen   TIMESTAMPTZ,
      jobs_today  INTEGER NOT NULL DEFAULT 0,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS jobs (
      code                TEXT PRIMARY KEY,
      shop_id             TEXT REFERENCES shops(id),
      printer_id          TEXT REFERENCES printers(id),
      filename            TEXT NOT NULL,
      blob_url            TEXT,
      pages               INTEGER NOT NULL,
      copies              INTEGER NOT NULL,
      color_mode          TEXT NOT NULL,
      duplex              BOOLEAN NOT NULL DEFAULT FALSE,
      amount              INTEGER NOT NULL,
      status              TEXT NOT NULL DEFAULT 'pending_payment',
      payment_provider    TEXT NOT NULL,
      razorpay_order_id   TEXT,
      razorpay_payment_id TEXT,
      print_error         TEXT,
      created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
      printed_at          TIMESTAMPTZ
    )
  `);
  await query(`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS shop_id TEXT REFERENCES shops(id)`);
  await query(`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS printer_id TEXT REFERENCES printers(id)`);
  await query(`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS razorpay_order_id TEXT`);
  await query(`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS razorpay_payment_id TEXT`);
  // One shop key should only ever be "live" on one physical computer — this
  // pair tracks which machine currently holds the shop's key so a second
  // computer using the same key gets rejected instead of silently racing
  // the first one for the same print jobs.
  // Auto-retry bookkeeping: how many times the agent has failed this job and
  // when, so a transient failure (printer offline, spooler hiccup) retries by
  // itself instead of leaving a paid order stuck until someone presses Retry.
  await query(`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS print_attempts INTEGER NOT NULL DEFAULT 0`);
  await query(`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS failed_at TIMESTAMPTZ`);
  await query(`ALTER TABLE shops ADD COLUMN IF NOT EXISTS bound_machine_id TEXT`);
  await query(`ALTER TABLE shops ADD COLUMN IF NOT EXISTS bound_machine_name TEXT`);
  schemaReady = true;
}

export function publicView(job) {
  return {
    code: job.code,
    shopId: job.shop_id,
    printerId: job.printer_id,
    filename: job.filename,
    pages: job.pages,
    copies: job.copies,
    colorMode: job.color_mode,
    duplex: job.duplex,
    amount: job.amount,
    status: job.status,
    printError: job.print_error || null,
    printAttempts: job.print_attempts || 0,
    createdAt: job.created_at,
    printedAt: job.printed_at,
  };
}

// ---- Jobs ----
export async function createJob(job) {
  await ensureSchema();
  await query(
    `INSERT INTO jobs (code,shop_id,filename,blob_url,pages,copies,color_mode,duplex,amount,status,payment_provider,razorpay_order_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
    [job.code, job.shopId || null, job.filename, job.blobUrl, job.pages, job.copies,
     job.colorMode, job.duplex, job.amount, job.status, job.paymentProvider, job.razorpayOrderId || null]
  );
}
export async function getJob(code) {
  await ensureSchema();
  const { rows } = await query('SELECT * FROM jobs WHERE code=$1', [code]);
  return rows[0] || null;
}
export async function getJobByRazorpayOrder(razorpayOrderId) {
  await ensureSchema();
  const { rows } = await query('SELECT * FROM jobs WHERE razorpay_order_id=$1', [razorpayOrderId]);
  return rows[0] || null;
}
export async function markPaid(code, razorpayPaymentId) {
  await ensureSchema();
  const r = await query(
    `UPDATE jobs SET status='paid',razorpay_payment_id=$1 WHERE code=$2 AND status='pending_payment'`,
    [razorpayPaymentId, code]
  );
  if (r.rowCount > 0) await wakeShopForJob(code);
}

// Tell the job's shop agent to check for work right now (push). Never throws.
export async function wakeShopForJob(code) {
  try {
    const { rows } = await query(
      `SELECT s.api_key FROM jobs j JOIN shops s ON s.id = j.shop_id WHERE j.code = $1`,
      [code]
    );
    if (rows[0]?.api_key) await sendWake(rows[0].api_key);
  } catch (err) {
    console.warn('wakeShopForJob failed:', err.message);
  }
}
export async function markPrinted(code) {
  await ensureSchema();
  const job = await getJob(code);
  await query(
    `UPDATE jobs SET status='printed',print_error=NULL,printed_at=now() WHERE code=$1`,
    [code]
  );
  if (job?.printer_id) {
    await query(
      `UPDATE printers SET jobs_today = jobs_today + 1 WHERE id = $1`,
      [job.printer_id]
    );
  }
  return job;
}
export async function markPrintFailed(code, errorMsg) {
  await ensureSchema();
  await query('UPDATE jobs SET print_error=$1, print_attempts=print_attempts+1, failed_at=now() WHERE code=$2', [errorMsg, code]);
}
export async function retryPrint(code) {
  await ensureSchema();
  await query(`UPDATE jobs SET print_error=NULL, print_attempts=0, failed_at=NULL WHERE code=$1 AND status='paid'`, [code]);
  await wakeShopForJob(code);
}

// Two real cleanup cases the app previously never handled:
//   1. A customer uploads a file, then abandons checkout — the file sits
//      in Blob storage forever (uploaded before payment even happens),
//      accumulating storage cost and holding onto a document (possibly an
//      ID proof, certificate, etc.) nobody ever paid for or printed.
//   2. A job's print permanently fails and is never retried successfully —
//      the file used to only get deleted on the SUCCESS path in
//      /api/agent/[code]/result, never on failure.
// Both return the rows so the cron job can delete the actual Blob files
// (deletion is an external API call, so it belongs in the route, not here).
export async function findAbandonedJobs(olderThanHours = 2) {
  await ensureSchema();
  const { rows } = await query(
    `SELECT code, blob_url FROM jobs
     WHERE status='pending_payment' AND blob_url IS NOT NULL
       AND created_at < now() - ($1 || ' hours')::interval`,
    [olderThanHours]
  );
  return rows;
}
export async function findStaleFailedJobs(olderThanHours = 48) {
  await ensureSchema();
  const { rows } = await query(
    `SELECT code, blob_url FROM jobs
     WHERE status='paid' AND print_error IS NOT NULL AND blob_url IS NOT NULL
       AND created_at < now() - ($1 || ' hours')::interval`,
    [olderThanHours]
  );
  return rows;
}
export async function markJobExpired(code) {
  await ensureSchema();
  await query(`UPDATE jobs SET status='expired', blob_url=NULL WHERE code=$1`, [code]);
}
export async function clearJobBlob(code) {
  await ensureSchema();
  await query(`UPDATE jobs SET blob_url=NULL WHERE code=$1`, [code]);
}

// Jobs paid but sitting unprinted far longer than a normal print takes —
// almost always means the shop's agent is offline or crashed, and
// previously nothing surfaced this anywhere until a customer complained.
export async function countStuckJobsByShop(olderThanMinutes = 15) {
  await ensureSchema();
  const { rows } = await query(
    `SELECT shop_id, COUNT(*) as count FROM jobs
     WHERE status='paid' AND print_error IS NULL
       AND created_at < now() - ($1 || ' minutes')::interval
     GROUP BY shop_id`,
    [olderThanMinutes]
  );
  const map = {};
  for (const r of rows) map[r.shop_id] = parseInt(r.count, 10);
  return map;
}
export async function assignPrinter(code, printerId) {
  await ensureSchema();
  await query(`UPDATE jobs SET printer_id=$1 WHERE code=$2`, [printerId, code]);
}
// Only jobs with NO print_error are handed to an agent. Previously a failed
// job (print_error set) stayed 'paid' with a blob and was returned on every
// poll, so a printer that mis-printed would re-print the same file every
// 10 seconds until someone noticed. A failed job now waits until the shop
// presses Retry (retryPrint clears print_error).
export const MAX_PRINT_ATTEMPTS = 3;
export const RETRY_AFTER_SECONDS = 45;
export const REPRINT_WINDOW_MINUTES = 30;

// A paid job is offered to the agent when it has never failed, OR it failed
// fewer than MAX_PRINT_ATTEMPTS times and the last failure was long enough
// ago. After that it waits for a human (Retry / Reprint) and shows as failed.
export async function listPendingPrintJobs(shopId) {
  await ensureSchema();
  const retryable = `(print_error IS NULL OR (print_attempts < ${MAX_PRINT_ATTEMPTS} AND failed_at < now() - interval '${RETRY_AFTER_SECONDS} seconds'))`;
  const { rows } = shopId
    ? await query(
        `SELECT * FROM jobs WHERE status='paid' AND blob_url IS NOT NULL AND ${retryable} AND shop_id=$1 ORDER BY created_at ASC LIMIT 20`,
        [shopId]
      )
    : await query(
        `SELECT * FROM jobs WHERE status='paid' AND blob_url IS NOT NULL AND ${retryable} ORDER BY created_at ASC LIMIT 20`
      );
  return rows;
}

// Put an already-printed job back in the queue (bad print, paper jam, wrong
// printer). Only possible while the file is still kept (REPRINT_WINDOW).
export async function reprintJob(code) {
  await ensureSchema();
  const { rowCount } = await query(
    `UPDATE jobs SET status='paid', print_error=NULL, print_attempts=0, failed_at=NULL, printed_at=NULL
     WHERE code=$1 AND status='printed' AND blob_url IS NOT NULL
       AND printed_at > now() - ($2 || ' minutes')::interval`,
    [code, REPRINT_WINDOW_MINUTES]
  );
  if (rowCount > 0) await wakeShopForJob(code);
  return rowCount > 0;
}

// Printed files are kept only for the reprint window, then removed.
export async function findExpiredPrintedBlobs(shopId = null) {
  await ensureSchema();
  const { rows } = await query(
    `SELECT code, blob_url FROM jobs
     WHERE status='printed' AND blob_url IS NOT NULL
       AND printed_at < now() - ($1 || ' minutes')::interval
       AND ($2::TEXT IS NULL OR shop_id=$2)
     LIMIT 20`,
    [REPRINT_WINDOW_MINUTES, shopId]
  );
  return rows;
}

// Which shop does a link-less ("no ?shop=") job belong to? Only answerable
// when it's unambiguous: exactly one active shop, OR several shops exist but
// exactly one of them has a live agent (printer seen in the last 6 minutes).
// The second case matters once test/extra shops have been added: without it
// every job from a link without ?shop= sat at shop_id NULL, showing the
// customer "paid - printing soon" forever while no agent ever saw it.
export async function getOnlyActiveShop() {
  await ensureSchema();
  const { rows } = await query(`SELECT * FROM shops WHERE active=true LIMIT 2`);
  if (rows.length === 1) return rows[0];
  const online = await query(
    `SELECT s.* FROM shops s
     WHERE s.active=true AND EXISTS (
       SELECT 1 FROM printers p WHERE p.shop_id=s.id AND p.last_seen > now() - interval '6 minutes')
     LIMIT 2`
  );
  return online.rows.length === 1 ? online.rows[0] : null;
}
export async function claimUnassignedJobs(shopId) {
  await ensureSchema();
  const only = await getOnlyActiveShop();
  if (!only || only.id !== shopId) return 0;
  const { rowCount } = await query(
    `UPDATE jobs SET shop_id=$1 WHERE shop_id IS NULL AND status IN ('paid','pending_payment')`,
    [shopId]
  );
  return rowCount;
}
export async function countUnassignedPaidJobs() {
  await ensureSchema();
  const { rows } = await query(`SELECT COUNT(*) AS c FROM jobs WHERE shop_id IS NULL AND status='paid'`);
  return parseInt(rows[0].c, 10);
}

// Razorpay orders created for this shop in the last hour that are still
// unpaid in our DB — candidates for the payment reconcile in pending.js
// (covers a customer who paid then closed the tab AND a missed webhook).
export async function listRecentUnpaidRazorpayJobs(shopId, minutes = 60) {
  await ensureSchema();
  const { rows } = await query(
    `SELECT code, razorpay_order_id FROM jobs
     WHERE status='pending_payment' AND razorpay_order_id IS NOT NULL
       AND (shop_id=$1 OR shop_id IS NULL)
       AND created_at > now() - ($2 || ' minutes')::interval
     ORDER BY created_at ASC LIMIT 10`,
    [shopId, minutes]
  );
  return rows;
}
export async function listRecentJobs({ shopId, limit = 100 } = {}) {
  await ensureSchema();
  const { rows } = shopId
    ? await query(`SELECT * FROM jobs WHERE shop_id=$1 ORDER BY created_at DESC LIMIT $2`, [shopId, limit])
    : await query(`SELECT * FROM jobs ORDER BY created_at DESC LIMIT $1`, [limit]);
  return rows;
}

// ---- Shops ----
export async function createShop({ name, slug, city, address }) {
  await ensureSchema();
  const apiKey = Array.from(crypto.getRandomValues(new Uint8Array(24)))
    .map(b => b.toString(16).padStart(2, '0')).join('');
  const { rows } = await query(
    `INSERT INTO shops (name,slug,city,address,api_key) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [name, slug, city || null, address || null, apiKey]
  );
  return rows[0];
}
export async function getShopByApiKey(apiKey) {
  await ensureSchema();
  const { rows } = await query('SELECT * FROM shops WHERE api_key=$1 AND active=true', [apiKey]);
  return rows[0] || null;
}
export async function getShopBySlug(slug) {
  await ensureSchema();
  const { rows } = await query('SELECT * FROM shops WHERE slug=$1', [slug]);
  return rows[0] || null;
}
export async function listShops() {
  await ensureSchema();
  const { rows } = await query('SELECT * FROM shops ORDER BY created_at ASC');
  return rows;
}
export async function toggleShop(id, active) {
  await ensureSchema();
  await query('UPDATE shops SET active=$1 WHERE id=$2', [active, id]);
}

// Atomically claims a shop's key for a specific machine, OR confirms it's
// still the same machine that already holds it. The WHERE clause is what
// makes this safe against two computers racing to register at nearly the
// same instant: only one UPDATE can win when bound_machine_id is still NULL,
// because the row that loses the race sees bound_machine_id already set to
// the OTHER machine's id and its own WHERE condition no longer matches — so
// it updates zero rows instead of overwriting the winner.
export async function checkAndBindMachine(shopId, machineId, machineName) {
  await ensureSchema();
  if (!machineId) return { ok: true }; // older agent build that doesn't send one yet — don't block it
  const { rows } = await query(
    `UPDATE shops
     SET bound_machine_id = $2, bound_machine_name = COALESCE($3, bound_machine_name)
     WHERE id = $1 AND (bound_machine_id IS NULL OR bound_machine_id = $2)
     RETURNING bound_machine_id`,
    [shopId, machineId, machineName || null]
  );
  return { ok: rows.length > 0 };
}

// Clears a shop's machine binding — use this when a shop owner genuinely
// gets a new/replacement PC, so their next heartbeat can claim the key again.
export async function resetShopMachine(id) {
  await ensureSchema();
  await query('UPDATE shops SET bound_machine_id=NULL, bound_machine_name=NULL WHERE id=$1', [id]);
}

// ---- Printers ----
export async function registerPrinter({ shopId, printerId, name }) {
  await ensureSchema();
  if (printerId) {
    const { rows } = await query(
      `INSERT INTO printers (id,shop_id,name,status,last_seen)
       VALUES ($1,$2,$3,'online',now())
       ON CONFLICT (id) DO UPDATE SET name=$3,status='online',last_seen=now() RETURNING *`,
      [printerId, shopId, name]
    );
    return rows[0];
  }
  // No printerId from the agent (it forgets it on every restart/reinstall):
  // reuse this shop's printer with the same name instead of creating a new
  // row each time, which is how one printer turned into dozens of rows.
  const existing = await query(
    `UPDATE printers SET status='online', last_seen=now()
     WHERE id = (SELECT id FROM printers WHERE shop_id=$1 AND name=$2 ORDER BY created_at ASC LIMIT 1)
     RETURNING *`,
    [shopId, name]
  );
  if (existing.rows[0]) return existing.rows[0];
  const { rows } = await query(
    `INSERT INTO printers (shop_id,name,status,last_seen) VALUES ($1,$2,'online',now()) RETURNING *`,
    [shopId, name]
  );
  return rows[0];
}
export async function heartbeatPrinter(printerId) {
  await ensureSchema();
  await query(
    `UPDATE printers SET status='online',last_seen=now() WHERE id=$1`,
    [printerId]
  );
}
export async function markPrinterOffline(printerId) {
  await ensureSchema();
  await query(`UPDATE printers SET status='offline' WHERE id=$1`, [printerId]);
}
export async function listPrinters(shopId) {
  await ensureSchema();
  const { rows } = shopId
    ? await query(`SELECT * FROM printers WHERE shop_id=$1 ORDER BY created_at ASC`, [shopId])
    : await query(`SELECT p.*,s.name as shop_name,s.slug FROM printers p JOIN shops s ON p.shop_id=s.id ORDER BY s.name,p.name`);
  return rows;
}
export async function resetDailyJobCounts() {
  await ensureSchema();
  await query(`UPDATE printers SET jobs_today=0`);
}

// ---- Analytics for owner dashboard ----
export async function getOwnerStats() {
  await ensureSchema();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

  const [todayRev, monthRev, todayJobs, printerStats, shopStats, stuckByShop] = await Promise.all([
    query(`SELECT COALESCE(SUM(amount),0) as total FROM jobs WHERE status='printed' AND printed_at>=$1`, [today]),
    query(`SELECT COALESCE(SUM(amount),0) as total FROM jobs WHERE status='printed' AND printed_at>=$1`, [firstOfMonth]),
    query(`SELECT COUNT(*) as count FROM jobs WHERE created_at>=$1`, [today]),
    query(`SELECT COUNT(*) FILTER (WHERE status='online') as online, COUNT(*) as total FROM printers`),
    query(`
      SELECT s.id,s.name,s.slug,s.city,s.active,
        COALESCE(SUM(j.amount) FILTER (WHERE j.status='printed' AND j.printed_at>=$1),0) as today_revenue,
        COALESCE(SUM(j.amount) FILTER (WHERE j.status='printed' AND j.printed_at>=$2),0) as month_revenue,
        COUNT(j.code) FILTER (WHERE j.created_at>=$1) as today_jobs,
        COUNT(j.code) FILTER (WHERE j.status='printed') as total_jobs
      FROM shops s
      LEFT JOIN jobs j ON j.shop_id=s.id
      GROUP BY s.id ORDER BY month_revenue DESC
    `, [today, firstOfMonth]),
    countStuckJobsByShop(15), // paid but unprinted for 15+ min — almost always means the shop's agent is offline
  ]);

  return {
    todayRevenue: parseInt(todayRev.rows[0].total),
    monthRevenue: parseInt(monthRev.rows[0].total),
    todayJobs: parseInt(todayJobs.rows[0].count),
    printersOnline: parseInt(printerStats.rows[0].online),
    printersTotal: parseInt(printerStats.rows[0].total),
    shops: shopStats.rows.map(s => ({ ...s, stuckJobs: stuckByShop[s.id] || 0 })),
  };
}
