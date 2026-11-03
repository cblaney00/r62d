// R62D as its own program (Electron): the Host / Join screen, the built-in game server and one full-screen window.
// The browser version is unchanged; this only wraps it. build.sh puts this together with server/, shared/ and public/.
import { app, BrowserWindow, ipcMain, Menu } from 'electron';
import net from 'node:net';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PORT = 6262;
let win = null, hosting = false;

// what build.sh wrote down: which version of the game this program is
let build = { version: 'dev', date: '' };
try { build = JSON.parse(fs.readFileSync(path.join(HERE, 'build.json'), 'utf8')); } catch {}

// profiles, match history and pro practice live in this friend's own folder (%APPDATA%\R62D\data on Windows)
process.env.R62D_DATA = path.join(app.getPath('userData'), 'data');
process.env.R62D_VERSION = build.version;
fs.mkdirSync(process.env.R62D_DATA, { recursive: true });

app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
Menu.setApplicationMenu(null); // no menu, so no Ctrl+W / Ctrl+R shortcuts that close or reload the game

const portFree = () => new Promise(ok => {
  const s = net.createServer().once('error', () => ok(false)).once('listening', () => s.close(() => ok(true)));
  s.listen(PORT, '0.0.0.0');
});

// HOST: start the game server inside the program (once), then play on it
ipcMain.handle('host', async () => {
  if (!hosting) {
    if (!(await portFree())) return { error: `Another program on this computer is already using port ${PORT} (maybe R62D is already hosting).` };
    process.env.PORT = String(PORT);
    await import('../server/server.js');
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
ipcMain.handle('menu', () => win.loadFile(path.join(HERE, 'start.html')));

app.whenReady().then(() => {
  win = new BrowserWindow({
    fullscreen: true, width: 1600, height: 900, backgroundColor: '#05070a', title: 'R62D',
    icon: path.join(HERE, 'icon.png'), autoHideMenuBar: true,
    webPreferences: { preload: path.join(HERE, 'preload.cjs'), contextIsolation: true, sandbox: true, backgroundThrottling: false },
  });
  win.webContents.on('before-input-event', (e, k) => {
    if (k.type === 'keyDown' && k.key === 'F11') { win.setFullScreen(!win.isFullScreen()); e.preventDefault(); }
  });
  win.webContents.on('page-title-updated', e => e.preventDefault());
  win.loadFile(path.join(HERE, 'start.html'));
});
app.on('window-all-closed', () => app.quit());
