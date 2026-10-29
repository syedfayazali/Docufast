// Authorizes the customer's browser to upload a file DIRECTLY to Vercel
// Blob storage, bypassing this app's serverless functions for the actual
// file bytes (Vercel caps request bodies at ~4.5MB, which real scanned PDFs
// routinely exceed).
//
// Two stores:
//   - ?private=1 (and PRIVATE_BLOB_READ_WRITE_TOKEN set): the private store,
//     used for all new uploads once it is connected. Files are not readable
//     without our token.
//   - otherwise: refused. There is no public store any more.
import { handleUpload as handleUploadPrivate } from 'blob2/client';
import { privateEnabled, privateToken } from '@/lib/privateBlob';

const MAX_UPLOAD_BYTES = 25 * 1024 * 1024; // 25MB — generous for any real print job

const ALLOWED_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp', 'image/tiff',
];

export default async function handler(req, res) {
  try {
    // Once the private store is connected, every upload goes there; a client
    // cannot opt out by leaving off ?private=1.
    if (!privateEnabled()) return res.status(503).json({ error: 'Secure storage is not configured' });
    const common = {
      body: req.body,
      request: req,
      onBeforeGenerateToken: async () => ({
        allowedContentTypes: ALLOWED_TYPES,
        maximumSizeInBytes: MAX_UPLOAD_BYTES,
        addRandomSuffix: true,
      }),
      // Required by handleUpload; nothing to do — the browser passes the URL on.
      onUploadCompleted: async () => {},
    };
    const jsonResponse = await handleUploadPrivate({ ...common, token: privateToken() });
    return res.status(200).json(jsonResponse);
  } catch (error) {
    console.error('blob-upload-token error:', error.message);
    return res.status(400).json({ error: error.message });
  }
}
