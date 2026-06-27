// Customer-facing upload + mock checkout flow.
const RATES = { bw: 2, color: 8 }; // rupees per page — mirrors RATES in server.js

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
