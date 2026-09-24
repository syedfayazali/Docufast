// DocuFast India — customer upload + Razorpay Standard Checkout.
// Flow: upload file DIRECTLY to Blob storage (browser -> Blob, bypassing
//   this app's serverless functions entirely for the file bytes — see
//   the comment on MAX_UPLOAD_BYTES below for why) → detect pages →
//   POST /api/jobs (gets razorpayOrderId) → open Razorpay modal →
//   on success, POST /api/verify-payment → show ticket + poll until printed.
import { upload } from 'https://esm.sh/@vercel/blob@0.27.0/client';

const RATES = { bw: 2, color: 8 }; // ₹ per page (display only — server is the authority)

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

const state = { file: null, blobUrl: null, pages: 1, copies: 1, colorMode: 'bw', duplex: 'single' };

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

async function handleFile(file) {
  if (COMPRESSIBLE_TYPES.includes(file.type)) {
    filenameLabel.textContent = file.name;
    document.getElementById('pagesNote').textContent = 'Compressing image…';
    const before = file.size;
    file = await compressImageIfNeeded(file);
    if (file.size < before) {
      console.log(`Compressed ${(before / 1024 / 1024).toFixed(1)}MB -> ${(file.size / 1024 / 1024).toFixed(1)}MB`);
    }
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    alert(`That file is too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Max size is ${MAX_UPLOAD_BYTES / 1024 / 1024}MB.`);
    return;
  }

  state.file = file;
  state.blobUrl = null;
  filenameLabel.textContent = file.name;
  payBtn.disabled = true;
  payBtn.textContent = 'Uploading…';
  pagesInput.readOnly = true;
  pagesInput.style.background = '#E7ECF7';
  document.getElementById('pagesNote').textContent = 'Uploading file…';

  try {
    const blob = await upload(file.name, file, {
      access: 'public',
      handleUploadUrl: '/api/blob-upload-token',
      onUploadProgress: ({ percentage }) => {
        payBtn.textContent = `Uploading… ${percentage}%`;
      },
    });
    state.blobUrl = blob.url;
  } catch (err) {
    document.getElementById('pagesNote').textContent = 'Upload failed — please try again.';
    payBtn.textContent = 'Pay & print';
    alert('Upload failed: ' + err.message);
    return;
  }

  payBtn.textContent = 'Detecting pages…';
  document.getElementById('pagesNote').textContent = 'Detecting page count…';

  // Send the blob URL (not the file bytes) for page-count detection — the
  // server fetches it directly from Blob storage, which has no
  // request-body-size limit the way an inbound POST does.
  try {
    const res = await fetch('/api/detect-pages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename: file.name, blobUrl: state.blobUrl }),
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
