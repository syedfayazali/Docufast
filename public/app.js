// DocuFast India — customer upload + Razorpay Standard Checkout.
// Flow: upload file DIRECTLY to Blob storage (browser -> Blob, bypassing
//   this app's serverless functions entirely for the file bytes — see
//   the comment on MAX_UPLOAD_BYTES below for why) → detect pages →
//   POST /api/jobs (gets razorpayOrderId) → open Razorpay modal →
//   on success, POST /api/verify-payment → show ticket + poll until printed.
import { initTools } from '/tools.js';

// New uploads go to the PRIVATE store once the server says it is enabled
// (/api/config -> privateUploads); until then the original public store is
// used unchanged.
let configP = null;
function loadConfig() {
  if (!configP) {
    const q = shopSlug ? `?shop=${encodeURIComponent(shopSlug)}` : '';
    configP = fetch('/api/config' + q).then(r => r.json()).catch(() => ({}));
  }
  return configP;
}
function privateUploadsEnabled() { return loadConfig().then(c => !!c.privateUploads); }

// Display prices (paise per page) come from the shop's price list; the server
// recomputes the amount from the same list when the order is created.
let prices = { bw: 200, color: 800, duplexBw: null, duplexColor: null };
function perPage(mode, duplex) {
  const single = mode === 'color' ? prices.color : prices.bw;
  const dbl = mode === 'color' ? prices.duplexColor : prices.duplexBw;
  return duplex && dbl ? dbl : single;
}
const rs = paise => '₹' + (paise / 100).toFixed(paise % 100 === 0 ? 0 : 2);

// Vercel's serverless functions hard-cap request bodies at roughly 4.5MB
// regardless of any app-level config — a real multi-page scanned PDF (ID
// proofs, mark sheets, a phone-scanned assignment — completely normal for a
// print shop customer) routinely exceeds that. Uploading straight to Blob
// storage from the browser sidesteps the limit entirely; this is just a
// sanity ceiling so nobody accidentally uploads something absurd.
const MAX_UPLOAD_BYTES = 25 * 1024 * 1024; // 25MB

// Shops link customers here via /?shop=<their-slug> (see /admin for that
// shop's URL). No slug in the URL just means "no specific shop assigned" —
// only the legacy single-shop agent setup will pick those jobs up.
const shopSlug = new URLSearchParams(window.location.search).get('shop');

// Compresses photo uploads client-side before they ever leave the browser.
// A modern phone photo is routinely 8-15MB at 12+ megapixels — way more
// resolution than printing actually needs — and every byte trimmed here is
// a byte never charged for Blob storage or the bandwidth of downloading it
// back down to the shop's PC to print. Runs entirely in the browser via
// Canvas, no library needed.
//
// PDFs are deliberately left untouched: reliably recompressing an existing
// PDF's embedded images needs a much heavier library and real testing
// against varied real-world files — a subtly-corrupted customer ID proof
// or certificate is a far worse outcome than the storage cost saved, so
// this isn't attempted here.
const COMPRESSIBLE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/bmp'];
const MAX_IMAGE_DIMENSION = 2480; // ~A4 at 300dpi — plenty for a printed page
const JPEG_QUALITY = 0.82;

async function compressImageIfNeeded(file) {
  if (!COMPRESSIBLE_TYPES.includes(file.type)) return file;

  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return file; // decode failed for some reason — upload the original rather than block the customer

  let { width, height } = bitmap;
  if (width > MAX_IMAGE_DIMENSION || height > MAX_IMAGE_DIMENSION) {
    const scale = MAX_IMAGE_DIMENSION / Math.max(width, height);
    width = Math.round(width * scale);
    height = Math.round(height * scale);
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.getContext('2d').drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();

  const compressedBlob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY));
  if (!compressedBlob || compressedBlob.size >= file.size) return file; // didn't actually help — keep the original

  // Re-encoded as JPEG regardless of the original format, so rename to
  // match — avoids a .png file that's actually JPEG bytes confusing
  // anything downstream that sniffs the extension.
  const newName = file.name.replace(/\.[^.]+$/, '') + '.jpg';
  return new File([compressedBlob], newName, { type: 'image/jpeg' });
}

function payLabel() { return state.account ? 'Bill to ' + state.account.name + ' & print' : 'Pay & print'; }
const state = { exact: false, account: null, file: null, blobUrl: null, pages: 1, copies: 1, colorMode: 'bw', duplex: 'single', service: null, coupon: null };

const dropzone = document.getElementById('dropzone');
const fileInput = document.getElementById('fileInput');
const camInput = document.getElementById('camInput');
const filenameLabel = document.getElementById('filenameLabel');
const pagesInput = document.getElementById('pages');
const pagesField = document.getElementById('pagesField');
const copiesInput = document.getElementById('copies');
const amountLabel = document.getElementById('amountLabel');
const payBtn = document.getElementById('payBtn');
const next1 = document.getElementById('next1');
const uploadStatus = document.getElementById('uploadStatus');

function setStatus(text, cls) { uploadStatus.textContent = text; uploadStatus.className = 'upload-status' + (cls ? ' ' + cls : ''); }

// --- Steps ---
function goStep(n) {
  [1, 2, 3].forEach(i => { document.getElementById('step' + i).style.display = i === n ? 'block' : 'none'; });
  document.querySelectorAll('#steps li').forEach(li => {
    const i = Number(li.dataset.step);
    li.className = i === n ? 'on' : i < n ? 'done' : '';
  });
  document.getElementById('priceBar').style.display = n >= 2 ? 'flex' : 'none';
  updatePrice();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
next1.addEventListener('click', () => { if (state.blobUrl) goStep(2); });
document.getElementById('next2').addEventListener('click', () => goStep(3));
document.getElementById('back2').addEventListener('click', () => goStep(1));
document.getElementById('back3').addEventListener('click', () => goStep(2));

// Show the shop's real prices on the option cards.
loadConfig().then(cfg => {
  if (cfg.prices) prices = cfg.prices;
  if (cfg.shopName) document.getElementById('shopLine').textContent = 'Printing at ' + cfg.shopName;
  renderPriceLabels();
});
function renderPriceLabels() {
  document.getElementById('priceBw').textContent = rs(prices.bw) + ' per page';
  document.getElementById('priceColor').textContent = rs(prices.color) + ' per page';
  const dbl = perPage(state.colorMode, true);
  const single = perPage(state.colorMode, false);
  document.getElementById('priceDouble').textContent = dbl === single ? 'Both sides of the sheet' : rs(dbl) + ' per page';
}

// --- File pick ---
// DPDP: no file is chosen or uploaded until the customer has given consent.
const consentChk = document.getElementById('consentChk');
const consentBox = document.getElementById('consentBox');
document.getElementById('privacyToggle').addEventListener('click', e => {
  e.preventDefault();
  const n = document.getElementById('privacyNote');
  n.style.display = n.style.display === 'none' ? 'block' : 'none';
});
consentChk.addEventListener('change', () => { if (consentChk.checked) { consentBox.classList.remove('need'); setStatus(''); } });
function needConsent() {
  if (consentChk.checked) return false;
  consentBox.classList.add('need');
  setStatus('Please tick the consent box above before choosing a file.', 'err');
  consentBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
  return true;
}

dropzone.addEventListener('click', () => { if (!needConsent()) fileInput.click(); });
// Tool panels (photos, passport, service) also need consent before any file is picked.
document.addEventListener('click', e => {
  if (e.target.closest('#photosAdd, #passportPick, #serviceSlots button, #sheetSlots .pick') && needConsent()) { e.stopImmediatePropagation(); e.preventDefault(); }
}, true);
document.getElementById('camBtn').addEventListener('click', () => { if (!needConsent()) camInput.click(); });
['dragover', 'dragenter'].forEach(e => dropzone.addEventListener(e, ev => { ev.preventDefault(); dropzone.classList.add('drag'); }));
['dragleave', 'drop'].forEach(e => dropzone.addEventListener(e, ev => { ev.preventDefault(); dropzone.classList.remove('drag'); }));
dropzone.addEventListener('drop', e => { state.exact = false; if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]); });
fileInput.addEventListener('change', e => { state.exact = false; if (e.target.files[0]) handleFile(e.target.files[0]); });
camInput.addEventListener('change', e => { state.exact = false; if (e.target.files[0]) handleFile(e.target.files[0]); });

async function handleFile(file, { skipCompress = false } = {}) {
  if (needConsent()) return;
  next1.disabled = true;
  state.blobUrl = null;
  if (!skipCompress && COMPRESSIBLE_TYPES.includes(file.type)) {
    filenameLabel.textContent = file.name;
    setStatus('Compressing image…');
    file = await compressImageIfNeeded(file);
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    setStatus(`That file is too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Max size is ${MAX_UPLOAD_BYTES / 1024 / 1024}MB.`, 'err');
    return;
  }

  state.file = file;
  filenameLabel.textContent = file.name;
  pagesField.style.display = 'none';
  next1.textContent = 'Uploading…';
  setStatus('Uploading file…');

  try {
    const onUploadProgress = ({ percentage }) => { next1.textContent = `Uploading… ${Math.round(percentage)}%`; };
    if (!(await privateUploadsEnabled())) throw new Error('Secure upload is not available right now. Please try again shortly.');
    const { upload: uploadPrivate } = await import('https://esm.sh/@vercel/blob@2.8.2/client');
    const blob = await uploadPrivate(file.name, file, {
      access: 'private',
      handleUploadUrl: '/api/blob-upload-token?private=1',
      onUploadProgress,
    });
    state.blobUrl = blob.url;
  } catch (err) {
    setStatus('Upload failed: ' + err.message + ' — please try again.', 'err');
    next1.textContent = 'Choose a file to continue';
    return;
  }

  next1.textContent = 'Detecting pages…';
  setStatus('Detecting page count…');

  // The server fetches the uploaded file itself to count pages (no request
  // body size limit that way).
  let detected = 0;
  try {
    const res = await fetch('/api/detect-pages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename: file.name, blobUrl: state.blobUrl }),
    });
    const data = await res.json();
    if (data.problem) {
      // Would fail at the printer after being paid for — stop here and say why.
      setStatus(data.problem, 'err');
      state.blobUrl = null;
      next1.disabled = true;
      next1.textContent = 'Choose a different file';
      return;
    }
    if (data.pages && data.pages > 0) detected = data.pages;
  } catch { /* fall through to manual entry */ }

  if (detected) {
    state.pages = detected;
    pagesInput.value = detected;
    pagesField.style.display = 'none';
    setStatus(`✓ ${file.name} — ${detected} page${detected > 1 ? 's' : ''} detected`, 'ok');
  } else {
    state.pages = 1;
    pagesInput.value = 1;
    pagesField.style.display = 'block';
    document.getElementById('pagesNote').textContent = 'We could not count the pages automatically — please enter how many pages to print.';
    setStatus('✓ Uploaded', 'ok');
  }

  document.getElementById('fileChip').textContent = `${file.name} · ${state.pages} page${state.pages > 1 ? 's' : ''}`;
  next1.disabled = false;
  next1.textContent = 'Continue';
}

// --- Options ---
document.querySelectorAll('.cards').forEach(row => {
  row.querySelectorAll('.ocard').forEach(card => {
    card.addEventListener('click', () => {
      row.querySelectorAll('.ocard').forEach(o => o.classList.remove('active'));
      card.classList.add('active');
      if (row.dataset.group === 'color') state.colorMode = card.dataset.value;
      if (row.dataset.group === 'duplex') state.duplex = card.dataset.value;
      renderPriceLabels();
      updatePrice();
    });
  });
});
pagesInput.addEventListener('input', () => {
  state.pages = Math.max(1, parseInt(pagesInput.value) || 1);
  document.getElementById('fileChip').textContent = `${state.file?.name || ''} · ${state.pages} page${state.pages > 1 ? 's' : ''}`;
  updatePrice();
});
function setCopies(n) { state.copies = Math.min(500, Math.max(1, n || 1)); copiesInput.value = state.copies; updatePrice(); }
copiesInput.addEventListener('input', () => { state.copies = Math.min(500, Math.max(1, parseInt(copiesInput.value) || 1)); updatePrice(); });
document.getElementById('copiesMinus').addEventListener('click', () => setCopies(state.copies - 1));
document.getElementById('copiesPlus').addEventListener('click', () => setCopies(state.copies + 1));

function updatePrice() {
  const per = perPage(state.colorMode, state.duplex === 'double');
  const fee = state.service ? state.service.fee : 0;
  const discount = state.coupon ? state.coupon.discount : 0;
  const total = per * state.pages * state.copies + fee - discount;
  amountLabel.textContent = '₹' + (total / 100).toFixed(2);
  document.getElementById('priceSub').textContent =
    `${state.pages} page${state.pages > 1 ? 's' : ''} × ${state.copies} cop${state.copies > 1 ? 'ies' : 'y'} × ${rs(per)}` + (fee ? ` + ${rs(fee)} service` : '') + (discount ? ` − ${rs(discount)} coupon` : '');
  const sum = document.getElementById('summary');
  if (sum) {
    const rows = [
      ['File', state.file?.name || '—'],
      ['Pages × copies', `${state.pages} × ${state.copies}`],
      ['Colour', state.colorMode === 'color' ? 'Colour' : 'Black & white'],
      ['Sides', state.duplex === 'double' ? 'Double-sided' : 'Single-sided'],
      ...(state.service ? [['Service', state.service.name + (fee ? ' · ' + rs(fee) : '')]] : []),
      ['Rate', rs(per) + ' per page'],
      ...(discount ? [['Coupon ' + state.coupon.code, '− ' + rs(discount)]] : []),
      ['Total', '₹' + (total / 100).toFixed(2)],
    ];
    sum.innerHTML = rows.map(([k, v]) => `<div class="row"><span></span><span></span></div>`).join('');
    sum.querySelectorAll('.row').forEach((row, i) => {
      row.children[0].textContent = rows[i][0];
      row.children[1].textContent = rows[i][1];
    });
  }
  payBtn.disabled = !state.blobUrl;
}

// --- Pay button ---
payBtn.addEventListener('click', async () => {
  if (!state.blobUrl) return;
  payBtn.disabled = true;
  payBtn.textContent = 'Creating order…';

  let createData;
  try {
    const res = await fetch('/api/jobs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filename: state.file.name,
        blobUrl: state.blobUrl,
        pages: state.pages,
        copies: state.copies,
        colorMode: state.colorMode,
        duplex: state.duplex === 'double',
        shopSlug,
        serviceId: state.service ? state.service.id : undefined,
        couponCode: state.coupon ? state.coupon.code : undefined,
        consent: consentChk.checked,
        accountCode: state.account ? state.account.code : undefined,
        exactSize: state.exact ? true : undefined,
      }),
    });
    createData = await res.json();
    if (!res.ok) throw new Error(createData.error || 'Could not create order');
    rememberDeleteToken(createData.code, createData.deleteToken);
  } catch (err) {
    alert(err.message);
    payBtn.disabled = false;
    payBtn.textContent = payLabel();
    return;
  }

  if (createData.accountBilled) {
    showTicket(createData.job);
    pollUntilPrinted(createData.job.code);
  } else if (createData.razorpayEnabled) {
    openRazorpayModal(createData);
  } else {
    // Mock fallback
    payBtn.textContent = 'Confirming (mock)…';
    await new Promise(r => setTimeout(r, 800));
    const payRes = await fetch(`/api/jobs/${createData.code}/pay`, { method: 'POST' });
    const payData = await payRes.json();
    if (!payRes.ok) { alert(payData.error); payBtn.disabled = false; payBtn.textContent = payLabel(); return; }
    showTicket(payData.job);
    pollUntilPrinted(payData.job.code);
  }
});

// --- Razorpay Standard Checkout modal ---
function openRazorpayModal({ code, amount, razorpayOrderId, razorpayKeyId }) {
  const options = {
    key: razorpayKeyId,
    amount: amount,           // in paise
    currency: 'INR',
    name: 'DocuFast India',
    description: `Print job — ${state.file.name}`,
    order_id: razorpayOrderId,
    handler: async function (response) {
      // response = { razorpay_payment_id, razorpay_order_id, razorpay_signature }
      // Always verify on the server — never trust this callback alone.
      payBtn.textContent = 'Verifying payment…';
      try {
        const verifyRes = await fetch('/api/verify-payment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(response),
        });
        const verifyData = await verifyRes.json();
        if (!verifyRes.ok) throw new Error(verifyData.error || 'Payment verification failed');
        showTicket(verifyData.job);
        pollUntilPrinted(verifyData.job.code);
      } catch (err) {
        alert('Payment received but verification failed: ' + err.message + '\nPlease contact us with your payment ID: ' + response.razorpay_payment_id);
        payBtn.disabled = false;
        payBtn.textContent = payLabel();
      }
    },
    prefill: { contact: '', email: '' },
    theme: { color: '#0A2E6E' }, // DocuFast navy
    modal: {
      ondismiss: function () {
        // User closed the modal without paying
        payBtn.disabled = false;
        payBtn.textContent = payLabel();
      },
    },
  };

  const rzp = new Razorpay(options);
  rzp.on('payment.failed', function (response) {
    alert('Payment failed: ' + response.error.description + '\nPlease try again.');
    payBtn.disabled = false;
    payBtn.textContent = payLabel();
  });
  rzp.open();
}

// --- Ticket display ---
// The delete token lets this phone (and only this phone) delete its own upload
// from the status page. Kept per order code; the newest 20 are remembered.
function rememberDeleteToken(code, token) {
  if (!code || !token) return;
  try {
    const m = JSON.parse(localStorage.getItem('df_del') || '{}');
    delete m[code]; m[code] = token;
    const keys = Object.keys(m);
    keys.slice(0, Math.max(0, keys.length - 20)).forEach(k => delete m[k]);
    localStorage.setItem('df_del', JSON.stringify(m));
  } catch { /* storage unavailable — deletion then needs the payment ID */ }
}
function rememberOrder(job) {
  try {
    const list = JSON.parse(localStorage.getItem('df_recent') || '[]').filter(r => r.code !== job.code);
    list.unshift({ code: job.code, filename: job.filename, at: Date.now() });
    localStorage.setItem('df_recent', JSON.stringify(list.slice(0, 20)));
  } catch { /* storage unavailable — history is a convenience only */ }
}

function showTicket(job) {
  rememberOrder(job);
  document.getElementById('uploadCard').style.display = 'none';
  document.getElementById('ticketCard').style.display = 'block';
  document.getElementById('ticketCode').textContent = job.code;
  document.getElementById('trackLink').href = '/status.html?code=' + encodeURIComponent(job.code);
  document.getElementById('ticketFilename').textContent = job.filename;
  document.getElementById('ticketMeta').textContent =
    `${job.pages} page${job.pages > 1 ? 's' : ''} × ${job.copies} ${job.copies > 1 ? 'copies' : 'copy'}, ${job.colorMode === 'color' ? 'color' : 'B&W'} — ₹${(job.amount / 100).toFixed(2)}`;

  const pill = document.getElementById('statusPill');
  const note = document.getElementById('ticketNote');

  if (job.status === 'printed') {
    pill.textContent = '✓ Printed'; pill.className = 'status-pill printed';
    note.textContent = 'Your document is printing — collect it from the tray.';
  } else if (job.status === 'paid' && job.printError) {
    pill.textContent = 'Payment received'; pill.className = 'status-pill error';
    note.textContent = `Payment went through, but printing failed (${job.printError}). Please show this code at the counter.`;
  } else {
    pill.textContent = 'Paid — printing soon'; pill.className = 'status-pill paid';
    note.textContent = 'Payment confirmed. Sending to printer…';
  }
}

// --- Follow the job until it is printed: live ping, polling only if push is down ---
function pollUntilPrinted(code) {
  let live = null;
  const check = async () => {
    try {
      const res = await fetch(`/api/jobs/${code}`);
      const data = await res.json();
      if (!res.ok) return;
      showTicket(data.job);
      if (!live && window.DFPush) live = window.DFPush.live(data.push, check, 5000, ['update']);
      if (data.job.status === 'printed' || (data.job.status === 'paid' && data.job.printError)) {
        if (live) live.close();
      }
    } catch { /* network hiccup — next ping or poll retries */ }
  };
  check();
}


// --- Document tools (photos -> PDF, passport sheet, service checklists) ---
function setColourMode(mode) {
  state.colorMode = mode;
  document.querySelectorAll('.cards[data-group="color"] .ocard').forEach(o => o.classList.toggle('active', o.dataset.value === mode));
  renderPriceLabels(); updatePrice();
}
const tools = initTools({
  onFile: (file, meta) => {
    state.service = meta.service || null;
    state.exact = !!meta.exact;
    if (meta.forceColour) setColourMode('color');
    filenameLabel.textContent = file.name;
    next1.style.display = '';
    handleFile(file, { skipCompress: true });
  },
  onService: s => { state.service = s; updatePrice(); },
  onError: msg => setStatus(msg, 'err'),
  onBusy: msg => { if (msg) { next1.disabled = true; next1.textContent = msg; setStatus(msg); } },
});
fetch('/api/services').then(r => r.json()).then(d => tools.setServices(d.services || [])).catch(() => {});


// --- Coupons ---
// The server re-checks the code and recomputes the discount from the shop's
// prices; the number shown here is only what the server told us.
const couponInput = document.getElementById('couponInput');
const couponMsg = document.getElementById('couponMsg');
function setCouponMsg(t, cls) { couponMsg.textContent = t; couponMsg.className = 'note' + (cls ? ' ' + cls : ''); }
async function applyCoupon() {
  const code = couponInput.value.trim();
  if (!code) { state.coupon = null; setCouponMsg(''); updatePrice(); return; }
  setCouponMsg('Checking…');
  try {
    const res = await fetch('/api/coupons/check', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, shopSlug, serviceId: state.service ? state.service.id : undefined,
        colorMode: state.colorMode, duplex: state.duplex === 'double', pages: state.pages, copies: state.copies }),
    });
    const d = await res.json();
    if (d.valid) { state.coupon = { code: d.code, discount: d.discount }; setCouponMsg(`✓ ${d.code} applied — you save ${rs(d.discount)}`, 'ok'); }
    else { state.coupon = null; setCouponMsg(d.message || 'That code is not valid.', 'err'); }
  } catch { state.coupon = null; setCouponMsg('Could not check the code. Try again.', 'err'); }
  updatePrice();
}
document.getElementById('couponBtn').addEventListener('click', applyCoupon);
couponInput.addEventListener('keydown', e => { if (e.key === 'Enter') applyCoupon(); });
// Any change to the order invalidates an applied discount — re-check it silently.
['back3', 'next2'].forEach(id => document.getElementById(id).addEventListener('click', () => { if (state.coupon) { couponInput.value = state.coupon.code; applyCoupon(); } }));


// --- Business account (monthly billing) ---
(function () {
  const input = document.getElementById('acctInput'), btn = document.getElementById('acctBtn'), msg = document.getElementById('acctMsg');
  if (!input) return;
  const setPay = () => { payBtn.textContent = state.account ? 'Bill to ' + state.account.name + ' & print' : 'Pay & print'; };
  btn.addEventListener('click', async () => {
    if (state.account) { state.account = null; input.value = ''; input.disabled = false; btn.textContent = 'Use'; msg.textContent = ''; setPay(); return; }
    const code = input.value.trim();
    if (!code) return;
    msg.textContent = 'Checking…'; msg.style.color = '';
    try {
      const r = await fetch('/api/accounts/check', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Invalid code');
      state.account = { code, name: d.name };
      input.disabled = true; btn.textContent = 'Remove';
      msg.textContent = 'Billing to ' + d.name + ' — no payment needed now.'; msg.style.color = '#0a7a3c';
      setPay();
    } catch (e) { msg.textContent = e.message; msg.style.color = '#b42318'; }
  });
})();
