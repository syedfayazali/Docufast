import { Pool } from 'pg';

let pool;
function getPool() {
  if (!pool) {
    const cs = process.env.DATABASE_URL || process.env.POSTGRES_URL;
    if (!cs) throw new Error('DATABASE_URL not set. Connect a Postgres database in Vercel Storage tab.');
    pool = new Pool({ connectionString: cs, ssl: { rejectUnauthorized: false } });
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
  await query(
    `UPDATE jobs SET status='paid',razorpay_payment_id=$1 WHERE code=$2 AND status='pending_payment'`,
    [razorpayPaymentId, code]
  );
}
export async function markPrinted(code) {
  await ensureSchema();
  const job = await getJob(code);
  await query(
    `UPDATE jobs SET status='printed',print_error=NULL,printed_at=now(),blob_url=NULL WHERE code=$1`,
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
  await query('UPDATE jobs SET print_error=$1 WHERE code=$2', [errorMsg, code]);
}
export async function retryPrint(code) {
  await ensureSchema();
  await query(`UPDATE jobs SET print_error=NULL WHERE code=$1 AND status='paid'`, [code]);
}
export async function assignPrinter(code, printerId) {
  await ensureSchema();
  await query(`UPDATE jobs SET printer_id=$1 WHERE code=$2`, [printerId, code]);
}
export async function listPendingPrintJobs(shopId) {
  await ensureSchema();
  const { rows } = shopId
    ? await query(
        `SELECT * FROM jobs WHERE status='paid' AND blob_url IS NOT NULL AND shop_id=$1 ORDER BY created_at ASC LIMIT 20`,
        [shopId]
      )
    : await query(
        `SELECT * FROM jobs WHERE status='paid' AND blob_url IS NOT NULL ORDER BY created_at ASC LIMIT 20`
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

  const [todayRev, monthRev, todayJobs, printerStats, shopStats] = await Promise.all([
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
  ]);

  return {
    todayRevenue: parseInt(todayRev.rows[0].total),
    monthRevenue: parseInt(monthRev.rows[0].total),
    todayJobs: parseInt(todayJobs.rows[0].count),
    printersOnline: parseInt(printerStats.rows[0].online),
    printersTotal: parseInt(printerStats.rows[0].total),
    shops: shopStats.rows,
  };
}
