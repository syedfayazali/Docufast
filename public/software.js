/* DocuFast software landing page: plans, form, video, interactive demos. */
(function () {
  'use strict';
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  function esc(t) { var d = document.createElement('div'); d.textContent = t; return d.innerHTML; }
  function paint(el) { if (window.dfIcons) window.dfIcons(el || document.body); }
  var QR = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 29 29" class="segno"><path class="qrline" stroke="#0b1b3f" d="M0 0.5h7m2 0h1m1 0h1m2 0h1m3 0h2m2 0h7m-29 1h1m5 0h1m1 0h1m1 0h4m3 0h1m1 0h1m2 0h1m5 0h1m-29 1h1m1 0h3m1 0h1m2 0h2m1 0h1m2 0h1m3 0h1m2 0h1m1 0h3m1 0h1m-29 1h1m1 0h3m1 0h1m3 0h1m1 0h2m4 0h2m2 0h1m1 0h3m1 0h1m-29 1h1m1 0h3m1 0h1m1 0h2m1 0h3m2 0h1m2 0h1m2 0h1m1 0h3m1 0h1m-29 1h1m5 0h1m2 0h4m1 0h2m3 0h2m1 0h1m5 0h1m-29 1h7m1 0h1m1 0h1m1 0h1m1 0h1m1 0h1m1 0h1m1 0h1m1 0h7m-20 1h4m2 0h1m1 0h4m-21 1h1m1 0h1m1 0h1m1 0h1m4 0h1m4 0h2m6 0h1m2 0h1m-28 1h1m2 0h2m2 0h1m1 0h1m1 0h3m1 0h1m1 0h2m1 0h1m1 0h1m2 0h1m2 0h1m-28 1h2m1 0h1m1 0h3m1 0h2m2 0h1m6 0h2m1 0h1m1 0h3m-29 1h3m1 0h2m1 0h1m2 0h2m1 0h5m4 0h1m4 0h1m-28 1h1m2 0h1m1 0h3m1 0h2m3 0h4m2 0h4m1 0h1m1 0h2m-28 1h1m3 0h1m3 0h1m1 0h2m1 0h1m1 0h1m3 0h3m2 0h1m2 0h1m-28 1h1m4 0h1m2 0h1m3 0h1m4 0h1m3 0h1m2 0h1m1 0h2m-28 1h1m2 0h1m6 0h2m3 0h3m1 0h1m4 0h1m1 0h1m-28 1h1m1 0h1m2 0h3m2 0h1m4 0h3m1 0h4m2 0h1m1 0h2m-28 1h3m5 0h5m2 0h1m3 0h1m1 0h1m2 0h2m1 0h1m-29 1h1m1 0h2m1 0h3m2 0h1m3 0h1m2 0h1m2 0h1m1 0h2m3 0h2m-28 1h1m1 0h1m1 0h1m3 0h1m2 0h3m2 0h1m1 0h4m1 0h2m1 0h1m-28 1h1m1 0h1m1 0h1m1 0h5m1 0h1m1 0h1m1 0h2m2 0h5m-17 1h1m3 0h1m1 0h1m1 0h2m1 0h2m3 0h1m1 0h3m-29 1h7m2 0h2m2 0h1m2 0h1m2 0h2m1 0h1m1 0h2m1 0h2m-29 1h1m5 0h1m4 0h2m3 0h2m2 0h1m3 0h2m1 0h2m-29 1h1m1 0h3m1 0h1m1 0h4m3 0h3m2 0h5m3 0h1m-29 1h1m1 0h3m1 0h1m4 0h2m6 0h2m2 0h2m1 0h3m-29 1h1m1 0h3m1 0h1m1 0h1m3 0h1m5 0h2m3 0h3m2 0h1m-29 1h1m5 0h1m4 0h3m1 0h1m1 0h4m3 0h1m2 0h1m-28 1h7m1 0h1m2 0h1m1 0h1m2 0h2m2 0h3m1 0h2m1 0h2"/></svg>';

  /* ---------- plans + signup form ---------- */
  var plansEl = $('#plans'), pickEl = $('#planPick'), form = $('#trialForm'), msg = $('#formMsg'), btn = $('#submitBtn');
  var CHECK = '<i class="ic" data-ic="check"></i>';
  fetch('/api/software/plans').then(function (r) { return r.json(); }).then(function (d) {
    $$('[data-trial]').forEach(function (e) { e.textContent = d.trialDays; });
    var term = 'monthly';
    function renderPlans() {
      var yearly = term === 'yearly';
      plansEl.innerHTML = d.plans.map(function (p) {
        var price = yearly ? p.yearly : p.price;
        return '<div class="plan' + (p.featured ? ' featured' : '') + '">' + (p.featured ? '<span class="tag">Most popular</span>' : '') +
          '<h3>' + esc(p.name) + '</h3><p class="bl">' + esc(p.blurb) + '</p>' +
          '<div class="price">₹' + price.toLocaleString('en-IN') + ' <small>/ ' + (yearly ? 'year' : 'month') + '</small></div>' +
          '<p class="bl" style="margin:-4px 0 12px;">' + (yearly ? '<b>2 months free</b> — just ₹' + Math.round(p.yearly / 12).toLocaleString('en-IN') + ' a month' : 'or <b>₹' + p.yearly.toLocaleString('en-IN') + ' / year</b> — 2 months free') + '</p><ul>' +
          p.features.map(function (f) { return '<li>' + CHECK + '<span>' + esc(f) + '</span></li>'; }).join('') +
          '</ul><a class="btn ' + (p.featured ? 'btn-navy' : 'btn-ghost') + '" href="#trial" data-pick="' + p.id + '">Start free trial</a></div>';
      }).join('');
      paint(plansEl);
    }
    renderPlans();
    $('#termTog').addEventListener('click', function (e) {
      var b = e.target.closest('[data-term]'); if (!b) return;
      term = b.dataset.term;
      $$('#termTog button').forEach(function (x) { x.classList.toggle('on', x === b); });
      renderPlans();
    });
    window.__dfTerm = function () { return term; };
    var want = new URLSearchParams(location.search).get('plan');
    pickEl.innerHTML = d.plans.map(function (p, i) {
      var on = want ? want === p.id : !!p.featured || (i === 0 && !d.plans.some(function (x) { return x.featured; }));
      return '<label><input type="radio" name="plan" value="' + p.id + '"' + (on ? ' checked' : '') + '><span>' + esc(p.name) + '<small>₹' + p.price.toLocaleString('en-IN') + ' / month or ₹' + p.yearly.toLocaleString('en-IN') + ' / year</small></span></label>';
    }).join('');
    paint();
    if (d.whatsapp) { $('#waLink').href = 'https://wa.me/' + d.whatsapp; $('#waLine').hidden = false; }
    plansEl.addEventListener('click', function (e) {
      var a = e.target.closest('[data-pick]'); if (!a) return;
      var r = pickEl.querySelector('input[value="' + a.dataset.pick + '"]'); if (r) r.checked = true;
    });
  }).catch(function () { plansEl.innerHTML = '<div class="plan"><p class="bl">Plans could not load. Please refresh, or send the form below and we will share the prices.</p></div>'; });

  form.addEventListener('submit', function (e) {
    e.preventDefault(); msg.textContent = '';
    var f = new FormData(form), body = {};
    f.forEach(function (v, k) { body[k] = v; });
    if (window.__dfTerm) body.term = window.__dfTerm();
    btn.disabled = true; btn.textContent = 'Sending…';
    fetch('/api/software/signup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
      .then(function (x) {
        if (!x.ok) { msg.textContent = x.j.error || 'Something went wrong. Please try again.'; btn.disabled = false; btn.textContent = 'Request free trial'; return; }
        form.hidden = true; $('#doneNum').textContent = body.phone; $('#doneBox').hidden = false; paint($('#doneBox'));
      })
      .catch(function () { msg.textContent = 'No connection. Please check your internet and try again.'; btn.disabled = false; btn.textContent = 'Request free trial'; });
  });

  /* ---------- demo video ---------- */
  var vid = $('#demoVideo'), vp = $('#vidPlay');
  function playDemo() { vp.classList.add('hide'); vid.setAttribute('controls', ''); var p = vid.play(); if (p && p.catch) p.catch(function () { vp.classList.remove('hide'); }); }
  vp.addEventListener('click', playDemo);
  vid.addEventListener('ended', function () { vid.removeAttribute('controls'); vp.classList.remove('hide'); vid.currentTime = 0; });
  $('#watchBtn').addEventListener('click', function () {
    $('#demo').scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' }); setTimeout(playDemo, reduce ? 0 : 450);
  });

  /* ---------- interactive customer phone ---------- */
  var scr = $('#pmScreen'), dsteps = $$('#dSteps button'), step = 0, touched = false, timer = null, inView = false;
  $('#camQr').innerHTML = QR;
  var st = { color: false, copies: 1, pages: 18 };
  function money(n) { return '₹' + n.toFixed(2); }
  function price() { var t = st.pages * (st.color ? 8 : 2) * st.copies; $('#pmTotal').textContent = money(t); $('#payAmt').textContent = money(t); $('#payBtnAmt').textContent = money(t); }
  function go(n) {
    step = n; scr.dataset.step = n;
    dsteps.forEach(function (b, i) { b.classList.toggle('on', i === n); b.classList.toggle('past', i < n); });
    if (n !== 3) $('#pmOk').classList.remove('show');
  }
  function tick() { if (touched || !inView || document.hidden || reduce) return; go((step + 1) % 4); }
  function startTimer() { if (!timer) timer = setInterval(tick, 3600); }
  dsteps.forEach(function (b) { b.addEventListener('click', function () { touched = true; go(+b.dataset.s); }); });
  $$('.pm-opts').forEach(function (g) {
    g.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return; touched = true;
      $$('button', g).forEach(function (x) { x.classList.toggle('on', x === b); });
      if (g.dataset.group === 'color') { st.color = b.dataset.v === 'color'; price(); }
    });
  });
  $('#cMinus').addEventListener('click', function () { touched = true; st.copies = Math.max(1, st.copies - 1); $('#cNum').textContent = st.copies; price(); });
  $('#cPlus').addEventListener('click', function () { touched = true; st.copies = Math.min(9, st.copies + 1); $('#cNum').textContent = st.copies; price(); });
  $('#pmPay').addEventListener('click', function () { touched = true; $('#pmOk').classList.add('show'); });
  go(0); price();
  if (reduce) { /* no autoplay: the visitor taps the steps */ }
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (es) { inView = es[0].isIntersecting; if (inView) startTimer(); }, { threshold: .35 }).observe($('.pm'));
  } else { inView = true; startTimer(); }

  /* ---------- live board loop ---------- */
  var bm = $('#boardMock'), Q = [], F = [], P = [['H2N58B', 'form.pdf · 4 pg'], ['W9C40D', 'photo.jpg · 1 pg']], base = { o: 8, p: 142, m: 980 }, cur = { o: 8, p: 142, m: 980 }, bTimers = [], bOn = false;
  function card(c, cls, extra) { return '<div class="jc ' + (cls || '') + '"><b>' + c[0] + '</b><span>' + c[1] + '</span>' + (extra || '') + '</div>'; }
  function drawBoard() {
    $('#colQ').innerHTML = Q.map(function (c) { return card(c, 'new'); }).join('');
    $('#colF').innerHTML = F.map(function (c) { return card(c, 'bad', '<em>Printer out of paper</em><u class="' + (c.hot ? 'hot' : '') + '">Retry print</u>'); }).join('');
    $('#colP').innerHTML = P.slice(0, 4).map(function (c) { return card(c); }).join('');
    $('#bmQ').textContent = Q.length; $('#bmF').textContent = F.length; $('#bmP').textContent = P.length;
    $('#bmOrders').textContent = cur.o; $('#bmPages').textContent = cur.p; $('#bmMoney').textContent = '₹' + cur.m.toLocaleString('en-IN');
  }
  function later(ms, fn) { bTimers.push(setTimeout(function () { if (bOn) fn(); }, ms)); }
  function cycle() {
    Q = []; F = []; P = [['H2N58B', 'form.pdf · 4 pg'], ['W9C40D', 'photo.jpg · 1 pg']]; cur = { o: base.o, p: base.p, m: base.m }; drawBoard();
    later(900, function () { Q = [['K4M92X', 'notes.pdf · 18 pg']]; bm.classList.add('ring'); drawBoard(); setTimeout(function () { bm.classList.remove('ring'); }, 1400); });
    later(3400, function () { P.unshift(Q[0]); Q = []; cur.o++; cur.p += 18; cur.m += 72; drawBoard(); });
    later(5200, function () { var c = ['R7T13Q', 'report.pdf · 6 pg']; F = [c]; drawBoard(); });
    later(7400, function () { F[0].hot = true; drawBoard(); });
    later(8200, function () { P.unshift(F[0]); F = []; cur.o++; cur.p += 6; cur.m += 36; drawBoard(); });
    later(11200, cycle);
  }
  function boardStop() { bOn = false; bTimers.forEach(clearTimeout); bTimers = []; }
  drawBoard();
  if (!reduce && 'IntersectionObserver' in window) {
    new IntersectionObserver(function (es) { if (es[0].isIntersecting) { if (!bOn) { bOn = true; cycle(); } } else boardStop(); }, { threshold: .3 }).observe(bm);
  }

  /* ---------- reveal on scroll ---------- */
  var rv = $$('.rv');
  if (reduce || !('IntersectionObserver' in window)) rv.forEach(function (e) { e.classList.add('in'); });
  else {
    var io = new IntersectionObserver(function (es) { es.forEach(function (x) { if (x.isIntersecting) { x.target.classList.add('in'); io.unobserve(x.target); } }); }, { threshold: .12, rootMargin: '0px 0px -6% 0px' });
    rv.forEach(function (e, i) { e.style.transitionDelay = (i % 3) * 70 + 'ms'; io.observe(e); });
  }

  /* ---------- sticky mobile call to action ---------- */
  var sticky = $('#stickyCta'), trial = $('#trial'), trialVisible = false;
  function stickyUpdate() { sticky.classList.toggle('show', window.scrollY > 520 && !trialVisible); }
  if ('IntersectionObserver' in window) new IntersectionObserver(function (es) { trialVisible = es[0].isIntersecting; stickyUpdate(); }).observe(trial);
  window.addEventListener('scroll', stickyUpdate, { passive: true });

  paint();
})();
