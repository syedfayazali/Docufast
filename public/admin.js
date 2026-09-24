// Shop dashboard — loads jobs for this specific shop only.
// Uses the shop's API key to authenticate — each shop only sees their own jobs.

const shopKeyInput = document.getElementById('shopKey');
shopKeyInput.value = localStorage.getItem('df_shop_key') || '';
shopKeyInput.addEventListener('keydown', e => { if (e.key === 'Enter') loadDashboard(); });

let refreshTimer = null;

async function loadDashboard() {
  const key = shopKeyInput.value.trim();
  if (!key) { showError('Please paste your shop API key first.'); return; }
  localStorage.setItem('df_shop_key', key);
  clearError();

  document.getElementById('loader').style.display = 'block';
  document.getElementById('content').style.display = 'none';

  // Verify key by calling the agent pending endpoint
  const res = await fetch('/api/agent/pending', {
    headers: { 'x-agent-key': key }
  });

  if (res.status === 401) {
    document.getElementById('loader').style.display = 'none';
    showError('Invalid API key — please check and try again.');
    return;
  }

  // Now load the shop's jobs via admin endpoint with shop key
  await refresh(key);

  document.getElementById('loader').style.display = 'none';
  document.getElementById('content').style.display = 'block';

  // Auto-refresh every 5 seconds
  if (refreshTimer) clearInterval(refreshTimer);
  refreshTimer = setInterval(() => refresh(key), 5000);
}

async function refresh(key) {
  try {
    const res = await fetch('/api/admin/jobs', {
      headers: { 'x-shop-key': key }
    });
    if (!res.ok) return;
    const data = await res.json();

    // KPIs
    document.getElementById('kpiJobs').textContent = data.jobs.length;
    document.getElementById('kpiPrinted').textContent = data.jobs.filter(j => j.status === 'printed').length;
    document.getElementById('kpiPending').textContent = data.jobs.filter(j => j.status === 'paid' || j.status === 'pending_payment').length;
    document.getElementById('kpiRevenue').textContent = '₹' + (data.revenueToday / 100).toFixed(2);

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
      qrImg.src = qrUrl;

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

    // Jobs table
    const rows = document.getElementById('jobRows');
    rows.innerHTML = '';
    if (!data.jobs.length) {
      rows.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--slate);padding:24px;">No jobs yet — share your QR code with customers.</td></tr>';
      return;
    }

    data.jobs.forEach(job => {
      const canRetry = job.status === 'paid' && job.printError;
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="code-cell">${job.code}</td>
        <td style="max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${job.filename}">${job.filename}</td>
        <td>${job.pages} × ${job.copies}</td>
        <td>₹${(job.amount / 100).toFixed(2)}</td>
        <td style="color:var(--slate);">${job.colorMode === 'color' ? '🟡 Colour' : '⚫ B&W'}${job.duplex ? ' · Duplex' : ''}</td>
        <td><span class="pill ${statusClass(job)}">${job.printError ? 'Print failed' : job.status.replace('_', ' ')}</span></td>
        <td>${canRetry ? `<button class="retry-btn" data-code="${job.code}">Retry</button>` : ''}</td>`;
      rows.appendChild(tr);
    });

    rows.querySelectorAll('.retry-btn').forEach(btn =>
      btn.addEventListener('click', () => retryPrint(btn.dataset.code, key))
    );
  } catch (err) {
    console.error('Refresh error:', err);
  }
}

async function retryPrint(code, key) {
  const res = await fetch(`/api/admin/jobs/${code}/retry`, {
    method: 'POST',
    headers: { 'x-agent-key': key }
  });
  if (!res.ok) {
    const d = await res.json().catch(() => ({}));
    alert(d?.error || 'Retry failed — check your key.');
    return;
  }
  refresh(key);
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

// Auto-load if key was saved from last visit
if (shopKeyInput.value) loadDashboard();
