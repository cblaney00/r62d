// What the pro teams have learned from practice (he asked: train them every day on the newest version; it runs on
// this computer, no AI service, so it costs nothing). Practice matches (train-worker.js) play every plan and operator
// a lot; the results are kept here per map, site and side, and the pros lean towards what wins.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = process.env.R62D_DATA || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'data');
const FILE = path.join(DIR, 'pro-training.json');
export const training = { version: null, at: 0, rounds: 0, plans: {}, ops: {} };
try { Object.assign(training, JSON.parse(fs.readFileSync(FILE, 'utf8'))); } catch {}
export function saveTraining() { try { fs.mkdirSync(DIR, { recursive: true }); fs.writeFileSync(FILE, JSON.stringify(training)); } catch {} }

const rate = r => (r ? (r.w + 1) / (r.n + 2) : 0.5); // wins out of rounds, nudged towards 50% while there are few
export const planKey = (map, site, side, plan) => `${map}|${site}|${side}|${plan}`;
export const opKey = (map, side, op) => `${map}|${side}|${op}`;
export function planWeight(map, site, side, plan) { return rate(training.plans[planKey(map, site, side, plan)]) * 2; } // 1 = no idea yet
export function opWeight(map, side, op) { return rate(training.ops[opKey(map, side, op)]) * 2; }
export function planRecord(map, site, side, plan) { return training.plans[planKey(map, site, side, plan)] || null; }
// add a batch of practice results ({ key: [rounds, wins] })
export function addResults(res) {
  for (const [kind, tbl] of [['plans', res.plans || {}], ['ops', res.ops || {}]]) for (const [k, [n, w]] of Object.entries(tbl)) {
    const r = training[kind][k] || (training[kind][k] = { n: 0, w: 0 }); r.n += n; r.w += w;
  }
  training.rounds += res.rounds || 0;
}
// a new version of the game makes the old lessons less sure: keep them, but at half weight
export function newVersion(version) {
  if (training.version === version) return;
  for (const kind of ['plans', 'ops']) for (const r of Object.values(training[kind])) { r.n = Math.round(r.n / 2); r.w = Math.round(r.w / 2); }
}
export const needsTraining = version => training.version !== version || Date.now() - (training.at || 0) > 24 * 3600 * 1000;
