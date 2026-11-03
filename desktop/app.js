// The game part of the R62D program: the Host / Join screen and the built-in game server.
// Run by main.js from the newest copy of the game (the download's, or one fetched by updates.js).
import { ipcMain } from 'electron';
import net from 'node:net';
import path from 'node:path';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

const PORT = Number(process.env.R62D_PORT) || 6262; // R62D_PORT: only for testing beside a running server

export async function start({ app, win, dir }) {
  let hosting = false, build = { version: 'dev', date: '', n: 0 };
  try { build = JSON.parse(fs.readFileSync(path.join(dir, 'desktop', 'build.json'), 'utf8')); } catch {}
  process.env.R62D_VERSION = build.version;

  const portFree = () => new Promise(ok => {
    const s = net.createServer().once('error', () => ok(false)).once('listening', () => s.close(() => ok(true)));
    s.listen(PORT, '0.0.0.0');
  });

  for (const k of ['host', 'join', 'info', 'quit', 'menu']) ipcMain.removeHandler(k); // in case a copy that failed set them first

  // HOST: start the game server inside the program (once), then play on it
  ipcMain.handle('host', async () => {
    if (!hosting) {
      if (!(await portFree())) return { error: `Another program on this computer is already using port ${PORT} (maybe R62D is already hosting).` };
      process.env.PORT = String(PORT);
      await import(pathToFileURL(path.join(dir, 'server', 'server.js')).href);
      hosting = true;
    }
    win.loadURL(`http://localhost:${PORT}/?app=1`);
    return { ok: true };
  });

  // JOIN: check a friend's game answers, then play on it
  ipcMain.handle('join', async (_e, addr) => {
    let url;
    try {
      url = new URL(/^https?:\/\//.test(addr) ? addr : 'http://' + addr);
      if (!url.port) url.port = String(PORT);
    } catch { return { error: 'That doesn\'t look like an address.' }; }
    try {
      const r = await fetch(new URL('/api/addr', url), { signal: AbortSignal.timeout(5000) });
      if (!r.ok) throw new Error();
    } catch { return { error: `No R62D game answered at ${url.host}. Check the address and that your friend has clicked HOST.` }; }
    win.loadURL(`${url.origin}/?app=1`);
    return { ok: true };
  });

  ipcMain.handle('info', () => ({ ...build, hosting }));
  ipcMain.handle('quit', () => app.quit());
  ipcMain.handle('menu', () => win.loadFile(path.join(dir, 'desktop', 'start.html')));

  await win.loadFile(path.join(dir, 'desktop', 'start.html'));
}
