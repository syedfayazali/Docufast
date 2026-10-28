// Push "wake-up" pings to a shop's desktop agent through Supabase Realtime.
//
// The ping carries NO job data. It only says "check for work now"; the agent
// then calls the normal authenticated /api/agent/pending route, so security
// and logic stay exactly where they are. If Supabase is not configured, or
// the ping fails for any reason, nothing breaks: agents keep their fallback
// poll and pick the job up a little later.
import crypto from 'crypto';

// Channel name = hash of the shop's agent key. The agent derives the same
// name locally, so it can't be guessed from outside.
export function shopChannel(apiKey) {
  return 'shop-' + crypto.createHash('sha256').update(String(apiKey)).digest('hex').slice(0, 32);
}

export async function sendWake(apiKey) {
  const base = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!base || !key || !apiKey) return false;
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 2500);
  try {
    const r = await fetch(
      `${base.replace(/\/$/, '')}/realtime/v1/api/broadcast/${shopChannel(apiKey)}/events/job?private=true`,
      {
        method: 'POST',
        headers: { apikey: key, 'Content-Type': 'application/json' },
        body: JSON.stringify({ wake: 1 }),
        signal: ctl.signal,
      }
    );
    if (!r.ok) console.warn('sendWake: Supabase answered', r.status);
    return r.ok;
  } catch (err) {
    console.warn('sendWake failed:', err.message);
    return false;
  } finally {
    clearTimeout(timer);
  }
}
