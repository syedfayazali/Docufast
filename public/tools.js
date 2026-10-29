// Customer-side document tools. Everything here runs in the customer's own
// browser — photos are combined into a PDF on their phone, and only the final
// file is uploaded (through the same private upload path as any other file).
//
// Three tools, all feeding one callback:
//   * Photos -> PDF        several photos / PDFs merged into one PDF, reorderable
//   * Passport photos      one photo repeated onto a single A4 sheet (35x45 mm)
//   * Service checklist    a fixed list of required documents (Aadhaar, PAN…)
//                          merged in order into one PDF for the shop
const PDF_LIB_URL = 'https://esm.sh/pdf-lib@1.17.1';
let pdfLibP = null;
const pdfLib = () => (pdfLibP = pdfLibP || import(PDF_LIB_URL));

const A4 = { w: 595.28, h: 841.89 }; // points
const MAX_DIM = 2480;                // ~A4 at 300dpi, plenty for print
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };
const isPdf = f => f.type === 'application/pdf' || /\.pdf$/i.test(f.name);

// ---- image helpers -------------------------------------------------------
async function decode(file) {
  // imageOrientation:'from-image' applies the phone's EXIF rotation.
  const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' }).catch(() => null);
  if (!bmp) throw new Error(`"${file.name}" could not be opened as a picture.`);
  return bmp;
}
// Returns a canvas of the image, rotated by quarter turns, optionally brightened.
async function toCanvas(file, rotate = 0, enhance = false, maxDim = MAX_DIM) {
  const bmp = await decode(file);
  let w = bmp.width, h = bmp.height;
  const k = Math.min(1, maxDim / Math.max(w, h));
  w = Math.round(w * k); h = Math.round(h * k);
  const turns = ((rotate % 4) + 4) % 4;
  const c = document.createElement('canvas');
  c.width = turns % 2 ? h : w; c.height = turns % 2 ? w : h;
  const ctx = c.getContext('2d');
  ctx.translate(c.width / 2, c.height / 2);
  ctx.rotate(turns * Math.PI / 2);
  if (enhance) ctx.filter = 'contrast(1.18) brightness(1.08)';
  ctx.drawImage(bmp, -w / 2, -h / 2, w, h);
  bmp.close?.();
  return c;
}
const canvasToJpeg = (c, q = 0.85) => new Promise(r => c.toBlob(r, 'image/jpeg', q));

// ---- merge into one PDF --------------------------------------------------
// items: [{ file, rotate, enhance }] in order. Images get one A4 page each,
// fitted inside a margin; PDFs have their pages copied in.
export async function buildPdf(items) {
  const { PDFDocument } = await pdfLib();
  const out = await PDFDocument.create();
  for (const it of items) {
    if (isPdf(it.file)) {
      let src;
      try { src = await PDFDocument.load(await it.file.arrayBuffer()); }
      catch { throw new Error(`"${it.file.name}" is a locked or damaged PDF. Remove its password or choose another file.`); }
      const pages = await out.copyPages(src, src.getPageIndices());
      pages.forEach(p => out.addPage(p));
    } else {
      const canvas = await toCanvas(it.file, it.rotate || 0, !!it.enhance);
      const jpg = await out.embedJpg(await (await canvasToJpeg(canvas)).arrayBuffer());
      const margin = 28;
      const scale = Math.min((A4.w - 2 * margin) / jpg.width, (A4.h - 2 * margin) / jpg.height);
      const w = jpg.width * scale, h = jpg.height * scale;
      const page = out.addPage([A4.w, A4.h]);
      page.drawImage(jpg, { x: (A4.w - w) / 2, y: (A4.h - h) / 2, width: w, height: h });
    }
  }
  if (!out.getPageCount()) throw new Error('Add at least one photo or PDF first.');
  const bytes = await out.save();
  return new File([bytes], 'documents.pdf', { type: 'application/pdf' });
}

// ---- passport photo sheet ------------------------------------------------
export async function passportSheet(file, rotate, count) {
  const W = 2480, H = 3508;                 // A4 @ 300dpi
  const pw = 413, ph = 531;                 // 35 x 45 mm @ 300dpi
  const cols = Math.floor((W - 160) / (pw + 20));
  const src = await toCanvas(file, rotate, false, 2000);
  // centre-crop the source to the 35:45 ratio
  const ratio = pw / ph;
  let sw = src.width, sh = src.height;
  if (sw / sh > ratio) sw = Math.round(sh * ratio); else sh = Math.round(sw / ratio);
  const sx = Math.round((src.width - sw) / 2), sy = Math.round((src.height - sh) / 2);

  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H);
  const rows = Math.ceil(count / cols);
  const gridW = cols * pw + (cols - 1) * 20, gridH = rows * ph + (rows - 1) * 20;
  const ox = Math.round((W - gridW) / 2), oy = 140;
  for (let i = 0; i < count; i++) {
    const x = ox + (i % cols) * (pw + 20), y = oy + Math.floor(i / cols) * (ph + 20);
    ctx.drawImage(src, sx, sy, sw, sh, x, y, pw, ph);
    ctx.strokeStyle = '#bbb'; ctx.lineWidth = 2; ctx.strokeRect(x, y, pw, ph); // cut guide
  }
  void gridH;
  const blob = await canvasToJpeg(c, 0.92);
  return new File([blob], 'passport-photos.jpg', { type: 'image/jpeg' });
}

// ---- UI ------------------------------------------------------------------
function thumbFor(file, rotate) {
  const box = el('div', 'tthumb');
  if (isPdf(file)) { box.textContent = 'PDF'; return box; }
  const img = new Image(); img.alt = '';
  img.src = URL.createObjectURL(file);
  img.style.transform = `rotate(${(rotate || 0) * 90}deg)`;
  box.appendChild(img);
  return box;
}

// opts: { onFile(file, meta), onError(msg), onBusy(text|null) }
export function initTools(opts) {
  const $ = id => document.getElementById(id);

  // ----- mode switching -----
  const panels = { file: $('panelFile'), photos: $('panelPhotos'), passport: $('panelPassport'), service: $('panelService') };
  function show(mode) {
    Object.entries(panels).forEach(([k, p]) => { p.style.display = k === mode ? 'block' : 'none'; });
    // The tool panels have their own button; the shared Continue returns once a file is ready.
    $('next1').style.display = mode === 'file' ? '' : 'none';
    document.querySelectorAll('#modes .mode').forEach(b => b.classList.toggle('active', b.dataset.mode === mode && (mode !== 'service' || b.dataset.service === currentService?.id)));
  }
  let currentService = null;
  document.querySelectorAll('#modes .mode[data-mode]').forEach(b => b.addEventListener('click', () => {
    currentService = null; opts.onService(null); show(b.dataset.mode);
  }));

  // ----- Photos -> PDF -----
  const photoItems = [];
  const photoList = $('photoList');
  function renderPhotos() {
    photoList.innerHTML = '';
    photoItems.forEach((it, i) => {
      const row = el('div', 'trow');
      row.appendChild(thumbFor(it.file, it.rotate));
      row.appendChild(el('div', 'tname', it.file.name));
      const mk = (txt, title, fn, dis) => { const b = el('button', 'tbtn', txt); b.type = 'button'; b.title = title; b.disabled = !!dis; b.addEventListener('click', fn); return b; };
      row.append(
        mk('↑', 'Move up', () => { [photoItems[i - 1], photoItems[i]] = [photoItems[i], photoItems[i - 1]]; renderPhotos(); }, i === 0),
        mk('↓', 'Move down', () => { [photoItems[i + 1], photoItems[i]] = [photoItems[i], photoItems[i + 1]]; renderPhotos(); }, i === photoItems.length - 1),
        mk('⟳', 'Rotate', () => { it.rotate = ((it.rotate || 0) + 1) % 4; renderPhotos(); }, isPdf(it.file)),
        mk('✕', 'Remove', () => { photoItems.splice(i, 1); renderPhotos(); }),
      );
      photoList.appendChild(row);
    });
    $('photosMake').disabled = !photoItems.length;
    $('photosMake').textContent = photoItems.length ? `Make PDF from ${photoItems.length} item${photoItems.length > 1 ? 's' : ''}` : 'Add photos first';
  }
  $('photosAdd').addEventListener('click', () => $('photosInput').click());
  $('photosInput').addEventListener('change', e => {
    [...e.target.files].forEach(f => photoItems.push({ file: f, rotate: 0 }));
    e.target.value = ''; renderPhotos();
  });
  $('photosMake').addEventListener('click', async () => {
    try {
      opts.onBusy('Building your PDF…');
      const enhance = $('photosEnhance').checked;
      const file = await buildPdf(photoItems.map(it => ({ ...it, enhance })));
      opts.onBusy(null); opts.onFile(file, {});
    } catch (err) { opts.onBusy(null); opts.onError(err.message); }
  });
  renderPhotos();

  // ----- Passport photos -----
  let passportFile = null, passportRotate = 0;
  function renderPassport() {
    const box = $('passportPreview'); box.innerHTML = '';
    if (passportFile) box.appendChild(thumbFor(passportFile, passportRotate));
    $('passportRotate').disabled = !passportFile;
    $('passportMake').disabled = !passportFile;
  }
  $('passportPick').addEventListener('click', () => $('passportInput').click());
  $('passportInput').addEventListener('change', e => { passportFile = e.target.files[0] || null; passportRotate = 0; e.target.value = ''; renderPassport(); });
  $('passportRotate').addEventListener('click', () => { passportRotate = (passportRotate + 1) % 4; renderPassport(); });
  $('passportMake').addEventListener('click', async () => {
    try {
      opts.onBusy('Making your photo sheet…');
      const file = await passportSheet(passportFile, passportRotate, parseInt($('passportCount').value, 10) || 8);
      opts.onBusy(null); opts.onFile(file, { forceColour: true });
    } catch (err) { opts.onBusy(null); opts.onError(err.message); }
  });
  renderPassport();

  // ----- Service checklist -----
  let slotFiles = [];
  function renderService() {
    const s = currentService; const list = $('serviceSlots'); list.innerHTML = '';
    $('serviceTitle').textContent = s.name;
    $('serviceFeeNote').textContent = s.fee ? `Service fee ₹${(s.fee / 100).toFixed(s.fee % 100 ? 2 : 0)} + printing` : 'Printing charges only';
    s.slots.forEach((slot, i) => {
      const row = el('div', 'trow slot');
      const info = el('div', 'tname');
      info.append(el('b', '', slot.label), el('span', 'req', slot.required ? ' · required' : ' · optional'));
      const state = slotFiles[i];
      row.appendChild(state ? thumbFor(state.file, state.rotate) : el('div', 'tthumb empty', '＋'));
      row.appendChild(info);
      const input = document.createElement('input'); input.type = 'file'; input.accept = 'image/*,application/pdf,.pdf'; input.style.display = 'none';
      input.addEventListener('change', e => { const f = e.target.files[0]; if (f) { slotFiles[i] = { file: f, rotate: 0 }; renderService(); } });
      const add = el('button', 'tbtn wide', state ? 'Change' : 'Add'); add.type = 'button'; add.addEventListener('click', () => input.click());
      row.append(input, add);
      if (state && !isPdf(state.file)) { const r = el('button', 'tbtn', '⟳'); r.type = 'button'; r.title = 'Rotate'; r.addEventListener('click', () => { state.rotate = ((state.rotate || 0) + 1) % 4; renderService(); }); row.appendChild(r); }
      list.appendChild(row);
    });
    const missing = s.slots.filter((slot, i) => slot.required && !slotFiles[i]).length;
    $('serviceMake').disabled = missing > 0;
    $('serviceMake').textContent = missing ? `Add ${missing} more required document${missing > 1 ? 's' : ''}` : 'Combine my documents';
  }
  $('serviceMake').addEventListener('click', async () => {
    try {
      opts.onBusy('Combining your documents…');
      const items = currentService.slots.map((_, i) => slotFiles[i]).filter(Boolean);
      const file = await buildPdf(items.map(it => ({ ...it, enhance: true })));
      opts.onBusy(null); opts.onFile(file, { service: currentService });
    } catch (err) { opts.onBusy(null); opts.onError(err.message); }
  });

  // Called by app.js once /api/services has loaded.
  return {
    setServices(services) {
      const bar = $('modes');
      bar.querySelectorAll('.mode[data-service]').forEach(b => b.remove());
      services.forEach(s => {
        const b = el('button', 'mode', s.name); b.type = 'button'; b.dataset.mode = 'service'; b.dataset.service = s.id;
        b.addEventListener('click', () => {
          currentService = s; slotFiles = []; opts.onService(s); renderService(); show('service');
        });
        bar.appendChild(b);
      });
    },
  };
}
