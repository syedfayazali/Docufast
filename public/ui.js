// Thin line icons (1.5px stroke, inherit colour). Usage: <i class="ic" data-ic="lock"></i>
(function () {
  var P = {
    lock: '<rect x="4.5" y="10.5" width="15" height="10" rx="2.5"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/>',
    zap: '<path d="M13 3 5 13.5h6L10.5 21 19 10h-6.2z"/>',
    pin: '<path d="M12 21s6.5-5.6 6.5-11a6.5 6.5 0 0 0-13 0c0 5.4 6.5 11 6.5 11z"/><circle cx="12" cy="10" r="2.3"/>',
    upload: '<path d="M12 16V4.5M7.5 9 12 4.5 16.5 9"/><path d="M5 15v2.5A2.5 2.5 0 0 0 7.5 20h9a2.5 2.5 0 0 0 2.5-2.5V15"/>',
    file: '<path d="M14 3.5H8A2.5 2.5 0 0 0 5.5 6v12A2.5 2.5 0 0 0 8 20.5h8a2.5 2.5 0 0 0 2.5-2.5V8z"/><path d="M14 3.5V8h4.5"/>',
    image: '<rect x="4" y="5" width="16" height="14" rx="2.5"/><circle cx="9" cy="10" r="1.6"/><path d="m4.5 17 4.5-4.2 3.3 3 2.7-2.3 4.5 3.5"/>',
    user: '<circle cx="12" cy="8.5" r="3.5"/><path d="M5 20c.8-3.6 3.6-5.5 7-5.5s6.2 1.9 7 5.5"/>',
    camera: '<path d="M4 8.5A2 2 0 0 1 6 6.5h2l1.3-2h5.4l1.3 2h2a2 2 0 0 1 2 2V17a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z"/><circle cx="12" cy="12.5" r="3.3"/>',
    check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
    printer: '<path d="M7 9V4.5h10V9"/><rect x="4" y="9" width="16" height="8" rx="2"/><path d="M7 14.5h10V20H7z"/>',
    bell: '<path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 1.5h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>',
    bellOff: '<path d="M6 16.5V11a6 6 0 0 1 9.5-4.8M18 11v5.5l1.5 1.5h-15"/><path d="M10 20.5a2 2 0 0 0 4 0M4 4l16 16"/>',
    store: '<path d="M4 9.5 5.5 4h13L20 9.5"/><path d="M4 9.5a2.7 2.7 0 0 0 5.3 0 2.7 2.7 0 0 0 5.4 0 2.7 2.7 0 0 0 5.3 0"/><path d="M5.5 12v8h13v-8"/>',
    shield: '<path d="M12 3.5 5 6v5.5c0 4.2 2.9 7.2 7 9 4.1-1.8 7-4.8 7-9V6z"/><path d="m9 12 2.2 2.2L15.5 10"/>',
    trash: '<path d="M5 7h14M10 7V4.5h4V7M7 7l.8 12.5h8.4L17 7"/>',
    arrowLeft: '<path d="M19 12H5M10.5 6.5 5 12l5.5 5.5"/>',
    copy: '<rect x="8.5" y="8.5" width="11" height="11" rx="2"/><path d="M15.5 8.5V6.5A2 2 0 0 0 13.5 4.5h-7a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h2"/>',
    download: '<path d="M12 4.5V16M7.5 11.5 12 16l4.5-4.5"/><path d="M5 17v1.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V17"/>',
    receipt: '<path d="M6 3.5h12v17l-3-2-3 2-3-2-3 2z"/><path d="M9 8.5h6M9 12h6"/>',
    search: '<circle cx="11" cy="11" r="6"/><path d="m20 20-4.2-4.2"/>',
    key: '<circle cx="8" cy="15" r="3.5"/><path d="m10.5 12.5 8-8M15.5 7.5l2.5 2.5"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    refresh: '<path d="M19 8a7.5 7.5 0 0 0-13.5-1.5M5 3.5v3h3M5 16a7.5 7.5 0 0 0 13.5 1.5M19 20.5v-3h-3"/>',
    tag: '<path d="M4 12.2V5.5A1.5 1.5 0 0 1 5.5 4h6.7l7.3 7.3a1.5 1.5 0 0 1 0 2.1l-6.1 6.1a1.5 1.5 0 0 1-2.1 0z"/><circle cx="8.5" cy="8.5" r="1.2"/>',
    briefcase: '<rect x="4" y="7.5" width="16" height="11.5" rx="2.5"/><path d="M9 7.5V6a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 6v1.5M4 13h16"/>',
    handshake: '<path d="M3.5 11.5 8 7l4 2.5 4-2.5 4.5 4.5-3 3-3.5-1-2 3-3-.5-3-2.5z"/>',
    chart: '<path d="M4.5 19.5h15M7.5 16v-4M12 16V7.5M16.5 16v-6.5"/>',
    list: '<path d="M8.5 7h11M8.5 12h11M8.5 17h11"/><circle cx="4.8" cy="7" r=".6"/><circle cx="4.8" cy="12" r=".6"/><circle cx="4.8" cy="17" r=".6"/>',
    logout: '<path d="M14 4.5H7A2.5 2.5 0 0 0 4.5 7v10A2.5 2.5 0 0 0 7 19.5h7M10.5 12h9M16.5 8.5 20 12l-3.5 3.5"/>',
    qr: '<rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><path d="M14 14h2.5v2.5H14zM18 18h2M17.5 14v1M20 14v1"/>'
  };
  function paint(root) {
    (root || document).querySelectorAll('i.ic[data-ic]:not([data-done])').forEach(function (el) {
      var p = P[el.getAttribute('data-ic')]; if (!p) return;
      el.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true">' + p + '</svg>';
      el.setAttribute('data-done', '1');
    });
  }
  window.dfIcons = paint;
  window.dfIcon = function (n, cls) { return '<i class="ic ' + (cls || '') + '" data-ic="' + n + '"></i>'; };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { paint(); });
  else paint();
  new MutationObserver(function () { paint(); }).observe(document.documentElement, { childList: true, subtree: true });
})();
