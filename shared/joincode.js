// HOST / JOIN codes (he asked: friends are used to "host, read out a code, join"). A code is just the host's
// address written short: K7P2Q instead of http://10.10.0.5:6262. Still only the homelab VPN / home network.
// Letters that look alike (0 O, 1 I L, U V) are left out. The last letter is a check, so a typo says
// "that code isn't right" instead of trying someone else's address.
// Lengths: homelab VPN (10.10.0.x) and home network (192.168.x.y) 5, any other address 8, another port 12.
const ABC = '23456789ABCDEFGHJKMNPQRSTWXYZ' + 'V'; // 30 letters
const N = 30n, MUL = 16807n, ADD = 4242n, W = [1, 7, 11, 13, 17, 19, 23, 29]; // weights coprime to 30: any one wrong letter is caught
export const DEFAULT_PORT = 6262;
const LEN = [4, 4, 7, 11]; // letters before the check, per kind
const ipNum = ip => { const p = String(ip).split('.').map(Number); return p.length === 4 && p.every(x => Number.isInteger(x) && x >= 0 && x <= 255) ? p : null; };
const inv = (a, m) => { let [r0, r1, s0, s1] = [a % m, m, 1n, 0n]; while (r1) { const q = r0 / r1; [r0, r1] = [r1, r0 - q * r1]; [s0, s1] = [s1, s0 - q * s1]; } return ((s0 % m) + m) % m; };
const check = body => { let s = 0; for (let i = 0; i < body.length; i++) s += W[i % W.length] * ABC.indexOf(body[i]); return ABC[s % 30]; };

export function makeCode(ip, port = DEFAULT_PORT) {
  const p = ipNum(ip); if (!p) return '';
  port = +port || DEFAULT_PORT;
  let kind, v;
  if (port !== DEFAULT_PORT) { kind = 3; v = ((BigInt(p[0]) << 24n) | (BigInt(p[1]) << 16n) | (BigInt(p[2]) << 8n) | BigInt(p[3])) * 65536n + BigInt(port); }
  else if (p[0] === 10 && p[1] === 10 && p[2] === 0) { kind = 0; v = BigInt(p[3]); }
  else if (p[0] === 192 && p[1] === 168) { kind = 1; v = BigInt(p[2] * 256 + p[3]); }
  else { kind = 2; v = (BigInt(p[0]) << 24n) | (BigInt(p[1]) << 16n) | (BigInt(p[2]) << 8n) | BigInt(p[3]); }
  const L = LEN[kind], M = N ** BigInt(L);
  let n = ((v * 4n + BigInt(kind)) * MUL + ADD) % M; // shuffled so neighbouring addresses don't look alike
  let body = '';
  for (let i = 0; i < L; i++) { body = ABC[Number(n % N)] + body; n /= N; }
  return body + check(body);
}

// A typed code (any case, spaces and dashes ignored) or a plain address → { ip, port }, else null.
export function readCode(text) {
  const t = String(text || '').trim();
  if (/[.:]/.test(t)) { // an address: 10.10.0.5, 10.10.0.5:6263, http://...
    const m = t.replace(/^https?:\/\//i, '').replace(/\/.*$/, '').match(/^(\d+\.\d+\.\d+\.\d+)(?::(\d+))?$/);
    return m && ipNum(m[1]) ? { ip: m[1], port: m[2] ? +m[2] : DEFAULT_PORT } : null;
  }
  const c = t.toUpperCase().replace(/[\s-]/g, '');
  const L = c.length - 1, kinds = [0, 1, 2, 3].filter(k => LEN[k] === L);
  if (!kinds.length || [...c].some(ch => !ABC.includes(ch))) return null;
  const body = c.slice(0, -1);
  if (check(body) !== c.slice(-1)) return null;
  const M = N ** BigInt(L);
  let n = 0n; for (const ch of body) n = n * N + BigInt(ABC.indexOf(ch));
  n = (((n - ADD) % M + M) % M) * inv(MUL, M) % M;
  const kind = Number(n % 4n), v = n / 4n;
  if (!kinds.includes(kind)) return null;
  const quad = x => [Number(x >> 24n) & 255, Number(x >> 16n) & 255, Number(x >> 8n) & 255, Number(x) & 255].join('.');
  if (kind === 0) return v < 256n ? { ip: '10.10.0.' + v, port: DEFAULT_PORT } : null;
  if (kind === 1) return v < 65536n ? { ip: `192.168.${Number(v) >> 8}.${Number(v) & 255}`, port: DEFAULT_PORT } : null;
  if (kind === 2) return v < 2n ** 32n ? { ip: quad(v), port: DEFAULT_PORT } : null;
  const port = Number(v % 65536n), ip = v / 65536n;
  return ip < 2n ** 32n && port ? { ip: quad(ip), port } : null;
}
// Shown in groups so it is easy to read out: K7P2Q, 4F9X-2KMA, ...
export const showCode = c => c.length <= 5 ? c : c.match(/.{1,4}/g).join('-');
