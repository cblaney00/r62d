// R62D as its own program (Electron). This file is the starter: it opens the window, looks on GitHub for a newer
// release of the game and fetches it (updates.js), then runs the game part (app.js) from the newest copy it has.
// The starter itself only changes with a new download; everything else (game, server, start screen) updates itself.
import { app, BrowserWindow, Menu } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { update } from './updates.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BUNDLED = path.resolve(HERE, '..'); // the game files that came in the download

process.env.R62D_DATA = path.join(app.getPath('userData'), 'data'); // %APPDATA%\R62D\data: profiles, matches, pro practice
fs.mkdirSync(process.env.R62D_DATA, { recursive: true });
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
Menu.setApplicationMenu(null); // no menu, so no Ctrl+W / Ctrl+R shortcuts that close or reload the game

const LOADING = `<!doctype html><meta charset="utf-8"><body style="margin:0;height:100vh;display:grid;place-items:center;align-content:center;gap:18px;
background:#05070a;color:#93a0ad;font:600 18px 'Segoe UI',sans-serif;letter-spacing:.12em"><div style="font:800 64px 'Segoe UI',sans-serif;color:#eef2f5;letter-spacing:.14em">R62D</div>
<div id="s">STARTING…</div><div style="width:320px;height:4px;background:#1a2028"><div id="b" style="height:100%;width:0;background:#f2c14e;transition:width .2s"></div></div></body>`;

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    fullscreen: true, width: 1600, height: 900, backgroundColor: '#05070a', title: 'R62D',
    icon: path.join(HERE, 'icon.png'), autoHideMenuBar: true,
    webPreferences: { preload: path.join(HERE, 'preload.cjs'), contextIsolation: true, sandbox: true, backgroundThrottling: false },
  });
  win.webContents.on('before-input-event', (e, k) => {
    if (k.type === 'keyDown' && k.key === 'F11') { win.setFullScreen(!win.isFullScreen()); e.preventDefault(); }
  });
  win.webContents.on('page-title-updated', e => e.preventDefault());
  await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(LOADING));
  const say = (text, frac) => win.webContents.executeJavaScript(`s.textContent=${JSON.stringify(text)};${frac != null ? `b.style.width='${Math.round(frac * 100)}%'` : ''}`).catch(() => {});

  const dir = await update(BUNDLED, path.join(app.getPath('userData'), 'game'), say);
  try {
    await (await import(pathToFileURL(path.join(dir, 'desktop', 'app.js')).href)).start({ app, win, dir });
  } catch (e) { // a downloaded copy that won't start: forget it and play the one from the download
    console.log('Updated game failed to start, using the original:', e.message);
    if (dir === BUNDLED) throw e;
    fs.rmSync(dir, { recursive: true, force: true });
    await (await import(pathToFileURL(path.join(BUNDLED, 'desktop', 'app.js')).href)).start({ app, win, dir: BUNDLED });
  }
});
app.on('window-all-closed', () => app.quit());
