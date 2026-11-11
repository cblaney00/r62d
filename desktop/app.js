// The game part of the R62D program: the start screen (PLAY / HOST / JOIN) and the built-in game server.
// Run by main.js from the newest copy of the game (the download's, or one fetched by updates.js).
// PLAY = a game on this computer only; HOST = the same game open to the home network and, on the VPN, Lando's
// homelab; JOIN = find games (Lando's homelab server first, then hosts on the network) and join one.
import { ipcMain } from 'electron';
import net from 'node:net';
import os from 'node:os';
import dgram from 'node:dgram';
import path from 'node:path';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

const PORT = Number(process.env.R62D_PORT) || 6262; // R62D_PORT: only for testing beside a running server
const FIND_PORT = 6264;                              // servers answer "R62D?" here (server/server.js)
const HOMELAB = process.env.R62D_HOMELAB || 'http://192.168.1.76:6262'; // the shared server on Lando's homelab (VPN)
const VPN_NET = '10.10.0.';                          // the homelab VPN: hosts there are found by asking each address

export async function start({ app, win, dir }) {
  let server = null, build = { version: 'dev', date: '', n: 0 };
  try { build = JSON.parse(fs.readFileSync(path.join(dir, 'desktop', 'build.json'), 'utf8')); } catch {}
  process.env.R62D_VERSION = build.version;

  const portFree = bind => new Promise(ok => {
    const s = net.createServer().once('error', () => ok(false)).once('listening', () => s.close(() => ok(true)));
    s.listen(PORT, bind);
  });
  // the game server inside the program, started once; bind 127.0.0.1 = this computer only, 0.0.0.0 = the network
  async function serve(bind) {
    if (server) { await server.openTo(bind); return null; }
    if (!(await portFree(bind))) return `Another program on this computer is already using port ${PORT} (maybe R62D is already open).`;
    process.env.PORT = String(PORT); process.env.R62D_BIND = bind;
    server = await import(pathToFileURL(path.join(dir, 'server', 'server.js')).href);
    return null;
  }

  for (const k of ['play', 'host', 'find', 'join', 'info', 'quit', 'menu']) ipcMain.removeHandler(k); // in case a copy that failed set them first

  ipcMain.handle('play', async () => {
    const error = await serve('127.0.0.1');
    if (error) return { error };
    win.loadURL(`http://localhost:${PORT}/?app=1`);
    return { ok: true };
  });

  ipcMain.handle('host', async () => {
    const error = await serve('0.0.0.0');
    if (error) return { error };
    win.loadURL(`http://localhost:${PORT}/?app=1`);
    return { ok: true };
  });

  // every R62D game this computer can reach: [{ url, name, players, version, homelab }], the homelab's first
  ipcMain.handle('find', async () => {
    const mine = new Set(['127.0.0.1']), found = new Map();
    const nets = Object.values(os.networkInterfaces()).flat().filter(a => a && a.family === 'IPv4');
    for (const a of nets) mine.add(a.address);
    const info = async (url, ms) => {
      try { const r = await fetch(new URL('/api/addr', url), { signal: AbortSignal.timeout(ms) }); const a = r.ok ? await r.json() : null; return a && a.version ? a : null; } catch { return null; } // a version = it really is R62D
    };
    const add = (url, name, players, version, homelab = false) => { if (!found.has(url)) found.set(url, { url, name, players, version, homelab }); };

    const homelab = info(HOMELAB, 2500).then(a => { if (a) add(HOMELAB, 'Lando\'s homelab', a.players, a.version && a.version.id, true); });
    // hosts on the home network answer a broadcast
    const lan = new Promise(done => {
      const s = dgram.createSocket('udp4');
      s.on('error', () => {});
      s.on('message', (m, from) => {
        try { const a = JSON.parse(m); if (a.r62d && !mine.has(from.address)) add(`http://${from.address}:${a.port}`, a.host, a.players, a.version); } catch {}
      });
      s.bind(() => {
        s.setBroadcast(true);
        const to = new Set(['255.255.255.255']);
        for (const a of nets) if (!a.internal && a.netmask) to.add(a.address.split('.').map((p, i) => (+p | (~+a.netmask.split('.')[i] & 255))).join('.'));
        for (const t of to) for (let i = 0; i < 2; i++) s.send('R62D?', FIND_PORT, t, () => {});
      });
      setTimeout(() => { try { s.close(); } catch {} done(); }, 1500);
    });
    // the VPN passes no broadcasts, so on the homelab VPN every address is asked directly
    const vpn = nets.some(a => a.address.startsWith(VPN_NET))
      ? Promise.all(Array.from({ length: 254 }, (_, i) => VPN_NET + (i + 1)).filter(ip => !mine.has(ip))
        .map(ip => info(`http://${ip}:${PORT}`, 1500).then(a => { if (a) add(`http://${ip}:${PORT}`, a.host, a.players, a.version && a.version.id); })))
      : null;
    await Promise.all([homelab, lan, vpn]);
    // the homelab's server can also answer from its own address: show it once
    const list = [...found.values()], lab = list.find(g => g.homelab);
    return list.filter(g => g === lab || !lab || g.name !== 'mini-server').sort((a, b) => b.homelab - a.homelab);
  });

  // JOIN one game (from the list, or a typed address)
  ipcMain.handle('join', async (_e, addr) => {
    let url;
    if (!/[.:]/.test(addr)) { // a HOST code (shared/joincode.js) rather than an address
      const { readCode } = await import(pathToFileURL(path.join(dir, 'shared', 'joincode.js')).href);
      const r = readCode(addr); if (!r) return { error: 'That code isn\'t right. Check each letter with your friend.' };
      addr = r.ip + ':' + r.port;
    }
    try {
      url = new URL(/^https?:\/\//.test(addr) ? addr : 'http://' + addr);
      if (!url.port) url.port = String(PORT);
    } catch { return { error: 'That doesn\'t look like an address.' }; }
    try {
      const r = await fetch(new URL('/api/addr', url), { signal: AbortSignal.timeout(5000) });
      if (!r.ok) throw new Error();
    } catch { return { error: `No R62D game answered at ${url.host}.` }; }
    win.loadURL(`${url.origin}/?app=1`);
    return { ok: true };
  });

  ipcMain.handle('info', () => ({ ...build }));
  ipcMain.handle('quit', () => app.quit());
  ipcMain.handle('menu', () => win.loadFile(path.join(dir, 'desktop', 'start.html')));

  await win.loadFile(path.join(dir, 'desktop', 'start.html'));
}
