// Node's path, for the phone (see fs.js): plain "/" paths only.
const norm = p => { const out = []; for (const s of p.split('/')) { if (!s || s === '.') continue; if (s === '..') out.pop(); else out.push(s); } return '/' + out.join('/'); };
const join = (...a) => norm(a.filter(Boolean).join('/'));
const resolve = (...a) => { let p = ''; for (const s of a) p = s.startsWith('/') ? s : p + '/' + s; return norm(p || '/'); };
const dirname = p => norm(p).replace(/\/[^/]*$/, '') || '/';
const basename = (p, ext) => { const b = norm(p).split('/').pop(); return ext && b.endsWith(ext) ? b.slice(0, -ext.length) : b; };
const extname = p => { const m = /\.[^./]*$/.exec(basename(p)); return m ? m[0] : ''; };
const normalize = norm, sep = '/';
export default { join, resolve, dirname, basename, extname, normalize, sep };
export { join, resolve, dirname, basename, extname, normalize, sep };
