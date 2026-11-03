// Several files in one order. Picking two or more files switches the page into "batch" mode:
// every file is uploaded and page-counted on its own, gets its own colour / sides / copies, and
// the whole lot is paid once. The server prices everything again from the shop's own rates.
const MAX_FILES = 10;
const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function initBatch(ctx) {
  const b = { active: false, items: [], seq: 0 };
  let ticketTimer = null;

  const list = () => b.items;
  const ready = () => b.items.filter(i => i.status === 'ready');
  const busy = () => b.items.some(i => i.status === 'queued' || i.status === 'uploading');
  const lineTotal = i => ctx.perPage(i.colorMode, i.duplex) * i.pages * i.copies;
  const subtotal = () => ready().reduce((a, i) => a + lineTotal(i), 0);
  const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;

  // ---- start / add ----
  b.start = async function (files) {
    if (ctx.needConsent()) return;
    files = Array.from(files);
    if (!b.active) { b.items = []; b.active = true; }
    const room = MAX_FILES - b.items.length;
    if (files.length > room) ctx.setStatus(`Up to ${MAX_FILES} files per order — the first ${Math.max(room, 0)} were added.`, 'err');
    files = files.slice(0, Math.max(room, 0));
    for (const f of files) {
      b.items.push({ id: ++b.seq, file: f, name: f.name, status: 'queued', pct: 0, pages: 1, copies: 1,
        colorMode: ctx.state.colorMode, duplex: ctx.state.duplex === 'double', error: '' });
    }
    document.body.classList.add('batch-mode');
    $('batchPanel').style.display = 'block';
    $('dropzone').classList.add('compact');
    render();
    pump();
  };
  b.reset = function () {
    if (!b.active) return;
    b.active = false; b.items = [];
    document.body.classList.remove('batch-mode');
    $('batchPanel').style.display = 'none';
    $('dropzone').classList.remove('compact');
    $('batchList').innerHTML = '';
    toggleSingleUi(true);
  };

  // At most three uploads at a time keeps a phone connection usable.
  let running = 0;
  function pump() {
    while (running < 3) {
      const next = b.items.find(i => i.status === 'queued');
      if (!next) break;
      next.status = 'uploading'; running++;
      uploadOne(next).catch(e => { next.status = 'error'; next.error = e.message || 'Upload failed'; })
        .finally(() => { running--; render(); pump(); });
    }
    render();
  }
  async function uploadOne(it) {
    let file = it.file;
    if (ctx.compressible.includes(file.type)) file = await ctx.compress(file);
    if (file.size > ctx.maxBytes) throw new Error(`Too large (${(file.size / 1048576).toFixed(1)}MB, max ${ctx.maxBytes / 1048576}MB)`);
    if (!(await ctx.privateUploads())) throw new Error('Secure upload is not available right now.');
    const { upload } = await import('https://esm.sh/@vercel/blob@2.8.2/client');
    const blob = await upload(file.name, file, {
      access: 'private', handleUploadUrl: '/api/blob-upload-token?private=1',
      onUploadProgress: ({ percentage }) => { it.pct = Math.round(percentage); renderRow(it); },
    });
    it.blobUrl = blob.url; it.name = file.name;
    const res = await fetch('/api/detect-pages', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ filename: file.name, blobUrl: blob.url }) });
    const d = await res.json().catch(() => ({}));
    if (d.problem) throw new Error(d.problem);
    it.pages = d.pages > 0 ? d.pages : 1;
    it.guessed = !(d.pages > 0);
    it.status = 'ready';
  }

  // ---- step 1 list ----
  function rowHtml(it) {
    const st = it.status === 'ready' ? `<span class="b-ok">${plural(it.pages, 'page')}${it.guessed ? ' (check count)' : ''}</span>`
      : it.status === 'error' ? `<span class="b-err">${esc(it.error)}</span>`
      : `<span class="b-wait">${it.status === 'queued' ? 'Waiting…' : 'Uploading ' + it.pct + '%'}</span>`;
    return `<div class="b-name">${esc(it.name)}</div><div class="b-st">${st}</div><button type="button" class="b-x" data-rm="${it.id}" aria-label="Remove ${esc(it.name)}">×</button>`;
  }
  function renderRow(it) {
    const el = document.querySelector(`#batchList [data-id="${it.id}"]`);
    if (el) el.innerHTML = rowHtml(it);
  }
  function render() {
    if (!b.active) return;
    const box = $('batchList');
    box.innerHTML = b.items.map(it => `<div class="b-row" data-id="${it.id}">${rowHtml(it)}</div>`).join('');
    const n = ready().length;
    const nxt = $('next1');
    if (busy()) { nxt.disabled = true; nxt.textContent = 'Uploading…'; }
    else if (n === 0) { nxt.disabled = true; nxt.textContent = 'Add a file to continue'; }
    else { nxt.disabled = false; nxt.textContent = `Continue with ${plural(n, 'file')}`; }
    $('batchAdd').style.display = b.items.length >= MAX_FILES ? 'none' : '';
    ctx.setStatus(n ? `${plural(n, 'file')} ready` + (b.items.some(i => i.status === 'error') ? ' — remove the ones that failed' : '') : '', n ? 'ok' : '');
    ctx.updatePrice();
  }
  document.addEventListener('click', e => {
    const rm = e.target.closest('[data-rm]');
    if (rm && b.active) {
      b.items = b.items.filter(i => String(i.id) !== rm.dataset.rm);
      if (!b.items.length) { b.reset(); $('next1').disabled = true; $('next1').textContent = 'Choose a file to continue'; ctx.setStatus(''); return; }
      render();
    }
  });
  $('batchAdd').addEventListener('click', () => { if (!ctx.needConsent()) $('fileInput').click(); });

  // ---- step 2: per-file options ----
  function toggleSingleUi(show) {
    document.querySelectorAll('#step2 > .group-label, #step2 > .cards, #step2 > .stepper, #fileChip').forEach(el => { el.style.display = show ? '' : 'none'; });
    $('batchOpts').style.display = show ? 'none' : 'block';
  }
  b.enterOptions = function () {
    b.items = b.items.filter(i => i.status === 'ready');
    toggleSingleUi(false);
    renderOptions();
  };
  function renderOptions() {
    $('batchOpts').innerHTML =
      `<div class="b-all"><span>Set all files to</span>
         <button type="button" class="ghost" data-all="bw">Black &amp; white</button>
         <button type="button" class="ghost" data-all="color">Colour</button></div>` +
      b.items.map(it => `<div class="b-card" data-id="${it.id}">
        <div class="b-title">${esc(it.name)}<small>${plural(it.pages, 'page')}</small></div>
        <div class="b-ctl">
          <label>Colour<select data-k="colorMode"><option value="bw"${it.colorMode === 'bw' ? ' selected' : ''}>Black &amp; white</option><option value="color"${it.colorMode === 'color' ? ' selected' : ''}>Colour</option></select></label>
          <label>Sides<select data-k="duplex"><option value="0"${it.duplex ? '' : ' selected'}>Single-sided</option><option value="1"${it.duplex ? ' selected' : ''}>Double-sided</option></select></label>
          <label>Copies<span class="b-step"><button type="button" data-cp="-1">−</button><input type="number" min="1" max="500" value="${it.copies}" data-k="copies" inputmode="numeric"><button type="button" data-cp="1">+</button></span></label>
        </div>
        <div class="b-line" data-line>${ctx.rs(lineTotal(it))}</div>
      </div>`).join('');
  }
  $('batchOpts').addEventListener('click', e => {
    const all = e.target.closest('[data-all]');
    if (all) { b.items.forEach(i => { i.colorMode = all.dataset.all; }); renderOptions(); ctx.updatePrice(); return; }
    const cp = e.target.closest('[data-cp]');
    if (cp) {
      const it = b.items.find(i => String(i.id) === cp.closest('.b-card').dataset.id);
      it.copies = Math.min(500, Math.max(1, it.copies + Number(cp.dataset.cp)));
      cp.parentElement.querySelector('input').value = it.copies; refreshLine(it); ctx.updatePrice();
    }
  });
  $('batchOpts').addEventListener('input', e => {
    const k = e.target.dataset.k; if (!k) return;
    const it = b.items.find(i => String(i.id) === e.target.closest('.b-card').dataset.id);
    if (k === 'copies') it.copies = Math.min(500, Math.max(1, parseInt(e.target.value, 10) || 1));
    else if (k === 'duplex') it.duplex = e.target.value === '1';
    else it.colorMode = e.target.value;
    refreshLine(it); ctx.updatePrice();
  });
  function refreshLine(it) {
    const el = document.querySelector(`#batchOpts [data-id="${it.id}"] [data-line]`);
    if (el) el.textContent = ctx.rs(lineTotal(it));
  }

  // ---- price + review ----
  b.payload = () => ready().map(i => ({ filename: i.name, blobUrl: i.blobUrl, pages: i.pages, copies: i.copies, colorMode: i.colorMode, duplex: i.duplex }));
  b.totals = function () {
    const discount = ctx.state.coupon ? ctx.state.coupon.discount : 0;
    return { subtotal: subtotal(), discount, total: subtotal() - discount, files: ready().length };
  };
  b.paintPrice = function () {
    const t = b.totals();
    $('amountLabel').textContent = '₹' + (t.total / 100).toFixed(2);
    const pg = ready().reduce((a, i) => a + i.pages * i.copies, 0);
    $('priceSub').textContent = `${plural(t.files, 'file')} · ${plural(pg, 'sheet side')}` + (t.discount ? ` − ${ctx.rs(t.discount)} coupon` : '');
    const sum = $('summary');
    if (sum) {
      const rows = ready().map(i => [i.name, `${i.pages}p × ${i.copies} · ${i.colorMode === 'color' ? 'Colour' : 'B&W'}${i.duplex ? ' · 2-sided' : ''} · ${ctx.rs(lineTotal(i))}`]);
      if (t.discount) rows.push(['Coupon ' + ctx.state.coupon.code, '− ' + ctx.rs(t.discount)]);
      rows.push(['Total', '₹' + (t.total / 100).toFixed(2)]);
      sum.innerHTML = rows.map(() => '<div class="row"><span></span><span></span></div>').join('');
      sum.querySelectorAll('.row').forEach((row, i) => { row.children[0].textContent = rows[i][0]; row.children[1].textContent = rows[i][1]; });
    }
    $('payBtn').disabled = !t.files || busy();
  };

  // ---- pay ----
  b.pay = async function () {
    const payBtn = $('payBtn');
    payBtn.disabled = true; payBtn.textContent = 'Creating order…';
    let data;
    try {
      const res = await fetch('/api/jobs/batch', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
        items: b.payload(), shopSlug: ctx.shopSlug, consent: ctx.consentChk.checked,
        couponCode: ctx.state.coupon ? ctx.state.coupon.code : undefined,
        accountCode: ctx.state.account ? ctx.state.account.code : undefined,
      }) });
      data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not create the order');
      data.jobs.forEach(j => ctx.rememberDeleteToken(j.code, data.tokens[j.code]));
    } catch (err) { alert(err.message); payBtn.disabled = false; payBtn.textContent = ctx.payLabel(); return; }

    if (data.accountBilled) return b.ticket(data.jobs.map(j => ({ ...j, status: 'paid' })));
    if (data.razorpayEnabled) return razorpay(data);
    payBtn.textContent = 'Confirming (mock)…';
    for (const j of data.jobs) await fetch(`/api/jobs/${j.code}/pay`, { method: 'POST' });
    b.ticket(data.jobs.map(j => ({ ...j, status: 'paid' })));
  };
  function razorpay(data) {
    const payBtn = $('payBtn');
    const rzp = new window.Razorpay({
      key: data.razorpayKeyId, amount: data.amount, currency: 'INR', name: 'DocuFast India',
      description: `Print order — ${plural(data.jobs.length, 'file')}`, order_id: data.razorpayOrderId,
      handler: async response => {
        payBtn.textContent = 'Verifying payment…';
        try {
          const r = await fetch('/api/verify-payment', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(response) });
          const v = await r.json();
          if (!r.ok) throw new Error(v.error || 'Payment verification failed');
          b.ticket(v.jobs || data.jobs);
        } catch (err) {
          alert('Payment received but verification failed: ' + err.message + '\nPlease contact us with your payment ID: ' + response.razorpay_payment_id);
          payBtn.disabled = false; payBtn.textContent = ctx.payLabel();
        }
      },
      theme: { color: '#0A2E6E' },
      modal: { ondismiss: () => { payBtn.disabled = false; payBtn.textContent = ctx.payLabel(); } },
    });
    rzp.on('payment.failed', r => { alert('Payment failed: ' + r.error.description + '\nPlease try again.'); payBtn.disabled = false; payBtn.textContent = ctx.payLabel(); });
    rzp.open();
  }

  // ---- ticket ----
  b.ticket = function (jobs) {
    jobs.forEach(j => ctx.rememberOrder({ code: j.code, filename: j.filename }));
    $('uploadCard').style.display = 'none';
    $('ticketCard').style.display = 'block';
    document.querySelector('#ticketCard .stub').style.display = 'none';
    $('trackLink').style.display = 'none';
    const box = $('batchTickets'); box.style.display = 'block';
    const total = jobs.reduce((a, j) => a + (j.amount || 0), 0);
    $('ticketNote').textContent = `${plural(jobs.length, 'file')} · ₹${(total / 100).toFixed(2)} paid. Each file has its own code — show a code at the counter if asked.`;
    const view = {}; jobs.forEach(j => { view[j.code] = j; });
    const paint = () => {
      box.innerHTML = jobs.map(j => {
        const v = view[j.code] || j;
        const done = v.status === 'printed';
        const bad = v.status === 'paid' && v.printError;
        return `<a class="b-tix" href="/status.html?code=${encodeURIComponent(j.code)}"><div><b>${esc(j.filename)}</b><small>${plural(j.pages, 'page')} × ${plural(j.copies, 'copy').replace('copys', 'copies')}</small></div><div class="b-code">${esc(j.code)}</div><div class="b-state ${done ? 'ok' : bad ? 'bad' : ''}">${done ? '✓ Printed' : bad ? 'Problem — see counter' : 'Printing soon'}</div></a>`;
      }).join('');
      const all = jobs.every(j => (view[j.code] || j).status === 'printed');
      const pill = $('statusPill');
      pill.textContent = all ? '✓ All printed' : 'Paid — printing soon';
      pill.className = 'status-pill ' + (all ? 'printed' : 'paid');
      return all;
    };
    paint();
    let tries = 0;
    clearInterval(ticketTimer);
    ticketTimer = setInterval(async () => {
      if (++tries > 240) return clearInterval(ticketTimer);
      for (const j of jobs) {
        const cur = view[j.code] || j;
        if (cur.status === 'printed') continue;
        try { const r = await fetch(`/api/jobs/${j.code}`); const d = await r.json(); if (r.ok) view[j.code] = { ...j, ...d.job }; } catch { /* retry next tick */ }
      }
      if (paint()) clearInterval(ticketTimer);
    }, 5000);
  };

  return b;
}
