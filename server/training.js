// What the pro teams have learned from practice (he asked: train them on each new version, 200 rounds; it runs on
// this computer, no AI service, so it costs nothing). Practice matches (train-worker.js) play every plan and operator
// a lot; the results are kept here per map, site and side, and the pros lean towards what wins.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';

const DIR = process.env.R62D_DATA || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'data');
const FILE = path.join(DIR, 'pro-training.json');
export const training = { version: null, at: 0, rounds: 0, verRounds: 0, plans: {}, ops: {}, opx: {}, guns: {}, att: {}, pro: {} }; // opx: per operator, all maps (BALL KNOWLEDGE)
export const ROUNDS_PER_VERSION = 200; // he asked: 200 practice rounds per update is enough
try { Object.assign(training, JSON.parse(fs.readFileSync(FILE, 'utf8'))); } catch {}
for (const k of ['guns', 'att', 'pro']) if (!training[k]) training[k] = {};
// skill uses were counted wrong before (defender bots set their traps before the count started, and bots never
// headshot): those two numbers start again from zero; x[8] = rounds the uses were counted in
for (const x of Object.values(training.opx || {})) if (x.length < 9) { x[5] = 0; x[6] = 0; x[8] = 0; }
export function saveTraining() { try { fs.mkdirSync(DIR, { recursive: true }); fs.writeFileSync(FILE, JSON.stringify(training)); } catch {} }

const rate = r => (r ? (r.w + 1) / (r.n + 2) : 0.5); // wins out of rounds, nudged towards 50% while there are few
export const planKey = (map, site, side, plan) => `${map}|${site}|${side}|${plan}`;
export const opKey = (map, side, op) => `${map}|${side}|${op}`;
export function planWeight(map, site, side, plan) { return rate(training.plans[planKey(map, site, side, plan)]) * 2; } // 1 = no idea yet
export function opWeight(map, side, op) { return rate(training.ops[opKey(map, side, op)]) * 2; }
export function planRecord(map, site, side, plan) { return training.plans[planKey(map, site, side, plan)] || null; }
// Guns and attachments (he asked: the pros should find what is strong this patch): [rounds, wins, kills, deaths].
// guns: 'op|gun' (that gun on that operator), att: 'gun|slot|choice'; pro[name] keeps the same per player
// ({ ops: { op: [...] }, guns: { gun: [...] }, att: { 'gun|slot|choice': [...] } }) for their profile in the PLAYBOOK.
export const gunKey = (op, w) => `${op}|${w}`;
export const attKey = (w, slot, c) => `${w}|${slot}|${c}`;
// how good a [rounds, wins, kills, deaths] record looks: rounds won and fights won both count, nudged to 50% while few
export const recRate = r => r ? (r[1] + r[2] + 1) / (r[0] + r[2] + r[3] + 2) : 0.5;
const recTrials = r => r ? r[0] + r[2] + r[3] : 0;
// Try new things and chase what looks strong (he asked): a guess drawn from how good it might really be. Something hardly
// tried gets a wide guess, so it is picked now and then; something that keeps winning gets a high, narrow one. spread
// > 1 keeps more variety (real matches). r: a record, or [successes, trials] given as { s, n }.
export function guess(r, spread = 1) {
  const p = r.n ? (r.s + 1) / (r.n + 2) : 0.5, sd = Math.sqrt(p * (1 - p) / (r.n + 3)) * spread;
  let z = 0; for (let i = 0; i < 6; i++) z += Math.random(); z = (z - 3) / Math.SQRT1_2; // about a normal draw
  return p + z * sd;
}
export const recGuess = (r, spread) => guess({ s: r ? r[1] + r[2] : 0, n: recTrials(r) }, spread);
export const plainGuess = (r, spread) => guess({ s: r ? r.w : 0, n: r ? r.n : 0 }, spread);
// a record and that pro's own record of the same thing together (their own results counted twice: it is their style)
export function blend(a, b) { const out = [0, 0, 0, 0]; for (const r of [a, b, b]) if (r) r.forEach((v, i) => { out[i] += v; }); return out; }
const addRec = (tbl, k, a) => { const x = tbl[k] || (tbl[k] = [0, 0, 0, 0]); a.forEach((v, i) => { x[i] = (x[i] || 0) + v; }); };
// add a batch of practice results ({ key: [rounds, wins] })
export function addResults(res) {
  for (const [kind, tbl] of [['plans', res.plans || {}], ['ops', res.ops || {}]]) for (const [k, [n, w]] of Object.entries(tbl)) {
    const r = training[kind][k] || (training[kind][k] = { n: 0, w: 0 }); r.n += n; r.w += w;
  }
  for (const [op, a] of Object.entries(res.opx || {})) { const x = training.opx[op] || (training.opx[op] = a.map(() => 0)); a.forEach((v, i) => { x[i] = (x[i] || 0) + v; }); }
  for (const kind of ['guns', 'att']) for (const [k, a] of Object.entries(res[kind] || {})) addRec(training[kind], k, a);
  for (const [name, P] of Object.entries(res.pro || {})) { const T = training.pro[name] || (training.pro[name] = { ops: {}, guns: {}, att: {} }); for (const kind of ['ops', 'guns', 'att']) for (const [k, a] of Object.entries(P[kind] || {})) addRec(T[kind], k, a); }
  training.rounds += res.rounds || 0; training.verRounds = (training.verRounds || 0) + (res.rounds || 0);
}
// a new version of the game makes the old lessons less sure: keep them, but at half weight
export function newVersion(version) {
  if (training.version === version) return;
  training.version = version; training.verRounds = 0;
  for (const kind of ['plans', 'ops']) for (const r of Object.values(training[kind])) { r.n = Math.round(r.n / 2); r.w = Math.round(r.w / 2); }
  const half = x => x.forEach((v, i) => { x[i] = Math.round(v / 2); });
  for (const x of Object.values(training.opx || {})) half(x);
  for (const kind of ['guns', 'att']) for (const x of Object.values(training[kind])) half(x);
  for (const P of Object.values(training.pro)) for (const kind of ['ops', 'guns', 'att']) for (const x of Object.values(P[kind] || {})) half(x);
}
export const roundsLeft = version => training.version !== version ? ROUNDS_PER_VERSION : Math.max(0, ROUNDS_PER_VERSION - (training.verRounds || 0));
export const needsTraining = version => roundsLeft(version) > 0;

// The practice version: a fingerprint of every .js in server/ and shared/ (gameplay code), so menu/art/sound changes
// don't start a new practice. The server's plumbing (web server, saving, practice itself) is left out: changing it
// doesn't change how a match plays. null if the files can't be read.
const NOT_PLAY = new Set(['server.js', 'practice.js', 'training.js', 'train-worker.js', 'store.js', 'ws.js']);
export function playVersion() {
  const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const h = crypto.createHash('sha1'), walk = d => { for (const f of fs.readdirSync(d, { withFileTypes: true }).sort((a, b) => a.name < b.name ? -1 : 1)) { const p = path.join(d, f.name); if (f.isDirectory()) walk(p); else if (f.name.endsWith('.js') && !(d.endsWith('server') && NOT_PLAY.has(f.name))) h.update(f.name).update(fs.readFileSync(p)); } };
  try { for (const d of ['server', 'shared']) walk(path.join(ROOT, d)); return 'p' + h.digest('hex').slice(0, 7); } catch { return null; }
}
