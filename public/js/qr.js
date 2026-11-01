// A small QR code maker (byte mode, error correction level M, versions 1-10), so a phone can scan the game's address
// off the screen (OPEN TO LAN, he asked). qrMatrix(text) -> array of rows of booleans (true = dark), no quiet zone.
const ECC_M = { // per version: [error-correction codewords per block, [blocks, data codewords per block], ...]
  1: [10, [1, 16]], 2: [16, [1, 28]], 3: [26, [1, 44]], 4: [18, [2, 32]], 5: [24, [2, 43]],
  6: [16, [4, 27]], 7: [18, [4, 31]], 8: [22, [2, 38], [2, 39]], 9: [22, [3, 36], [2, 37]], 10: [26, [4, 43], [1, 44]],
};
const ALIGN = { 1: [], 2: [6, 18], 3: [6, 22], 4: [6, 26], 5: [6, 30], 6: [6, 34], 7: [6, 22, 38], 8: [6, 24, 42], 9: [6, 26, 46], 10: [6, 28, 50] };

// Reed-Solomon over GF(256), polynomial 0x11d
const EXP = new Array(512), LOG = new Array(256);
{ let x = 1; for (let i = 0; i < 255; i++) { EXP[i] = x; LOG[x] = i; x <<= 1; if (x & 256) x ^= 0x11d; } for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255]; }
const mul = (a, b) => (a && b ? EXP[LOG[a] + LOG[b]] : 0);
function rsGen(n) { let g = [1]; for (let i = 0; i < n; i++) { const ng = new Array(g.length + 1).fill(0); for (let j = 0; j < g.length; j++) { ng[j] ^= g[j]; ng[j + 1] ^= mul(g[j], EXP[i]); } g = ng; } return g; }
function rsEcc(data, n) {
  const g = rsGen(n), r = data.concat(new Array(n).fill(0));
  for (let i = 0; i < data.length; i++) { const c = r[i]; if (c) for (let j = 0; j < g.length; j++) r[i + j] ^= mul(g[j], c); }
  return r.slice(data.length);
}

function codewords(text, v) {
  const bytes = [...new TextEncoder().encode(text)], spec = ECC_M[v], groups = spec.slice(1);
  const dataLen = groups.reduce((s, [b, n]) => s + b * n, 0);
  const bits = []; const put = (val, n) => { for (let i = n - 1; i >= 0; i--) bits.push((val >> i) & 1); };
  put(4, 4); put(bytes.length, v < 10 ? 8 : 16); for (const b of bytes) put(b, 8);
  put(0, Math.min(4, dataLen * 8 - bits.length)); while (bits.length % 8) bits.push(0);
  const data = []; for (let i = 0; i < bits.length; i += 8) data.push(bits.slice(i, i + 8).reduce((a, b) => a * 2 + b, 0));
  for (let pad = 0xec; data.length < dataLen; pad ^= 0xec ^ 0x11) data.push(pad);
  const blocks = []; let at = 0;
  for (const [b, n] of groups) for (let i = 0; i < b; i++) { const d = data.slice(at, at + n); at += n; blocks.push({ d, e: rsEcc(d, spec[0]) }); }
  const out = [], maxD = Math.max(...blocks.map(b => b.d.length));
  for (let i = 0; i < maxD; i++) for (const b of blocks) if (i < b.d.length) out.push(b.d[i]);
  for (let i = 0; i < spec[0]; i++) for (const b of blocks) out.push(b.e[i]);
  return out;
}
const capacity = v => ECC_M[v].slice(1).reduce((s, [b, n]) => s + b * n, 0) - (v < 10 ? 2 : 3);

export function qrMatrix(text) {
  const len = new TextEncoder().encode(text).length;
  let v = 1; while (v <= 10 && capacity(v) < len) v++;
  if (v > 10) throw new Error('text too long for a QR code here');
  const N = 17 + 4 * v, m = [...Array(N)].map(() => new Array(N).fill(null)); // null = free for data
  const set = (x, y, d) => { if (x >= 0 && y >= 0 && x < N && y < N) m[y][x] = d; };
  const finder = (cx, cy) => { for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) { const r = Math.max(Math.abs(dx), Math.abs(dy)); set(cx + dx, cy + dy, r !== 2 && r !== 4); } };
  finder(3, 3); finder(N - 4, 3); finder(3, N - 4);
  for (let i = 8; i < N - 8; i++) { m[6][i] = i % 2 === 0; m[i][6] = i % 2 === 0; } // timing
  const al = ALIGN[v];
  for (const ay of al) for (const ax of al) {
    if ((ax === 6 && ay === 6) || (ax === 6 && ay === al[al.length - 1]) || (ax === al[al.length - 1] && ay === 6)) continue;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) m[ay + dy][ax + dx] = Math.max(Math.abs(dx), Math.abs(dy)) !== 1;
  }
  // reserve format (and version) areas
  for (let i = 0; i < 9; i++) { if (m[8][i] === null) m[8][i] = false; if (m[i][8] === null) m[i][8] = false; }
  for (let i = 0; i < 8; i++) { m[8][N - 1 - i] = false; m[N - 1 - i][8] = false; }
  m[N - 8][8] = true; // the dark module
  if (v >= 7) for (let i = 0; i < 18; i++) { m[Math.floor(i / 3)][N - 11 + i % 3] = false; m[N - 11 + i % 3][Math.floor(i / 3)] = false; }
  const fixed = m.map(r => r.map(c => c !== null));
  // data, zig-zagging up and down two columns at a time from the bottom right
  const cw = codewords(text, v), bits = []; for (const c of cw) for (let i = 7; i >= 0; i--) bits.push((c >> i) & 1);
  let bi = 0;
  for (let right = N - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    const up = ((N - 1 - right) / 2 | 0) % 2 === 0;
    for (let k = 0; k < N; k++) { const y = up ? N - 1 - k : k; for (const x of [right, right - 1]) if (!fixed[y][x]) m[y][x] = bi < bits.length ? !!bits[bi++] : false; }
  }
  const MASKS = [(x, y) => (x + y) % 2 === 0, (x, y) => y % 2 === 0, x => x % 3 === 0, (x, y) => (x + y) % 3 === 0,
    (x, y) => (Math.floor(y / 2) + Math.floor(x / 3)) % 2 === 0, (x, y) => (x * y) % 2 + (x * y) % 3 === 0,
    (x, y) => ((x * y) % 2 + (x * y) % 3) % 2 === 0, (x, y) => ((x + y) % 2 + (x * y) % 3) % 2 === 0];
  const withMask = k => {
    const g = m.map((r, y) => r.map((c, x) => (fixed[y][x] ? c : c !== MASKS[k](x, y))));
    // format bits: level M = 00, then the mask number, BCH(15,5), xor 0x5412
    let f = (0 << 3) | k, r = f << 10; for (let i = 14; i >= 10; i--) if ((r >> i) & 1) r ^= 0x537 << (i - 10);
    const fmt = ((f << 10) | r) ^ 0x5412, bit = i => ((fmt >> i) & 1) === 1;
    for (let i = 0; i <= 5; i++) g[i][8] = bit(i);
    g[7][8] = bit(6); g[8][8] = bit(7); g[8][7] = bit(8);
    for (let i = 9; i < 15; i++) g[8][14 - i] = bit(i);
    for (let i = 0; i < 8; i++) g[8][N - 1 - i] = bit(i);
    for (let i = 8; i < 15; i++) g[N - 15 + i][8] = bit(i);
    if (v >= 7) { let vr = v << 12; for (let i = 17; i >= 12; i--) if ((vr >> i) & 1) vr ^= 0x1f25 << (i - 12); const vb = (v << 12) | vr;
      for (let i = 0; i < 18; i++) { const b = ((vb >> i) & 1) === 1; g[Math.floor(i / 3)][N - 11 + i % 3] = b; g[N - 11 + i % 3][Math.floor(i / 3)] = b; } }
    return g;
  };
  const penalty = g => { // the standard rules, so the chosen mask scans easily
    let p = 0;
    for (let pass = 0; pass < 2; pass++) for (let a = 0; a < N; a++) { let run = 1; for (let b = 1; b < N; b++) { const c = pass ? g[b][a] : g[a][b], d = pass ? g[b - 1][a] : g[a][b - 1]; if (c === d) { run++; if (run === 5) p += 3; else if (run > 5) p++; } else run = 1; } }
    for (let y = 0; y < N - 1; y++) for (let x = 0; x < N - 1; x++) { const c = g[y][x]; if (c === g[y][x + 1] && c === g[y + 1][x] && c === g[y + 1][x + 1]) p += 3; }
    const pat = [1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0], tap = [0, 0, 0, 0, 1, 0, 1, 1, 1, 0, 1];
    for (let y = 0; y < N; y++) for (let x = 0; x <= N - 11; x++) for (const P of [pat, tap]) { if (P.every((b, i) => g[y][x + i] === !!b)) p += 40; if (P.every((b, i) => g[x + i][y] === !!b)) p += 40; }
    const dark = g.flat().filter(Boolean).length; p += Math.floor(Math.abs(dark * 20 - N * N * 10) / (N * N)) * 10;
    return p;
  };
  let best = null, bp = Infinity;
  for (let k = 0; k < 8; k++) { const g = withMask(k), pp = penalty(g); if (pp < bp) { bp = pp; best = g; } }
  return best;
}

// draw it on a canvas: dark modules on white with a 4-module quiet zone
export function drawQr(canvas, text, px = 6) {
  const g = qrMatrix(text), N = g.length, size = (N + 8) * px;
  canvas.width = canvas.height = size;
  const c = canvas.getContext('2d'); c.fillStyle = '#fff'; c.fillRect(0, 0, size, size); c.fillStyle = '#000';
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (g[y][x]) c.fillRect((x + 4) * px, (y + 4) * px, px, px);
}
