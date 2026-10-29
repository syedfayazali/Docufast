// TEMPORARY diagnostic: does the live-push handshake work end to end from a
// server on the internet? Joins a throwaway private channel exactly like the
// shop agent does, sends a ping through the REST route, and reports what came
// back. No secrets, no data. Delete after use.
export const config = { maxDuration: 60 };

export default async function handler(req, res) {
  const base = process.env.SUPABASE_URL, key = process.env.SUPABASE_ANON_KEY;
  const out = { node: process.version, hasWebSocket: typeof WebSocket !== 'undefined', t: [] };
  const t0 = Date.now();
  const log = (m) => out.t.push(`${((Date.now() - t0) / 1000).toFixed(1)}s ${m}`);
  if (!base || !key || typeof WebSocket === 'undefined') { log('missing config or WebSocket'); return res.status(200).json(out); }
  const topic = 'shop-diag' + Math.random().toString(16).slice(2, 12);
  const ws = new WebSocket(`${base.replace(/^http/, 'ws').replace(/\/$/, '')}/realtime/v1/websocket?apikey=${key}&vsn=1.0.0`);
  let ref = 0, joined = false, got = false, hb = 0, hbReplies = 0;
  const send = (t, e, p) => ws.send(JSON.stringify({ topic: t, event: e, payload: p, ref: String(++ref) }));
  ws.onopen = () => {
    log('socket open');
    send('realtime:' + topic, 'phx_join', { config: { broadcast: { ack: false, self: false }, presence: { key: '' }, postgres_changes: [], private: true }, access_token: key });
  };
  ws.onmessage = async (ev) => {
    let m; try { m = JSON.parse(ev.data); } catch { return; }
    if (m.event === 'phx_reply' && m.topic === 'realtime:' + topic) {
      log('join reply: ' + JSON.stringify(m.payload).slice(0, 300));
      if (m.payload && m.payload.status === 'ok' && !joined) {
        joined = true;
        try {
          const r = await fetch(`${base.replace(/\/$/, '')}/realtime/v1/api/broadcast/${topic}/events/job?private=true`, { method: 'POST', headers: { apikey: key, 'Content-Type': 'application/json' }, body: JSON.stringify({ wake: 1 }) });
          log('REST ping HTTP ' + r.status);
        } catch (e) { log('REST ping failed ' + e.message); }
      }
    } else if (m.event === 'broadcast') { got = true; log('RECEIVED broadcast ' + JSON.stringify(m.payload).slice(0, 120)); }
    else if (m.topic === 'phoenix' && m.event === 'phx_reply') { hbReplies++; log('heartbeat reply'); }
    else if (m.event === 'phx_close' || m.event === 'phx_error') log('server sent ' + m.event + ' ' + JSON.stringify(m.payload).slice(0, 200));
    else if (m.event === 'system') log('system: ' + JSON.stringify(m.payload).slice(0, 200));
  };
  ws.onerror = () => log('socket error');
  let closed = false; ws.onclose = (e) => { closed = true; log(`socket closed code ${e.code} ${e.reason || ''}`); };
  const hbT = setInterval(() => { if (ws.readyState === 1) { hb++; send('phoenix', 'heartbeat', {}); } }, 10000);
  await new Promise(r => setTimeout(r, 40000));
  clearInterval(hbT);
  out.summary = { joined, receivedPing: got, heartbeatsSent: hb, heartbeatReplies: hbReplies, stillOpen: !closed };
  try { ws.close(); } catch { /* ignore */ }
  return res.status(200).json(out);
}
