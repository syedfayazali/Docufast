import { inflateRawSync } from 'zlib';
// Page counting and file sanity checks shared by /api/detect-pages (what the
// customer sees) and /api/jobs (what is billed), so the two can never disagree.

export async function countPdfPages(buffer) {
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

// A .docx is a zip. Word records the real page count in docProps/app.xml
// (<Pages>N</Pages>) each time the file is saved, which is far more accurate
// than counting sections. Returns null if it is missing or the file is not a zip.
function zipEntry(buf, wanted) {
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) return null;
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  for (let n = 0; n < count && p + 46 <= buf.length && buf.readUInt32LE(p) === 0x02014b50; n++) {
    const method = buf.readUInt16LE(p + 10), csize = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28), extraLen = buf.readUInt16LE(p + 30), cmtLen = buf.readUInt16LE(p + 32);
    const off = buf.readUInt32LE(p + 42);
    if (buf.toString('utf8', p + 46, p + 46 + nameLen) === wanted) {
      const dataStart = off + 30 + buf.readUInt16LE(off + 26) + buf.readUInt16LE(off + 28);
      const raw = buf.subarray(dataStart, dataStart + csize);
      return method === 0 ? raw : method === 8 ? inflateRawSync(raw) : null;
    }
    p += 46 + nameLen + extraLen + cmtLen;
  }
  return null;
}
export function countDocxPages(buffer) {
  try {
    const xml = zipEntry(buffer, 'docProps/app.xml');
    const m = xml && /<Pages>\s*(\d+)\s*<\/Pages>/.exec(xml.toString('utf8'));
    const n = m ? parseInt(m[1], 10) : 0;
    return n > 0 && n <= 100000 ? n : null;
  } catch {
    return null;
  }
}

// Catches files that would be paid for and then fail at the printer: wrong
// type disguised by its extension, corrupt files, and password-protected PDFs
// (SumatraPDF cannot open those). Returns a customer-readable reason or null.
export function fileProblem(ext, buffer) {
  if (!buffer || buffer.length < 8) return 'This file looks empty or damaged. Please choose it again.';
  const head = buffer.slice(0, 8);
  if (ext === 'pdf') {
    if (buffer.slice(0, 1024).toString('latin1').indexOf('%PDF-') === -1) return 'This is not a valid PDF file. Please choose a different file.';
    // /Encrypt in the trailer = password protected / restricted.
    const tail = buffer.slice(Math.max(0, buffer.length - 4096)).toString('latin1');
    if (/\/Encrypt\s+\d+\s+\d+\s+R/.test(tail) || /\/Encrypt\s*<</.test(tail)) {
      return 'This PDF is password-protected, so it cannot be printed. Remove the password (open it, then Print → Save as PDF) and upload again.';
    }
  } else if (ext === 'jpg' || ext === 'jpeg') {
    if (!(head[0] === 0xFF && head[1] === 0xD8)) return 'This does not look like a real JPG photo. Please choose a different file.';
  } else if (ext === 'png') {
    if (!(head[0] === 0x89 && head[1] === 0x50 && head[2] === 0x4E && head[3] === 0x47)) return 'This does not look like a real PNG image. Please choose a different file.';
  } else if (ext === 'docx') {
    if (!(head[0] === 0x50 && head[1] === 0x4B)) return 'This is not a valid Word (.docx) file. Please save it again from Word and upload.';
  } else if (ext === 'doc') {
    return 'Old Word (.doc) files are not supported. Please save as .docx or PDF and upload again.';
  }
  return null;
}

