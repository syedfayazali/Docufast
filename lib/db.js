// Job storage using Postgres (via the Vercel Marketplace — Neon, Supabase,
// etc. all work the same way here, since we connect with a plain
// connection string rather than a provider-specific SDK).
//
// Whichever provider you pick from Storage -> Connect Database in the
// Vercel dashboard, it injects DATABASE_URL automatically — that's the only
// env var this file needs. (Older guides mention POSTGRES_URL — that was
// the now-deprecated native "Vercel Postgres" product; DATABASE_URL is the
// current one, but we fall back to POSTGRES_URL too just in case.)
//
// The table is created on first use (CREATE TABLE IF NOT EXISTS) so there's
// no separate "run this migration" step to forget.
import { Pool } from 'pg';

const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;

let pool;
function getPool() {
  if (!pool) {
    if (!connectionString) {
      throw new Error(
        'No database connection string found. In Vercel: Storage tab -> Connect Database -> pick a Postgres provider (e.g. Neon) -> connect to this project. That sets DATABASE_URL automatically.'
      );
    }
    pool = new Pool({ connectionString, ssl: { rejectUnauthorized: false } });
  }
  return pool;
}

async function query(text, params) {
  return getPool().query(text, params);
}

let schemaReady = false;
async function ensureSchema() {
  if (schemaReady) return;
  await query(`
    CREATE TABLE IF NOT EXISTS jobs (
      code TEXT PRIMARY KEY,
      filename TEXT NOT NULL,
      blob_url TEXT,
      pages INTEGER NOT NULL,
      copies INTEGER NOT NULL,
      color_mode TEXT NOT NULL,
      duplex BOOLEAN NOT NULL DEFAULT FALSE,
      amount INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending_payment',
      payment_provider TEXT NOT NULL,
      order_id TEXT,
      txn_token TEXT,
      paytm_txn_id TEXT,
      print_error TEXT,
      claimed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      printed_at TIMESTAMPTZ
    )
  `);
  // claimed_at may not exist on tables created before this column was added.
  await query(`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMPTZ`);

  // Tracks the last time the print agent checked in, plus what it reported
  // about itself (printer reachable or not), so the admin dashboard can show
  // "agent online/offline" and "printer online/offline" without anyone
  // needing to physically check the shop PC.
  await query(`
    CREATE TABLE IF NOT EXISTS agent_status (
      id TEXT PRIMARY KEY DEFAULT 'default',
      last_seen TIMESTAMPTZ,
      printer_ok BOOLEAN,
      printer_message TEXT,
      agent_version TEXT
    )
  `);
  schemaReady = true;
}

// Strips internal fields (blob_url) before sending job info to any client —
// neither the customer browser nor the admin dashboard should see the raw
// storage URL; only the print agent gets that, via listPendingPrintJobs().
export function publicView(job) {
  return {
    code: job.code,
    filename: job.filename,
    pages: job.pages,
    copies: job.copies,
    colorMode: job.color_mode,
    duplex: job.duplex,
    amount: job.amount,
    status: job.status,
    printError: job.print_error || null,
    createdAt: job.created_at,
  };
}

export async function createJob(job) {
  await ensureSchema();
  await query(
    `INSERT INTO jobs (code, filename, blob_url, pages, copies, color_mode, duplex, amount, status, payment_provider, order_id, txn_token)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
    [job.code, job.filename, job.blobUrl, job.pages, job.copies, job.colorMode, job.duplex, job.amount, job.status, job.paymentProvider, job.orderId || null, job.txnToken || null]
  );
}

export async function getJob(code) {
  await ensureSchema();
  const { rows } = await query('SELECT * FROM jobs WHERE code = $1', [code]);
  return rows[0] || null;
}

export async function markPaid(code, paytmTxnId) {
  await ensureSchema();
  await query(
    `UPDATE jobs SET status = 'paid', paytm_txn_id = $1 WHERE code = $2 AND status = 'pending_payment'`,
    [paytmTxnId || null, code]
  );
}

export async function markPrinted(code) {
  await ensureSchema();
  const job = await getJob(code);
  await query(
    `UPDATE jobs SET status = 'printed', print_error = NULL, printed_at = now(), blob_url = NULL WHERE code = $1`,
    [code]
  );
  return job;
}

export async function markPrintFailed(code, errorMsg) {
  await ensureSchema();
  await query('UPDATE jobs SET print_error = $1, claimed_at = NULL WHERE code = $2', [errorMsg, code]);
}

export async function retryPrint(code) {
  await ensureSchema();
  await query(`UPDATE jobs SET print_error = NULL, claimed_at = NULL WHERE code = $1 AND status = 'paid'`, [code]);
}

// Jobs the print agent should pick up: paid, not yet printed, and not
// currently claimed by another (or a stuck) agent run.
//
// "Claiming" matters because the agent could crash mid-print: without it,
// the same job would still show up as pending on the very next poll and get
// printed twice. Marking claimed_at when a job is handed out, and only
// re-offering jobs whose claim is older than claimStaleMs, means a normal
// crash just delays a job (until the claim goes stale) instead of double-
// printing it.
export async function listPendingPrintJobs(claimStaleMs = 2 * 60 * 1000) {
  await ensureSchema();
  const { rows } = await query(
    `SELECT * FROM jobs
     WHERE status = 'paid' AND blob_url IS NOT NULL
       AND (claimed_at IS NULL OR claimed_at < now() - ($1 || ' milliseconds')::interval)
     ORDER BY created_at ASC LIMIT 20`,
    [claimStaleMs]
  );
  if (rows.length === 0) return rows;
  const codes = rows.map((r) => r.code);
  await query(`UPDATE jobs SET claimed_at = now() WHERE code = ANY($1::text[])`, [codes]);
  return rows;
}

// Called by the agent on every poll, even when there's nothing to print, so
// the dashboard can tell "agent online" apart from "agent has been dead for
// 3 hours and nobody noticed." printerOk/printerMessage let the agent report
// printer-level problems (offline, out of paper, etc. as far as the OS can
// tell) separately from job-level print failures.
export async function recordAgentHeartbeat({ printerOk, printerMessage, agentVersion }) {
  await ensureSchema();
  await query(
    `INSERT INTO agent_status (id, last_seen, printer_ok, printer_message, agent_version)
     VALUES ('default', now(), $1, $2, $3)
     ON CONFLICT (id) DO UPDATE SET
       last_seen = now(), printer_ok = $1, printer_message = $2, agent_version = $3`,
    [printerOk, printerMessage || null, agentVersion || null]
  );
}

export async function getAgentStatus() {
  await ensureSchema();
  const { rows } = await query(`SELECT * FROM agent_status WHERE id = 'default'`);
  return rows[0] || null;
}

export async function listRecentJobs(limit = 100) {
  await ensureSchema();
  const { rows } = await query('SELECT * FROM jobs ORDER BY created_at DESC LIMIT $1', [limit]);
  return rows;
}
