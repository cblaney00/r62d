// Shared by tests/protry.js and tests/skillgap.js: how often the given operators win, played in bot rounds under some setting
// (R62D_TWEAK = a change to try, R62D_EAGER = how readily bots use skills). Each round one operator from `focus` is forced
// on one bot of its side (in turn, so all get about the same rounds); everyone else picks as usual.
// mode '1v1' = 1V1 rounds on the small maps (fast, ~0.2 s a round); '5v5' = normal matches on every map with the pro teams.
// measure({ focus, rounds, mode, env, workers }) → { ops: { op: { n, won, kills, deaths, uses } }, atk: { n, won } }
import { fork } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const child = fileURLToPath(new URL('./_measure-child.js', import.meta.url));
export async function measure({ focus, rounds = 600, mode = '1v1', env = {}, workers = 12 }) {
  const W = Math.max(1, Math.min(workers, rounds));
  const parts = await Promise.all([...Array(W)].map((_, i) => new Promise((res, rej) => {
    const c = fork(child, [JSON.stringify({ focus, rounds: Math.ceil(rounds / W), mode, off: i })], { env: { ...process.env, ...env } });
    c.on('message', res); c.on('exit', code => code && rej(new Error('measure worker failed')));
  })));
  const out = { ops: {}, atk: { n: 0, won: 0 } };
  for (const p of parts) { out.atk.n += p.atk.n; out.atk.won += p.atk.won; for (const [k, v] of Object.entries(p.ops)) { const o = out.ops[k] || (out.ops[k] = { n: 0, won: 0, kills: 0, deaths: 0, uses: 0 }); for (const f in o) o[f] += v[f] || 0; } }
  return out;
}
// a win rate with its 90% range, as text
export const rate = (w, n) => { if (!n) return '  -'; const p = w / n, e = 1.645 * Math.sqrt(p * (1 - p) / n); return `${Math.round(p * 100)}% ±${Math.round(e * 100)}`; };
