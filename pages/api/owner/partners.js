import { isOwner } from '@/lib/auth';
import { getPartnerReport, setPartner, recordPayout } from '@/lib/db';

// Owner-only partner-shop sales share and payouts.
export default async function handler(req, res) {
  if (!isOwner(req)) return res.status(401).json({ error: 'Unauthorized' });
  try {
    if (req.method === 'GET') {
      const r = await getPartnerReport();
      if (req.query.format === 'csv') {
        const q = v => '"' + String(v ?? '').replace(/"/g, '""') + '"';
        const lines = ['Shop,Partner,Share %,Sales (INR),Share (INR),Paid out (INR),Due (INR)'];
        r.shops.forEach(s => lines.push([q(s.name), q(s.partnerName), s.sharePct ?? '', (s.sales / 100).toFixed(2), (s.share / 100).toFixed(2), (s.paidOut / 100).toFixed(2), (s.due / 100).toFixed(2)].join(',')));
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename="partner-payouts.csv"');
        return res.status(200).send(lines.join('\n'));
      }
      return res.status(200).json(r);
    }
    if (req.method === 'PATCH') { await setPartner(req.body?.shopId, req.body || {}); return res.status(200).json({ ok: true }); }
    if (req.method === 'POST') { await recordPayout(req.body?.shopId, req.body?.amount, req.body?.note); return res.status(200).json({ ok: true }); }
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e) { return res.status(400).json({ error: e.message }); }
}
