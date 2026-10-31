import { isOwner } from '@/lib/auth';
import { getOwnerReport, listJobsForExport } from '@/lib/db';
import { csvHead, csvRow } from '@/lib/csv';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!isOwner(req)) return res.status(401).json({ error: 'Unauthorized' });

  if (req.query.format === 'csv') {
    const ok = d => /^\d{4}-\d{2}-\d{2}$/.test(String(d || ''));
    const today = new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);
    const from = ok(req.query.from) ? req.query.from : today.slice(0, 8) + '01';
    const to = ok(req.query.to) ? req.query.to : today;
    const rows = await listJobsForExport(from, to);
    const lines = [csvHead.join(',')].concat(rows.map(csvRow));
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="docufast-orders-${from}-to-${to}.csv"`);
    return res.status(200).send('\ufeff' + lines.join('\r\n'));
  }

  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json(await getOwnerReport(req.query.days));
}
