// ONE-TIME tool for moving the database to Supabase. Delete this file after
// the move is finished.
//
// Copies shops, printers and jobs from the CURRENT database (DATABASE_URL)
// into the new one (SUPABASE_DB_URL). Safe to run several times: rows are
// upserted by primary key, so it can be re-run right before cut-over to pick
// up the latest orders. Data never leaves the server.
//
// Protected by MIGRATE_TOKEN (set it in Vercel, then remove it afterwards):
//   POST /api/admin/migrate-db   header  x-migrate-token: <MIGRATE_TOKEN>
import { Pool } from 'pg';
import crypto from 'crypto';

function same(a, b) {
  const x = Buffer.from(String(a || '')); const y = Buffer.from(String(b || ''));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

const TABLES = [
  { name: 'shops', pk: 'id' },
  { name: 'printers', pk: 'id' },
  { name: 'jobs', pk: 'code' },
];

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  if (!process.env.MIGRATE_TOKEN || !same(req.headers['x-migrate-token'], process.env.MIGRATE_TOKEN)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const target = process.env.SUPABASE_DB_URL;
  const source = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!target || !source) return res.status(400).json({ error: 'Both DATABASE_URL and SUPABASE_DB_URL must be set' });
  if (target === source) return res.status(400).json({ error: 'Source and target are the same database' });

  // Always read from the OLD database, whatever USE_SUPABASE says.
  const from = new Pool({ connectionString: source, ssl: { rejectUnauthorized: false }, max: 1 });
  const to = new Pool({ connectionString: target, ssl: { rejectUnauthorized: false }, max: 1 });
  const report = {};
  try {
    for (const { name, pk } of TABLES) {
      const { rows } = await from.query(`SELECT * FROM ${name}`);
      // Only columns that exist in the new table (the old one may lack newer ones).
      const cols = (await to.query(
        `SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name=$1`, [name]
      )).rows.map(r => r.column_name);
      let copied = 0;
      for (const row of rows) {
        const keys = Object.keys(row).filter(k => cols.includes(k));
        const vals = keys.map(k => row[k]);
        const ph = keys.map((_, i) => `$${i + 1}`).join(',');
        const upd = keys.filter(k => k !== pk).map(k => `${k}=EXCLUDED.${k}`).join(',');
        await to.query(
          `INSERT INTO ${name} (${keys.join(',')}) VALUES (${ph}) ON CONFLICT (${pk}) DO UPDATE SET ${upd}`, vals
        );
        copied++;
      }
      const count = (await to.query(`SELECT COUNT(*)::int AS c FROM ${name}`)).rows[0].c;
      report[name] = { read: rows.length, copied, nowInTarget: count };
    }
    return res.status(200).json({ ok: true, report });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message, report });
  } finally {
    await from.end().catch(() => {});
    await to.end().catch(() => {});
  }
}
