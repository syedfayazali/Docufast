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

// Browser pages (shop board, owner dashboard, customer status page) listen on
// channels of their own. Names are derived with a server secret so they can't
// be guessed from a job code or shop name; the pings carry no data.
function pushSecret() { return process.env.FILE_LINK_SECRET || process.env.SESSION_SECRET || process.env.OWNER_KEY || 'df'; }
const h = (label) => crypto.createHmac('sha256', pushSecret()).update(label).digest('hex').slice(0, 30);
// (all names start with "shop-" because that is the prefix the database policy allows)
export const jobChannel = (code) => 'shop-j' + h('job:' + String(code).toUpperCase());
export const ownerChannel = () => 'shop-o' + h('owner');
// What a browser needs to listen. The anon key is public by design; the
// database policies only let it touch these ping channels.
export function browserPush(channel) {
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_ANON_KEY;
  return url && key && channel ? { url, key, channel } : null;
}

export async function sendBroadcast(channel, event, payload = { wake: 1 }) {
  const base = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!base || !key || !channel) return false;
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 2500);
  try {
    const r = await fetch(
      `${base.replace(/\/$/, '')}/realtime/v1/api/broadcast/${channel}/events/${event}?private=true`,
      { method: 'POST', headers: { apikey: key, 'Content-Type': 'application/json' }, body: JSON.stringify(payload), signal: ctl.signal }
    );
    if (!r.ok) console.warn('sendBroadcast: Supabase answered', r.status);
    return r.ok;
  } catch (err) {
    console.warn('sendBroadcast failed:', err.message);
    return false;
  } finally {
    clearTimeout(timer);
  }
}

// Tell a shop's agent (and its open board) to look for work now.
export const sendWake = (apiKey) => apiKey ? sendBroadcast(shopChannel(apiKey), 'job') : Promise.resolve(false);
