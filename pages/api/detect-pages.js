import { readBytes } from '@/lib/privateBlob';
// Detects page count server-side before payment so the customer sees
// the correct price. Takes the uploaded file's Blob URL and returns the
// page count. The result is shown to the customer and confirmed before
// they pay — the jobs endpoint also re-detects independently.
//
// Supported:
//   PDF  — pdf-parse (reads actual PDF structure, works on all PDFs)
//   DOCX — counts section breaks in the XML (±1 page accuracy, good enough)
//   DOC  — binary Word format, heuristic count from page break markers
//   JPG/JPEG/PNG/GIF/WebP/BMP/TIFF — always 1 (images are single-page)
//   Other — returns null (user must enter manually)

import { countPdfPages, countDocxPages, fileProblem } from '@/lib/pagecount';

export const config = { api: { bodyParser: { sizeLimit: '1mb' } } };
// sizeLimit is small on purpose now — this endpoint no longer accepts raw
// file bytes in the request body (see blobUrl path below), so 1mb is
// generous for just a filename + URL.

async function bufferFromRequest(req) {
  const { filename, blobUrl } = req.body || {};
  if (!filename) throw Object.assign(new Error('Missing filename'), { status: 400 });

  if (blobUrl) {
    // New path: the browser already uploaded the file directly to Blob
    // storage (bypassing this API route's body-size limit entirely — see
    // /api/blob-upload-token). We just fetch it back server-side to detect
    // pages; an outbound fetch has no serverless-request-body-size cap the
    // way an inbound POST does.
    try {
      return await readBytes(blobUrl);
    } catch (e) {
      throw Object.assign(new Error('Could not fetch uploaded file'), { status: 502 });
    }
  }

  throw Object.assign(new Error('Missing blobUrl'), { status: 400 });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { filename } = req.body || {};
    const buffer = await bufferFromRequest(req);
    const ext = (filename || '').toLowerCase().split('.').pop();

    const problem = fileProblem(ext, buffer);
    if (problem) return res.status(200).json({ pages: null, problem, filename });

    let pages = null;
    let method = 'unknown';

    if (ext === 'pdf') {
      pages = await countPdfPages(buffer);
      method = 'pdf-parse';
    } else if (ext === 'docx') {
      pages = countDocxPages(buffer);
      method = 'docx-section-count';
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
