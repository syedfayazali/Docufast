// Wraps Vercel Blob storage. Files are stored under a randomized path so the
// URL itself isn't guessable, and are deleted the moment a job is printed
// (or expires) — see lib/db.js. Requires a Blob store linked to the Vercel
// project (Storage tab in the dashboard); BLOB_READ_WRITE_TOKEN is then
// injected automatically, no manual setup needed.
import { put, del } from '@vercel/blob';

export async function uploadFile(filename, buffer) {
  const blob = await put(filename, buffer, { access: 'public', addRandomSuffix: true });
  return blob.url;
}

export async function deleteFile(url) {
  if (!url) return;
  try {
    await del(url);
  } catch (err) {
    console.error('Blob delete failed (non-fatal):', err.message);
  }
}
