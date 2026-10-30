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

export function countDocxPages(buffer) {
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

export function countDocPages(buffer) {
  // Binary .doc format — page breaks are encoded as 0x0C bytes
  let count = 1;
  for (let i = 0; i < Math.min(buffer.length, 1048576); i++) {
    if (buffer[i] === 0x0C) count++;
  }
  return count > 1 ? count : null; // null if no breaks found (heuristic unreliable)
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
  }
  return null;
}

