// The Android app plays the game with no computer (public/phone/README.md): the server's code runs in the phone's web view.
// This stands in for Node's fs: files are kept in the page's localStorage under "r62dfs:<path>" (profiles, match history,
// the pros' practice numbers: all small). Replays are not kept on a phone (too big for it): those writes vanish.
const K = 'r62dfs:', skip = p => /\/replays(\/|$)/.test(p);
const ls = { get: k => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); return true; } catch { return false; } }, del: k => { try { localStorage.removeItem(k); } catch {} }, keys: () => { try { return Object.keys(localStorage); } catch { return []; } } };
const nf = p => Object.assign(new Error('ENOENT: no such file ' + p), { code: 'ENOENT' });
const text = d => typeof d === 'string' ? d : new TextDecoder().decode(d);
function readFileSync(p, enc) { const v = skip(p) ? null : ls.get(K + p); if (v === null) throw nf(p); return enc ? v : new TextEncoder().encode(v); }
function writeFileSync(p, d) { if (!skip(p)) ls.set(K + p, text(d)); }
const existsSync = p => !skip(p) && (ls.get(K + p) !== null || ls.keys().some(k => k.startsWith(K + p.replace(/\/$/, '') + '/')));
function readdirSync(d, o) {
  if (skip(d)) return [];
  const pre = K + d.replace(/\/$/, '') + '/', names = new Map();
  for (const k of ls.keys()) if (k.startsWith(pre)) { const rest = k.slice(pre.length), i = rest.indexOf('/'); names.set(i < 0 ? rest : rest.slice(0, i), i >= 0); }
  const list = [...names.keys()].sort();
  return o && o.withFileTypes ? list.map(n => ({ name: n, isDirectory: () => names.get(n), isFile: () => !names.get(n) })) : list;
}
function statSync(p) { const v = skip(p) ? null : ls.get(K + p); if (v === null) throw nf(p); return { size: v.length, mtimeMs: Date.now(), isDirectory: () => false, isFile: () => true }; }
function renameSync(a, b) { const v = ls.get(K + a); if (v === null) throw nf(a); if (!skip(b)) ls.set(K + b, v); ls.del(K + a); }
function copyFileSync(a, b) { const v = ls.get(K + a); if (v === null) throw nf(a); if (!skip(b)) ls.set(K + b, v); }
const unlinkSync = p => ls.del(K + p), mkdirSync = () => {};
const sink = () => { const s = { write() { return true; }, end() {}, on() { return s; }, once() { return s; }, pipe(x) { return x; } }; return s; };
const createWriteStream = sink, createReadStream = sink;
export default { readFileSync, writeFileSync, existsSync, readdirSync, statSync, renameSync, copyFileSync, unlinkSync, mkdirSync, createWriteStream, createReadStream };
export { readFileSync, writeFileSync, existsSync, readdirSync, statSync, renameSync, copyFileSync, unlinkSync, mkdirSync, createWriteStream, createReadStream };
