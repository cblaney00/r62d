// Replays (he asked 2026-11-15): a bot-only Quick Match is recorded start to finish, only the newest 3 are kept, an
// out-of-date one is deleted, free play doesn't record, and playing it back streams snapshots in time order with
// pause, speed and seek (after a seek the map is exactly what the match had at that moment). A downloaded file
// opens again.
// Run: node tests/replays.js [map]
import './_tmpdata.js';
import fs from 'node:fs';
import path from 'node:path';
import { EventEmitter } from 'node:events';
import { Game } from '../server/game.js';
import { buildMap } from '../shared/map.js';
import { PHASE } from '../shared/constants.js';
import { listReplays, replayFile, ReplayView, openUpload, replayDir } from '../server/replays.js';

let fails = 0; const fail = (...a) => { fails++; console.log('FAIL', ...a); };
const map = process.argv[2] || 'harbor';
const sleep = ms => new Promise(r => setTimeout(r, ms));

// one bot match; shots = the map as it was at a few moments, to compare with seeking
function play(mode = 'quick', free = false, maxMin = 25) {
  const g = new Game(free ? { free: true } : {});
  g.mode = mode; g.recBots = true; g.mapId = map; g.map = buildMap(map); g.botLevel = 5;
  for (let i = 0; i < 10; i++) g.addBot();
  g.startMatch();
  const dt = 1 / 30, shots = []; let t = 0, n = 0;
  while (t < 60 * maxMin && g.phase !== PHASE.LOBBY) {
    g.tick(dt); t += dt;
    if (++n % 2 === 0 && g.phase !== PHASE.LOBBY) {
      g.broadcast();
      if (g.rec && g.rec.frames % 900 === 450) shots.push({ t: g.time - g.rec.t0, tiles: Array.from(g.map.tiles), hp: Array.from(g.map.hp).map(v => Math.max(0, Math.round(v))) });
    }
    if (g.phase === PHASE.MATCH_END) { for (let i = 0; i < 30; i++) g.tick(dt); break; }
  }
  if (g.rec) g.resetToLobby();
  return { g, shots, t };
}

const t0 = performance.now();
const a = play();
console.log(`match 1: ${(a.t / 60).toFixed(1)} min played in ${((performance.now() - t0) / 1000).toFixed(1)} s, ${a.shots.length} map checks`);
for (let i = 0; i < 50 && listReplays().length < 1; i++) await sleep(100); // (writing a long match takes a moment)
let list = listReplays();
if (list.length !== 1) fail('expected 1 replay, got', list.length);
const r = list[0];
if (r) {
  console.log(`replay ${r.id}: ${r.mapName} ${r.modeName}, ${Math.round(r.duration / 60)} min, score ${r.score.join('-')}, ${(r.size / 1048576).toFixed(1)} MB`);
  if (!r.done) fail('replay not marked finished');
  if (!replayFile(r.id)) fail('no file');
}

// playing it back with a pretend socket
class FakeSock extends EventEmitter { constructor() { super(); this.open = true; this.got = []; } send(s) { this.got.push(JSON.parse(s)); } }
if (r) {
  const s = new FakeSock(), v = new ReplayView(s, r.id);
  s.emit('message', JSON.stringify({ t: 'join', name: 'Tester' }));
  const kinds = s.got.map(m => m.t);
  if (kinds[0] !== 'welcome' || !kinds.includes('rpinfo') || !kinds.includes('snap')) fail('start messages', kinds.join(','));
  const info = s.got.find(m => m.t === 'rpinfo');
  if (!info || Math.abs(info.d - r.duration) > 2) fail('length', info && info.d, r.duration);
  if (!info || info.rounds.length < 3) fail('rounds on the timeline', info && info.rounds.length);
  s.got = []; for (let i = 0; i < 40; i++) v.tick(1 / 20);
  const snaps = s.got.filter(m => m.t === 'snap');
  if (snaps.length < 28) fail('1x: snapshots in 2 s', snaps.length); // (this test records 15 a second)
  if (snaps.some((m, i) => i && m.time < snaps[i - 1].time)) fail('snapshots out of order');
  const tA = snaps.length && snaps[snaps.length - 1].rp.at;
  if (Math.abs(tA - 2) > 0.2) fail('clock after 2 s at 1x', tA);
  s.emit('message', JSON.stringify({ t: 'rp', a: 'speed', v: 8 })); s.got = []; for (let i = 0; i < 20; i++) v.tick(1 / 20);
  const tB = s.got.filter(m => m.t === 'snap').pop().rp.at;
  if (Math.abs(tB - tA - 8) > 0.3) fail('8x: 1 s should move 8 s', tB - tA);
  s.emit('message', JSON.stringify({ t: 'rp', a: 'pause', v: 1 })); s.got = []; for (let i = 0; i < 20; i++) v.tick(1 / 20);
  if (s.got.some(m => m.t === 'snap')) fail('paused but still sending');
  // follow: that player's private details come along
  const someone = snaps[snaps.length - 1].players.find(p => p.a);
  s.emit('message', JSON.stringify({ t: 'tv', a: 'follow', id: someone && someone.id }));
  s.emit('message', JSON.stringify({ t: 'rp', a: 'pause', v: 0 })); s.got = []; v.tick(1 / 20); v.tick(1 / 20);
  const fs1 = s.got.filter(m => m.t === 'snap').pop();
  if (someone && (!fs1 || String(fs1.you) !== String(someone.id) || !fs1.mine)) fail('follow gives that player\'s HUD details');
  // seeking: the map must match what the match had then
  for (const sh of a.shots) {
    s.got = []; s.emit('message', JSON.stringify({ t: 'rp', a: 'seek', v: sh.t }));
    const mp = s.got.find(m => m.t === 'rpmap');
    if (!mp) { fail('no map after seek'); continue; }
    let bad = 0; for (let k = 0; k < sh.tiles.length; k++) if (mp.tiles[k] !== sh.tiles[k] || Math.max(0, Math.round(mp.hp[k])) !== sh.hp[k]) bad++;
    if (bad) fail(`seek to ${sh.t.toFixed(1)} s: ${bad} cells differ`);
  }
  s.got = []; s.emit('message', JSON.stringify({ t: 'rp', a: 'seek', v: r.duration - 0.5 })); s.emit('message', JSON.stringify({ t: 'rp', a: 'pause', v: 0 }));
  for (let i = 0; i < 30; i++) v.tick(1 / 20);
  const end = s.got.filter(m => m.t === 'rpst').pop();
  if (!end || !end.e) fail('end not reached / reported', JSON.stringify(s.got.filter(m => m.t !== 'snap').slice(-3)), s.got.filter(m => m.t === 'snap').length);
  // a downloaded file opens again
  const up = openUpload(fs.readFileSync(replayFile(r.id)));
  if (up.error || !up.id) fail('open a downloaded file', up.error);
  const bogus = openUpload(Buffer.from('hello'));
  if (!bogus.error) fail('a non-replay file was accepted');
}

// free play never records
play('quick', true, 0.3); await sleep(200);
if (listReplays().length !== 1) fail('free play made a replay');
// only the newest 3; out of date ones go
// (copies of the recorded one, made a minute apart, stand in for more matches)
const dir = replayDir();
if (r) for (let i = 1; i <= 3; i++) {
  const id = r.id.slice(0, -2) + 'z' + i, m = { ...r, id, date: r.date + i * 60000 };
  fs.copyFileSync(path.join(dir, r.id + '.r62d'), path.join(dir, id + '.r62d')); fs.writeFileSync(path.join(dir, id + '.json'), JSON.stringify(m));
}
list = listReplays();
if (r && list.some(x => x.id === r.id)) fail('the oldest of 4 was kept');
console.log(`after more matches: ${list.length} kept`);
if (list.length > 3) fail('more than 3 kept', list.length);
const any = list[0];
if (any) {
  const f = path.join(dir, any.id + '.json'), m = JSON.parse(fs.readFileSync(f, 'utf8')); m.v = 'pOLD'; fs.writeFileSync(f, JSON.stringify(m));
  if (listReplays().some(x => x.id === any.id)) fail('out-of-date replay still listed');
  if (fs.existsSync(path.join(dir, any.id + '.r62d'))) fail('out-of-date replay file not deleted');
}
console.log(fails ? `${fails} failure(s)` : 'PASS replays');
process.exit(fails ? 1 : 0);
