// Serves the game the way the Android app does (android/src/.../MainActivity.java, "serve"), so playing alone on a phone
// can be tried in a desktop browser: the server's files with their Node parts swapped for public/phone/node/*, process.env
// as __PENV, no .unref(), and public/phone/shim.js put first into index.html. No game server runs here: the page runs it.
// Run: node tests/phonehost.mjs [port] [root]   (root: a game folder, default this project; e.g. an unzipped R62D-update.zip)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const port = +process.argv[2] || 6265, ROOT = path.resolve(process.argv[3] || path.join(path.dirname(fileURLToPath(import.meta.url)), '..'));
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.ogg': 'audio/ogg', '.wasm': 'application/wasm' };
export function rewrite(p, text) { // the same rules as the app's
  if (p.startsWith('/server/') && p.endsWith('.js')) return text.replace(/from 'node:(\w+)'/g, "from '/phone/node/$1.js'").replace(/process\.env/g, '__PENV').replace(/\.unref\(\)/g, '');
  if (p === '/index.html') return text.replace('<head>', '<head><script src="/phone/shim.js"></script>');
  return text;
}
http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]); if (p === '/') p = '/index.html';
  const file = path.normalize(path.join(ROOT, p.startsWith('/server/') || p.startsWith('/shared/') ? '' : 'public', p));
  if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('not found'); }
    const ext = path.extname(file), t = TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': t, 'Cache-Control': 'no-cache' });
    res.end(ext === '.js' || ext === '.html' ? rewrite(p, data.toString('utf8')) : data);
  });
}).listen(port, () => console.log('phone-style game at http://localhost:' + port));
