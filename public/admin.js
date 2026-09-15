const ownerKeyInput = document.getElementById('ownerKey');
ownerKeyInput.value = localStorage.getItem('df_owner_key') || '';
ownerKeyInput.addEventListener('input', () => localStorage.setItem('df_owner_key', ownerKeyInput.value));

async function refresh() {
  const res = await fetch('/api/admin/jobs');
  const data = await res.json();
  document.getElementById('kpiJobs').textContent = data.jobs.length;
  document.getElementById('kpiPrinted').textContent = data.jobs.filter(j => j.status === 'printed').length;
  document.getElementById('kpiRevenue').textContent = '₹' + (data.revenueToday / 100).toFixed(2);
  const rows = document.getElementById('jobRows');
  rows.innerHTML = '';
  data.jobs.forEach(job => {
    const canRetry = job.status === 'paid' && job.printError;
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="code">${job.code}</td>
      <td style="max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${job.filename}</td>
      <td>${job.pages}×${job.copies}</td>
      <td>₹${(job.amount/100).toFixed(2)}</td>
      <td><span class="status-pill ${statusClass(job)}">${job.printError?'print failed':job.status.replace('_',' ')}</span></td>
      <td>${canRetry?`<button class="ghost" style="margin:0;padding:6px 10px;font-size:12px;" data-code="${job.code}">Retry</button>`:''}</td>`;
    rows.appendChild(tr);
  });
  rows.querySelectorAll('button[data-code]').forEach(btn => btn.addEventListener('click', () => retryPrint(btn.dataset.code)));
}

async function retryPrint(code) {
  const key = ownerKeyInput.value.trim();
  if (!key) { alert('Paste your AGENT_KEY above first.'); return; }
  const res = await fetch(`/api/admin/jobs/${code}/retry`, { method: 'POST', headers: { 'x-agent-key': key } });
  if (!res.ok) { const d = await res.json().catch(()=>{}); alert(d?.error || 'Retry failed'); return; }
  refresh();
}

function statusClass(job) {
  if (job.printError) return 'error';
  if (job.status === 'paid') return 'paid';
  if (job.status === 'printed') return 'printed';
  return 'pending';
}

refresh();
setInterval(refresh, 4000);
