import { isOwner } from '@/lib/auth';
import { getOwnerReport, listJobsForExport } from '@/lib/db';

const csvCell = v => {
  if (v === null || v === undefined) return '';
  let t = v instanceof Date ? v.toISOString().replace('T', ' ').slice(0, 19) : String(v);
  // Stop spreadsheet formula injection from customer-controlled filenames.
  if (/^[=+\-@\t\r]/.test(t)) t = "'" + t;
  return /[",\n\r]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t;
};

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!isOwner(req)) return res.status(401).json({ error: 'Unauthorized' });

  if (req.query.format === 'csv') {
    const ok = d => /^\d{4}-\d{2}-\d{2}$/.test(String(d || ''));
    const today = new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);
    const from = ok(req.query.from) ? req.query.from : today.slice(0, 8) + '01';
    const to = ok(req.query.to) ? req.query.to : today;
    const rows = await listJobsForExport(from, to);
    const head = ['Code', 'Created (IST)', 'Printed (IST)', 'Shop', 'File', 'Pages', 'Copies', 'Colour', 'Double-sided', 'Amount (INR)', 'Status', 'Refunded (INR)'];
    const lines = [head.join(',')].concat(rows.map(r => [
      r.code, r.created, r.printed, r.shop, r.filename, r.pages, r.copies,
      r.color_mode === 'color' ? 'Colour' : 'B&W', r.duplex ? 'Yes' : 'No',
      (r.amount / 100).toFixed(2), r.status, r.refund_amount ? (r.refund_amount / 100).toFixed(2) : '',
    ].map(csvCell).join(',')));
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="docufast-orders-${from}-to-${to}.csv"`);
    return res.status(200).send('\ufeff' + lines.join('\r\n'));
  }

  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json(await getOwnerReport(req.query.days));
}
