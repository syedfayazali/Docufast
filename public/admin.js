const ownerKeyInput = document.getElementById('ownerKey');
ownerKeyInput.value = localStorage.getItem('qwikprint_owner_key') || '';
ownerKeyInput.addEventListener('input', () => {
  localStorage.setItem('qwikprint_owner_key', ownerKeyInput.value);
});

async function refresh() {
  const res = await fetch('/api/admin/jobs');
  const data = await res.json();

  document.getElementById('kpiJobs').textContent = data.jobs.length;
  document.getElementById('kpiPrinted').textContent = data.jobs.filter((j) => j.status === 'printed').length;
  document.getElementById('kpiRevenue').textContent = '₹' + (data.revenueToday / 100).toFixed(2);

  renderAgentBanner(data.agent);

  const rows = document.getElementById('jobRows');
  rows.innerHTML = '';
  data.jobs.forEach((job) => {
    const tr = document.createElement('tr');
    const canRetry = job.status === 'paid' && job.printError;
    tr.innerHTML = `
      <td class="code">${job.code}</td>
      <td>${job.filename}</td>
      <td>${job.pages} × ${job.copies}</td>
      <td>₹${(job.amount / 100).toFixed(2)}</td>
      <td><span class="status-pill ${statusClass(job)}">${job.printError ? 'print failed' : job.status.replace('_', ' ')}</span></td>
      <td>${canRetry ? `<button class="ghost" style="margin:0;padding:6px 10px;font-size:12px;" data-code="${job.code}">Retry</button>` : ''}</td>
    `;
    rows.appendChild(tr);
  });

  rows.querySelectorAll('button[data-code]').forEach((btn) => {
    btn.addEventListener('click', () => retryPrint(btn.dataset.code));
  });
}

async function retryPrint(code) {
  const key = ownerKeyInput.value.trim();
  if (!key) {
    alert('Paste your owner key above first (the same value as AGENT_KEY).');
    return;
  }
  const res = await fetch(`/api/admin/jobs/${code}/retry`, {
    method: 'POST',
    headers: { 'x-agent-key': key },
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    alert(data.error || 'Retry failed — check your owner key.');
    return;
  }
  refresh();
}

function statusClass(job) {
  if (job.printError) return 'error';
  if (job.status === 'paid') return 'paid';
  if (job.status === 'printed') return 'printed';
  if (job.status === 'pending_payment') return 'pending';
  return 'error';
}

function renderAgentBanner(agent) {
  const el = document.getElementById('agentBanner');
  if (!el) return;

  if (!agent) {
    el.textContent = '⚠ Print agent has never checked in. Set it up on the shop PC — see print-agent/README.md.';
    el.className = 'agent-banner error';
    return;
  }

  if (!agent.online) {
    const mins = Math.round((Date.now() - new Date(agent.lastSeen).getTime()) / 60000);
    el.textContent = `⚠ Print agent offline — last seen ${mins} minute(s) ago. Jobs will queue up until it reconnects.`;
    el.className = 'agent-banner error';
    return;
  }

  if (agent.printerOk === false) {
    el.textContent = `⚠ Agent online, but printer problem reported: ${agent.printerMessage || 'unknown issue'}.`;
    el.className = 'agent-banner error';
    return;
  }

  el.textContent = '✓ Print agent online, printer ready.';
  el.className = 'agent-banner ok';
}

refresh();
setInterval(refresh, 4000);
