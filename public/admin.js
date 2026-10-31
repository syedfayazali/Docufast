// Shop dashboard — loads jobs for this specific shop only.
// Uses shop code + PIN to authenticate — each shop only sees their own jobs.

const codeInput = document.getElementById('shopCode');
const pinInput = document.getElementById('shopPin');
try { codeInput.value = localStorage.getItem('df_shop_code') || ''; } catch {}
[codeInput, pinInput].forEach(el => el.addEventListener('keydown', e => { if (e.key === 'Enter') loadDashboard(); }));

let liveConn = null, lastPush = null;
let refreshTimer = null;

// Staff sign in with shop code + PIN (the PIN is kept for this tab only, never the agent key).
function authHeaders() {
  return { 'x-staff-slug': codeInput.value.trim().toLowerCase(), 'x-staff-pin': pinInput.value.trim() };
}

async function loadDashboard() {
  const slug = codeInput.value.trim();
  if (!slug || !pinInput.value.trim()) { showError('Enter your shop code and PIN.'); return; }
  try { localStorage.setItem('df_shop_code', slug); } catch {}
  clearError();

  document.getElementById('loader').style.display = 'block';
  document.getElementById('content').style.display = 'none';

  const res = await fetch('/api/admin/jobs', { headers: authHeaders() });
  if (!res.ok) {
    document.getElementById('loader').style.display = 'none';
    const d = await res.json().catch(() => ({}));
    showError(d.error || 'Could not sign in — check your shop code and PIN.');
    return;
  }

  await refresh();
  loadPlan(); loadSettings();

  document.getElementById('loader').style.display = 'none';
  document.getElementById('content').style.display = 'block';
  document.body.classList.add('board-app');   // fixed shell: only the columns scroll

  // Live updates: the server pings this page when an order changes. We only
  // poll (every 10 s) while the live connection is down.
  if (liveConn) liveConn.close();
  liveConn = window.DFPush.live(lastPush, () => refresh(), 10000);
}

// ---- Shop settings (this shop only) ----
const $s = id => document.getElementById(id);
const toR = p => (p === null || p === undefined ? '' : String(p / 100));
const toP = id => { const v = $s(id).value.trim(); return v === '' ? null : Math.round(parseFloat(v) * 100); };
async function setCall(body) {
  const msg = $s('setMsg'); msg.style.color = '';
  const res = await fetch('/api/admin/settings', { method: 'PATCH', headers: { ...authHeaders(), 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const d = await res.json().catch(() => ({}));
  msg.style.color = res.ok ? '#2E6B4F' : '#C0412B';
  msg.textContent = res.ok ? 'Saved.' : (d.error || 'Could not save.');
  return res.ok;
}
async function loadSettings() {
  try {
    const res = await fetch('/api/admin/settings', { headers: authHeaders() }); if (!res.ok) return;
    const d = await res.json();
    $s('sBw').value = toR(d.prices.bw); $s('sColor').value = toR(d.prices.color);
    $s('sDuplexBw').value = toR(d.prices.duplexBw); $s('sDuplexColor').value = toR(d.prices.duplexColor);
    $s('sRetention').value = d.retentionMinutes ?? '';
    $s('sKey').dataset.k = d.agentKey || '';
  } catch { /* optional */ }
}
$s('savePrices').onclick = () => {
  const prices = { bw: toP('sBw'), color: toP('sColor'), duplexBw: toP('sDuplexBw'), duplexColor: toP('sDuplexColor') };
  if (prices.bw === null || prices.color === null || Number.isNaN(prices.bw) || Number.isNaN(prices.color)) { $s('setMsg').style.color = '#C0412B'; $s('setMsg').textContent = 'Black & white and colour prices are required.'; return; }
  setCall({ prices });
};
$s('showKey').onclick = () => { const k = $s('sKey'); const hidden = !k.value; k.value = hidden ? (k.dataset.k || '') : ''; $s('showKey').textContent = hidden ? 'Hide' : 'Show'; };
$s('saveRetention').onclick = () => setCall({ retentionMinutes: $s('sRetention').value.trim() === '' ? null : Number($s('sRetention').value) });
$s('savePin').onclick = async () => {
  const pin = $s('sNewPin').value.trim();
  if (await setCall({ newPin: pin })) { pinInput.value = pin; $s('sNewPin').value = ''; $s('setMsg').textContent = 'PIN changed. Use the new PIN next time you sign in.'; }
};
$s('expBtn').onclick = async () => {
  const q = new URLSearchParams(); if ($s('expFrom').value) q.set('from', $s('expFrom').value); if ($s('expTo').value) q.set('to', $s('expTo').value);
  const res = await fetch('/api/admin/export?' + q, { headers: authHeaders() });
  if (!res.ok) { $s('setMsg').style.color = '#C0412B'; $s('setMsg').textContent = 'Download failed.'; return; }
  const a = document.createElement('a'); a.href = URL.createObjectURL(await res.blob()); a.download = 'orders.csv';
  document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(a.href);
};

// ---- Plan & renewal ----
let planData = null;
const rsn = n => '₹' + n.toLocaleString('en-IN');
async function loadPlan() {
  const card = document.getElementById('planCard');
  try {
    const res = await fetch('/api/admin/plan', { headers: authHeaders() });
    if (!res.ok) return;
    planData = await res.json();
    const b = planData.billing;
    if (b.state === 'free') { card.style.display = 'none'; return; }   // own shop: no plan
    const label = { trial: 'Free trial', active: 'Plan active', grace: 'Plan ended — renew now', expired: 'Plan paused — renew to take orders' }[b.state];
    const until = new Date(b.until).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    document.getElementById('planTitle').textContent = `${label} · ${b.plan.toUpperCase()}`;
    document.getElementById('planInfo').textContent = b.daysLeft >= 0 ? `Until ${until} (${b.daysLeft} days left)` : `Ended ${until}`;
    const pick = document.getElementById('planPick');
    pick.innerHTML = planData.plans.map(p => `<option value="${p.id}"${p.id === b.plan ? ' selected' : ''}>${p.name}</option>`).join('');
    const paint = () => {
      const p = planData.plans.find(x => x.id === pick.value);
      document.getElementById('payMonthly').textContent = `Pay ${rsn(p.monthly)} · 1 month`;
      document.getElementById('payYearly').textContent = `Pay ${rsn(p.yearly)} · 12 months (2 free)`;
    };
    pick.onchange = paint; paint();
    document.getElementById('payMonthly').onclick = () => payPlan('monthly');
    document.getElementById('payYearly').onclick = () => payPlan('yearly');
    card.style.display = 'block';
    const bar = document.getElementById('planBar');
    const soon = b.state === 'trial' || b.state === 'active' ? b.daysLeft <= 5 : true;
    bar.className = 'planbar' + (b.state === 'expired' ? ' bad' : '');
    bar.textContent = b.state === 'expired' ? 'Your plan has ended, so new customer orders are paused. Tap to renew.' :
      b.state === 'grace' ? 'Your plan has ended. Tap to renew so customer orders do not stop.' :
      `Your ${b.state === 'trial' ? 'trial' : 'plan'} ends in ${b.daysLeft} day${b.daysLeft === 1 ? '' : 's'}. Tap to renew.`;
    bar.style.display = soon ? 'block' : 'none';
    bar.onclick = () => document.querySelector('#viewTabs [data-view=settings]').click();
  } catch { /* plan card is optional */ }
}
async function payPlan(term) {
  const msg = document.getElementById('planMsg'); msg.textContent = '';
  const res = await fetch('/api/admin/plan', { method: 'POST', headers: { ...authHeaders(), 'Content-Type': 'application/json' }, body: JSON.stringify({ plan: document.getElementById('planPick').value, term }) });
  const d = await res.json().catch(() => ({}));
  if (!res.ok) { msg.textContent = d.error || 'Could not start payment.'; return; }
  if (!window.Razorpay) { msg.textContent = 'Payment window could not load. Check your internet and try again.'; return; }
  new window.Razorpay({
    key: d.razorpayKeyId, amount: d.amount, currency: 'INR', name: 'DocuFast India', description: d.description, order_id: d.razorpayOrderId,
    handler: async response => {
      msg.textContent = 'Confirming payment…';
      const v = await fetch('/api/admin/plan-verify', { method: 'POST', headers: { ...authHeaders(), 'Content-Type': 'application/json' }, body: JSON.stringify(response) });
      const vd = await v.json().catch(() => ({}));
      msg.textContent = v.ok ? 'Thank you! Your plan is renewed.' : (vd.error || 'We received your payment but could not confirm it yet. It will show up shortly; contact us if not.');
      loadPlan();
    },
    theme: { color: '#0B2160' },
  }).open();
}

async function refresh() {
  try {
    const res = await fetch('/api/admin/jobs', {
      headers: authHeaders()
    });
    if (!res.ok) return;
    const data = await res.json();
    lastPush = data.push || null;

    // Today's totals (shop-scoped views get exact India-time numbers from the server)
    const t = data.today;
    document.getElementById('kpiJobs').textContent = t ? t.jobs : data.jobs.length;
    document.getElementById('kpiPages').textContent = t ? t.pages : '—';
    document.getElementById('kpiRevenue').textContent = '₹' + (((t ? t.money : data.revenueToday) || 0) / 100).toFixed(2);
    document.getElementById('kpiPending').textContent = data.jobs.filter(j => j.status === 'paid' && !j.printError).length;

    const badge = document.getElementById('printerBadge');
    if (t) {
      const on = t.printersOnline > 0;
      badge.className = 'printer-badge ' + (on ? 'on' : 'off');
      badge.lastElementChild.textContent = t.printersTotal === 0 ? 'No printer' : on ? 'Printer online' : 'Printer offline';
    }

    notifyNewPaid(data.jobs);

    // Shop name
    if (data.shopName) {
      document.getElementById('shopName').textContent = data.shopName;
    }

    // Shop link + QR (only shown for shop-scoped views, not the owner-key view)
    if (data.shopSlug) {
      const link = `${window.location.origin}/?shop=${encodeURIComponent(data.shopSlug)}`;
      document.getElementById('shopLinkInput').value = link;

      // Shop-specific QR — encodes this shop's own link, so scans route
      // straight to their queue instead of the unrouted shared link.
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=600x600&data=${encodeURIComponent(link)}`;
      const qrImg = document.getElementById('shopQrImg');
      if (qrImg.dataset.u !== qrUrl) { qrImg.dataset.u = qrUrl; qrImg.src = qrUrl; }   // set once, not on every refresh

      const downloadBtn = document.getElementById('downloadQrBtn');
      downloadBtn.href = qrUrl;
      downloadBtn.download = `docufast-qr-${data.shopSlug}.png`;
      // The QR image is served cross-origin, so a plain `download` attribute
      // won't trigger a save in most browsers — fetch it as a blob instead.
      downloadBtn.onclick = async (e) => {
        e.preventDefault();
        try {
          const resp = await fetch(qrUrl);
          const blob = await resp.blob();
          const objectUrl = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = objectUrl;
          a.download = `docufast-qr-${data.shopSlug}.png`;
          document.body.appendChild(a);
          a.click();
          a.remove();
          URL.revokeObjectURL(objectUrl);
        } catch {
          // Fall back to just opening the image if the fetch/blob path fails.
          window.open(qrUrl, '_blank');
        }
      };

      document.getElementById('posterLink').href = `/signage.html?shop=${encodeURIComponent(data.shopSlug)}`;

      document.getElementById('shopLinkCard').style.display = 'block';
    }

    renderBoard(data.jobs);
  } catch (err) {
    console.error('Refresh error:', err);
  }
}

// ---- queue board ----
const seenPaid = new Set();
let firstLoad = true;
let soundOn = true;
try { soundOn = localStorage.getItem('df_sound') !== 'off'; } catch {}
const soundBtn = document.getElementById('soundBtn');
function paintSoundBtn() { soundBtn.innerHTML = (soundOn ? window.dfIcon('bell') + ' Sound on' : window.dfIcon('bellOff') + ' Sound off'); window.dfIcons && window.dfIcons(soundBtn); }
paintSoundBtn();
soundBtn.addEventListener('click', () => {
  soundOn = !soundOn; paintSoundBtn();
  try { localStorage.setItem('df_sound', soundOn ? 'on' : 'off'); } catch {}
  if (soundOn) beep();
});

let audioCtx = null;
function beep() {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    [880, 1175].forEach((f, i) => {
      const o = audioCtx.createOscillator(), g = audioCtx.createGain();
      o.frequency.value = f; o.type = 'sine';
      o.connect(g); g.connect(audioCtx.destination);
      const t0 = audioCtx.currentTime + i * 0.18;
      g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.35, t0 + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.16);
      o.start(t0); o.stop(t0 + 0.18);
    });
  } catch { /* audio unavailable — the flash still shows */ }
}

// A job is "new" the first time we see it paid after the page has loaded.
function notifyNewPaid(jobs) {
  const fresh = [];
  jobs.forEach(j => {
    if (j.status === 'paid' && !seenPaid.has(j.code)) { seenPaid.add(j.code); fresh.push(j.code); }
  });
  if (firstLoad) { firstLoad = false; return; }
  if (!fresh.length) return;
  const b = document.getElementById('newBanner');
  b.innerHTML = window.dfIcon('bell') + ' '; b.appendChild(document.createTextNode('New paid order' + (fresh.length > 1 ? 's' : '') + ': ' + fresh.join(', '))); window.dfIcons && window.dfIcons(b);
  b.classList.remove('show'); void b.offsetWidth; b.classList.add('show');
  newCodes = new Set(fresh);
  if (soundOn) beep();
  const old = document.title; document.title = '(New) order — DocuFast';
  setTimeout(() => { document.title = old; b.classList.remove('show'); }, 8000);
}
let newCodes = new Set();

function jobCard(job, kind) {
  const div = document.createElement('div');
  div.className = 'jcard' + (newCodes.has(job.code) ? ' new' : '');
  const code = document.createElement('div'); code.className = 'jcode'; code.textContent = job.code;
  const file = document.createElement('div'); file.className = 'jfile'; file.textContent = job.filename; file.title = job.filename;
  const meta = document.createElement('div'); meta.className = 'jmeta';
  meta.textContent = `${job.pages} pg × ${job.copies} · ${job.colorMode === 'color' ? 'Colour' : 'B&W'}${job.duplex ? ' · Double-sided' : ''} · ₹${(job.amount / 100).toFixed(2)}`;
  div.append(code);
  if (job.serviceName) { const sv = document.createElement('div'); sv.className = 'jmeta'; sv.style.fontWeight = '700'; sv.style.color = 'var(--navy)'; sv.textContent = job.serviceName; div.append(sv); }
  div.append(file, meta);
  if (kind === 'failed') {
    const err = document.createElement('div'); err.className = 'jerr'; err.textContent = job.printError || 'Print failed';
    div.appendChild(err);
  }
  if (kind === 'failed' || kind === 'printed') {
    const btn = document.createElement('button'); btn.className = 'retry-btn';
    btn.textContent = kind === 'failed' ? 'Retry print' : 'Reprint';
    btn.addEventListener('click', () => kind === 'failed' ? retryPrint(job.code) : reprintJob(job.code));
    div.appendChild(btn);
  }
  return div;
}

let boardSig = '';
function renderBoard(jobs) {
  const sig = JSON.stringify(jobs.map(j => [j.code, j.status, j.printError || '', j.printedAt || '', j.attempts || 0]));
  if (sig === boardSig) return;   // nothing changed: don't rebuild or flash the cards
  boardSig = sig;
  const cols = {
    queue: jobs.filter(j => j.status === 'paid' && !j.printError).reverse(),
    failed: jobs.filter(j => j.status === 'paid' && j.printError),
    printed: jobs.filter(j => j.status === 'printed').slice(0, 12),
  };
  const ids = { queue: ['colQueue', 'cntQueue'], failed: ['colFailed', 'cntFailed'], printed: ['colPrinted', 'cntPrinted'] };
  Object.entries(cols).forEach(([k, list]) => {
    const body = document.getElementById(ids[k][0]); body.innerHTML = '';
    document.getElementById(ids[k][1]).textContent = list.length;
    if (!list.length) {
      const e = document.createElement('div'); e.className = 'empty-col';
      e.textContent = k === 'queue' ? 'Nothing waiting' : k === 'failed' ? 'All good' : 'Nothing printed yet';
      body.appendChild(e);
    }
    list.forEach(j => body.appendChild(jobCard(j, k)));
  });
  newCodes = new Set();
}

async function reprintJob(code) {
  if (!confirm('Print order ' + code + ' again? (Only works for 30 minutes after printing.)')) return;
  const res = await fetch(`/api/admin/jobs/${code}/retry?reprint=1`, { method: 'POST', headers: authHeaders() });
  if (!res.ok) {
    const d = await res.json().catch(() => ({}));
    alert(d?.error || 'Reprint failed.');
    return;
  }
  refresh();
}

async function retryPrint(code) {
  const res = await fetch(`/api/admin/jobs/${code}/retry`, {
    method: 'POST',
    headers: authHeaders()
  });
  if (!res.ok) {
    const d = await res.json().catch(() => ({}));
    alert(d?.error || 'Retry failed — check your PIN.');
    return;
  }
  refresh();
}

async function copyShopLink() {
  const input = document.getElementById('shopLinkInput');
  const btn = document.getElementById('copyLinkBtn');
  try {
    await navigator.clipboard.writeText(input.value);
  } catch {
    // Clipboard API can fail (older browser, non-HTTPS) — fall back to a manual select
    input.select();
    document.execCommand('copy');
  }
  const original = btn.textContent;
  btn.textContent = 'Copied!';
  setTimeout(() => { btn.textContent = original; }, 1500);
}

function statusClass(job) {
  if (job.printError) return 'error';
  if (job.status === 'printed') return 'printed';
  if (job.status === 'paid') return 'paid';
  return 'pending';
}

function showError(msg) {
  const el = document.getElementById('statusMsg');
  el.textContent = msg;
  el.style.display = 'block';
}

function clearError() {
  document.getElementById('statusMsg').style.display = 'none';
}



// Orders / Plan & settings tabs
document.getElementById('viewTabs').addEventListener('click', e => {
  const b = e.target.closest('button[data-view]'); if (!b) return;
  document.querySelectorAll('#viewTabs button').forEach(x => x.classList.toggle('on', x === b));
  const settings = b.dataset.view === 'settings';
  document.getElementById('viewOrders').style.display = settings ? 'none' : 'flex';
  document.getElementById('viewSettings').style.display = settings ? 'block' : 'none';
});
