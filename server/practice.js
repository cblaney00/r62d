// Run pro practice now, from the command line (he asked for a big batch: `node server/practice.js 600`). The same
// practice matches as the daily one (train-worker.js), shared over several threads, saved into the real pro-training
// data as they come in, counted towards this version. Don't run it while the game server is running (both would write).
import os from 'node:os';
import { Worker } from 'node:worker_threads';
import { training, addResults, saveTraining, newVersion, playVersion } from './training.js';

const total = Number(process.argv[2]) || 200, threads = Math.max(1, Math.min(8, Number(process.env.R62D_TRAIN_WORKERS) || Math.floor(os.cpus().length / 3)));
newVersion(playVersion());
let got = 0, live = threads; const t0 = Date.now();
for (let i = 0; i < threads; i++) {
  const w = new Worker(new URL('./train-worker.js', import.meta.url), { resourceLimits: { maxOldGenerationSizeMb: 512 }, workerData: { minutes: 120, rounds: Math.ceil((total - i) / threads), duty: 1 } });
  w.on('message', m => { if (m.crash) { console.log('a practice match crashed on ' + m.map + ' (skipped):\n' + m.crash); return; } if (m.done) { if (--live === 0) { training.at = Date.now(); saveTraining(); console.log(`done: ${got} rounds in ${Math.round((Date.now() - t0) / 1000)} s, ${training.verRounds} on this version`); } return; }
    addResults(m); got += m.rounds || 0; if (got % 50 === 0) { saveTraining(); console.log(`${got} / ${total} rounds`); } });
  w.on('error', e => console.log('practice thread stopped:', e.stack || e.message));
}
