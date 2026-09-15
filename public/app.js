// DocuFast India — customer upload + Razorpay Standard Checkout.
// Flow: upload file → POST /api/jobs (gets razorpayOrderId) →
//   open Razorpay modal → on success, POST /api/verify-payment →
//   show ticket + poll until printed.

const RATES = { bw: 2, color: 8 }; // ₹ per page (display only — server is the authority)

// Shops link customers here via /?shop=<their-slug> (see /admin for that
// shop's URL). No slug in the URL just means "no specific shop assigned" —
// only the legacy single-shop agent setup will pick those jobs up.
const shopSlug = new URLSearchParams(window.location.search).get('shop');

const state = { file: null, fileData: null, pages: 1, copies: 1, colorMode: 'bw', duplex: 'single' };

const dropzone = document.getElementById('dropzone');
const fileInput = document.getElementById('fileInput');
const filenameLabel = document.getElementById('filenameLabel');
const pagesInput = document.getElementById('pages');
const copiesInput = document.getElementById('copies');
const amountLabel = document.getElementById('amountLabel');
const payBtn = document.getElementById('payBtn');

// --- File pick ---
dropzone.addEventListener('click', () => fileInput.click());
['dragover', 'dragenter'].forEach(e => dropzone.addEventListener(e, ev => { ev.preventDefault(); dropzone.classList.add('drag'); }));
['dragleave', 'drop'].forEach(e => dropzone.addEventListener(e, ev => { ev.preventDefault(); dropzone.classList.remove('drag'); }));
dropzone.addEventListener('drop', e => { if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]); });
fileInput.addEventListener('change', e => { if (e.target.files[0]) handleFile(e.target.files[0]); });

function handleFile(file) {
  state.file = file;
  filenameLabel.textContent = file.name;
  payBtn.disabled = true;
  payBtn.textContent = 'Detecting pages…';
  pagesInput.readOnly = true;
  pagesInput.style.background = '#E7ECF7';
  document.getElementById('pagesNote').textContent = 'Detecting page count…';

  const reader = new FileReader();
  reader.onload = async () => {
    state.fileData = reader.result;

    // Send file to server for page count detection
    // Done before payment so customer sees the correct amount
    try {
      const res = await fetch('/api/detect-pages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: file.name, fileData: state.fileData }),
      });
      const data = await res.json();

      if (data.pages && data.pages > 0) {
        state.pages = data.pages;
        pagesInput.value = data.pages;
        pagesInput.readOnly = true;
        pagesInput.style.background = '#E7ECF7';
        document.getElementById('pagesNote').textContent =
          `✓ Auto-detected: ${data.pages} page${data.pages > 1 ? 's' : ''}`;
      } else {
        // Could not detect — let user enter manually
        pagesInput.readOnly = false;
        pagesInput.style.background = '';
        pagesInput.value = 1;
        state.pages = 1;
        document.getElementById('pagesNote').textContent =
          'Could not auto-detect — please enter the number of pages';
        pagesInput.focus();
      }
    } catch {
      // Network error — let user enter manually
      pagesInput.readOnly = false;
      pagesInput.style.background = '';
      document.getElementById('pagesNote').textContent = 'Enter the number of pages manually';
    }

    updatePrice();
    payBtn.disabled = false;
    payBtn.textContent = 'Pay & print';
  };
  reader.readAsDataURL(file);
}

// --- Options ---
document.querySelectorAll('.toggle-row').forEach(row => {
  row.querySelectorAll('.opt').forEach(opt => {
    opt.addEventListener('click', () => {
      row.querySelectorAll('.opt').forEach(o => o.classList.remove('active'));
      opt.classList.add('active');
      if (opt.dataset.group === 'color') state.colorMode = opt.dataset.value;
      if (opt.dataset.group === 'duplex') state.duplex = opt.dataset.value;
      updatePrice();
    });
  });
});
pagesInput.addEventListener('input', () => { state.pages = Math.max(1, parseInt(pagesInput.value) || 1); updatePrice(); });
copiesInput.addEventListener('input', () => { state.copies = Math.max(1, parseInt(copiesInput.value) || 1); updatePrice(); });

function updatePrice() {
  amountLabel.textContent = '₹' + (RATES[state.colorMode] * state.pages * state.copies).toFixed(2);
}

// --- Pay button ---
payBtn.addEventListener('click', async () => {
  if (!state.fileData) return;
  payBtn.disabled = true;
  payBtn.textContent = 'Creating order…';

  let createData;
  try {
    const res = await fetch('/api/jobs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filename: state.file.name,
        fileData: state.fileData,
        pages: state.pages,
        copies: state.copies,
        colorMode: state.colorMode,
        duplex: state.duplex === 'double',
        shopSlug,
      }),
    });
    createData = await res.json();
    if (!res.ok) throw new Error(createData.error || 'Could not create order');
  } catch (err) {
    alert(err.message);
    payBtn.disabled = false;
    payBtn.textContent = 'Pay & print';
    return;
  }

  if (createData.razorpayEnabled) {
    openRazorpayModal(createData);
  } else {
    // Mock fallback
    payBtn.textContent = 'Confirming (mock)…';
    await new Promise(r => setTimeout(r, 800));
    const payRes = await fetch(`/api/jobs/${createData.code}/pay`, { method: 'POST' });
    const payData = await payRes.json();
    if (!payRes.ok) { alert(payData.error); payBtn.disabled = false; payBtn.textContent = 'Pay & print'; return; }
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
        payBtn.textContent = 'Pay & print';
      }
    },
    prefill: { contact: '', email: '' },
    theme: { color: '#0A2E6E' }, // DocuFast navy
    modal: {
      ondismiss: function () {
        // User closed the modal without paying
        payBtn.disabled = false;
        payBtn.textContent = 'Pay & print';
      },
    },
  };

  const rzp = new Razorpay(options);
  rzp.on('payment.failed', function (response) {
    alert('Payment failed: ' + response.error.description + '\nPlease try again.');
    payBtn.disabled = false;
    payBtn.textContent = 'Pay & print';
  });
  rzp.open();
}

// --- Ticket display ---
function showTicket(job) {
  document.getElementById('uploadCard').style.display = 'none';
  document.getElementById('ticketCard').style.display = 'block';
  document.getElementById('ticketCode').textContent = job.code;
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

// --- Poll until the agent prints the job ---
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
    } catch { /* network hiccup — retry next tick */ }
  }, 3000);
}
