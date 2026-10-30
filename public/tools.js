// Customer-side document tools. Everything here runs in the customer's own
// browser — photos are combined into a PDF on their phone, and only the final
// file is uploaded (through the same private upload path as any other file).
//
// Three tools, all feeding one callback:
//   * Photos -> PDF        several photos / PDFs merged into one PDF, reorderable
//   * Passport photos      one photo repeated onto a single A4 sheet (35x45 mm)
//   * ID card copy        front + back photos, each fitted to real card size
//                          (85.6 x 54 mm) and printed side by side on one A4
//   * Passport copy       two passport pages (125 x 88 mm) stacked on one A4
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
// Draws the passport-photo page onto `c` (any width; layout is in A4@300dpi units).
// With no photo it draws empty frames, so the customer sees the layout first.
function paintPassport(c, src, count) {
  const W = 2480, H = 3508, pw = 413, ph = 531;   // A4 and 35 x 45 mm @ 300dpi
  const cols = Math.floor((W - 160) / (pw + 20));
  const ctx = c.getContext('2d');
  const k = c.width / W;
  c.height = Math.round(H * k);
  ctx.setTransform(k, 0, 0, k, 0, 0);
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H);
  let sx = 0, sy = 0, sw = 0, sh = 0;
  if (src) {
    const ratio = pw / ph; sw = src.width; sh = src.height;   // centre-crop to 35:45
    if (sw / sh > ratio) sw = Math.round(sh * ratio); else sh = Math.round(sw / ratio);
    sx = Math.round((src.width - sw) / 2); sy = Math.round((src.height - sh) / 2);
  }
  const rows = Math.ceil(count / cols);
  const ox = Math.round((W - (cols * pw + (cols - 1) * 20)) / 2), oy = 140;
  void rows;
  for (let i = 0; i < count; i++) {
    const x = ox + (i % cols) * (pw + 20), y = oy + Math.floor(i / cols) * (ph + 20);
    if (src) ctx.drawImage(src, sx, sy, sw, sh, x, y, pw, ph);
    else { ctx.fillStyle = '#eef1f6'; ctx.fillRect(x, y, pw, ph); }
    ctx.strokeStyle = '#bbb'; ctx.lineWidth = 2; ctx.strokeRect(x, y, pw, ph); // cut guide
  }
}
export async function passportSheet(file, rotate, count) {
  const src = await toCanvas(file, rotate, false, 2000);
  const c = document.createElement('canvas'); c.width = 2480;
  paintPassport(c, src, count);
  const blob = await canvasToJpeg(c, 0.92);
  return new File([blob], 'passport-photos.jpg', { type: 'image/jpeg' });
}


// ---- ID card / passport copy sheets ---------------------------------------
// Each document photo is fitted to its real printed size. The customer drags
// and zooms inside a frame of that exact shape, so a card photographed on a
// table is cropped to just the card. Output is one A4 image at 300 dpi.
const MM = 300 / 25.4;
export const SHEET_PRESETS = {
  idcard:   { name: 'ID card copy', w: 85.6, h: 54, layout: 'side',  labels: ['Front', 'Back'],
              hint: 'Works for Aadhaar, PAN, Voter ID and driving licence. Front and back are printed side by side at real card size on one A4 sheet.', file: 'id-card-copy.jpg' },
  passport: { name: 'Passport copy', w: 125, h: 88, layout: 'stack', labels: ['Photo page', 'Address page'],
              hint: 'Both passport pages are printed at real size, one above the other, on one A4 sheet.', file: 'passport-copy.jpg' },
};

// Draws one document into a frame (x,y,w,h in px), honouring the customer's pan/zoom.
function drawInFrame(ctx, src, st, x, y, w, h) {
  ctx.save();
  ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  ctx.fillStyle = '#fff'; ctx.fillRect(x, y, w, h);
  const cover = Math.max(w / src.width, h / src.height);
  const sc = cover * st.zoom;
  const dw = src.width * sc, dh = src.height * sc;
  ctx.drawImage(src, x + w / 2 - st.cx * dw, y + h / 2 - st.cy * dh, dw, dh);
  ctx.restore();
}
const minZoomFor = (src, w, h) => Math.min(w / src.width, h / src.height) / Math.max(w / src.width, h / src.height);

// Draws the A4 page for an ID-card / passport copy onto `c` (any width). Empty
// sides show a grey placeholder so the preview works before photos are added.
function paintSheet(c, P, slots, cutLine) {
  const W = 2480, H = 3508;
  const fw = Math.round(P.w * MM), fh = Math.round(P.h * MM), gap = Math.round(6 * MM), top = Math.round(18 * MM);
  const k = c.width / W;
  c.height = Math.round(H * k);
  const ctx = c.getContext('2d');
  ctx.setTransform(k, 0, 0, k, 0, 0);
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H);
  const pos = P.layout === 'side'
    ? [[Math.round((W - (2 * fw + gap)) / 2), top], [Math.round((W - (2 * fw + gap)) / 2) + fw + gap, top]]
    : [[Math.round((W - fw) / 2), top], [Math.round((W - fw) / 2), top + fh + gap]];
  for (let i = 0; i < 2; i++) {
    const [x, y] = pos[i];
    if (slots[i] && slots[i].canvas) drawInFrame(ctx, slots[i].canvas, slots[i], x, y, fw, fh);
    else {
      ctx.fillStyle = '#eef1f6'; ctx.fillRect(x, y, fw, fh);
      ctx.fillStyle = '#8a93a6'; ctx.font = '600 64px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(P.labels[i], x + fw / 2, y + fh / 2);
    }
    if (cutLine) { ctx.strokeStyle = '#b8b8b8'; ctx.lineWidth = 2; ctx.setLineDash([14, 10]); ctx.strokeRect(x - 6, y - 6, fw + 12, fh + 12); ctx.setLineDash([]); }
  }
}

export async function copySheet(presetId, slots, cutLine = true) {
  const P = SHEET_PRESETS[presetId];
  const c = document.createElement('canvas'); c.width = 2480;
  paintSheet(c, P, slots, cutLine);
  const blob = await canvasToJpeg(c, 0.92);
  // Wrap the sheet in an A4 PDF so the shop's printer receives real A4 at 100%
  // (the cards then come out at true size). Falls back to the plain image.
  try {
    const { PDFDocument } = await pdfLib();
    const pdf = await PDFDocument.create();
    const img = await pdf.embedJpg(await blob.arrayBuffer());
    const page = pdf.addPage([A4.w, A4.h]);
    page.drawImage(img, { x: 0, y: 0, width: A4.w, height: A4.h });
    return { file: new File([await pdf.save()], P.file.replace(/\.jpg$/, '.pdf'), { type: 'application/pdf' }), exact: true };
  } catch {
    return { file: new File([blob], P.file, { type: 'image/jpeg' }), exact: false };
  }
}

// One slot = a pan/zoom fitting box for one side of the document.
function buildFitter(preset, label, onChange) {
  const st = { file: null, rotate: 0, canvas: null, zoom: 1, cx: 0.5, cy: 0.5 };
  const wrap = el('div', 'fit');
  const head = el('div', 'fit-head'); head.appendChild(el('b', '', label));
  const ctl = el('div', 'fit-ctl');
  const pick = el('button', 'tbtn wide pick', 'Add'); pick.type = 'button';
  const rot = el('button', 'tbtn', '⟳'); rot.type = 'button'; rot.title = 'Rotate'; rot.disabled = true;
  ctl.append(pick, rot); head.appendChild(ctl);
  const input = document.createElement('input'); input.type = 'file'; input.accept = 'image/*'; input.style.display = 'none';
  const box = el('div', 'fit-box');
  box.style.aspectRatio = `${preset.w} / ${preset.h}`;
  const cv = document.createElement('canvas');
  const PW = 640, PH = Math.round(PW * preset.h / preset.w);
  cv.width = PW; cv.height = PH; box.appendChild(cv);
  const empty = el('div', 'fit-empty', 'Tap Add and choose a photo');
  box.appendChild(empty);
  const zoomRow = el('label', 'fit-zoom'); zoomRow.append(el('span', '', 'Zoom'));
  const zoom = document.createElement('input'); zoom.type = 'range'; zoom.min = '0.3'; zoom.max = '4'; zoom.step = '0.01'; zoom.value = '1'; zoom.disabled = true;
  zoomRow.appendChild(zoom);
  wrap.append(head, input, box, zoomRow);

  const clamp = () => { st.cx = Math.min(1, Math.max(0, st.cx)); st.cy = Math.min(1, Math.max(0, st.cy)); };
  function paint() {
    const ctx = cv.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, PW, PH);
    if (st.canvas) drawInFrame(ctx, st.canvas, st, 0, 0, PW, PH);
    empty.style.display = st.canvas ? 'none' : 'flex';
    rot.disabled = zoom.disabled = !st.canvas;
    pick.textContent = st.canvas ? 'Change' : 'Add';
    onChange();
  }
  async function load() {
    st.canvas = await toCanvas(st.file, st.rotate, false, 2200);
    const mz = minZoomFor(st.canvas, PW, PH);
    zoom.min = String(Math.max(0.2, mz)); st.zoom = 1; st.cx = 0.5; st.cy = 0.5; zoom.value = '1';
    paint();
  }
  pick.addEventListener('click', () => input.click());
  input.addEventListener('change', async e => { const f = e.target.files[0]; e.target.value = ''; if (!f) return; st.file = f; st.rotate = 0; try { await load(); } catch (err) { alert(err.message); } });
  rot.addEventListener('click', async () => { st.rotate = (st.rotate + 1) % 4; await load(); });
  zoom.addEventListener('input', () => { st.zoom = parseFloat(zoom.value); paint(); });

  // drag to move; two fingers or the mouse wheel to zoom
  const ptrs = new Map(); let lastDist = 0;
  const toNorm = (dx, dy) => {
    const cover = Math.max(PW / st.canvas.width, PH / st.canvas.height) * st.zoom;
    const k = box.getBoundingClientRect().width / PW;
    return [dx / k / (st.canvas.width * cover), dy / k / (st.canvas.height * cover)];
  };
  box.style.touchAction = 'none';
  box.addEventListener('pointerdown', e => { if (!st.canvas) return; box.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY }); lastDist = 0; });
  box.addEventListener('pointermove', e => {
    if (!ptrs.has(e.pointerId) || !st.canvas) return;
    const prev = ptrs.get(e.pointerId); const cur = { x: e.clientX, y: e.clientY };
    if (ptrs.size === 1) {
      const [nx, ny] = toNorm(cur.x - prev.x, cur.y - prev.y);
      st.cx -= nx; st.cy -= ny; clamp();
    } else if (ptrs.size === 2) {
      ptrs.set(e.pointerId, cur);
      const [a, b] = [...ptrs.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (lastDist) { st.zoom = Math.min(4, Math.max(parseFloat(zoom.min), st.zoom * d / lastDist)); zoom.value = String(st.zoom); }
      lastDist = d;
    }
    ptrs.set(e.pointerId, cur); paint();
  });
  const up = e => { ptrs.delete(e.pointerId); lastDist = 0; };
  box.addEventListener('pointerup', up); box.addEventListener('pointercancel', up);
  box.addEventListener('wheel', e => { if (!st.canvas) return; e.preventDefault(); st.zoom = Math.min(4, Math.max(parseFloat(zoom.min), st.zoom * (e.deltaY < 0 ? 1.06 : 0.94))); zoom.value = String(st.zoom); paint(); }, { passive: false });
  paint();
  return { el: wrap, st, ready: () => !!st.canvas, pickBtn: pick };
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
  const panels = { file: $('panelFile'), photos: $('panelPhotos'), passport: $('panelPassport'), service: $('panelService'), sheet: $('panelSheet') };
  let currentPreset = null;
  // Fees for the built-in print tools, set by the owner (null until /api/services answers).
  let toolSvc = null;
  const toolIdOf = b => b && b.dataset.tool;
  const toolService = id => (toolSvc && toolSvc[id]) || null;
  function setFee(id, sv) { const n = $(id); n.textContent = feeNote(sv); n.style.display = sv ? '' : 'none'; }
  const feeNote = sv => !sv ? '' : (sv.fee ? `Service fee ₹${(sv.fee / 100).toFixed(sv.fee % 100 ? 2 : 0)} + printing` : 'Printing charges only');
  function show(mode) {
    Object.entries(panels).forEach(([k, p]) => { p.style.display = k === mode ? 'block' : 'none'; });
    // The tool panels have their own button; the shared Continue returns once a file is ready.
    $('next1').style.display = mode === 'file' ? '' : 'none';
    if (mode === 'passport') setFee('passportFee', toolService('tool-passport-photo'));
    document.querySelectorAll('#modes .mode').forEach(b => b.classList.toggle('active', b.dataset.mode === mode && (mode !== 'service' || b.dataset.service === currentService?.id) && (mode !== 'sheet' || b.dataset.preset === currentPreset)));
  }
  let currentService = null;
  document.querySelectorAll('#modes .mode[data-mode]').forEach(b => b.addEventListener('click', () => {
    currentService = null; opts.onService(null);
    if (b.dataset.mode === 'sheet') { currentPreset = b.dataset.preset; renderSheet(); }
    show(b.dataset.mode);
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
    paintPassportPreview();
  }
  let passportSrc = null, passportSrcKey = '';
  async function paintPassportPreview() {
    const cv = $('passportSheetPrev');
    const count = parseInt($('passportCount').value, 10) || 8;
    const key = passportFile ? passportFile.name + passportFile.size + ':' + passportRotate : '';
    if (key !== passportSrcKey) {
      passportSrcKey = key;
      passportSrc = passportFile ? await toCanvas(passportFile, passportRotate, false, 700).catch(() => null) : null;
    }
    cv.width = 360; paintPassport(cv, passportSrc, count);
  }
  $('passportCount').addEventListener('change', paintPassportPreview);
  $('passportPick').addEventListener('click', () => $('passportInput').click());
  $('passportInput').addEventListener('change', e => { passportFile = e.target.files[0] || null; passportRotate = 0; e.target.value = ''; renderPassport(); });
  $('passportRotate').addEventListener('click', () => { passportRotate = (passportRotate + 1) % 4; renderPassport(); });
  $('passportMake').addEventListener('click', async () => {
    try {
      opts.onBusy('Making your photo sheet…');
      const file = await passportSheet(passportFile, passportRotate, parseInt($('passportCount').value, 10) || 8);
      opts.onBusy(null); opts.onFile(file, { forceColour: true, service: toolService('tool-passport-photo') });
    } catch (err) { opts.onBusy(null); opts.onError(err.message); }
  });
  renderPassport();


  // ----- ID card / passport copy -----
  let fitters = [];
  function renderSheet() {
    const P = SHEET_PRESETS[currentPreset];
    $('sheetTitle').textContent = P.name;
    $('sheetHint').textContent = P.hint;
    const list = $('sheetSlots'); list.innerHTML = '';
    setFee('sheetFee', toolService(toolIdOf(document.querySelector(`#modes .mode[data-preset="${currentPreset}"]`))));
    fitters = [];
    const refresh = () => {
      const cv = $('sheetPrev'); cv.width = 360;
      paintSheet(cv, P, fitters.map(f => f.st), $('sheetCut').checked);
      const missing = fitters.filter(f => !f.ready()).length;
      $('sheetMake').disabled = missing > 0;
      $('sheetMake').textContent = missing ? (missing === 2 ? 'Add both sides first' : 'Add the other side') : 'Make my print sheet';
    };
    fitters = P.labels.map(l => buildFitter(P, l, refresh));
    fitters.forEach(f => list.appendChild(f.el));
    refresh();
  }
  $('sheetCut').addEventListener('change', () => { if (currentPreset) renderSheetPreview(); });
  function renderSheetPreview() { const cv = $('sheetPrev'); cv.width = 360; paintSheet(cv, SHEET_PRESETS[currentPreset], fitters.map(f => f.st), $('sheetCut').checked); }
  $('sheetMake').addEventListener('click', async () => {
    try {
      opts.onBusy('Making your print sheet…');
      const r = await copySheet(currentPreset, fitters.map(f => f.st), $('sheetCut').checked);
      opts.onBusy(null); opts.onFile(r.file, { exact: r.exact, service: toolService(toolIdOf(document.querySelector(`#modes .mode[data-preset="${currentPreset}"]`))) });
    } catch (err) { opts.onBusy(null); opts.onError(err.message); }
  });

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
    setToolServices(list) {
      if (!Array.isArray(list)) return;            // lookup failed: keep tools visible, no fee
      toolSvc = Object.fromEntries(list.map(t => [t.id, t]));
      document.querySelectorAll('#modes .mode[data-tool]').forEach(b => { b.style.display = toolSvc[b.dataset.tool] ? '' : 'none'; });
    },
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
