import { put, del } from '@vercel/blob';
import { deletePrivate } from '@/lib/privateBlob';

export async function uploadFile(filename, buffer) {
  const blob = await put(filename, buffer, { access: 'public', addRandomSuffix: true });
  return blob.url;
}

export async function deleteFile(url) {
  if (!url) return;
  // Private store first (new uploads), then the public store (older uploads).
  if (await deletePrivate(url)) return;
  try { await del(url); } catch (err) { console.error('Blob delete failed:', err.message); }
}
