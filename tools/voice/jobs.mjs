// Lists every recording the game needs (shared/comms.js) as JSON lines for render.py. Run from the project folder.
import { SPEAKERS, CASTER_VOICE, BOT_VOICES, PRO_VOICE, LINES, CAST, TONES, WAYS, clipId, linePieces, slotTone, voiceHas } from '../../shared/comms.js';
import { OPERATORS } from '../../shared/operators.js';
import { PRO_TEAMS, playbook } from '../../shared/pros.js';
import { buildMap, MAP_LIST } from '../../shared/map.js';
import fs from 'node:fs';
const title = s => s[0] + s.slice(1).toLowerCase();
const ops = Object.values(OPERATORS).map(o => title(o.name));
const rooms = new Set(['outside']), maps = [];
for (const id of MAP_LIST) { const m = buildMap(id); maps.push(m.name); for (const r of m.rooms || []) rooms.add(r.name.replace(/^\dF /, '')); }
const plans = [...new Set([...fs.readFileSync('shared/pros.js', 'utf8').matchAll(/plans\.push\(\{ id: '\w+', name: '([^']+)'/g)].map(m => m[1]))];
const names = PRO_TEAMS.flatMap(t => t.players.map(p => p.name)), teams = PRO_TEAMS.map(t => t.name);
const nums = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];
const SLOTS = { op: ops, place: [...rooms], way: WAYS, plan: plans, name: names, name2: names, team: teams, team2: teams, map: maps, n: nums, n2: nums, n3: nums };
const seen = new Set(), out = [];
const add = (v, tone, text) => { const id = clipId(tone, text), k = v + '/' + id; if (seen.has(k)) return; seen.add(k); const t = TONES[tone]; out.push({ v, id, text: /[.!?]$/.test(text) ? text : text + '.', ls: t.ls * SPEAKERS[v][1], k: t.k, up: t.up }); };
for (const v of Object.keys(SPEAKERS)) {
  const caster = CASTER_VOICE.includes(v), book = caster ? CAST : LINES, usedSlots = new Set();
  for (const [cat, def] of Object.entries(book)) def.lines.forEach((line, i) => {
    if (!voiceHas(v, cat, i)) return;
    if (caster && !((v === CASTER_VOICE[1]) === (def.tone === 'desk'))) return; // play-by-play calls, the analyst explains
    for (const p of linePieces(line)) { if (typeof p === 'string') add(v, def.tone, p); else usedSlots.add(p.s); }
  });
  for (const s of usedSlots) for (const val of SLOTS[s] || []) add(v, slotTone(v), val);
}
process.stdout.write(out.map(j => JSON.stringify(j)).join('\n') + '\n');
