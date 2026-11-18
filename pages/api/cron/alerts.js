// Emails the owner when a shop has paid orders that are not getting printed (the shop's PC is off,
// asleep, offline or its printer is broken). Set ALERT_EMAIL (where to send) and CRON_SECRET.
// Vercel's own cron calls this once a day; for real-time alerts point a free uptime monitor
// (e.g. UptimeRobot) at  /api/cron/alerts?key=<CRON_SECRET>  every 5 minutes.
// A shop is reported at most once an hour.
import { dbQuery, rateLimit } from '@/lib/db';
import { sendAlert } from '@/lib/mail';

export default async function handler(req, res) {
  const secret = process.env.CRON_SECRET;
  const given = (req.headers.authorization || '').replace(/^Bearer /, '') || String(req.query.key || '');
  if (!secret || given !== secret) return res.status(401).json({ error: 'Unauthorized' });
  if (!process.env.ALERT_EMAIL) return res.status(200).json({ ok: true, skipped: 'ALERT_EMAIL is not set' });
  try {
    const { rows } = await dbQuery(`
      SELECT s.id, s.name,
        COUNT(*) FILTER (WHERE j.print_error IS NULL) AS waiting,
        COUNT(*) FILTER (WHERE j.print_error IS NOT NULL) AS failed,
        MAX(j.print_error) AS last_error,
        (SELECT MAX(last_seen) FROM printers p WHERE p.shop_id=s.id) AS last_seen
      FROM jobs j JOIN shops s ON s.id=j.shop_id
      WHERE j.status='paid' AND j.created_at < now() - interval '15 minutes' AND j.created_at > now() - interval '3 days'
      GROUP BY s.id, s.name`);
    const lines = [];
    for (const r of rows) {
      if (!(await rateLimit('alert:' + r.id, 1, 3600))) continue;
      const seen = r.last_seen ? `last seen ${new Date(r.last_seen).toISOString().replace('T', ' ').slice(0, 16)} UTC` : 'never connected';
      lines.push(`• ${r.name}: ${r.waiting} waiting, ${r.failed} failed (${seen})${r.last_error ? ` — last error: ${r.last_error}` : ''}`);
    }
    if (lines.length) await sendAlert(`DocuFast: ${lines.length} shop(s) have paid orders not printing`, `Paid orders older than 15 minutes are not printed:\n\n${lines.join('\n')}\n\nCheck that the shop PC is on, DocuFast is open, and the printer has paper.`);
    return res.status(200).json({ ok: true, shops: rows.length, alerted: lines.length });
  } catch (e) {
    console.error('alerts failed:', e.message);
    return res.status(500).json({ error: 'failed' });
  }
}
