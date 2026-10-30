/* Live updates for the browser pages (shop board, owner dashboard, status page).
   Speaks Supabase Realtime's wire protocol directly, so no library is needed.
   The server sends content-free pings ("something changed"); the page then
   re-fetches through its normal authenticated API call.

   DFPush.connect({ url, key, channel, events: ['update'], onEvent, onState })
   onState('connected' | 'down') — pages poll ONLY while it is 'down'.
   Returns { close() }. Reconnects on its own with backoff. */
(function () {
  function connect(o) {
    var ws = null, ref = 0, stopped = false, joined = false, tries = 0;
    var hbTimer = null, hbWait = null, joinTimer = null, retryTimer = null, last = '';
    var topic = 'realtime:' + o.channel;
    var events = o.events || ['update'];

    function state(s) { if (s !== last) { last = s; try { o.onState && o.onState(s); } catch (e) { /* ignore */ } } }
    function send(t, e, p) { try { ws.send(JSON.stringify({ topic: t, event: e, payload: p, ref: String(++ref) })); } catch (x) { /* ignore */ } }
    function clear() { clearInterval(hbTimer); clearTimeout(hbWait); clearTimeout(joinTimer); }
    function drop() {
      clear(); joined = false; state('down');
      try { ws && ws.close(); } catch (e) { /* ignore */ }
      ws = null;
      if (stopped) return;
      tries++;
      retryTimer = setTimeout(open, Math.min(30000, 1000 * Math.pow(2, Math.min(tries, 5))));
    }
    function open() {
      if (stopped) return;
      try { ws = new WebSocket(o.url.replace(/^http/, 'ws').replace(/\/$/, '') + '/realtime/v1/websocket?apikey=' + encodeURIComponent(o.key) + '&vsn=1.0.0'); }
      catch (e) { return drop(); }
      var mine = ws;
      ws.onopen = function () {
        send(topic, 'phx_join', { config: { broadcast: { ack: false, self: false }, presence: { key: '' }, postgres_changes: [], private: true }, access_token: o.key });
        joinTimer = setTimeout(function () { if (mine === ws && !joined) drop(); }, 15000);
      };
      ws.onmessage = function (ev) {
        var m; try { m = JSON.parse(ev.data); } catch (e) { return; }
        if (m.topic === topic && m.event === 'phx_reply') {
          if (m.payload && m.payload.status === 'ok') {
            joined = true; tries = 0; clearTimeout(joinTimer); state('connected');
            clearInterval(hbTimer);
            hbTimer = setInterval(function () {
              send('phoenix', 'heartbeat', {});
              clearTimeout(hbWait);
              hbWait = setTimeout(function () { if (mine === ws) drop(); }, 12000);   // no reply = dead link
            }, 25000);
          } else drop();
        } else if (m.topic === 'phoenix' && m.event === 'phx_reply') {
          clearTimeout(hbWait);
        } else if (m.topic === topic && m.event === 'broadcast' && m.payload && events.indexOf(m.payload.event) !== -1) {
          try { o.onEvent && o.onEvent(m.payload.event); } catch (e) { /* ignore */ }
        } else if (m.topic === topic && (m.event === 'phx_error' || m.event === 'phx_close')) {
          drop();
        }
      };
      ws.onclose = function () { if (mine === ws) drop(); };
      ws.onerror = function () { /* onclose follows */ };
    }
    // A sleeping phone / laptop kills sockets quietly: check when the tab returns.
    function wake() { if (!stopped && document.visibilityState === 'visible' && last !== 'connected') { clearTimeout(retryTimer); tries = 0; open(); } }
    document.addEventListener('visibilitychange', wake);
    window.addEventListener('online', wake);
    open();
    return { close: function () { stopped = true; clear(); clearTimeout(retryTimer); document.removeEventListener('visibilitychange', wake); window.removeEventListener('online', wake); try { ws && ws.close(); } catch (e) { /* ignore */ } } };
  }

  /* Convenience for pages: refresh() on every ping, and poll ONLY while push is down.
     Returns { close() }. cfg is the `push` object from the API (may be null → poll only). */
  function live(cfg, refresh, pollMs, events) {
    var pollTimer = null, conn = null;
    function startPoll() { if (!pollTimer) pollTimer = setInterval(refresh, pollMs); }
    function stopPoll() { clearInterval(pollTimer); pollTimer = null; }
    if (!cfg || typeof WebSocket === 'undefined') { startPoll(); return { close: stopPoll }; }
    startPoll();                       // until the socket is up
    conn = connect({
      url: cfg.url, key: cfg.key, channel: cfg.channel, events: events || ['update', 'job'],
      onEvent: function () { refresh(); },
      onState: function (s) { if (s === 'connected') { stopPoll(); refresh(); } else startPoll(); }
    });
    document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') refresh(); });
    return { close: function () { stopPoll(); conn && conn.close(); } };
  }
  window.DFPush = { connect: connect, live: live };
})();
