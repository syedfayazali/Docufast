import { authStaff } from '@/lib/staff';
import { listJobsForExport } from '@/lib/db';
import { csvHead, csvRow } from '@/lib/csv';

// The shop's own printed orders as a CSV (never other shops').
export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const auth = await authStaff(req);
  if (!auth.shop) return res.status(auth.status || 401).json({ error: auth.error });
  const ok = d => /^\d{4}-\d{2}-\d{2}$/.test(String(d || ''));
  const today = new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);
  const from = ok(req.query.from) ? req.query.from : today.slice(0, 8) + '01';
  const to = ok(req.query.to) ? req.query.to : today;
  const rows = await listJobsForExport(from, to, auth.shop.id);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="orders-${from}-to-${to}.csv"`);
  return res.status(200).send('\ufeff' + [csvHead.join(',')].concat(rows.map(csvRow)).join('\r\n'));
}
