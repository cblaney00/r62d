// Loaded first on a phone playing alone (the Android app puts it into index.html; see public/phone/README.md). The game
// page talks to its server through a WebSocket and /api/ calls as usual; here both go to the server running in this
// same page (public/phone/server.js), started the first time it is needed.
(() => {
  window.__PENV = {}; // the server's process.env (the app rewrites process.env to this)
  try { const t = localStorage.getItem('r62d-penv'); if (t) { Object.assign(__PENV, JSON.parse(t)); window.process = window.process || { env: __PENV }; } } catch {} // (tests only: e.g. {"R62D_FAST": "1"})
  // he asked (2026-11-18): his controls back to the defaults, on the phone too. Once per phone: keys, sensitivity, aim and
  // lean mode, and the touch controls (stick speed, gyro, tilt, button size, fire mode) are forgotten here and in the
  // phone's profiles, so the game starts from its defaults and saves them. Volumes, crosshair and colours stay.
  try {
    const played = () => { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith('r62dfs:') && k.endsWith('/profiles.json')) return true; } return false; };
    if (!localStorage.getItem('r62d-ctrlreset-1') && played()) { // (a phone that never played here has nothing to reset)
      for (const k of ['r62d-keys-v5', 'r62d-sens', 'r62d-aim', 'r62d-aim2', 'r62d-lean', 'r62d-autofire', 'r62d-fire', 'r62d-gyro', 'r62d-gyroinv',
        'r62d-gyrosens', 'r62d-input', 'r62d-sticksens', 'r62d-tilt', 'r62d-tiltdz', 'r62d-uiscale']) localStorage.removeItem(k);
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i); if (!k || !k.startsWith('r62dfs:') || !k.endsWith('/profiles.json')) continue;
        const p = JSON.parse(localStorage.getItem(k));
        for (const v of Object.values(p || {})) if (v && v.settings) for (const f of ['binds', 'bindsVersion', 'sens', 'adsSens', 'steadySens', 'farFast', 'farFastM', 'aim', 'aimV', 'lean']) delete v.settings[f];
        localStorage.setItem(k, JSON.stringify(p));
      }
    }
    localStorage.setItem('r62d-ctrlreset-1', '1');
  } catch {}
  let srv = null;
  const server = () => srv || (srv = import('/phone/server.js'));
  const later = f => setTimeout(f, 0); // (messages arrive on their own turn, like a network)

  class LocalSocket {
    constructor(url) {
      this.url = String(url); this.readyState = 0; this.binaryType = 'blob'; this.bufferedAmount = 0;
      this.onopen = this.onmessage = this.onclose = this.onerror = null; this._l = {};
      server().then(S => {
        if (this.readyState === 3) return;
        this._c = S.connect(this.url.replace(/^wss?:\/\/[^/]+/, ''), (k, data) => later(() => {
          if (k === 'msg' && this.readyState === 1) this._fire('message', { data });
          else if (k === 'close' && this.readyState !== 3) { this.readyState = 3; this._fire('close', { code: 1000, wasClean: true }); }
        }));
        this.readyState = 1; later(() => this._fire('open', {}));
      }).catch(e => { console.error('phone server failed to start:', e); this.readyState = 3; later(() => { this._fire('error', {}); this._fire('close', { code: 1006 }); }); });
    }
    send(s) { if (this.readyState === 1) { const c = this._c; later(() => c && c.fromPage(String(s))); } }
    close() { if (this.readyState >= 2) return; this.readyState = 3; const c = this._c; if (c) c.sock.close(); }
    addEventListener(k, f) { (this._l[k] || (this._l[k] = [])).push(f); }
    removeEventListener(k, f) { this._l[k] = (this._l[k] || []).filter(x => x !== f); }
    _fire(k, e) { e.type = k; e.target = this; const h = this['on' + k]; if (h) h.call(this, e); for (const f of this._l[k] || []) f.call(this, e); }
  }
  Object.assign(LocalSocket, { CONNECTING: 0, OPEN: 1, CLOSING: 2, CLOSED: 3 });
  window.WebSocket = LocalSocket;

  const realFetch = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const u = new URL(typeof input === 'string' ? input : input.url, location.href);
    if (u.origin !== location.origin || !u.pathname.startsWith('/api/')) return realFetch(input, init);
    const S = await server();
    const [status, body] = S.api(u.pathname, u.searchParams, (init && init.method) || 'GET');
    return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  };
})();
