// DocuFast ad: every frame is a pure function of time, so frames can be captured one by one.
(() => {
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const E = { lin: x => x, out: x => 1 - Math.pow(1 - x, 3), in: x => x * x * x, io: x => x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2,
  expo: x => x >= 1 ? 1 : 1 - Math.pow(2, -10 * x), inexpo: x => x <= 0 ? 0 : Math.pow(2, 10 * x - 10),
  back: x => { const c = 1.70158, d = c + 1; return 1 + d * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); },
  elastic: x => x === 0 || x === 1 ? x : Math.pow(2, -10 * x) * Math.sin((x * 10 - .75) * (2 * Math.PI) / 3) + 1 };
const P = (t, a, b, e = E.out) => e(clamp((t - a) / (b - a)));
const L = (a, b, u) => a + (b - a) * u;
const R = seed => () => (seed = (seed * 16807) % 2147483647, (seed - 1) / 2147483646);
const NAVY = '#0B2559', DEEP = '#0B1B3F', GOLD = '#FFA800', GOLDD = '#E39600';
function put(el, o = {}) {
  const { x = 0, y = 0, s = 1, sx = s, sy = s, r = 0, o: op = 1, b = 0 } = o;
  el.style.transform = (el.dataset.c ? 'translate(-50%,-50%) ' : '') + `translate(${x}px,${y}px) rotate(${r}deg) scale(${sx},${sy})`;
  el.style.opacity = op; el.style.filter = b > .25 ? `blur(${b}px)` : 'none';
}
function mk(parent, css, html = '', cls = '') { const d = document.createElement('div'); d.className = 'abs ' + cls; d.style.cssText = css; d.innerHTML = html; parent.appendChild(d); return d; }
const C = (parent, css, html, cls) => { const d = mk(parent, css, html, cls); d.dataset.c = 1; return d; };
const fmt = n => '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const IC = {
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  bell: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/></svg>',
  printer: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 9V3.5h10V9"/><rect x="3.5" y="9" width="17" height="8" rx="2"/><path d="M7 14h10v6.5H7z"/></svg>',
  upload: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 16V4M7 9l5-5 5 5"/><path d="M4.5 15v4.5h15V15"/></svg>',
  qr: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="3.5" width="7" height="7" rx="1"/><rect x="13.5" y="3.5" width="7" height="7" rx="1"/><rect x="3.5" y="13.5" width="7" height="7" rx="1"/><path d="M14 14h2.5v2.5M20.5 14v.01M14 20.5h.01M17 20.5h3.5V18"/></svg>',
  shield: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l8 3v6c0 4.6-3.2 8.2-8 9.5C7.2 20.2 4 16.6 4 12V6z"/><path d="M8.5 12l2.5 2.5 4.5-5"/></svg>',
  file: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4M9 12h6M9 16h6"/></svg>',
  usb: '<svg viewBox="0 0 120 56" width="150"><rect x="4" y="12" width="70" height="32" rx="6" fill="#cfd6e6"/><rect x="74" y="16" width="40" height="24" rx="3" fill="#8b94a8"/><rect x="82" y="22" width="8" height="5" fill="#222"/><rect x="82" y="30" width="8" height="5" fill="#222"/><circle cx="22" cy="28" r="5" fill="#e5484d"/></svg>',
};
const SHOP = 'Sai Xerox & Prints';
const BRAND = '<img src="/brand.png" style="display:block;width:100%;height:auto">';

// ---------- shared pieces ----------
function phone(parent, x, y, w = 440, h = 900) {
  const ph = mk(parent, `left:${x - w / 2}px;top:${y - h / 2}px;width:${w}px;height:${h}px;border-radius:72px;background:#0b1b3f;box-shadow:0 70px 130px rgba(11,27,63,.38),inset 0 0 0 4px #24386f`);
  const scr = mk(ph, `left:14px;top:14px;width:${w - 28}px;height:${h - 28}px;border-radius:60px;overflow:hidden;background:#fff`);
  mk(ph, `left:${w / 2 - 62}px;top:30px;width:124px;height:36px;border-radius:20px;background:#0b1b3f;z-index:9`);
  return { ph, scr, w: w - 28, h: h - 28 };
}
const camHTML = (w, h) => `<div class="abs" style="left:0;top:0;width:${w}px;height:${h}px;background:radial-gradient(circle at 50% 40%,#1b2a4d,#0b1224)"></div>
  <div class="abs" style="left:0;top:92px;width:${w}px;text-align:center;font-size:30px;font-weight:700;color:#cbd5e1">Scan to order</div>
  <div class="abs" data-c="1" style="left:${w / 2}px;top:${h / 2 - 10}px;width:262px;height:262px;border-radius:30px;background:#fff;padding:22px">${window.QR_SHOP.replace('<svg ', '<svg width="218" height="218" ')}</div>`;
const brackets = (parent, cx, cy, size, col) => {
  const g = C(parent, `left:${cx}px;top:${cy}px;width:${size}px;height:${size}px`);
  const parts = [[0, 0, 'top:0;left:0;border-top:10px solid;border-left:10px solid;border-top-left-radius:34px'], [0, 0, 'top:0;right:0;border-top:10px solid;border-right:10px solid;border-top-right-radius:34px'],
    [0, 0, 'bottom:0;left:0;border-bottom:10px solid;border-left:10px solid;border-bottom-left-radius:34px'], [0, 0, 'bottom:0;right:0;border-bottom:10px solid;border-right:10px solid;border-bottom-right-radius:34px']];
  const els = parts.map(p => { const d = document.createElement('div'); d.style.cssText = `position:absolute;width:64px;height:64px;${p[2]}`; g.appendChild(d); return d; });
  return { g, set(col) { els.forEach(e => e.style.borderColor = col); } };
};
const stageEl = document.getElementById('stage'), scenesEl = document.getElementById('scenes'), fx = document.getElementById('fx');

// ---------- SCENE 1: the chaos ----------
const S1 = { start: 0, end: 4, build(r) {
  r.style.background = 'radial-gradient(1300px 900px at 72% 38%,#1a3a86 0%,#0B1B3F 58%,#060d22 100%)';
  const rnd = R(42), say = ['Sir, please print this', 'Resume_final_2.pdf', 'Aadhaar copy pls', 'Bluetooth?', 'pen drive pls', 'one colour copy', 'send on WhatsApp', 'urgent urgent!!', 'how long sir?'];
  this.fl = [];
  for (let i = 0; i < 30; i++) {
    const type = ['chat', 'pdf', 'usb', 'chat', 'img'][i % 5], sc = .55 + rnd() * 1.15;
    const html = type === 'chat' ? `<div class="bub">${say[i % say.length]}</div>` : type === 'pdf' ? `<div class="pdfc"><b>PDF</b><i></i><i></i><i style="width:70%"></i><i></i></div>` : type === 'usb' ? IC.usb.replace('width="150"', 'width="240"') : '<div class="imgc"></div>';
    this.fl.push({ el: mk(r, 'left:0;top:0', html), x0: rnd() * 2700, y: 40 + rnd() * 940, v: 60 + rnd() * 240 * sc, rot: (rnd() - .5) * 34, sc, blur: sc > 1.35 ? 6 : sc < .75 ? 3 : 0, op: .22 + rnd() * .5 });
  }
  const spec = [['QUEUES.', '#fff', 0, 250], ['WHATSAPP FILES.', GOLD, 1, 470], ['PEN DRIVES.', '#fff', 2, 690]];
  this.lines = spec.map(([txt, col, t0, y]) => ({ t0, el: mk(r, `left:130px;top:${y}px;font-size:210px;color:${col};text-shadow:0 14px 46px rgba(0,0,0,.5)`, txt, 'big'),
    strike: mk(r, `left:120px;top:${y + 104}px;height:26px;width:10px;background:#ff4d4d;border-radius:8px;transform-origin:0 50%;box-shadow:0 0 30px rgba(255,77,77,.6)`) }));
}, draw(t) {
  this.fl.forEach(f => { const x = ((f.x0 - f.v * t) % 2700 + 2700) % 2700 - 380; put(f.el, { x, y: f.y + Math.sin(t * 2 + f.x0) * 14, s: f.sc, r: f.rot + t * 3 * (f.sc - 1), o: f.op * P(t, 0, .4), b: f.blur }); });
  this.lines.forEach((l, i) => {
    const u = P(t, l.t0, l.t0 + .3, E.back), a = P(t, l.t0, l.t0 + .06, E.lin);
    const jit = t > 3.1 && t < 3.55 ? (Math.sin(t * 160 + i) * 14) : 0;
    put(l.el, { x: L(-60, 0, u) + jit, s: L(1.7, 1, u), o: a, b: (1 - P(t, l.t0, l.t0 + .18)) * 14 });
    l.strike.style.width = (l.el.offsetWidth + 20) + 'px';
    put(l.strike, { sx: P(t, 3.0 + i * .13, 3.28 + i * .13, E.out), o: t > 3 + i * .13 ? 1 : 0 });
  });
} };

// ---------- SCENE 2: what if ----------
const S2 = { start: 4, end: 8, build(r) {
  r.style.background = GOLD;
  this.cam = mk(r, 'left:0;top:0;width:1920px;height:1080px;transform-origin:960px 540px');
  const spec = [['WHAT IF', 120, NAVY, 4.3], ['YOUR CUSTOMERS', 320, NAVY, 4.75], ['DID ALL OF IT', 520, NAVY, 5.2]];
  this.words = spec.map(([txt, y, col, t0]) => { const wrap = mk(this.cam, `left:110px;top:${y}px;width:1800px;height:200px;overflow:hidden`); const inn = mk(wrap, `left:0;top:0;font-size:190px;color:${col}`, txt, 'big'); return { wrap, inn, t0 }; });
  this.pill = mk(this.cam, 'left:110px;top:740px;padding:0 54px;height:210px;background:#0B1B3F;border-radius:44px;display:flex;align-items:center;font-size:170px;color:#fff;box-shadow:0 30px 60px rgba(11,27,63,.35)', 'THEMSELVES?', 'big');
  const p = phone(this.cam, 960, 540, 470, 930); this.phone = p.ph; p.scr.innerHTML = camHTML(p.w, p.h);
  this.br = brackets(p.scr, p.w / 2, p.h / 2 - 10, 330); this.br.set(GOLD);
  this.scan = mk(p.scr, `left:${p.w / 2 - 150}px;top:0;width:300px;height:6px;background:${GOLD};border-radius:4px;box-shadow:0 0 24px ${GOLD}`);
  this.zoomAnchor = this.cam;
}, draw(t) {
  this.words.forEach(w => { const u = P(t, w.t0, w.t0 + .38, E.out); put(w.inn, { y: (1 - u) * 210 }); });
  const exit = P(t, 6.35, 6.85, E.in);
  this.words.forEach(w => put(w.wrap, { x: -1700 * exit, o: 1 }));
  const pu = P(t, 5.75, 6.15, E.back); put(this.pill, { x: -1700 * exit, s: L(.4, 1, pu), o: P(t, 5.75, 5.85, E.lin) });
  const rise = P(t, 6.55, 7.15, E.back); put(this.phone, { y: L(1300, 0, rise), r: L(-8, 0, rise) });
  put(this.scan, { y: 140 + ((t * 2.2) % 1) * 640, o: P(t, 6.8, 7, E.lin) });
  const z = P(t, 7.15, 8.0, E.in); this.cam.style.transform = `scale(${1 + 17 * z})`;
} };

// ---------- SCENE 3: the drop ----------
const S3 = { start: 8, end: 12, build(r) {
  r.style.background = '#fff';
  this.ring = C(r, `left:960px;top:400px;width:200px;height:200px;border-radius:50%;border:16px solid ${GOLD}`);
  this.ring2 = C(r, `left:960px;top:400px;width:200px;height:200px;border-radius:50%;border:8px solid ${NAVY}`);
  this.logo = C(r, 'left:960px;top:400px;width:900px', BRAND);
  this.tag = C(r, `left:960px;top:575px;font-size:50px;font-weight:700;color:${NAVY};letter-spacing:.02em;white-space:nowrap`, 'Documents Made Easy, Delivered To You');
  const rnd = R(7); this.conf = [];
  for (let i = 0; i < 44; i++) { const a = rnd() * Math.PI * 2, v = 500 + rnd() * 1100; this.conf.push({ el: C(r, `left:960px;top:400px;width:${14 + rnd() * 22}px;height:${14 + rnd() * 22}px;background:${[GOLD, NAVY, '#FFD36B', '#2563eb'][i % 4]};border-radius:${i % 3 ? '3px' : '50%'}`), vx: Math.cos(a) * v, vy: Math.sin(a) * v - 250, rot: rnd() * 720 }); }
  const tiles = [['qr', 'SCAN'], ['upload', 'UPLOAD'], ['rs', 'PAY'], ['printer', 'PRINT']];
  this.tiles = tiles.map(([ic, txt], i) => {
    const el = C(r, `left:${300 + i * 440}px;top:790px;width:400px;height:360px;border-radius:44px;background:${NAVY};box-shadow:0 30px 60px rgba(11,37,89,.35)`, '');
    mk(el, `left:${200 - 70}px;top:40px;width:140px;height:140px;border-radius:50%;background:${GOLD};color:${NAVY};display:flex;align-items:center;justify-content:center;font-size:84px;font-weight:900`, ic === 'rs' ? '₹' : `<div style="width:76px;height:76px">${IC[ic]}</div>`);
    mk(el, 'left:0;top:215px;width:400px;text-align:center;font-size:76px;font-weight:900;letter-spacing:-.02em', txt);
    mk(el, `left:24px;top:22px;font-size:34px;font-weight:800;color:${GOLD}`, '0' + (i + 1));
    return el;
  });
}, draw(t, lt) {
  const slam = P(t, 8.0, 8.4, E.expo);
  const mv = P(t, 9.65, 10.05, E.io);
  put(this.logo, { y: L(0, -215, mv), s: L(2.4, 1, slam) * L(1, .62, mv), o: P(t, 8.0, 8.03, E.lin) * (1 - 0) });
  const r1 = P(t, 8.0, 8.9, E.out), r2 = P(t, 8.08, 9.2, E.out);
  put(this.ring, { s: L(.4, 14, r1), o: (1 - r1) * .9 }); put(this.ring2, { s: L(.4, 18, r2), o: (1 - r2) * .8 });
  const dt = Math.max(0, t - 8.0);
  this.conf.forEach(c => put(c.el, { x: c.vx * dt * Math.pow(.2, dt * .25), y: c.vy * dt + 1300 * dt * dt, r: c.rot * dt, o: t < 8 ? 0 : clamp(1.6 - dt * 1.2) }));
  put(this.tag, { y: 0, o: P(t, 8.85, 9.2) * (1 - mv * .0) , s: 1 });
  this.tag.style.top = (575 - 215 * mv) + 'px';
  this.tiles.forEach((tile, i) => { const t0 = 10.0 + i * .5; const u = P(t, t0, t0 + .32, E.back); put(tile, { y: L(900, 0, u) - 330 * 0 , s: L(.5, 1, u) * (1 + .03 * mv * 0), o: P(t, t0, t0 + .06, E.lin), b: (1 - P(t, t0, t0 + .2)) * 10 }); tile.style.top = '790px'; });
  this.tiles.forEach((tile, i) => { const t0 = 10.0 + i * .5; const u = P(t, t0, t0 + .32, E.back); put(tile, { y: -150 + L(520, 0, u), s: L(.55, 1, u), o: P(t, t0, t0 + .06, E.lin), b: (1 - P(t, t0, t0 + .2)) * 10 }); });
} };

// ---------- SCENE 4: customer flow ----------
const S4 = { start: 12, end: 20, build(r) {
  r.style.background = '#EEF2FA';
  C(r, `left:1650px;top:980px;width:1100px;height:1100px;border-radius:50%;background:${GOLD};opacity:.2`, '');
  C(r, `left:100px;top:60px;width:900px;height:900px;border-radius:50%;background:${NAVY};opacity:.05`, '');
  const p = phone(r, 560, 545, 470, 930); this.phone = p.ph; this.scr = p.scr; const W = p.w, H = p.h;
  this.track = mk(p.scr, `left:0;top:0;width:${W * 3}px;height:${H}px`);
  // screen 1: camera
  const s1 = mk(this.track, `left:0;top:0;width:${W}px;height:${H}px;overflow:hidden`, camHTML(W, H));
  this.br = brackets(s1, W / 2, H / 2 - 10, 330); this.br.set(GOLD);
  this.scan = mk(s1, `left:${W / 2 - 150}px;top:0;width:300px;height:6px;background:${GOLD};border-radius:4px;box-shadow:0 0 24px ${GOLD}`);
  this.flash = mk(s1, `left:0;top:0;width:${W}px;height:${H}px;background:#fff`);
  this.found = mk(s1, `left:${W / 2 - 190}px;top:150px;width:380px;height:92px;border-radius:46px;background:#fff;display:flex;align-items:center;gap:16px;padding:0 24px;font-size:27px;font-weight:800;color:#0b1b3f;box-shadow:0 20px 40px rgba(0,0,0,.35)`,
    `<span style="width:46px;height:46px;border-radius:50%;background:#15803D;color:#fff;display:flex;align-items:center;justify-content:center;padding:9px">${IC.check}</span>${SHOP}`);
  // screen 2: upload
  const s2 = mk(this.track, `left:${W}px;top:0;width:${W}px;height:${H}px;background:#f6f7f9`);
  mk(s2, `left:0;top:0;width:${W}px;height:150px;background:#fff;border-bottom:1px solid #e6e8ee`); mk(s2, 'left:30px;top:84px;width:170px', BRAND);
  mk(s2, 'left:30px;top:178px;font-size:44px;font-weight:900;color:#0b1b3f', 'Upload your file');
  mk(s2, `left:30px;top:250px;width:${W - 60}px;height:380px;border:5px dashed #b8c1d6;border-radius:34px;background:#fff`);
  mk(s2, `left:30px;top:410px;width:${W - 60}px;text-align:center;font-size:30px;font-weight:700;color:#8b92a3`, 'Tap to choose a file');
  this.chip = mk(s2, `left:54px;top:300px;width:${W - 108}px;height:160px;background:#fff;border-radius:24px;box-shadow:0 20px 44px rgba(11,27,63,.22);border:2px solid #e6e8ee;padding:22px`,
    `<div style="display:flex;gap:18px;align-items:center"><div style="width:64px;height:76px;border-radius:12px;background:#e5484d;color:#fff;font-weight:900;font-size:22px;display:flex;align-items:center;justify-content:center">PDF</div><div><div style="font-size:30px;font-weight:800;color:#0b1b3f">Assignment.pdf</div><div style="font-size:23px;color:#5e6678;margin-top:2px">1.2 MB</div></div></div>`);
  this.bar = mk(this.chip, 'left:22px;bottom:18px;height:12px;width:10px;border-radius:6px;background:#FFA800');
  this.det = mk(s2, `left:54px;top:520px;height:70px;border-radius:35px;background:#E8F5EC;color:#15803D;display:flex;align-items:center;gap:12px;padding:0 26px;font-size:28px;font-weight:800`, `<span style="width:34px;height:34px;display:block">${IC.check}</span>12 pages detected`);
  // screen 3: options + price
  const s3 = mk(this.track, `left:${W * 2}px;top:0;width:${W}px;height:${H}px;background:#f6f7f9`);
  mk(s3, `left:0;top:0;width:${W}px;height:150px;background:#fff;border-bottom:1px solid #e6e8ee`); mk(s3, 'left:30px;top:84px;width:170px', BRAND);
  mk(s3, 'left:30px;top:178px;font-size:44px;font-weight:900;color:#0b1b3f', 'Print options');
  const seg = (y, a, b) => { mk(s3, `left:30px;top:${y}px;font-size:24px;font-weight:700;color:#5e6678`, a[0]); const bg = mk(s3, `left:30px;top:${y + 38}px;width:${W - 60}px;height:84px;background:#e6e9f1;border-radius:22px`); const sel = mk(bg, `left:6px;top:6px;width:${(W - 60) / 2 - 6}px;height:72px;background:#0b1b3f;border-radius:17px`);
    mk(bg, `left:0;top:0;width:${(W - 60) / 2}px;height:84px;display:flex;align-items:center;justify-content:center;font-size:28px;font-weight:800;color:#fff;z-index:2`, a[1]); const o = mk(bg, `left:${(W - 60) / 2}px;top:0;width:${(W - 60) / 2}px;height:84px;display:flex;align-items:center;justify-content:center;font-size:28px;font-weight:800;color:#0b1b3f;z-index:2`, b); return { sel, w: (W - 60) / 2, aEl: bg.children[1], bEl: o }; };
  this.segColour = seg(240, ['COLOUR', 'Black & white'], 'Colour');
  mk(s3, 'left:30px;top:410px;font-size:24px;font-weight:700;color:#5e6678', 'COPIES');
  mk(s3, `left:30px;top:448px;width:${W - 60}px;height:84px;background:#fff;border:2px solid #e6e8ee;border-radius:22px`);
  mk(s3, 'left:60px;top:462px;font-size:44px;font-weight:700;color:#0b1b3f', '–'); mk(s3, `left:${W - 90}px;top:462px;font-size:44px;font-weight:700;color:#0b1b3f`, '+');
  this.copies = mk(s3, `left:30px;top:458px;width:${W - 60}px;text-align:center;font-size:48px;font-weight:900;color:#0b1b3f`, '1');
  this.segSides = seg(560, ['SIDES', 'Single-sided'], 'Double-sided');
  this.total = mk(s3, `left:0;top:${H - 190}px;width:${W}px;height:190px;background:#0b1b3f;border-radius:36px 36px 0 0;padding:34px 36px;color:#fff`, `<div style="font-size:26px;opacity:.7;font-weight:600">Your price</div><div id="tot" style="font-size:78px;font-weight:900;font-variant-numeric:tabular-nums;margin-top:2px">₹24.00</div>`);
  this.totEl = this.total.querySelector('#tot');
  // pay sheet
  this.pay = mk(p.scr, `left:0;top:${H}px;width:${W}px;height:640px;background:#fff;border-radius:48px 48px 0 0;box-shadow:0 -30px 60px rgba(0,0,0,.28);z-index:6`);
  mk(this.pay, 'left:30px;top:36px;font-size:30px;font-weight:700;color:#5e6678', 'Pay securely');
  mk(this.pay, 'left:30px;top:76px;font-size:96px;font-weight:900;color:#0b1b3f', '₹36.00');
  [['#4f46e5', 'UPI'], ['#0ea5e9', 'UPI'], ['#16a34a', 'UPI']].forEach((a, i) => mk(this.pay, `left:${30 + i * 130}px;top:230px;width:110px;height:110px;border-radius:30px;background:${a[0]};color:#fff;display:flex;align-items:center;justify-content:center;font-size:30px;font-weight:900`, a[1]));
  this.btn = mk(this.pay, `left:30px;top:400px;width:${W - 60}px;height:110px;border-radius:30px;background:${GOLD};color:#0b1b3f;display:flex;align-items:center;justify-content:center;font-size:42px;font-weight:900`, 'Pay ₹36.00');
  this.ok = mk(p.scr, `left:0;top:0;width:${W}px;height:${H}px;background:#fff;z-index:8`);
  this.okRing = C(this.ok, `left:${W / 2}px;top:${H / 2 - 120}px;width:200px;height:200px;border-radius:50%;border:14px solid #15803D`);
  this.okBall = C(this.ok, `left:${W / 2}px;top:${H / 2 - 120}px;width:220px;height:220px;border-radius:50%;background:#15803D;color:#fff;padding:52px`, IC.check);
  mk(this.ok, `left:0;top:${H / 2 + 20}px;width:${W}px;text-align:center;font-size:50px;font-weight:900;color:#0b1b3f`, 'Payment successful');
  mk(this.ok, `left:0;top:${H / 2 + 95}px;width:${W}px;text-align:center;font-size:30px;font-weight:600;color:#5e6678`, 'Order code  <b class="mono" style="color:#0b1b3f">K4M92X</b>');
  // right-hand captions
  const caps = [['01', 'SCAN', 'your shop’s QR', 12.2], ['02', 'UPLOAD', 'any file', 14.2], ['03', 'SEE THE', 'exact price', 16.2], ['04', 'PAY', 'by UPI', 18.2]];
  this.caps = caps.map(([n, a, b, t0]) => { const g = mk(r, 'left:1050px;top:210px;width:800px;height:600px', ''); mk(g, `left:0;top:0;font-size:150px;font-weight:900;color:${GOLD};letter-spacing:-.03em`, n); mk(g, `left:0;top:170px;font-size:190px;font-weight:900;color:${NAVY};letter-spacing:-.04em;white-space:nowrap`, a); mk(g, `left:0;top:370px;font-size:96px;font-weight:700;color:#475569;white-space:nowrap`, b); return { g, t0 }; });
  this.nocash = mk(r, `left:1050px;top:770px;padding:0 40px;height:130px;border-radius:30px;background:${NAVY};color:#fff;display:flex;align-items:center;font-size:62px;font-weight:900;letter-spacing:-.02em;white-space:nowrap;box-shadow:0 24px 50px rgba(11,37,89,.3)`, 'NO CASH. NO CHANGE.');
  this.dots = [0, 1, 2, 3].map(i => mk(r, `left:${1050 + i * 70}px;top:130px;width:50px;height:10px;border-radius:5px;background:#c4cbdd`));
  mk(r, 'left:40px;top:1030px;font-size:20px;color:#64748b;font-weight:600', 'Illustrative screens, sample data');
}, draw(t) {
  const W = this.track.parentElement.clientWidth;
  put(this.phone, { y: L(900, 0, P(t, 12.15, 12.65, E.back)), r: L(6, 0, P(t, 12.15, 12.7)) });
  // camera: scan line, lock-on, flash
  put(this.scan, { y: 140 + (((t - 12.4) * 1.3) % 1) * 640, o: t > 12.4 && t < 13.2 ? 1 : 0 });
  const lock = P(t, 13.2, 13.4, E.back); this.br.set(t >= 13.2 ? '#22c55e' : GOLD); this.br.g.style.transform = `translate(-50%,-50%) scale(${L(1, .9, lock)})`;
  put(this.flash, { o: 1 - P(t, 13.2, 13.42, E.lin) });
  put(this.found, { y: L(-150, 0, P(t, 13.3, 13.65, E.back)), o: P(t, 13.3, 13.35, E.lin) });
  // track slides
  const k1 = P(t, 13.85, 14.3, E.io), k2 = P(t, 15.85, 16.3, E.io);
  this.track.style.transform = `translateX(${-W * (k1 + k2)}px)`;
  // upload
  put(this.chip, { y: L(-380, 0, P(t, 14.35, 14.8, E.back)), o: P(t, 14.35, 14.4, E.lin) });
  this.bar.style.width = L(10, 300, P(t, 14.8, 15.5, E.io)) + 'px';
  put(this.det, { s: L(.6, 1, P(t, 15.45, 15.7, E.back)), o: P(t, 15.45, 15.55, E.lin) });
  // options: 16.5 base, 16.75 copies, 17.25 double-sided
  const c2 = t >= 16.75, ds = t >= 17.25;
  this.copies.textContent = c2 ? '2' : '1';
  const sg = (seg, on, a, b) => { seg.sel.style.transform = `translateX(${on ? seg.w : 0}px)`; seg.aEl.style.color = on ? '#0b1b3f' : '#fff'; seg.bEl.style.color = on ? '#fff' : '#0b1b3f'; seg.aEl.textContent = a; };
  sg(this.segSides, ds, 'Single-sided');
  const price = ds ? 36 : c2 ? 48 : 24; this.totEl.textContent = fmt(price);
  const pulse = t > 17.25 ? 1 + .1 * Math.exp(-(t - 17.25) * 9) * Math.sin((t - 17.25) * 40) : (t > 16.75 ? 1 + .08 * Math.exp(-(t - 16.75) * 9) : 1);
  this.totEl.style.transform = `scale(${pulse})`; this.totEl.style.transformOrigin = '0 50%';
  // pay sheet
  put(this.pay, { y: -640 * P(t, 18.1, 18.6, E.out) });
  put(this.btn, { s: t > 18.85 && t < 19.0 ? .95 : 1 });
  const okU = P(t, 19.05, 19.3, E.lin); put(this.ok, { o: okU }); this.ok.style.display = t < 19.05 ? 'none' : 'block';
  put(this.okBall, { s: L(.2, 1, P(t, 19.1, 19.5, E.back)) }); put(this.okRing, { s: L(.5, 2.4, P(t, 19.1, 19.9)), o: 1 - P(t, 19.1, 19.6) });
  // captions
  this.caps.forEach((c, i) => { const inn = P(t, c.t0, c.t0 + .45, E.out), out = i < 3 ? P(t, c.t0 + 1.75, c.t0 + 2.05, E.in) : 0;
    put(c.g, { x: L(700, 0, inn) - 700 * out, o: (P(t, c.t0, c.t0 + .1, E.lin)) * (1 - out), b: (1 - inn) * 14 }); });
  put(this.nocash, { x: L(700, 0, P(t, 19.55, 19.85, E.back)), o: P(t, 19.55, 19.6, E.lin) });
  this.dots.forEach((d, i) => { d.style.background = t >= this.caps[i].t0 ? GOLD : '#c4cbdd'; d.style.width = (t >= this.caps[i].t0 ? 110 : 50) + 'px'; });
} };

// ---------- SCENE 5: the shop ----------
const S5 = { start: 20, end: 28, build(r) {
  r.style.background = 'radial-gradient(1500px 1000px at 35% 40%,#16357A,#0B1B3F 60%,#070f26)';
  this.mon = mk(r, 'left:90px;top:170px;width:1200px;height:760px;border-radius:38px;background:#0f172a;box-shadow:0 60px 120px rgba(0,0,0,.5)');
  mk(r, 'left:610px;top:925px;width:160px;height:90px;background:linear-gradient(#27324d,#1a2238)'); mk(r, 'left:480px;top:1000px;width:420px;height:30px;border-radius:15px;background:#1f2a44');
  const scr = mk(this.mon, 'left:22px;top:22px;width:1156px;height:716px;border-radius:18px;background:#fff;overflow:hidden');
  mk(scr, 'left:0;top:0;width:1156px;height:62px;background:#fff;border-bottom:1px solid #e6e8ee'); mk(scr, 'left:24px;top:14px;width:150px', BRAND);
  mk(scr, `left:700px;top:12px;font-size:22px;font-weight:700;color:#5e6678;line-height:38px`, `${SHOP}`);
  mk(scr, 'left:1000px;top:14px;height:34px;padding:0 16px;border-radius:17px;background:#E8F5EC;color:#15803D;font-size:18px;font-weight:700;line-height:34px', '● Printer online');
  this.kp = [['Orders today', '8', 24], ['Pages printed', '142', 300], ['Collected today', fmt(980), 576], ['Waiting to print', '0', 852]].map(([a, b, x]) => { const k = mk(scr, `left:${x}px;top:82px;width:280px;height:104px`, `<div class="kpi" style="height:104px"><small>${a}</small><b>${b}</b></div>`, ''); return k.querySelector('b'); });
  this.colEls = [['To print', 24], ['Needs attention', 404], ['Printed', 784]].map(([a, x]) => mk(scr, `left:${x}px;top:210px;width:350px;height:480px`, `<div class="col" style="height:480px"><h6><span>${a}</span><b>0</b></h6></div>`));
  this.cnt = this.colEls.map(c => c.querySelector('b'));
  const done = ['H2N58B', 'W9C40D'];
  done.forEach((c, i) => mk(this.colEls[2], `left:14px;top:${56 + i * 118}px;width:322px;height:102px`, `<div class="jc"><div class="code">${c}</div><div class="m">form.pdf · 4 pg · ₹12.00</div></div>`));
  this.cnt[2].textContent = '2';
  this.card = mk(this.colEls[0], 'left:14px;top:56px;width:322px;height:132px', `<div class="jc" style="border-color:#FFA800;box-shadow:0 0 0 6px rgba(255,168,0,.28)"><div class="code">K4M92X</div><div class="m">Assignment.pdf · 12 pg · ×2 · ₹36.00</div><div id="prg" style="margin-top:10px;height:10px;border-radius:5px;background:#e6e8ee;overflow:hidden"><div id="prb" style="height:10px;width:0;background:#15803D"></div></div></div>`);
  this.prb = this.card.querySelector('#prb');
  this.card2 = mk(this.colEls[2], 'left:14px;top:56px;width:322px;height:102px', `<div class="jc" style="border-color:#15803D"><div class="code">K4M92X</div><div class="m">Assignment.pdf · 12 pg · ₹36.00</div></div>`);
  this.stamp = C(scr, 'left:200px;top:340px;padding:6px 26px;border:8px solid #15803D;border-radius:18px;color:#15803D;font-size:60px;font-weight:900;letter-spacing:.06em;background:rgba(255,255,255,.85)', 'PRINTED');
  // notification
  this.note = C(r, 'left:690px;top:100px;width:820px;height:150px;border-radius:30px;background:#fff;color:#0b1b3f;box-shadow:0 40px 80px rgba(0,0,0,.45);z-index:20', `<div style="position:absolute;left:0;top:0;width:18px;height:150px;border-radius:30px 0 0 30px;background:#FFA800"></div><div style="position:absolute;left:50px;top:34px;width:82px;height:82px;border-radius:24px;background:#FFF6E0;color:#E39600;padding:18px">${IC.bell}</div><div style="position:absolute;left:158px;top:26px;font-size:46px;font-weight:900">New paid order</div><div style="position:absolute;left:158px;top:84px;font-size:32px;font-weight:600;color:#5e6678"><span class="mono" style="color:#0b1b3f">K4M92X</span> &nbsp;·&nbsp; ₹36.00 &nbsp;·&nbsp; UPI</div>`);
  // printer
  this.prn = mk(r, 'left:1370px;top:420px;width:470px;height:420px');
  this.sheets = [0, 1, 2, 3, 4, 5].map(i => { const s = mk(this.prn, `left:80px;top:150px;width:310px;height:230px;background:#fff;border-radius:6px;border:2px solid #d9dfec;box-shadow:0 8px 20px rgba(0,0,0,.25);padding:26px`, '<i style="display:block;height:12px;background:#c9d1e3;border-radius:6px;margin:0 0 14px"></i>'.repeat(5)); return s; });
  mk(this.prn, 'left:0;top:60px;width:470px;height:210px;border-radius:34px;background:linear-gradient(#f1f4fb,#d4dbea);box-shadow:0 30px 60px rgba(0,0,0,.45)');
  mk(this.prn, 'left:30px;top:20px;width:410px;height:70px;border-radius:24px 24px 0 0;background:#bcc6dc');
  mk(this.prn, 'left:60px;top:170px;width:350px;height:20px;border-radius:10px;background:#1a2238');
  this.led = mk(this.prn, 'left:400px;top:110px;width:20px;height:20px;border-radius:50%;background:#22c55e');
  mk(this.prn, 'left:0;top:268px;width:470px;height:26px;border-radius:0 0 18px 18px;background:#aab5cd');
  this.pl = mk(r, `left:1370px;top:360px;width:470px;text-align:center;font-size:40px;font-weight:800;color:${GOLD}`, 'PRINTING…');
  this.wire = mk(r, 'left:1290px;top:546px;height:8px;width:90px;border-radius:4px;background:repeating-linear-gradient(90deg,#FFA800 0 16px,transparent 16px 30px)');
  this.low = mk(r, 'left:0;top:900px;width:1920px;text-align:center;font-size:84px;font-weight:900;color:#fff;letter-spacing:-.02em', 'NOTHING TO FORWARD.<span style="color:#FFA800"> NOTHING TO OPEN.</span>');
  mk(r, 'left:40px;top:1030px;font-size:20px;color:#8ea0c4;font-weight:600', 'Illustrative screens, sample data');
}, draw(t) {
  const mu = P(t, 20.25, 20.75, E.back); put(this.mon, { y: L(260, 0, mu), s: L(.9, 1, mu), o: P(t, 20.25, 20.35, E.lin) });
  const nd = P(t, 20.35, 20.7, E.back), nx = P(t, 21.3, 21.65, E.in); put(this.note, { y: L(-260, 0, nd) - 60 * nx, s: 1 - .5 * nx, x: -300 * nx, o: P(t, 20.35, 20.4, E.lin) * (1 - nx) });
  const cu = P(t, 21.5, 21.85, E.back); const moved = t >= 27.45;
  put(this.card, { s: L(.5, 1, cu), o: P(t, 21.5, 21.55, E.lin) * (t < 27.45 ? 1 : 0) });
  this.cnt[0].textContent = t >= 21.6 && t < 27.4 ? '1' : '0';
  put(this.card2, { y: L(-30, 0, P(t, 27.45, 27.75, E.back)), o: P(t, 27.45, 27.55, E.lin) });
  this.cnt[2].textContent = t >= 27.45 ? '3' : '2';
  const cnt = (a, b, t0, t1) => Math.round(L(a, b, P(t, t0, t1, E.out)));
  this.kp[0].textContent = t >= 21.6 ? '9' : '8';
  this.kp[2].textContent = fmt(L(980, 1016, P(t, 21.6, 22.1, E.out)));
  this.kp[3].textContent = t >= 21.6 && t < 27.4 ? '1' : '0';
  this.kp[1].textContent = cnt(142, 154, 27.2, 27.8);
  [0, 2].forEach(i => this.kp[i].style.transform = `scale(${t >= 21.6 && t < 22.0 ? 1.2 : 1})`);
  // printer
  const pu = P(t, 24.0, 24.45, E.back); put(this.prn, { x: L(600, 0, pu), o: P(t, 24.0, 24.1, E.lin) });
  put(this.pl, { x: L(600, 0, pu), o: (P(t, 24.3, 24.4, E.lin)) * (t < 27.1 ? 1 : 0) * (.6 + .4 * Math.abs(Math.sin(t * 6))) });
  this.led.style.background = t > 24.4 && t < 27.1 && Math.sin(t * 22) > 0 ? '#9affb8' : '#22c55e';
  this.sheets.forEach((s, i) => { const t0 = 24.55 + i * .4; const u = P(t, t0, t0 + .38, E.out); put(s, { y: L(0, 84 + i * 8, u) + (i % 2 ? 4 : -2), x: i * 6 - 12, r: (i - 2.5) * 1.6, o: u > 0 ? 1 : 0 }); s.style.zIndex = i; });
  this.wire.style.backgroundPosition = `${-(t * 160) % 30}px 0`; put(this.wire, { o: t > 24.1 && t < 27.1 ? 1 : 0 });
  this.prb.style.width = (P(t, 24.5, 27.0, E.lin) * 100) + '%';
  const su = P(t, 27.1, 27.28, E.in); put(this.stamp, { s: L(2.6, 1, su), r: -8, o: P(t, 27.1, 27.14, E.lin) * (t < 27.5 ? 1 : 0) });
  this.stamp.style.left = '200px';
  const lu = P(t, 27.15, 27.5, E.out); put(this.low, { y: L(120, 0, lu), o: P(t, 27.15, 27.25, E.lin) });
} };

// ---------- SCENE 6: benefits ----------
const S6 = { start: 28, end: 36, build(r) {
  r.style.background = '#F6F7F9';
  C(r, `left:1700px;top:60px;width:900px;height:900px;border-radius:50%;background:${GOLD};opacity:.16`, '');
  const hw = [['RUN',NAVY,28.1],['THE',NAVY,28.17],['SHOP.',NAVY,28.24],['NOT',GOLDD,28.5],['THE',GOLDD,28.57],['QUEUE.',GOLDD,28.64]]; this.h = [];
  [0, 1].forEach(row => { const rw = mk(r, `left:90px;top:${28 + row * 140}px;display:flex;gap:34px;font-size:122px`, '', 'big'); rw.style.position = 'absolute'; hw.slice(row * 3, row * 3 + 3).forEach(([w, col, t0]) => { const sp = document.createElement('span'); sp.textContent = w; sp.style.cssText = `display:inline-block;color:${col}`; rw.appendChild(sp); this.h.push({ el: sp, t0 }); }); });
  const card = (x, title, t0, bg) => { const el = mk(r, `left:${x}px;top:330px;width:560px;height:640px;border-radius:44px;background:${bg};box-shadow:0 40px 80px rgba(11,37,89,.18);overflow:hidden`); mk(el, `left:40px;top:34px;font-size:56px;font-weight:900;letter-spacing:-.02em;color:${bg === '#fff' ? NAVY : '#fff'}`, title); return { el, t0 }; };
  this.c1 = card(90, 'YOUR PRICES', 28.3, '#fff'); this.c2 = card(680, 'EVERY RUPEE', 30.9, '#fff'); this.c3 = card(1270, 'PRIVATE BY DEFAULT', 33.4, NAVY);
  this.c3.el.children[0].style.fontSize = '47px';
  // prices
  const rows = [['Black & white', '₹2.00'], ['Colour', '₹8.00'], ['Double-sided B&W', '₹1.50'], ['Double-sided colour', '₹6.00']];
  this.rows = rows.map(([a, b], i) => { const row = mk(this.c1.el, `left:30px;top:${130 + i * 120}px;width:500px;height:96px;border-radius:22px;background:#f6f7f9;border:2px solid #e6e8ee`, `<div style="position:absolute;left:24px;top:28px;font-size:30px;font-weight:700;color:#475569">${a}</div><div class="val" style="position:absolute;right:24px;top:24px;font-size:40px;font-weight:900;color:#0b1b3f">${b}</div>`); return row; });
  mk(this.c1.el, 'left:40px;top:600px;font-size:28px;font-weight:700;color:#8b92a3', 'Set separately for each shop');
  // money
  this.bars = Array.from({ length: 14 }, (_, i) => mk(this.c2.el, `left:${36 + i * 36}px;top:560px;width:26px;height:${60 + ((i * 53) % 9) * 22 + i * 5}px;border-radius:7px 7px 0 0;background:${i === 13 ? GOLD : '#c7d2ec'};transform-origin:50% 100%`));
  this.bars.forEach((b, i) => b.dataset.h = b.style.height);
  this.money = mk(this.c2.el, 'left:40px;top:120px;font-size:84px;font-weight:900;color:#0b1b3f;font-variant-numeric:tabular-nums;letter-spacing:-.03em', '₹0');
  mk(this.c2.el, 'left:44px;top:222px;font-size:30px;font-weight:700;color:#8b92a3', 'collected this month');
  this.xl = mk(this.c2.el, `left:40px;top:575px;height:60px;padding:0 24px;border-radius:30px;background:${NAVY};color:#fff;font-size:26px;font-weight:800;line-height:60px`, 'Export to Excel');
  // privacy
  const st = [['Customer consents', 33.85], ['Stored privately', 34.4], ['Deleted after printing', 34.95]];
  this.st = st.map(([a, t0], i) => ({ el: mk(this.c3.el, `left:40px;top:${140 + i * 110}px;width:480px;height:90px;border-radius:24px;background:rgba(255,255,255,.1);display:flex;align-items:center;gap:20px;padding:0 24px;font-size:32px;font-weight:800;color:#fff`, `<span style="width:46px;height:46px;border-radius:50%;background:#15803D;padding:9px;display:block;flex:0 0 auto">${IC.check}</span>${a}`), t0 }));
  this.shield = C(this.c3.el, `left:280px;top:540px;width:150px;height:150px;color:${GOLD}`, IC.shield);
  this.file = C(this.c3.el, 'left:280px;top:540px;width:86px;height:86px;color:#fff', IC.file);
  const rnd = R(5); this.dust = Array.from({ length: 16 }, (_, i) => ({ el: C(this.c3.el, `left:280px;top:540px;width:12px;height:12px;background:#fff;border-radius:3px`, ''), a: rnd() * 6.28, v: 60 + rnd() * 160 }));
}, draw(t) {
  this.h.forEach(w => { const u = P(t, w.t0, w.t0 + .28, E.back); put(w.el, { s: L(.5, 1, u), y: L(60, 0, u), o: P(t, w.t0, w.t0 + .05, E.lin), b: (1 - P(t, w.t0, w.t0 + .18)) * 12 }); });
  [this.c1, this.c2, this.c3].forEach(c => { const u = P(t, c.t0, c.t0 + .5, E.back); put(c.el, { y: L(700, 0, u), r: L(4, 0, u), o: P(t, c.t0, c.t0 + .06, E.lin) }); });
  // prices: edit row 3
  const ed = t > 29.5; this.rows[2].querySelector('.val').textContent = ed ? '₹1.00' : '₹1.50';
  this.rows[2].style.borderColor = t > 29.4 && t < 30.3 ? GOLD : '#e6e8ee'; this.rows[2].style.boxShadow = t > 29.4 && t < 30.3 ? '0 0 0 6px rgba(255,168,0,.3)' : 'none';
  // money
  this.money.textContent = '₹' + Math.round(L(0, 12480, P(t, 31.0, 32.3, E.out))).toLocaleString('en-IN');
  this.bars.forEach((b, i) => put(b, { sy: P(t, 31.0 + i * .06, 31.45 + i * .06, E.back), o: 1 }));
  put(this.xl, { s: L(.4, 1, P(t, 32.4, 32.7, E.back)), o: P(t, 32.4, 32.45, E.lin) });
  this.st.forEach(s => { const u = P(t, s.t0, s.t0 + .3, E.back); put(s.el, { x: L(300, 0, u), o: P(t, s.t0, s.t0 + .06, E.lin) }); });
  put(this.shield, { s: L(.3, 1, P(t, 33.6, 34.1, E.back)) * (1 - P(t, 35.3, 35.5, E.in) * .0), o: P(t, 33.6, 33.7, E.lin), y: 0 });
  const dd = Math.max(0, t - 35.25), fs = 1 - P(t, 35.2, 35.45, E.in);
  put(this.file, { x: -120, y: 0, s: fs * L(.4, 1, P(t, 34.6, 34.9, E.back)), o: P(t, 34.6, 34.7, E.lin) });
  this.dust.forEach(d => put(d.el, { x: -120 + Math.cos(d.a) * d.v * dd, y: Math.sin(d.a) * d.v * dd + 200 * dd * dd, o: t < 35.25 ? 0 : clamp(1 - dd * 1.6) }));
} };

// ---------- SCENE 7: languages ----------
const S7 = { start: 36, end: 40, build(r) {
  r.style.background = GOLD;
  C(r, `left:300px;top:1050px;width:1300px;height:1300px;border-radius:50%;background:#FFC24D;opacity:.5`, '');
  mk(r, `left:130px;top:100px;font-size:46px;font-weight:900;color:${NAVY};letter-spacing:.14em`, 'FOR EVERY CUSTOMER');
  this.rows = [['ENGLISH', 'font-family:Inter', 36.2, 150], ['తెలుగు', "font-family:'NotoTe',sans-serif", 37.2, 400], ['हिन्दी', "font-family:'NotoHi',sans-serif", 38.2, 650]].map(([txt, ff, t0, y]) => ({ t0, el: mk(r, `left:130px;top:${y}px;font-size:260px;font-weight:800;color:${NAVY};line-height:1.15;${ff}`, txt, 'big') }));
  this.sub = mk(r, `left:130px;top:960px;font-size:62px;font-weight:800;color:${NAVY};white-space:nowrap`, 'Your customers pick their language.');
}, draw(t) {
  this.rows.forEach((w, i) => { const u = P(t, w.t0, w.t0 + .3, E.back); put(w.el, { x: L(-900, 0, u), s: L(1.5, 1, u), o: P(t, w.t0, w.t0 + .05, E.lin), b: (1 - P(t, w.t0, w.t0 + .15)) * 16 }); });
  const su = P(t, 38.75, 39.1, E.out); put(this.sub, { y: L(60, 0, su), o: P(t, 38.75, 38.85, E.lin) });
} };

// ---------- SCENE 8: call to action ----------
const S8 = { start: 40, end: 48, build(r) {
  r.style.background = 'radial-gradient(1400px 1000px at 25% 35%,#1a3a86,#0B1B3F 55%,#060d22)';
  this.glow = C(r, `left:960px;top:540px;width:1700px;height:1700px;border-radius:50%;background:radial-gradient(circle,rgba(255,168,0,.35),rgba(255,168,0,0) 62%)`);
  this.logo = mk(r, 'left:110px;top:90px;width:560px;border-radius:36px;background:#fff;padding:30px 36px;box-shadow:0 40px 80px rgba(0,0,0,.4)', BRAND);
  this.hl = [['MAKE YOUR', 440, '#fff', 40.4], ['PRINT SHOP', 600, GOLD, 40.7], ['SMARTER.', 760, '#fff', 41.0]].map(([w, y, col, t0]) => ({ t0, el: mk(r, `left:110px;top:${y}px;font-size:168px;color:${col}`, w, 'big') }));
  this.free = mk(r, `left:110px;top:400px;font-size:196px;color:${GOLD}`, 'TRY IT FREE', 'big');
  this.days = mk(r, 'left:110px;top:650px;font-size:150px;color:#fff', 'FOR 14 DAYS', 'big');
  this.url = mk(r, `left:110px;top:870px;height:120px;padding:0 50px;border-radius:60px;background:${GOLD};color:${DEEP};font-size:64px;font-weight:900;display:flex;align-items:center;letter-spacing:-.01em;box-shadow:0 24px 60px rgba(255,168,0,.35)`, 'software.docufastindia.com');
  this.qr = mk(r, 'left:1400px;top:330px;width:420px;height:520px;border-radius:40px;background:#fff;padding:36px;box-shadow:0 50px 100px rgba(0,0,0,.5)', `${window.QR_SITE.replace('<svg ', '<svg width="368" height="368" ')}<div style="margin-top:22px;text-align:center;font-size:38px;font-weight:900;color:${NAVY}">Scan to start</div>`);
  this.tag = mk(r, 'left:0;top:1030px;width:1920px;text-align:center;font-size:36px;font-weight:600;color:#c9d2ea;letter-spacing:.04em', 'Documents Made Easy, Delivered To You');
  this.gf = mk(r, `left:0;top:0;width:1920px;height:1080px;background:${GOLD}`);
}, draw(t) {
  const lu = P(t, 40.05, 40.4, E.back); put(this.logo, { s: L(1.6, 1, lu), o: P(t, 40.05, 40.1, E.lin), y: L(-30, 0, lu) });
  put(this.glow, { s: 1 + .04 * Math.sin(t * 2), o: P(t, 40, 40.8, E.lin) });
  const hx = P(t, 42.75, 43.1, E.in);
  this.hl.forEach(w => { const u = P(t, w.t0, w.t0 + .3, E.back); put(w.el, { s: L(.6, 1, u), y: L(80, 0, u), x: -1900 * hx, o: P(t, w.t0, w.t0 + .06, E.lin), b: (1 - P(t, w.t0, w.t0 + .18)) * 12 }); });
  const fu = P(t, 42.9, 43.25, E.back), du = P(t, 43.6, 43.95, E.back);
  put(this.free, { s: L(.5, 1, fu), y: L(80, 0, fu), o: P(t, 42.9, 42.96, E.lin) });
  put(this.days, { s: L(.5, 1, du), y: L(80, 0, du), o: P(t, 43.6, 43.66, E.lin) });
  const uu = P(t, 44.3, 44.7, E.back); put(this.url, { y: L(300, 0, uu), o: P(t, 44.3, 44.36, E.lin) });
  const qu = P(t, 44.5, 44.95, E.back); put(this.qr, { s: L(.5, 1, qu), r: L(10, 0, qu), o: P(t, 44.5, 44.56, E.lin) });
  put(this.tag, { o: P(t, 45.8, 46.2, E.lin), y: L(30, 0, P(t, 45.8, 46.2)) });
  put(this.gf, { o: t >= 47.1 ? .55 * Math.exp(-(t - 47.1) * 6) : 0 });
  this.logo.style.transform += ` scale(${t >= 47.1 ? 1 + .06 * Math.exp(-(t - 47.1) * 5) : 1})`;
} };

const SCENES = [S1, S2, S3, S4, S5, S6, S7, S8];
SCENES.forEach(s => { s.root = mk(scenesEl, '', ''); s.root.className = 'scene'; s.root.style.cssText = ''; s.build(s.root); });
// wipe panels at the cuts
const CUTS = [[4, GOLD], [12, '#EEF2FA'], [20, '#0B1B3F'], [28, '#F6F7F9'], [36, GOLD], [40, '#0B1B3F']];
const wipe = mk(fx, 'left:0;top:0;width:3000px;height:1080px;display:none;z-index:50', '');
wipe.innerHTML = `<div style="position:absolute;left:0;top:-40px;width:2600px;height:1160px;background:var(--wc);transform:skewX(-12deg);box-shadow:-40px 0 80px rgba(0,0,0,.25)"></div><div style="position:absolute;left:-60px;top:-40px;width:60px;height:1160px;background:#FFA800;transform:skewX(-12deg)"></div>`;
const flash = mk(fx, 'left:0;top:0;width:1920px;height:1080px;background:#fff;opacity:0;z-index:60');
const IMPACTS = [[0, .9], [1, 1], [2, 1.2], [8, 2.2], [27.1, 1.2], [36.2, 1.4], [37.2, 1.5], [38.2, 1.6], [40, 2], [47.1, 1.6]];
let cur = -1, grainN = 0;
window.draw = function (t) {
  const idx = SCENES.findIndex(s => t >= s.start && t < s.end); const i = idx < 0 ? SCENES.length - 1 : idx;
  if (i !== cur) { SCENES.forEach((s, k) => s.root.style.display = k === i ? 'block' : 'none'); cur = i; }
  SCENES[i].draw(t, t - SCENES[i].start);
  // wipe
  let on = false;
  for (const [tc, col] of CUTS) { if (t > tc - .3 && t < tc + .3) { const u = (t - (tc - .3)) / .6; wipe.style.display = 'block'; wipe.style.setProperty('--wc', col); wipe.style.transform = `translateX(${1920 - (1920 + 2600) * u}px)`; wipe.style.opacity = 1; on = true; } }
  if (!on) wipe.style.display = 'none';
  flash.style.opacity = t > 7.8 && t < 8.0 ? clamp((t - 7.8) / .2) : 0;
  // camera shake on impacts, fade in/out
  let sx = 0, sy = 0; IMPACTS.forEach(([ti, a]) => { const d = t - ti; if (d >= 0 && d < .6) { const k = a * 16 * Math.exp(-d * 11); sx += Math.sin(d * 95) * k; sy += Math.cos(d * 83) * k * .7; } });
  stageEl.style.transform = `translate(${sx}px,${sy}px)`;
  document.getElementById('grain').style.transform = `translate(${(Math.sin(t * 91) * 30)}px,${(Math.cos(t * 77) * 30)}px)`;
  const fade = Math.min(P(t, 0, .12, E.lin), 1 - P(t, 47.65, 48, E.lin)); document.getElementById('scenes').style.opacity = fade;
  document.body.style.background = '#000';
};
window.ready = document.fonts.ready.then(() => new Promise(r => setTimeout(r, 400)));
})();
