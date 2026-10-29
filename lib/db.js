import { randomBytes, randomInt, scryptSync, timingSafeEqual } from 'crypto';
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
  await query(`CREATE TABLE IF NOT EXISTS services (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, slots JSONB NOT NULL DEFAULT '[]'::jsonb,
    fee INTEGER NOT NULL DEFAULT 0, active BOOLEAN NOT NULL DEFAULT FALSE, sort INTEGER NOT NULL DEFAULT 100)`);
  await query(`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS service_id TEXT`);
  await query(`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS service_name TEXT`);
  await query(`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS service_fee INTEGER`);
  await query(`INSERT INTO services (id,name,slots,fee,active,sort) VALUES ($1,$2,$3::jsonb,0,FALSE,$4) ON CONFLICT (id) DO NOTHING`, ["aadhaar-update", "Aadhaar update", "[{\"label\": \"Existing Aadhaar card\", \"required\": true}, {\"label\": \"Proof document for the update\", \"required\": true}, {\"label\": \"Passport-size photo\", \"required\": false}]", 10]);
  await query(`INSERT INTO services (id,name,slots,fee,active,sort) VALUES ($1,$2,$3::jsonb,0,FALSE,$4) ON CONFLICT (id) DO NOTHING`, ["pan-new", "New PAN card", "[{\"label\": \"Aadhaar card – front\", \"required\": true}, {\"label\": \"Aadhaar card – back\", \"required\": true}, {\"label\": \"Passport-size photo\", \"required\": true}, {\"label\": \"Signature on white paper\", \"required\": true}]", 20]);
  await query(`INSERT INTO services (id,name,slots,fee,active,sort) VALUES ($1,$2,$3::jsonb,0,FALSE,$4) ON CONFLICT (id) DO NOTHING`, ["passport", "Passport application", "[{\"label\": \"Aadhaar card\", \"required\": true}, {\"label\": \"Date-of-birth proof (SSC memo / birth certificate)\", \"required\": true}, {\"label\": \"Address proof\", \"required\": true}, {\"label\": \"Passport-size photo\", \"required\": true}, {\"label\": \"Old passport (if renewing)\", \"required\": false}]", 30]);
  await query(`INSERT INTO services (id,name,slots,fee,active,sort) VALUES ($1,$2,$3::jsonb,0,FALSE,$4) ON CONFLICT (id) DO NOTHING`, ["driving-licence", "Driving licence", "[{\"label\": \"Aadhaar card\", \"required\": true}, {\"label\": \"Age proof\", \"required\": true}, {\"label\": \"Address proof\", \"required\": true}, {\"label\": \"Passport-size photo\", \"required\": true}, {\"label\": \"Signature on white paper\", \"required\": true}, {\"label\": \"Medical certificate (if required)\", \"required\": false}]", 40]);
  await query(`INSERT INTO services (id,name,slots,fee,active,sort) VALUES ($1,$2,$3::jsonb,0,FALSE,$4) ON CONFLICT (id) DO NOTHING`, ["voter-id", "Voter ID", "[{\"label\": \"Aadhaar card\", \"required\": true}, {\"label\": \"Age proof\", \"required\": true}, {\"label\": \"Address proof\", \"required\": true}, {\"label\": \"Passport-size photo\", \"required\": true}]", 50]);
  await query(`ALTER TABLE printers ADD COLUMN IF NOT EXISTS push_state TEXT`);
  await query(`ALTER TABLE printers ADD COLUMN IF NOT EXISTS push_changed_at TIMESTAMPTZ`);
  await query(`ALTER TABLE printers ADD COLUMN IF NOT EXISTS agent_version TEXT`);
  await query(`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS refund_id TEXT`);
  await query(`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS refund_amount INTEGER`);
  await query(`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS refunded_at TIMESTAMPTZ`);
  await query(`ALTER TABLE shops ADD COLUMN IF NOT EXISTS prices JSONB`);
  await query(`ALTER TABLE shops ADD COLUMN IF NOT EXISTS staff_pin_hash TEXT`);
  await query(`ALTER TABLE shops ADD COLUMN IF NOT EXISTS pin_fail_count INTEGER NOT NULL DEFAULT 0`);
  await query(`ALTER TABLE shops ADD COLUMN IF NOT EXISTS pin_locked_until TIMESTAMPTZ`);
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
    serviceName: job.service_name || null,
    createdAt: job.created_at,
    printedAt: job.printed_at,
  };
}

// ---- Jobs ----
export async function createJob(job) {
  await ensureSchema();
  await query(
    `INSERT INTO jobs (code,shop_id,filename,blob_url,pages,copies,color_mode,duplex,amount,status,payment_provider,razorpay_order_id,service_id,service_name,service_fee)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
    [job.code, job.shopId || null, job.filename, job.blobUrl, job.pages, job.copies,
     job.colorMode, job.duplex, job.amount, job.status, job.paymentProvider, job.razorpayOrderId || null,
     job.serviceId || null, job.serviceName || null, job.serviceFee || null]
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

// Issues a brand-new key for a shop and frees its machine binding. The old key
// stops working immediately; the shop's agent must be given the new one.
export async function rotateShopKey(id) {
  await ensureSchema();
  const apiKey = Array.from(crypto.getRandomValues(new Uint8Array(24)))
    .map(b => b.toString(16).padStart(2, '0')).join('');
  const { rows } = await query(
    `UPDATE shops SET api_key=$2, bound_machine_id=NULL, bound_machine_name=NULL
     WHERE id=$1 RETURNING id, name, api_key`, [id, apiKey]);
  return rows[0] || null;
}

// Extra, customer-safe context for the status page: which shop, whether its
// print computer is online right now, and how many paid jobs are ahead.
export async function getJobStatusExtras(job) {
  await ensureSchema();
  const out = { shopName: null, shopCity: null, shopAddress: null, shopOnline: null, ahead: 0 };
  if (!job.shop_id) return out;
  const shop = await query(
    `SELECT s.name, s.city, s.address,
       EXISTS (SELECT 1 FROM printers p WHERE p.shop_id=s.id AND p.last_seen > now() - interval '6 minutes') AS online
     FROM shops s WHERE s.id=$1`, [job.shop_id]);
  if (shop.rows[0]) {
    out.shopName = shop.rows[0].name; out.shopCity = shop.rows[0].city;
    out.shopAddress = shop.rows[0].address; out.shopOnline = !!shop.rows[0].online;
  }
  if (job.status === 'paid') {
    const a = await query(
      `SELECT COUNT(*) AS c FROM jobs WHERE shop_id=$1 AND status='paid' AND print_error IS NULL AND created_at < $2`,
      [job.shop_id, job.created_at]);
    out.ahead = parseInt(a.rows[0].c) || 0;
  }
  return out;
}

// Marks a job refunded (only from paid/printed) and drops its file reference.
export async function markRefunded(code, refundId, amount) {
  await ensureSchema();
  const { rows } = await query(
    `UPDATE jobs SET status='refunded', refund_id=$2, refund_amount=$3, refunded_at=now(), blob_url=NULL
     WHERE code=$1 AND status IN ('paid','printed') RETURNING *`, [code, refundId, amount]);
  return rows[0] || null;
}

// Today's numbers for a shop's dashboard (India time), plus printer presence.
export async function getShopToday(shopId) {
  await ensureSchema();
  const day = `(now() AT TIME ZONE 'Asia/Kolkata')::date`;
  const [t, p] = await Promise.all([
    query(`SELECT COUNT(*) FILTER (WHERE status IN ('paid','printed')) AS jobs,
                  COALESCE(SUM(pages*copies) FILTER (WHERE status='printed'),0) AS pages,
                  COALESCE(SUM(amount) FILTER (WHERE status='printed'),0) AS money
           FROM jobs WHERE shop_id=$1 AND (created_at AT TIME ZONE 'Asia/Kolkata')::date = ${day}`, [shopId]),
    query(`SELECT COUNT(*) FILTER (WHERE last_seen > now() - interval '6 minutes') AS online, COUNT(*) AS total FROM printers WHERE shop_id=$1`, [shopId]),
  ]);
  return {
    jobs: parseInt(t.rows[0].jobs) || 0,
    pages: parseInt(t.rows[0].pages) || 0,
    money: parseInt(t.rows[0].money) || 0,
    printersOnline: parseInt(p.rows[0].online) || 0,
    printersTotal: parseInt(p.rows[0].total) || 0,
  };
}

// ---- Owner reports ----
const IST = `AT TIME ZONE 'Asia/Kolkata'`;
export async function getOwnerReport(days = 14) {
  await ensureSchema();
  days = Math.min(90, Math.max(1, parseInt(days, 10) || 14));
  const [daily, hours, perShop, ready] = await Promise.all([
    query(`SELECT (printed_at ${IST})::date AS d, COALESCE(SUM(amount),0) AS revenue, COUNT(*) AS jobs, COALESCE(SUM(pages*copies),0) AS pages
           FROM jobs WHERE status='printed' AND printed_at >= now() - ($1 || ' days')::interval
           GROUP BY 1 ORDER BY 1`, [String(days)]),
    query(`SELECT EXTRACT(hour FROM created_at ${IST})::int AS h, COUNT(*) AS c
           FROM jobs WHERE status IN ('paid','printed') AND created_at >= now() - interval '30 days' GROUP BY 1`),
    query(`SELECT s.name, COUNT(j.code) AS jobs, COALESCE(SUM(j.amount),0) AS revenue
           FROM shops s LEFT JOIN jobs j ON j.shop_id=s.id AND j.status='printed' AND j.printed_at >= now() - ($1 || ' days')::interval
           GROUP BY s.id, s.name ORDER BY revenue DESC`, [String(days)]),
    query(`SELECT s.id, s.name, s.slug, s.active,
             (s.prices IS NOT NULL) AS has_prices,
             (s.staff_pin_hash IS NOT NULL) AS has_pin,
             (s.bound_machine_id IS NOT NULL) AS agent_linked,
             (SELECT MAX(last_seen) FROM printers p WHERE p.shop_id=s.id) AS last_seen,
             (SELECT COUNT(*) FROM jobs j WHERE j.shop_id=s.id AND j.status='printed') AS printed_total,
             (SELECT COUNT(*) FROM jobs j WHERE j.shop_id=s.id AND j.status='paid' AND j.print_error IS NOT NULL) AS failed_now,
             (SELECT COUNT(*) FROM jobs j WHERE j.shop_id=s.id AND j.status='paid' AND j.print_error IS NULL AND j.created_at < now() - interval '15 minutes') AS stuck
           FROM shops s ORDER BY s.created_at ASC`),
  ]);

  // Fill days with no jobs so the chart has no gaps (India dates).
  const byDay = new Map(daily.rows.map(r => [new Date(r.d).toISOString().slice(0, 10), r]));
  const out = [];
  const nowIst = new Date(Date.now() + 5.5 * 3600 * 1000);
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(nowIst.getTime() - i * 86400000).toISOString().slice(0, 10);
    const r = byDay.get(d);
    out.push({ date: d, revenue: r ? parseInt(r.revenue) : 0, jobs: r ? parseInt(r.jobs) : 0, pages: r ? parseInt(r.pages) : 0 });
  }
  const hrs = Array.from({ length: 24 }, (_, h) => ({ hour: h, jobs: 0 }));
  hours.rows.forEach(r => { hrs[r.h].jobs = parseInt(r.c); });

  const now = Date.now();
  const readiness = ready.rows.map(r => {
    const online = r.last_seen && now - new Date(r.last_seen).getTime() < 6 * 60000;
    const gates = [
      { key: 'prices', label: 'Price list set', ok: !!r.has_prices },
      { key: 'pin', label: 'Staff PIN issued', ok: !!r.has_pin },
      { key: 'agent', label: 'Print agent linked and online now', ok: !!(r.agent_linked && online) },
      { key: 'printed', label: 'At least 5 orders printed', ok: parseInt(r.printed_total) >= 5 },
      { key: 'clean', label: 'No failed or stuck orders right now', ok: parseInt(r.failed_now) + parseInt(r.stuck) === 0 },
    ];
    return { shopId: r.id, name: r.name, slug: r.slug, active: r.active, gates, ready: gates.every(g => g.ok), lastSeen: r.last_seen };
  });

  return {
    daily: out,
    hours: hrs,
    perShop: perShop.rows.map(r => ({ name: r.name, jobs: parseInt(r.jobs), revenue: parseInt(r.revenue) })),
    readiness,
  };
}

// Rows for the CSV export (printed + refunded orders in a date range, India dates).
export async function listJobsForExport(from, to) {
  await ensureSchema();
  const { rows } = await query(
    `SELECT j.code, (j.created_at ${IST}) AS created, (j.printed_at ${IST}) AS printed, s.name AS shop,
            j.filename, j.pages, j.copies, j.color_mode, j.duplex, j.amount, j.status, j.refund_amount
     FROM jobs j LEFT JOIN shops s ON s.id=j.shop_id
     WHERE j.status IN ('printed','refunded') AND (j.created_at ${IST})::date BETWEEN $1::date AND $2::date
     ORDER BY j.created_at ASC LIMIT 20000`, [from, to]);
  return rows;
}

// ---- Services (document checklists) ----
function cleanSlots(slots) {
  const arr = Array.isArray(slots) ? slots : [];
  return arr.slice(0, 12).map(x => ({ label: String(x?.label || '').trim().slice(0, 80), required: x?.required !== false }))
            .filter(x => x.label);
}
export async function listServices({ onlyActive } = {}) {
  await ensureSchema();
  const { rows } = await query(`SELECT id,name,slots,fee,active,sort FROM services ${onlyActive ? 'WHERE active' : ''} ORDER BY sort, name`);
  return rows;
}
export async function getActiveService(id) {
  await ensureSchema();
  const { rows } = await query(`SELECT id,name,slots,fee FROM services WHERE id=$1 AND active`, [String(id || '')]);
  return rows[0] || null;
}
export async function updateService(id, { name, fee, active, slots }) {
  await ensureSchema();
  const f = Math.round(Number(fee));
  const { rows } = await query(
    `UPDATE services SET name=COALESCE($2,name), fee=COALESCE($3,fee), active=COALESCE($4,active), slots=COALESCE($5::jsonb,slots)
     WHERE id=$1 RETURNING id,name,slots,fee,active,sort`,
    [id, name ? String(name).trim().slice(0, 80) : null,
     Number.isFinite(f) && f >= 0 && f <= 1000000 ? f : null,
     typeof active === 'boolean' ? active : null,
     slots ? JSON.stringify(cleanSlots(slots)) : null]);
  return rows[0] || null;
}

export async function setShopPrices(id, prices) {
  await ensureSchema();
  const { rows } = await query('UPDATE shops SET prices=$2::jsonb WHERE id=$1 RETURNING id, prices', [id, JSON.stringify(prices)]);
  return rows[0] || null;
}
// The shop a customer's order belongs to: the slug's shop if active, else the
// only active shop, else none. Same rule the job API has always used.
export async function resolveShop(slug) {
  if (slug) {
    const shop = await getShopBySlug(slug);
    if (shop && shop.active) return shop;
  }
  return await getOnlyActiveShop();
}

// ---- Staff PIN login (so staff never handle the agent key) ----
const PIN_MAX_FAILS = 5;
const PIN_LOCK_MINUTES = 10;
function hashPin(pin, salt = randomBytes(16).toString('hex')) {
  return `${salt}:${scryptSync(String(pin), salt, 32).toString('hex')}`;
}
function checkPin(pin, stored) {
  const [salt, hash] = String(stored || '').split(':');
  if (!salt || !hash) return false;
  const a = Buffer.from(hash, 'hex');
  const b = scryptSync(String(pin), salt, 32);
  return a.length === b.length && timingSafeEqual(a, b);
}
// Owner sets (or resets) a shop's staff PIN. Returns the PIN once.
export async function setStaffPin(id) {
  await ensureSchema();
  const pin = String(randomInt(0, 1000000)).padStart(6, '0');
  const { rows } = await query(
    `UPDATE shops SET staff_pin_hash=$2, pin_fail_count=0, pin_locked_until=NULL
     WHERE id=$1 RETURNING id, name, slug`, [id, hashPin(pin)]);
  return rows[0] ? { ...rows[0], pin } : null;
}
// -> { shop } on success, or { error, status } (locked after repeated misses)
export async function verifyStaffPin(slug, pin) {
  await ensureSchema();
  const { rows } = await query('SELECT * FROM shops WHERE slug=$1 AND active=true', [String(slug || '')]);
  const shop = rows[0];
  if (!shop || !shop.staff_pin_hash) return { error: 'Wrong shop code or PIN', status: 401 };
  if (shop.pin_locked_until && new Date(shop.pin_locked_until) > new Date()) {
    return { error: 'Too many wrong attempts. Try again in a few minutes.', status: 429 };
  }
  if (checkPin(pin, shop.staff_pin_hash)) {
    if (shop.pin_fail_count) await query('UPDATE shops SET pin_fail_count=0, pin_locked_until=NULL WHERE id=$1', [shop.id]);
    return { shop };
  }
  await query(
    `UPDATE shops SET pin_fail_count = pin_fail_count + 1,
       pin_locked_until = CASE WHEN pin_fail_count + 1 >= $2 THEN now() + ($3 || ' minutes')::interval ELSE pin_locked_until END
     WHERE id=$1`, [shop.id, PIN_MAX_FAILS, String(PIN_LOCK_MINUTES)]);
  return { error: 'Wrong shop code or PIN', status: 401 };
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
// What the agent says about itself: live-push connection state and app version.
// Only the three known push states are stored; anything else is ignored.
export async function recordAgentInfo(printerId, { push, version }) {
  if (!printerId) return;
  await ensureSchema();
  const state = ['connected', 'connecting', 'down', 'off'].includes(push) ? push : null;
  const ver = version ? String(version).slice(0, 20) : null;
  await query(
    `UPDATE printers SET
       push_changed_at = CASE WHEN $2::text IS NOT NULL AND push_state IS DISTINCT FROM $2::text THEN now() ELSE push_changed_at END,
       push_state = COALESCE($2::text, push_state),
       agent_version = COALESCE($3::text, agent_version)
     WHERE id=$1`, [printerId, state, ver]);
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
      SELECT s.id,s.name,s.slug,s.city,s.active,s.prices,
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
