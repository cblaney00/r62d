// The pros' suggestions, tested (he asked 2026-11-20: "pros should also be able to send detailed suggestions on how to fix the
// problems they see in the game so we can test their suggestions during balance patches").
// Every suggestion with an exact change (`fix`: [{ path, to | mul }], and `focus`: the operators it is about; server/opinions.js)
// is played in bot rounds without and with the change (R62D_TWEAK, shared/tweaks.js), and the focus operators' win rates
// compared. Run: node tests/protry.js [rounds each] [--5v5] [--top n] [--save] [--fix '<json list>' --focus op,op]
//   reads the pros' suggestions from the real practice data (read only); --save writes the results back into it as
//   training.tested (BALL KNOWLEDGE → PRO IDEAS shows them). Don't --save while the game server is running.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { measure, rate } from './_measure.js';
const arg = k => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
const rounds = +process.argv[2] || 800, mode = process.argv.includes('--5v5') ? '5v5' : '1v1', top = +arg('--top') || 8;
const REAL = path.join(process.env.R62D_DATA || path.join(os.homedir().startsWith('/root') ? '/home/insideabush' : os.homedir(), '.local/share/r62d/data'), 'pro-training.json');
const training = JSON.parse(fs.readFileSync(REAL, 'utf8'));
let tries = [];
if (arg('--fix')) tries.push({ id: 'manual', fix: JSON.parse(arg('--fix')), focus: arg('--focus').split(','), who: ['you'], text: 'a change tried by hand' });
else {
  const by = {};
  for (const [name, log] of Object.entries(training.suggestions || {})) { const s = log[log.length - 1]; if (!s || !s.fix || !s.fix.length) continue; const k = JSON.stringify(s.fix); (by[k] || (by[k] = { id: s.id, fix: s.fix, focus: s.focus || [], who: [], text: s.text })).who.push(name); }
  tries = Object.values(by).sort((a, b) => b.who.length - a.who.length).slice(0, top);
}
if (!tries.length) { console.log('No suggestion with an exact change yet (they come with the next practice).'); process.exit(0); }
const base = {}, results = {};
console.log(`${tries.length} suggestions, ${rounds} ${mode} rounds each way\n`);
for (const t of tries) {
  const key = t.focus.join(',');
  if (!base[key]) base[key] = await measure({ focus: t.focus, rounds, mode });
  const after = await measure({ focus: t.focus, rounds, mode, env: { R62D_TWEAK: JSON.stringify(t.fix) } });
  const b = base[key], line = t.focus.map(op => { const x = b.ops[op] || { n: 0, won: 0 }, y = after.ops[op] || { n: 0, won: 0 }; return `${op.toUpperCase()} ${rate(x.won, x.n)} → ${rate(y.won, y.n)}`; }).join(', ');
  const sum = r => t.focus.reduce((a, op) => [a[0] + ((r.ops[op] || {}).won || 0), a[1] + ((r.ops[op] || {}).n || 0)], [0, 0]);
  const [bw, bn] = sum(b), [aw, an] = sum(after);
  results[t.id] = { at: Date.now(), mode, fix: t.fix, focus: t.focus, who: t.who, before: [bw, bn], after: [aw, an], atk: [after.atk.won, after.atk.n], atkBefore: [b.atk.won, b.atk.n] };
  console.log(`${t.who.join(', ')}: ${t.fix.map(f => f.path + (f.mul !== undefined ? ' ×' + f.mul : ' = ' + f.to)).join('; ')}\n   ${line}   (attack ${rate(b.atk.won, b.atk.n)} → ${rate(after.atk.won, after.atk.n)})\n`);
}
if (process.argv.includes('--save')) { const cur = JSON.parse(fs.readFileSync(REAL, 'utf8')); cur.tested = { ...(cur.tested || {}), ...results }; fs.writeFileSync(REAL, JSON.stringify(cur)); console.log('saved into', REAL); }
