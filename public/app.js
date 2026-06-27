// Customer-facing upload + mock checkout flow.
const RATES = { bw: 2, color: 8 }; // rupees per page — mirrors RATES in server.js

// QR codes get scanned by all sorts of camera apps, and a lot of them
// (especially on Xiaomi/Oppo/Vivo and older Samsung phones) open the link in
// a stripped-down in-app browser bundled with the camera app, instead of the
// phone's real browser (Chrome/Samsung Internet/Safari). Those mini-browsers
// often can't complete the cross-site form-POST redirect to Paytm's hosted
// payment page — the page that works fine in a real browser. This check
// flags the common in-app signatures and offers a one-tap way out, before
// the customer gets to the part where it would otherwise hang.
function detectInAppBrowser() {
  const ua = navigator.userAgent || '';
  // Generic in-app WebView indicators across Android camera apps + common
  // social apps people might tap the link from instead of scanning directly.
  const patterns = [
    'MiuiBrowser', 'XiaoMi', 'HuaweiBrowser', 'VivoBrowser', 'OppoBrowser',
    'HeyTapBrowser', 'SamsungBrowser/4', // old Samsung WebView-based version
    'FBAN', 'FBAV', // Facebook in-app
    'Instagram', 'WhatsApp', 'Line/', 'MicroMessenger', // WeChat
    'wv)', // generic Android "WebView" marker
  ];
  return patterns.some((p) => ua.includes(p));
}

function showInAppWarning() {
  const el = document.getElementById('inAppWarning');
  if (!el) return;
  const isAndroid = /Android/i.test(navigator.userAgent);
  if (isAndroid) {
    // Android intent:// URL forces the link open in the system's chosen
    // default browser, escaping whatever in-app WebView is currently
    // showing this page — this is the standard reliable workaround.
    const target = location.href.replace(/^https?:\/\//, '');
    const intentUrl = `intent://${target}#Intent;scheme=https;package=com.android.chrome;end`;
    el.innerHTML = `⚠ For payment to work, please open this page in your regular browser. <a href="${intentUrl}" style="color:inherit;text-decoration:underline;font-weight:700;">Tap here to open in Chrome</a>, or copy this link and paste it into your browser.`;
  } else {
    el.textContent = '⚠ For payment to work, please open this page in Safari (tap "•••" or the share icon and choose "Open in Safari"), not inside another app.';
  }
  el.style.display = 'block';
}

if (detectInAppBrowser()) showInAppWarning();

const state = {
  file: null,
  fileData: null,
  pages: 1,
  copies: 1,
  colorMode: 'bw',
  duplex: 'single',
};

const dropzone = document.getElementById('dropzone');
const fileInput = document.getElementById('fileInput');
const filenameLabel = document.getElementById('filenameLabel');
const pagesInput = document.getElementById('pages');
const copiesInput = document.getElementById('copies');
const amountLabel = document.getElementById('amountLabel');
const payBtn = document.getElementById('payBtn');

dropzone.addEventListener('click', () => fileInput.click());
['dragover', 'dragenter'].forEach((evt) =>
  dropzone.addEventListener(evt, (e) => { e.preventDefault(); dropzone.classList.add('drag'); })
);
['dragleave', 'drop'].forEach((evt) =>
  dropzone.addEventListener(evt, (e) => { e.preventDefault(); dropzone.classList.remove('drag'); })
);
dropzone.addEventListener('drop', (e) => {
  if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
});
fileInput.addEventListener('change', (e) => {
  if (e.target.files.length) handleFile(e.target.files[0]);
});

function handleFile(file) {
  state.file = file;
  filenameLabel.textContent = file.name;
  const reader = new FileReader();
  reader.onload = () => {
    state.fileData = reader.result; // data URL (base64)
    updatePrice();
    payBtn.disabled = false;
    payBtn.textContent = 'Pay & get pickup code';
  };
  reader.readAsDataURL(file);
}

document.querySelectorAll('.toggle-row').forEach((row) => {
  row.querySelectorAll('.opt').forEach((opt) => {
    opt.addEventListener('click', () => {
      row.querySelectorAll('.opt').forEach((o) => o.classList.remove('active'));
      opt.classList.add('active');
      const group = opt.dataset.group;
      if (group === 'color') state.colorMode = opt.dataset.value;
      if (group === 'duplex') state.duplex = opt.dataset.value;
      updatePrice();
    });
  });
});

pagesInput.addEventListener('input', () => { state.pages = Math.max(1, parseInt(pagesInput.value, 10) || 1); updatePrice(); });
copiesInput.addEventListener('input', () => { state.copies = Math.max(1, parseInt(copiesInput.value, 10) || 1); updatePrice(); });

function updatePrice() {
  const rate = RATES[state.colorMode];
  const total = rate * state.pages * state.copies;
  amountLabel.textContent = '₹' + total.toFixed(2);
}

payBtn.addEventListener('click', async () => {
  if (!state.fileData) return;
  payBtn.disabled = true;
  payBtn.textContent = 'Creating order…';

  try {
    const createRes = await fetch('/api/jobs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filename: state.file.name,
        fileData: state.fileData,
        pages: state.pages,
        copies: state.copies,
        colorMode: state.colorMode,
        duplex: state.duplex === 'double',
      }),
    });
    const createData = await createRes.json();
    if (!createRes.ok) throw new Error(createData.error || 'Could not create job');

    if (createData.paytmEnabled) {
      // Real Paytm: build a hidden form and navigate the whole page to
      // Paytm's hosted payment page. Paytm redirects back to our
      // /paytm-callback route when done, which redirects here again with
      // ?code=...&paid=1/0 — handled by checkPaymentReturn() below.
      payBtn.textContent = 'Redirecting to Paytm…';

      // If the page hasn't actually navigated away within a few seconds,
      // something is blocking it (most commonly: an in-app browser that
      // can't complete the cross-site redirect). Rather than leaving the
      // customer staring at "Redirecting…" forever with no way to tell
      // what's wrong, surface the same in-app-browser guidance — this
      // catches cases detectInAppBrowser() missed (new/unrecognized
      // WebViews) since it's based on what actually happened, not just the
      // user agent string.
      const stuckTimer = setTimeout(() => {
        showInAppWarning();
        payBtn.disabled = false;
        payBtn.textContent = 'Pay & get pickup code';
      }, 6000);
      window.addEventListener('pagehide', () => clearTimeout(stuckTimer));

      const form = document.createElement('form');
      form.method = 'POST';
      form.action = createData.txnUrl;
      form.style.display = 'none';
      [
        ['mid', createData.mid],
        ['orderId', createData.code],
        ['txnToken', createData.txnToken],
      ].forEach(([name, value]) => {
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = name;
        input.value = value;
        form.appendChild(input);
      });
      document.body.appendChild(form);
      form.submit();
      return; // page is navigating away — nothing more to do here
    }

    // Mock mode only (no real Paytm keys configured yet).
    payBtn.textContent = 'Waiting for UPI confirmation…';
    await new Promise((r) => setTimeout(r, 900));
    const payRes = await fetch(`/api/jobs/${createData.code}/pay`, { method: 'POST' });
    const payData = await payRes.json();
    if (!payRes.ok) throw new Error(payData.error || 'Payment failed');
    showTicket(payData.job);
    pollUntilPrinted(payData.job.code);
  } catch (err) {
    alert(err.message);
    payBtn.disabled = false;
    payBtn.textContent = 'Pay & get pickup code';
  }
});

// Handles the bounce-back after a real Paytm payment: server redirects here
// with ?code=XXXXXX&paid=1 (or paid=0 on failure) after independently
// verifying the transaction status — see the /paytm-callback route in server.js.
async function checkPaymentReturn() {
  const params = new URLSearchParams(location.search);
  const code = params.get('code');
  const paid = params.get('paid');
  if (!code) return;

  if (paid === '1') {
    try {
      const res = await fetch(`/api/jobs/${code}`);
      const data = await res.json();
      if (res.ok) {
        showTicket(data.job);
        pollUntilPrinted(code);
      }
    } catch {
      // fall through silently — code is still valid, user can note it down
    }
  } else if (paid === '0') {
    alert('Payment was not completed. Please try again.');
  }
}
checkPaymentReturn();

// Printing now happens on a separate machine (the laptop print agent), which
// polls the cloud every few seconds — so the customer page polls too, until
// the job flips to 'printed' or a print error shows up.
function pollUntilPrinted(code) {
  const interval = setInterval(async () => {
    try {
      const res = await fetch(`/api/jobs/${code}`);
      const data = await res.json();
      if (!res.ok) return;
      showTicket(data.job);
      if (data.job.status === 'printed' || (data.job.status === 'paid' && data.job.printError)) {
        clearInterval(interval);
      }
    } catch {
      // transient network hiccup — just try again next tick
    }
  }, 3000);
}

function showTicket(job) {
  document.getElementById('uploadCard').style.display = 'none';
  document.getElementById('ticketCard').style.display = 'block';
  document.getElementById('ticketCode').textContent = job.code;
  document.getElementById('ticketFilename').textContent = job.filename;
  document.getElementById('ticketMeta').textContent =
    `${job.pages} page${job.pages > 1 ? 's' : ''} × ${job.copies} ${job.copies > 1 ? 'copies' : 'copy'}, ${job.colorMode === 'color' ? 'color' : 'B&W'}, ₹${(job.amount / 100).toFixed(2)}`;

  const pill = document.getElementById('statusPill');
  const note = document.getElementById('ticketNote');
  const label = document.getElementById('ticketLabel');

  if (job.status === 'printed') {
    pill.textContent = 'Printed';
    pill.className = 'status-pill printed';
    label.textContent = 'Order code';
    note.textContent = 'Printed — collect it from the tray. This code is your receipt reference.';
  } else if (job.status === 'paid' && job.printError) {
    pill.textContent = 'Payment received';
    pill.className = 'status-pill error';
    label.textContent = 'Order code';
    note.textContent = `Payment went through, but printing failed (${job.printError}). Show this code at the counter — your file is still saved and ready to retry.`;
  } else {
    pill.textContent = 'Paid';
    pill.className = 'status-pill paid';
    label.textContent = 'Pickup code';
    note.textContent = 'Printing now — collect it from the tray.';
  }
}
