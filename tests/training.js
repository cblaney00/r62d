// Pro practice (he asked: train the pros every day on the newest version, without using up AI tokens: it all runs on
// this computer). Runs a short practice in the background thread and checks results come back, are stored, and make
// the pros lean towards what won.
import './_tmpdata.js';
import { Worker } from 'node:worker_threads';
import { training, addResults, planWeight, planKey } from '../server/training.js';
let fails = 0; const bad = (...a) => { fails++; console.log('FAIL', ...a); };
const got = await new Promise(res => {
  const w = new Worker(new URL('../server/train-worker.js', import.meta.url), { workerData: { minutes: +(process.argv[2] || 2) } });
  let n = 0; w.on('message', m => { if (m.done) { w.terminate(); res(n); } else { addResults(m); n += m.rounds; } }); w.on('error', e => { bad(e.message); res(n); });
});
if (got && !(Object.keys(training.guns).length && Object.keys(training.att).length && Object.keys(training.pro).length)) bad('no gun / attachment / per-pro results');
else console.log(`${Object.keys(training.guns).length} gun results, ${Object.keys(training.att).length} attachment results, ${Object.keys(training.pro).length} pros: ${Object.keys(training.pro).join(', ')}`);
const plans = Object.keys(training.plans).length, ops = Object.keys(training.ops).length;
if (got && !Object.keys(training.opx || {}).length) bad('no per-operator numbers (opx) for BALL KNOWLEDGE'); else console.log('opx sample:', JSON.stringify(Object.entries(training.opx).slice(0, 3)));
console.log(`${got} practice rounds: ${plans} plan results, ${ops} operator results`);
if (got < 2 || !plans || !ops) bad('practice produced no results');
// a plan that keeps winning gets picked more
const k = planKey('harbor', 0, 'atk', 'fast'); training.plans[k] = { n: 40, w: 36 }; const k2 = planKey('harbor', 0, 'atk', 'default'); training.plans[k2] = { n: 40, w: 4 };
if (!(planWeight('harbor', 0, 'atk', 'fast') > 1.5 && planWeight('harbor', 0, 'atk', 'default') < 0.5)) bad('weights do not follow the results');
console.log(fails ? `FAIL training (${fails})` : 'PASS training');
process.exit(fails ? 1 : 0);
