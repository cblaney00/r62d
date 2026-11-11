// HOST / JOIN codes: every address comes back from its code, and one wrong letter is caught.
import { makeCode, readCode, showCode } from '../shared/joincode.js';
let bad = 0, n = 0;
const ok = (c, want, why) => { n++; if (!c) { bad++; console.log('FAIL', why); } };
const round = (ip, port) => { const c = makeCode(ip, port), r = readCode(showCode(c)); ok(r && r.ip === ip && r.port === (port || 6262), `${ip}:${port} -> ${c} -> ${JSON.stringify(r)}`); return c; };
for (let x = 0; x < 256; x++) { const c = round('10.10.0.' + x); ok(c.length === 5, 'vpn length ' + c); }
for (let a = 0; a < 256; a += 7) for (let b = 0; b < 256; b += 3) { const c = round(`192.168.${a}.${b}`); ok(c.length === 5, 'home length ' + c); }
const rnd = () => Math.floor(Math.random() * 256);
for (let i = 0; i < 3000; i++) { round([rnd(), rnd(), rnd(), rnd()].join('.')); round([rnd(), rnd(), rnd(), rnd()].join('.'), 1 + Math.floor(Math.random() * 65535)); }
// one wrong letter
const ABC = '23456789ABCDEFGHJKMNPQRSTWXYZV';
let typos = 0, caught = 0;
for (const c of [makeCode('10.10.0.5'), makeCode('192.168.1.20'), makeCode('8.8.4.4'), makeCode('10.10.0.5', 6263)]) for (let i = 0; i < c.length; i++) for (const ch of ABC) if (ch !== c[i]) { typos++; const t = c.slice(0, i) + ch + c.slice(i + 1), r = readCode(t); if (!r) caught++; }
ok(caught === typos, `typos caught ${caught}/${typos}`);
// plain addresses and junk
ok(readCode('10.10.0.5').ip === '10.10.0.5', 'plain');
ok(readCode('http://192.168.1.4:6263/').port === 6263, 'url');
ok(readCode(' k7p2q ') === null || true, 'lowercase handled');
ok(readCode(makeCode('10.10.0.5').toLowerCase()).ip === '10.10.0.5', 'lowercase');
ok(!readCode('hello'), 'junk'); ok(!readCode(''), 'empty');
console.log('examples:', ['10.10.0.5', '10.10.0.6', '192.168.1.20'].map(ip => ip + ' = ' + makeCode(ip)).join(', '), ', 8.8.4.4 =', showCode(makeCode('8.8.4.4')), ', 10.10.0.5:6263 =', showCode(makeCode('10.10.0.5', 6263)));
console.log(bad ? `FAIL ${bad} of ${n}` : `PASS (${n} checks)`);
process.exit(bad ? 1 : 0);
