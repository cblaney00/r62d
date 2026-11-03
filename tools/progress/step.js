// Updates progress.json for the build progress window.
//   node step.js start <n> "<detail>"   step n is being worked on
//   node step.js done <n> "<detail>"    step n is finished
//   node step.js fail <n> "<detail>"    step n hit a problem
//   node step.js log "<line>"           add a line to the log
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const FILE = path.join(path.dirname(fileURLToPath(import.meta.url)), 'progress.json');
const p = JSON.parse(fs.readFileSync(FILE, 'utf8'));
const [cmd, a, b] = process.argv.slice(2);
const now = Date.now();
if (!p.started) p.started = now;
if (cmd === 'log') p.log.push({ at: now, text: a });
else {
  const s = p.steps[Number(a) - 1];
  s.state = cmd === 'start' ? 'doing' : cmd;
  if (cmd === 'start') s.began = now;
  else s.ended = now;
  if (b) s.detail = b;
  p.log.push({ at: now, text: `${cmd === 'start' ? 'Started' : cmd === 'done' ? 'Finished' : 'Problem with'}: ${s.name}${b ? ' — ' + b : ''}` });
}
p.log = p.log.slice(-60);
p.updated = now;
fs.writeFileSync(FILE, JSON.stringify(p, null, 1));
