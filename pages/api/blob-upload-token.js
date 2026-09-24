// Authorizes the customer's browser to upload a file DIRECTLY to Vercel
// Blob storage, bypassing this app's serverless functions entirely for the
// actual file bytes. This is what fixes the old ~3MB effective upload
// ceiling: a scanned multi-page PDF (very normal for a print shop customer
// — ID proofs, mark sheets, phone-scanned assignments) routinely exceeds
// that, and Vercel's platform enforces a hard ~4.5MB request body cap on
// serverless functions regardless of any sizeLimit config — raising a
// config number doesn't fix it, only skipping the function body does.
//
// The client (public/app.js) calls @vercel/blob/client's upload() helper,
// which POSTs here first to get a short-lived token, then PUTs the file
// bytes straight to Blob storage using that token.
import { handleUpload } from '@vercel/blob/client';

const MAX_UPLOAD_BYTES = 25 * 1024 * 1024; // 25MB — generous for any real print job

export default async function handler(req, res) {
  try {
    const jsonResponse = await handleUpload({
      body: req.body,
      request: req,
      onBeforeGenerateToken: async () => ({
        // Restrict to types the print pipeline actually understands —
        // matches what detect-pages.js / the agent's SumatraPDF step handle.
        allowedContentTypes: [
          'application/pdf',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp', 'image/tiff',
        ],
        maximumSizeInBytes: MAX_UPLOAD_BYTES,
        addRandomSuffix: true,
      }),
      // Vercel's Blob backend calls this route a second time (server-to-server)
      // once the upload actually finishes. We don't need to do anything here —
      // the browser gets the blob URL directly from upload() and passes it to
      // /api/jobs itself — but handleUpload requires this callback to exist.
      onUploadCompleted: async () => {},
    });
    return res.status(200).json(jsonResponse);
  } catch (error) {
    console.error('blob-upload-token error:', error.message);
    return res.status(400).json({ error: error.message });
  }
}
