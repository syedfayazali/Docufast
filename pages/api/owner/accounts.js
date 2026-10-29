import { isOwner } from '@/lib/auth';
import { listAccounts, createAccount, updateAccount, rotateAccountCode, recordAccountPayment, getAccountStatement } from '@/lib/db';

// Owner-only business accounts: create (code shown once), limits, payments, statement (JSON or CSV).
export default async function handler(req, res) {
  if (!isOwner(req)) return res.status(401).json({ error: 'Unauthorized' });
  try {
    if (req.method === 'GET') {
      if (req.query.statement) {
        const st = await getAccountStatement(req.query.statement);
        if (!st) return res.status(404).json({ error: 'Account not found' });
        if (req.query.format === 'csv') {
          const q = v => '"' + String(v ?? '').replace(/"/g, '""') + '"';
          const lines = ['Date,Type,Reference,Amount (INR)'];
          st.jobs.forEach(j => lines.push([q(new Date(j.created_at).toISOString().slice(0, 10)), 'Order', q(j.code + ' ' + j.filename), (j.amount / 100).toFixed(2)].join(',')));
          st.payments.forEach(p => lines.push([q(new Date(p.created_at).toISOString().slice(0, 10)), 'Payment', q(p.note || ''), (-p.amount / 100).toFixed(2)].join(',')));
          lines.push(['', 'Balance due', '', (st.account.balance / 100).toFixed(2)].join(','));
          res.setHeader('Content-Type', 'text/csv; charset=utf-8');
          res.setHeader('Content-Disposition', `attachment; filename="statement-${st.account.name.replace(/[^a-z0-9]+/gi, '-')}.csv"`);
          return res.status(200).send(lines.join('\n'));
        }
        return res.status(200).json(st);
      }
      return res.status(200).json({ accounts: await listAccounts() });
    }
    if (req.method !== 'POST' && req.method !== 'PATCH') return res.status(405).json({ error: 'Method not allowed' });
    const b = req.body || {};
    if (req.method === 'POST' && !b.action) return res.status(201).json(await createAccount(b));
    if (b.action === 'payment') { await recordAccountPayment(b.id, b.amount, b.note); return res.status(200).json({ ok: true }); }
    if (b.action === 'rotate') { const code = await rotateAccountCode(b.id); return code ? res.status(200).json({ code }) : res.status(404).json({ error: 'Account not found' }); }
    await updateAccount(b.id, { active: b.active, creditLimit: b.creditLimit });
    return res.status(200).json({ ok: true });
  } catch (e) { return res.status(400).json({ error: e.message }); }
}
