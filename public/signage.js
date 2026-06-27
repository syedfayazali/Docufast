// Builds a QR code for whatever URL the server is currently configured to
// be reachable at (BASE_URL — e.g. your ngrok address). Uses the free
// api.qrserver.com image API so no QR-generation library is needed locally.
(async function init() {
  const res = await fetch('/api/config');
  const data = await res.json();
  const url = data.baseUrl;

  document.getElementById('urlText').textContent = url;
  const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=${encodeURIComponent(url)}`;
  document.getElementById('qrImg').src = qrApiUrl;
})();
