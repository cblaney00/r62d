// Drives a hidden Firefox over WebDriver BiDi to screenshot the game.
// Usage: node tests/shoot.mjs <port> <outdir> <steps.json>
// Each step: {"js": "...", "wait": ms, "shot": "name"}
import fs from 'node:fs';
const [port, outDir, stepsFile] = process.argv.slice(2);
const steps = JSON.parse(fs.readFileSync(stepsFile, 'utf8'));
const ws = new WebSocket(`ws://127.0.0.1:${port}/session`);
let id = 0; const waiting = new Map();
const call = (method, params) => new Promise((res, rej) => { const i = ++id; waiting.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params })); });
const logs = [];
ws.onmessage = ev => {
  const m = JSON.parse(ev.data);
  if (m.id && waiting.has(m.id)) { const w = waiting.get(m.id); waiting.delete(m.id); m.type === 'error' ? w.rej(new Error(m.error + ': ' + m.message)) : w.res(m.result); }
  else if (m.method === 'log.entryAdded') logs.push(`[${m.params.level}] ${m.params.text}`);
};
const sleep = ms => new Promise(r => setTimeout(r, ms));
ws.onopen = async () => {
  try {
    await call('session.new', { capabilities: {} });
    await call('session.subscribe', { events: ['log.entryAdded'] });
    const tree = await call('browsingContext.getTree', {});
    const ctx = (await call('browsingContext.create', { type: 'tab' })).context;
    await call('browsingContext.setViewport', { context: ctx, viewport: { width: 1600, height: 900 } });
    for (const s of steps) {
      if (s.url) await call('browsingContext.navigate', { context: ctx, url: s.url, wait: 'complete' });
      if (s.js) {
        const r = await call('script.evaluate', { expression: s.js, target: { context: ctx }, awaitPromise: true });
        if (r.result && r.result.value !== undefined) console.log('js ->', String(r.result.value).slice(0, 4000));
        if (r.exceptionDetails) console.log('js error', r.exceptionDetails.text);
      }
      if (s.wait) await sleep(s.wait);
      if (s.shot) {
        const r = await call('browsingContext.captureScreenshot', { context: ctx });
        fs.writeFileSync(`${outDir}/${s.shot}.png`, Buffer.from(r.data, 'base64'));
        console.log('shot', s.shot);
      }
    }
  } catch (e) { console.log('ERROR', e.message); }
  console.log('--- browser log ---\n' + logs.slice(0, 80).join('\n'));
  process.exit(0);
};
