import { put, del } from '@vercel/blob';

export async function uploadFile(filename, buffer) {
  const blob = await put(filename, buffer, { access: 'public', addRandomSuffix: true });
  return blob.url;
}

export async function deleteFile(url) {
  if (!url) return;
  try { await del(url); } catch (err) { console.error('Blob delete failed:', err.message); }
}
