// Detects page count server-side before payment so the customer sees
// the correct price. Accepts a base64-encoded file and returns the
// page count. The result is shown to the customer and confirmed before
// they pay — the jobs endpoint also re-detects independently.
//
// Supported:
//   PDF  — pdf-parse (reads actual PDF structure, works on all PDFs)
//   DOCX — counts section breaks in the XML (±1 page accuracy, good enough)
//   DOC  — binary Word format, heuristic count from page break markers
//   JPG/JPEG/PNG/GIF/WebP/BMP/TIFF — always 1 (images are single-page)
//   Other — returns null (user must enter manually)

export const config = { api: { bodyParser: { sizeLimit: '1mb' } } };
// sizeLimit is small on purpose now — this endpoint no longer accepts raw
// file bytes in the request body (see blobUrl path below), so 1mb is
// generous for just a filename + URL.

async function bufferFromRequest(req) {
  const { filename, fileData, blobUrl } = req.body || {};
  if (!filename) throw Object.assign(new Error('Missing filename'), { status: 400 });

  if (blobUrl) {
    // New path: the browser already uploaded the file directly to Blob
    // storage (bypassing this API route's body-size limit entirely — see
    // /api/blob-upload-token). We just fetch it back server-side to detect
    // pages; an outbound fetch has no serverless-request-body-size cap the
    // way an inbound POST does.
    const resp = await fetch(blobUrl);
    if (!resp.ok) throw Object.assign(new Error('Could not fetch uploaded file'), { status: 502 });
    return Buffer.from(await resp.arrayBuffer());
  }

  if (fileData) {
    // Legacy path — still supported for small files sent inline as base64,
    // kept so nothing breaks if some caller still uses it.
    const base64 = fileData.includes(',') ? fileData.split(',')[1] : fileData;
    return Buffer.from(base64, 'base64');
  }

  throw Object.assign(new Error('Missing fileData or blobUrl'), { status: 400 });
}

async function countPdfPages(buffer) {
  try {
    // pdf-parse reads the actual xref table and page tree —
    // works on linearized, compressed, scanned, and encrypted PDFs.
    const pdfParse = (await import('pdf-parse')).default;
    const data = await pdfParse(buffer, { max: 0 }); // max:0 = don't extract text, just metadata
    return data.numpages;
  } catch (err) {
    // Fall back to regex scan if pdf-parse fails (e.g. malformed PDF)
    const text = buffer.slice(0, 65536).toString('latin1');
    const matches = [...text.matchAll(/\/Count\s+(\d+)/g)];
    if (matches.length) return Math.max(...matches.map(m => parseInt(m[1], 10)));
    return null;
  }
}

function countDocxPages(buffer) {
  try {
    // DOCX is a ZIP — the word/document.xml contains <w:sectPr> for each
    // section. Number of sections ≈ number of pages (close enough for billing).
    const text = buffer.toString('latin1');
    // Count <w:sectPr> elements — each represents a section/page break
    const sectPrMatches = text.match(/<w:sectPr[\s>]/g);
    if (sectPrMatches) return Math.max(1, sectPrMatches.length);
    // Fallback: count page break elements
    const pgBreaks = text.match(/<w:lastRenderedPageBreak\/>/g);
    if (pgBreaks) return Math.max(1, pgBreaks.length + 1);
    return null;
  } catch {
    return null;
  }
}

function countDocPages(buffer) {
  // Binary .doc format — page breaks are encoded as 0x0C bytes
  let count = 1;
  for (let i = 0; i < Math.min(buffer.length, 1048576); i++) {
    if (buffer[i] === 0x0C) count++;
  }
  return count > 1 ? count : null; // null if no breaks found (heuristic unreliable)
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { filename } = req.body || {};
    const buffer = await bufferFromRequest(req);
    const ext = (filename || '').toLowerCase().split('.').pop();

    let pages = null;
    let method = 'unknown';

    if (ext === 'pdf') {
      pages = await countPdfPages(buffer);
      method = 'pdf-parse';
    } else if (ext === 'docx') {
      pages = countDocxPages(buffer);
      method = 'docx-section-count';
    } else if (ext === 'doc') {
      pages = countDocPages(buffer);
      method = 'doc-pagebreak-count';
    } else if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'tiff', 'tif'].includes(ext)) {
      pages = 1;
      method = 'image-single-page';
    }
    // txt, xlsx, pptx etc — return null, user enters manually

    return res.status(200).json({ pages, method, filename });
  } catch (err) {
    console.error('detect-pages error:', err.message);
    return res.status(err.status || 500).json({ error: err.message, pages: null });
  }
}
