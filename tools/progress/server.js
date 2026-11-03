// Build progress window (temporary: delete tools/progress when the R62D program is finished).
// Serves page.html on http://127.0.0.1:6263 and the steps from progress.json; step.js updates that file.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const PORT = 6263;

http.createServer((req, res) => {
  const file = req.url.startsWith('/progress.json') ? 'progress.json' : 'page.html';
  fs.readFile(path.join(DIR, file), (err, data) => {
    if (err) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'content-type': file.endsWith('.json') ? 'application/json' : 'text/html; charset=utf-8', 'cache-control': 'no-store' });
    res.end(data);
  });
}).listen(PORT, '127.0.0.1');
