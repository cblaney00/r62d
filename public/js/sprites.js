// Top-down drawings of operators, drones, gadgets and the objective.
import { OPERATORS, WEAPONS, bodyW, RIOT } from '/shared/operators.js';
import { shade } from './textures.js';
import { G } from './gunart.js';
import { HEADGEAR, PACK, VEST } from './headgear.js';
const HAIR = ['#1b1512', '#3a2618', '#5a3a22', '#8a6a3a', '#c9a060', '#2a2a2a', '#6a2a1a', '#d8d2c4'];
const hairOf = op => HAIR[(op.charCodeAt(0) * 7 + op.charCodeAt(op.length - 1) * 3 + op.length) % HAIR.length];

// what's on someone's back (PACK in headgear.js): one small drawing per kind
function drawPack(ctx, kind, o, u) {
  const k = String(kind || '').replace(/\d+$/, ''), v = +(String(kind).match(/\d+$/) || [1])[0], col = o.color;
  switch (k) {
    case 'none': return;
    case 'tank': box(ctx, -12.5, -4 + v, 5, 7, 2.4, v === 4 ? '#4a5a6a' : '#7a4a2a'); cap(ctx, -9, 1 + v, -4, 6, 0.6, '#222'); break; // gas bottle and hose
    case 'dragbag': box(ctx, -13, -7.5, 4, 15, 1.6, '#4a4a3a'); ctx.fillStyle = '#2a2a22'; ctx.fillRect(-12.6, -1, 3.2, 2); break;
    case 'tube': cap(ctx, -10, -7 + v * 2, -10, 7 - v, 3.4, v === 2 ? '#5a2a20' : '#3a3424'); ctx.fillStyle = col; ctx.fillRect(-11.6, -1, 3.2, 1.2); break;
    case 'laptop': box(ctx, -12, -5, 4.5, 10, 0.8, '#202228'); ctx.fillStyle = col; ctx.fillRect(-11.4, -3.5, 3.2, 0.7); break;
    case 'canisters': for (const y of v === 2 ? [-4, 0, 4] : [-3.4, 3.4]) ell(ctx, -10, y, 2, 2, v === 2 ? '#8aa040' : '#8a9096'); break;
    case 'radio': box(ctx, -11.5, -4, 4.5, 8, 1, '#2a2e2a'); cap(ctx, -10, v === 2 ? 3 : -3, -16, v === 2 ? 7 : -8, 0.6, '#999'); break;
    case 'sling': cap(ctx, -6, -7.5, -9, 7.5, 1.4, u.strap); box(ctx, -10.5, 2 * v - 3, 3.5, 4, 1, u.dark); break;
    case 'crate': box(ctx, -13, -5.5, 6, 11, 0.6, '#3a3d44'); ctx.fillStyle = '#e8b030'; ctx.fillRect(-12.6, -0.5, 5.2, 1); break;
    case 'projector': box(ctx, -11.5, -4, 4.5, 8, 2, '#3a3050'); ell(ctx, -9.2, 0, 1.3, 1.3, col); break;
    case 'coil': ctx.strokeStyle = '#b08030'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(-10, 0, 3.6, 0, 7); ctx.stroke(); ctx.beginPath(); ctx.arc(-10, 0, 2, 0, 7); ctx.stroke(); break;
    case 'reel': ell(ctx, -10, 0, 3.6, 3.6, '#2a3a2a'); ell(ctx, -10, 0, 1.4, 1.4, col); break;
    case 'hammer': cap(ctx, -13, 6, -5, -6, 1.2, '#6a4a2a'); box(ctx, -15, 4.5, 4, 4, 0.6, '#555a60'); break;
    case 'discs': for (const y of [-3.5, 0, 3.5]) { ell(ctx, -10, y, 2.4, 1.6, '#9aa0a8'); } break;
    case 'flares': for (let i = 0; i < 4; i++) { cap(ctx, -12 + i * 1.6, -4, -12 + i * 1.6, 4, 1, i % 2 ? '#d84a2a' : '#ff9f2e'); } break;
    case 'spikes': for (const y of [-3, 0, 3]) cap(ctx, -14, y, -7, y, 0.9, '#8a8f96'); break;
    case 'ammo': box(ctx, -11.5, -5, 4.5, 10, 0.6, '#4a5030'); ctx.fillStyle = '#c8a040'; for (let i = 0; i < 4; i++) ctx.fillRect(-11, -4 + i * 2.3, 3.6, 0.6); break;
    case 'medbag': box(ctx, -12, -4.5, 5, 9, 1.4, v === 2 ? '#e8e8e8' : '#c83a3a'); ctx.fillStyle = v === 2 ? '#c22' : '#fff'; ctx.fillRect(-10, -2, 1, 4); ctx.fillRect(-11.5, -0.5, 4, 1); break;
    case 'plates': for (const y of [-4, 0.5]) box(ctx, -12, y, 4.5, 3.6, 0.4, '#6a6a5a'); break;
    case 'roll': box(ctx, -11.5, -6, 4, 12, 2, '#5a4a6a'); ctx.fillStyle = '#ccc'; for (const y of [-3, 0, 3]) ctx.fillRect(-11, y, 3, 0.4); break;
    case 'cloak': ctx.fillStyle = v === 2 ? shade(o.helmet, 1.2) : '#121317'; ctx.beginPath(); ctx.moveTo(-3, -8.5); ctx.quadraticCurveTo(-15, 0, -3, 8.5); ctx.closePath(); ctx.fill(); break;
    case 'panel': box(ctx, -12.5, -6, 4.5, 12, 1, '#59626b'); ctx.fillStyle = '#d9b02a'; for (let i = 0; i < 3; i++) ctx.fillRect(-12.3, -5 + i * 4, 4, 1); break;
    case 'jammer': box(ctx, -11.5, -4, 4.5, 8, 1.2, '#2b2f36'); ctx.fillStyle = '#55c1e8'; ctx.fillRect(-10.5, -2.5, 1.2, 1.2); cap(ctx, -9, -3, -14, -9, 0.6, '#999'); break;
    case 'pouches': for (const y of v === 2 ? [-5, -1, 3] : [-4, 1.5]) box(ctx, -9.8, y, 3, 3, 0.6, v === 2 ? '#4a5a3a' : '#33402a'); break;
    case 'antennas': box(ctx, -11, -3, 3.6, 6, 1, '#222'); for (const y of [-2, 2]) cap(ctx, -9, y, -15, y * 3, 0.5, '#aaa'); break;
    case 'baton': cap(ctx, -9, -6, -9, 6, 1.1, '#111'); box(ctx, -10.5, 3, 3, 3, 0.6, '#1a1a1a'); break;
    case 'toolbox': box(ctx, -12.5, -4.5, 5.5, 9, 0.6, '#b03a2a'); cap(ctx, -12, 0, -7.5, 0, 0.6, '#222'); break;
    case 'mics': for (const y of [-3.5, 3.5]) { cap(ctx, -7, y, -12, y, 0.8, '#222'); ell(ctx, -12.5, y, 1.2, 1.2, '#555'); } break;
    case 'armorbag': box(ctx, -13, -6.5, 6.5, 13, 2, '#3a4a3a'); ctx.fillStyle = '#e0e0e0'; ctx.fillRect(-11, -1.5, 2.5, 3); break;
    case 'wire': ell(ctx, -10, 0, 3, 3, v === 2 ? '#4a3a5a' : '#3a3a2a'); ctx.strokeStyle = v === 2 ? '#ff5050' : '#c8c8c8'; ctx.lineWidth = 0.5; for (const r of [1, 2, 2.6]) { ctx.beginPath(); ctx.arc(-10, 0, r, 0, 7); ctx.stroke(); } break;
    case 'camcase': box(ctx, -12, -4.5, 5, 9, 1, '#2a2a30'); for (const y of [-2, 1.5]) ell(ctx, -9.5, y, 0.9, 0.9, '#7ad'); break;
    case 'darts': box(ctx, -11, -5, 3.6, 10, 1, '#4a3a2a'); ctx.fillStyle = col; for (let i = 0; i < 5; i++) ctx.fillRect(-11.6, -4 + i * 2, 1.2, 0.6); break;
    case 'speaker': box(ctx, -12, -4, 5, 8, 1.6, '#2a2228'); ell(ctx, -9.5, 0, 1.8, 1.8, '#111'); break;
    case 'bottle': box(ctx, -10.5, -1.5, 4, 3, 1.4, '#4aa0d8'); cap(ctx, -6, -6, -6, 6, 1, u.strap); break;
    case 'tripod': for (const a of [-0.4, 0, 0.4]) cap(ctx, -6, 0, -6 - Math.cos(a) * 9, Math.sin(a) * 9, 0.7, '#3a3a3a'); break;
    case 'medcase': box(ctx, -12, -5, 5, 10, 0.8, '#e8f0f0'); ctx.fillStyle = '#2a9a5a'; ctx.fillRect(-10, -2, 1, 4); ctx.fillRect(-11.5, -0.5, 4, 1); break;
    case 'hive': box(ctx, -12.5, -4.5, 5.5, 9, 2.4, 'rgba(60,90,70,0.85)'); ctx.fillStyle = `rgba(110,240,140,${0.35 + 0.2 * Math.sin(performance.now() / 333)})`; for (let i = 0; i < 7; i++) ctx.fillRect(-11.8 + (i * 1.7) % 4.2, -3.6 + i * 1.1, 0.6, 0.6); break; // MAGPIE's swarm jar
    case 'radar': box(ctx, -11, -3, 3.6, 6, 1, '#2a3036'); ctx.strokeStyle = col; ctx.lineWidth = 0.6; ctx.beginPath(); ctx.arc(-13, 0, 3, -1, 1); ctx.stroke(); break;
    case 'girders': for (const y of [-4, 3]) box(ctx, -14, y - 1, 9, 2.2, 0.2, '#8a5a3a'); break;
    default: box(ctx, -11.5, -5.5, 5, 11, 1.6, u.dark);
  }
}
// the cut of what they wear over the torso (VEST in headgear.js); returns false when there is no plate carrier on top
function drawTorso(ctx, op, o, u, sh) {
  const kind = String(VEST[op] || 'carrier'), k = kind.replace(/\d+$/, ''), v = +(kind.match(/\d+$/) || [1])[0];
  const tint = { parka: '#9aa0a0', wetsuit: '#22282e', jacket: o.team === 'atk' ? '#6a6a52' : '#4e5a6e', leather: '#2a2420', jersey: o.color, field: '#8a7a58', shirt: '#5a5a5a', hoodie: '#3a3a40',
    coat: '#3a3a44', cloak: '#141518', tweed: '#7a6a4a', poncho: '#8a5a3a', suit: '#2a2a32', scrubs: '#5a9ab8', hazmat: '#c8d34a', ghillie: '#4f6a32', singlet: o.color, light: u.cloth, overalls: '#3a4a6a', apron: '#6a4a2a' }[k];
  const own = !!u.pat; // operators with their own uniform wear it; the identity kits (hazmat, hi-vis, scrubs...) keep their look on top
  ell(ctx, -1, 0, 6.8 * sh, 9.4 * sh, tint && !own ? shade(tint, 0.85 + v * 0.07) : u.cloth);
  drawPattern(ctx, u, sh);
  const patches = () => { box(ctx, -3.6, -8.6, 3.6, 2.2, 0.6, o.color, false); box(ctx, -3.6, 6.4, 3.6, 2.2, 0.6, o.color, false); };
  const carrier = (col = u.vest, w = 10.2, hgt = 13.2) => {
    box(ctx, -6, -hgt / 2, w, hgt, 3, col);
    ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 0.35; for (let i = -5; i <= 5; i += 1.6) { ctx.beginPath(); ctx.moveTo(-3.5, i); ctx.lineTo(1.8, i); ctx.stroke(); }
    cap(ctx, -5, -6, -0.5, -7.5, 1.1, u.strap); cap(ctx, -5, 6, -0.5, 7.5, 1.1, u.strap);
  };
  const pouches = (n, col = u.vestL) => { for (let i = 0; i < n; i++) { const y = (i - (n - 1) / 2) * 3.4; box(ctx, 2.2, y - 1.4, 2.6, 2.8, 0.6, col); } };
  switch (k) {
    case 'carrier': carrier(); pouches(v + 1); break;
    case 'heavy': carrier(shade(u.vest, 0.9), 11, 15); ell(ctx, -1.5, -8.2, 3, 2, u.vestL); ell(ctx, -1.5, 8.2, 3, 2, u.vestL); pouches(v === 3 ? 2 : 3); break; // shoulder pads
    case 'bomb': box(ctx, -7, -8.5, 13, 17, 4, '#3a3d44'); ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = 0.5; for (let i = -6; i <= 6; i += 3) { ctx.beginPath(); ctx.moveTo(-6, i); ctx.lineTo(5, i); ctx.stroke(); } break;
    case 'rig': box(ctx, 0, -5, 3.6, 10, 1, u.vest); pouches(v + 2, u.vestL); cap(ctx, -5, -6.5, 1, -5, 1, u.strap); cap(ctx, -5, 6.5, 1, 5, 1, u.strap); break;
    case 'harness': cap(ctx, -5, -7, 3, 6, 1.1, '#2a2a2a'); cap(ctx, -5, 7, 3, -6, 1.1, '#2a2a2a'); box(ctx, 0.5, -1.5, 2.4, 3, 0.6, '#d8c040'); break;
    case 'medic': carrier(); box(ctx, -0.5, -2, 4, 4, 0.6, '#f0f0f0', false); ctx.fillStyle = v === 2 ? '#2a9a5a' : '#c22'; ctx.fillRect(1, -1.5, 1, 3); ctx.fillRect(0, -0.5, 3, 1); break;
    case 'police': carrier('#1e2430'); ctx.fillStyle = '#d8d8d8'; ctx.fillRect(-3, -1, 5, 2); break;
    case 'hivis': ctx.fillStyle = '#d8e030'; ctx.fillRect(-6, -7, 9, 14); ctx.fillStyle = '#e8e8e8'; ctx.fillRect(-6, v === 2 ? -1 : -3, 9, 1.2); ctx.fillRect(-6, v === 2 ? 2 : 2, 9, 1.2); break;
    case 'overalls': case 'apron': cap(ctx, -5, -5.5, 2, -3, 1.1, '#222'); cap(ctx, -5, 5.5, 2, 3, 1.1, '#222'); box(ctx, -1, -4, 5, 8, 1.2, shade(tint, 1.15)); break;
    case 'cloak': ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.arc(-1, 0, 7, 1.8, 4.5); ctx.fill(); break;
    case 'jersey': case 'singlet': ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.fillRect(-4, -0.8, 7, 1.6); break;
    case 'ghillie': ctx.fillStyle = '#3a5222'; for (let i = 0; i < 9; i++) { ctx.beginPath(); ctx.arc(-4 + (i % 3) * 3, -6 + Math.floor(i / 3) * 5, 1.6, 0, 7); ctx.fill(); } break;
    default: // jackets, coats, hoodies and the like: a collar and a zip, maybe a light rig
      cap(ctx, -2.5, -5.6, -2.5, 5.6, 1.4, shade(tint || u.cloth, 0.7)); cap(ctx, 1.5, -6, 1.5, 6, 0.4, 'rgba(0,0,0,0.4)');
      if (v === 2 || k === 'field') pouches(2);
  }
  patches();
}


const UNIFORM = {
  atk: { cloth: '#8a8360', clothD: '#625d43', vest: '#5d5b42', vestL: '#787556', dark: '#38372a', strap: '#47452f' },
  def: { cloth: '#62728b', clothD: '#46536a', vest: '#3e4a5e', vestL: '#56667f', dark: '#262e3b', strap: '#323b4a' },
};
// Every operator's own uniform (he asked: recognisable at a glance by uniform, helmet and accents; own colours, with the
// team colour kept as a trim: the ring and the armbands). [cloth, vest, pattern, pattern colour]; patterns in drawPattern.
// No uniform is team blue or enemy orange (found at playtest: an enemy BRISK in blue looked like a teammate).
const UNI = {
  ember: ['#5a3a2a', '#3a2a22', 'char', '#d8602a'], kestrel: ['#d6dad6', '#8a9298', 'digital', '#9aa4aa'], hammer: ['#c89a3a', '#4a3e26', 'hazard', '#1e1e1e'],
  talon: ['#2a2e3a', '#1a1d24', 'circuit', '#3ae0a0'], bulwark: ['#33363a', '#1e2023', 'hex', '#55595f'], rivet: ['#22282e', '#3a4048', 'stripe', '#e0a030'],
  haze: ['#7a7a6e', '#55554a', 'camo', '#9c9c8c'], glint: ['#7a6842', '#4a4030', 'camo', '#a08c5c'], brisk: ['#2a8a7a', '#1a4a42', 'stripe', '#e8e8e8'],
  onyx: ['#18181a', '#2a2a2e', 'hex', '#3c3c44'], prism: ['#5a3a7a', '#36264e', 'check', '#c080ff'], volt: ['#26384a', '#18222e', 'zig', '#ffe030'],
  tether: ['#4a5a3a', '#343e2c', 'camo', '#6e7e4c'], strider: ['#3c4c38', '#262e24', 'tiger', '#141a12'], ferro: ['#7a3a2a', '#4a2a22', 'plain', null],
  salvo: ['#5a6a4a', '#3a4a32', 'digital', '#7c8c5c'], torque: ['#2e221c', '#201814', 'stripe', '#c04020'], rush: ['#c03030', '#1a1a1a', 'stripe', '#ffffff'],
  blaze: ['#d8c040', '#4a2a1a', 'splatter', '#c02a2a'], echo: ['#6a7a5a', '#4a5a42', 'digital', '#8ea474'], mark: ['#4a4a5a', '#2a2a36', 'tiger', '#7a7a92'],
  patch: ['#e8eaea', '#b8c0c0', 'plain', null], trench: ['#6a5a42', '#4a4030', 'check', '#8a7a5a'], wren: ['#2a2a2a', '#5a4a3a', 'plain', null],
  vapor: ['#8a8aa0', '#4a4a60', 'splatter', '#c4c4e4'], crow: ['#101012', '#1a1a1e', 'plain', null],
  mason: ['#8a8a82', '#4a4a48', 'digital', '#aaaaa2'], veil: ['#3a3a52', '#24243a', 'zig', '#8080ff'], lynx: ['#a07a4a', '#5a442a', 'spots', '#3a2a1a'],
  solace: ['#e0e4e8', '#5a6470', 'plain', null], wraith: ['#2a2a30', '#1a1a20', 'splatter', '#5a5a72'], bramble: ['#4a6a2a', '#2a3a1a', 'camo', '#7a9a3a'],
  kite: ['#8a2a2a', '#3a1a1a', 'check', '#e05252'], gravel: ['#7a6a52', '#3a3a3a', 'digital', '#9c8c6c'], shunt: ['#3a3a3a', '#222222', 'zig', '#f0d030'],
  hush: ['#3a3e48', '#24262c', 'plain', null], shade: ['#4a3a6a', '#2a2242', 'hex', '#9b6be0'], rampart: ['#5a6068', '#3c4249', 'hex', '#8f9aa6'],
  miasma: ['#c8d34a', '#6a7a2a', 'plain', null], snare: ['#7a5a3a', '#4a3422', 'tiger', '#33251a'], argus: ['#2a2a32', '#1a1a22', 'stripe', '#3ac4b0'],
  solder: ['#5a4a3a', '#3a3028', 'splatter', '#ff9a3a'], latch: ['#d8e030', '#3a3a2a', 'stripe', '#e8e8e8'], hound: ['#8a5a3a', '#5a3a22', 'check', '#c26a3a'],
  ruse: ['#3a3048', '#24202e', 'spots', '#8a6ad6'], rally: ['#e05a7a', '#46384a', 'stripe', '#ffffff'], lens: ['#4f6a32', '#3a4a22', 'camo', '#6a8a42'],
  audit: ['#4a5a6a', '#2a343e', 'stripe', '#5ad0c0'], tonic: ['#4aa08a', '#2a6a5a', 'plain', null], ward: ['#3a4252', '#2a303c', 'hex', '#7aa0e8'],
  girder: ['#5e6064', '#3a3c40', 'hazard', '#e0c030'], magpie: ['#1a1c1e', '#e6e6e0', 'split', '#f2f2ec'],
  perch: ['#6a5e46', '#40382a', 'digital', '#8a7e5e'], moss: ['#4a5a2a', '#36421e', 'tiger', '#7a8a4a'], osprey: ['#8a7a5a', '#4e4432', 'check', '#d8b060'], nail: ['#5a3a34', '#2e2422', 'stripe', '#b85a4a'],
  gimlet: ['#6a5a3a', '#3e3424', 'char', '#c8a050'], hoist: ['#2e4a62', '#1e2e3e', 'zig', '#5aa0d8'], lockjaw: ['#4a3a32', '#2a201c', 'check', '#a04a3a'], deadfall: ['#4e4458', '#2e2836', 'hazard', '#e0c030'],
};
// side colours on the clothing (he asked: every attacker wears some orange, every defender some blue, placed differently
// per operator so each one stays easy to tell apart): bigger armbands for all, plus a mix of helmet band, vest stripe,
// gloves and a patch on the back gear. Fixed by side, not by your team (the ring round the feet still is).
export const SIDE_COL = { atk: '#ff7a1f', def: '#2f93ff' };
const ACC_SETS = [['band', 'gloves'], ['vest'], ['gloves', 'pack'], ['band', 'vest'], ['vest', 'gloves'], ['band'], ['pack', 'vest'], ['band', 'pack']];
const accCache = {};
export function accentsOf(op) {
  if (accCache[op]) return accCache[op];
  const team = OPERATORS[op] ? OPERATORS[op].team : 'atk', i = Object.keys(OPERATORS).filter(k => OPERATORS[k].team === team).indexOf(op);
  return (accCache[op] = new Set(ACC_SETS[(i < 0 ? 0 : i) % ACC_SETS.length]));
}
const uniCache = {};
export function uniformOf(op, team) {
  if (uniCache[op]) return uniCache[op];
  const d = UNI[op]; if (!d) return UNIFORM[team] || UNIFORM.atk;
  const [cloth, vest, pat, pc] = d;
  return (uniCache[op] = { cloth, clothD: shade(cloth, 0.72), vest, vestL: shade(vest, 1.3), dark: shade(vest, 0.6), strap: shade(vest, 0.7), pat, pc });
}
export const UNIFORM_LIST = UNI;
// the operator's pattern over their torso (clipped to the body), a handful of plain shapes: cheap to draw
function drawPattern(ctx, u, sh) {
  if (!u.pat || u.pat === 'plain') return;
  ctx.save(); ctx.beginPath(); ctx.ellipse(-1, 0, 6.8 * sh, 9.4 * sh, 0, 0, 7); ctx.clip();
  ctx.fillStyle = u.pc; ctx.strokeStyle = u.pc;
  switch (u.pat) {
    case 'camo': for (const [x, y, rx, ry, a] of [[-4, -6, 2.6, 1.6, 0.4], [1, -3, 2.2, 1.4, -0.6], [-3, 2, 2.8, 1.5, 1], [2, 6, 2.2, 1.6, 0.2], [-6, 6, 1.6, 1.2, 0]]) { ctx.beginPath(); ctx.ellipse(x, y, rx, ry, a, 0, 7); ctx.fill(); } break;
    case 'digital': for (let i = 0; i < 14; i++) ctx.fillRect(-7 + (i * 5.3) % 12, -9 + (i * 7.1) % 18, 1.4, 1.4); break;
    case 'tiger': ctx.lineWidth = 1; for (let y = -8; y <= 8; y += 3.2) { ctx.beginPath(); ctx.moveTo(-8, y); ctx.lineTo(-4, y + 1.2); ctx.lineTo(-1, y - 0.4); ctx.stroke(); } break;
    case 'stripe': ctx.fillRect(-8, -1, 15, 2); break; // one bold band across the chest
    case 'hazard': ctx.lineWidth = 1.3; for (let x = -12; x < 8; x += 3.4) { ctx.beginPath(); ctx.moveTo(x, -10); ctx.lineTo(x + 6, 10); ctx.stroke(); } break;
    case 'check': for (let x = -8; x < 6; x += 3) for (let y = -10; y < 10; y += 3) if (((x + y) / 3 & 1) === 0) ctx.fillRect(x, y, 1.5, 1.5); break;
    case 'hex': ctx.lineWidth = 0.4; for (let y = -9; y < 10; y += 3) for (let x = -8 + (y / 3 & 1) * 1.5; x < 6; x += 3) { ctx.beginPath(); for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; ctx.lineTo(x + Math.cos(a) * 1.4, y + Math.sin(a) * 1.4); } ctx.closePath(); ctx.stroke(); } break;
    case 'zig': ctx.lineWidth = 0.9; ctx.beginPath(); for (let i = 0; i <= 6; i++) ctx.lineTo(-7 + i * 2, i % 2 ? -3 : 3); ctx.stroke(); break;
    case 'circuit': ctx.lineWidth = 0.4; for (const [x0, y0, x1, y1] of [[-7, -5, -2, -5], [-2, -5, -2, 1], [-2, 1, 3, 1], [-6, 4, 0, 4], [0, 4, 0, 7]]) { ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke(); ctx.fillRect(x1 - 0.5, y1 - 0.5, 1, 1); } break;
    case 'spots': for (let i = 0; i < 9; i++) { ctx.beginPath(); ctx.arc(-6 + (i * 4.7) % 11, -8 + (i * 6.3) % 16, 0.9 + (i % 3) * 0.3, 0, 7); ctx.fill(); } break;
    case 'splatter': for (let i = 0; i < 7; i++) { const x = -6 + (i * 5.1) % 10, y = -8 + (i * 7.7) % 16; ctx.beginPath(); ctx.arc(x, y, 1.1, 0, 7); ctx.fill(); ctx.fillRect(x, y - 0.25, 2.2, 0.5); } break;
    case 'char': ctx.globalAlpha = 0.7; for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.ellipse(-5 + (i * 4.3) % 9, -7 + (i * 5.9) % 14, 1.8, 0.9, i, 0, 7); ctx.fill(); } break;
    case 'split': ctx.fillRect(-9, 0, 18, 10); break; // MAGPIE: black one side, white the other
  }
  ctx.restore();
}
const SKIN = ['#c99a78', '#a8785a', '#7a5238', '#e0b393', '#8d6346'];
const OUT = 'rgba(6,7,9,0.6)';
let LX = -0.6, LY = -0.8; // light direction in the character's rotated frame (world light comes from the top-left)

function cap(ctx, x1, y1, x2, y2, w, col) { ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); }
// the operator's pattern carried onto their sleeves and trouser legs, as a dashed inner line (cheap)
const SLEEVE = { camo: [2.2, 1.4], digital: [0.8, 0.9], tiger: [0.6, 1.4], stripe: [], hazard: [1.3, 1.3], check: [1, 1], hex: [0.5, 0.8], zig: [1.6, 1], circuit: [2.5, 0.8], spots: [0.6, 1.6], splatter: [0.7, 2], char: [1.6, 1.6], split: [] };
let curU = null;
function limb(ctx, pts, w, col) { // outlined, two-segment limb
  for (const [lw, c] of [[w + 1.1, OUT], [w, col]]) {
    ctx.strokeStyle = c; ctx.lineWidth = lw; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]); ctx.stroke();
  }
  if (curU && curU.pc && SLEEVE[curU.pat] && (col === curU.cloth || col === curU.clothD)) {
    ctx.strokeStyle = curU.pc; ctx.lineWidth = w * 0.42; ctx.lineCap = 'butt'; ctx.setLineDash(SLEEVE[curU.pat]);
    ctx.beginPath(); ctx.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]); ctx.stroke();
    ctx.setLineDash([]); ctx.lineCap = 'round';
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.10)'; ctx.lineWidth = w * 0.35;
  ctx.beginPath(); ctx.moveTo(pts[0] + LX * w * 0.25, pts[1] + LY * w * 0.25); for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i] + LX * w * 0.25, pts[i + 1] + LY * w * 0.25); ctx.stroke();
}
let SHADE = true; // off on Low graphics: flat colours instead of per-part lighting
export function setShading(on) { SHADE = on; }
function shaded(ctx, x, y, r, col) { // radial shading lit from the top-left
  if (!SHADE) return col;
  const g = ctx.createRadialGradient(x + LX * r * 0.45, y + LY * r * 0.45, r * 0.1, x, y, r * 1.15);
  g.addColorStop(0, shade(col, 1.5)); g.addColorStop(0.55, col); g.addColorStop(1, shade(col, 0.68));
  return g;
}
function ell(ctx, x, y, rx, ry, col, outline = true) {
  ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, 7);
  ctx.fillStyle = shaded(ctx, x, y, Math.max(rx, ry), col); ctx.fill();
  if (outline) { ctx.strokeStyle = OUT; ctx.lineWidth = 0.55; ctx.stroke(); }
}
function box(ctx, x, y, w, h, r, col, outline = true) {
  ctx.beginPath(); ctx.roundRect(x, y, w, h, r);
  ctx.fillStyle = shaded(ctx, x + w / 2, y + h / 2, Math.max(w, h) / 2, col); ctx.fill();
  if (outline) { ctx.strokeStyle = OUT; ctx.lineWidth = 0.5; ctx.stroke(); }
}

function drawGun(ctx, wkey, recoil) {
  const w = WEAPONS[wkey]; if (!w) return;
  const L = w.len, x0 = 4 - recoil;
  const g = G[wkey] || {};
  const metal = g.tan ? '#9c855a' : '#1d1f23', poly = g.tan ? '#a38a5b' : w.cls === 'Shotgun' ? '#5b3c22' : '#2b2e33'; // (a tan rifle stays tan in your hands)
  ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(x0 + 1.2, 1.9, L, 2.6);
  // stock
  if (w.cls !== 'Pistol' && w.cls !== 'MP') { box(ctx, x0 - 4, 0.1, 5, 2.8, 0.8, poly); ctx.fillStyle = '#111'; ctx.fillRect(x0 - 4, 0.3, 0.8, 2.4); }
  // receiver + handguard
  box(ctx, x0, -0.3, L * 0.6, 3.3, 0.6, metal);
  ctx.fillStyle = 'rgba(255,255,255,0.12)'; for (let i = 0; i < L * 0.5; i += 1.3) ctx.fillRect(x0 + L * 0.08 + i, -0.3, 0.55, 0.6); // top rail
  // barrel + muzzle
  ctx.fillStyle = '#121316'; ctx.fillRect(x0 + L * 0.6, 0.55, L * 0.4, 1.6);
  ctx.fillStyle = '#0a0a0c'; ctx.fillRect(x0 + L - 1.6, 0.25, 1.9, 2.2);
  if (g.brake) { box(ctx, x0 + L - 1.2, 0, 3.4, 2.7, 0.6, '#17181a'); ctx.fillStyle = '#050506'; ctx.fillRect(x0 + L, 0, 0.5, 2.7); ctx.fillRect(x0 + L + 1.2, 0, 0.5, 2.7); } // muzzle brake
  if (g.double) { ctx.fillStyle = '#121316'; ctx.fillRect(x0 + L * 0.5, -0.2, L * 0.5, 1.4); ctx.fillRect(x0 + L * 0.5, 1.5, L * 0.5, 1.4); } // side-by-side barrels
  if (g.revolver) { box(ctx, x0 + L * 0.22, -0.9, 3.4, 4.6, 1.4, '#55595e'); ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(x0 + L * 0.22 + 0.6, 0.7, 2.2, 0.5); } // cylinder
  if (g.can) box(ctx, x0 + L - 1.5, -0.1, 4.6, 3, 0.9, '#16181b'); // built-in suppressor
  if (g.bolt) { ctx.fillStyle = '#2c2f33'; ctx.fillRect(x0 + L * 0.3, 2.8, 0.7, 1.6); ctx.beginPath(); ctx.arc(x0 + L * 0.3 + 0.35, 4.6, 0.9, 0, 7); ctx.fill(); } // bolt handle
  if (g.mag === 'drum') { ctx.fillStyle = '#3c4147'; ctx.beginPath(); ctx.arc(x0 + L * 0.34, 4.4, 2.5, 0, 7); ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 0.5; ctx.stroke(); }
  else if (g.mag === 'bullpup') box(ctx, x0 + L * 0.06, 2.7, 2.3, 3.6, 0.5, '#24272b');
  else if (w.cls === 'AR' || w.cls === 'SMG' || w.cls === 'MP') { box(ctx, x0 + L * 0.32, 2.7, 2.3, w.cls === 'MP' ? 2.8 : 3.6, 0.5, '#24272b'); }
  if (w.cls === 'LMG' && g.mag !== 'drum') { box(ctx, x0 + L * 0.26, 2.5, 5, 4.4, 0.8, '#3d4030'); cap(ctx, x0 + L * 0.7, 2.2, x0 + L * 0.45, 3.6, 0.6, '#222'); }
  if (g.mag === 'belt') { ctx.fillStyle = '#b08a3e'; for (let i = 0; i < 4; i++) ctx.fillRect(x0 + L * 0.26 - 1 - i * 1.1, 4.6 + i * 0.5, 0.7, 1.6); } // brass belt
  if (w.cls === 'Shotgun' && g.pump) { box(ctx, x0 + L * 0.5, -0.1, 5, 3.1, 0.8, '#6a4628'); ctx.fillStyle = 'rgba(0,0,0,0.4)'; for (let i = 0; i < 4; i++) ctx.fillRect(x0 + L * 0.5 + 0.6 + i * 1.1, 0.1, 0.4, 2.7); }
  if (w.cls === 'DMR') {
    box(ctx, x0 + L * 0.16, -1.9, L * 0.42, 2, 0.8, '#0f1012');
    ctx.fillStyle = '#7fc3ff'; ctx.beginPath(); ctx.arc(x0 + L * 0.58, -0.9, 0.7, 0, 7); ctx.fill();
  } else if (w.cls !== 'Pistol') {
    box(ctx, x0 + L * 0.26, -1.3, 3.6, 1.6, 0.5, '#101113');
    ctx.fillStyle = '#ff4646'; ctx.beginPath(); ctx.arc(x0 + L * 0.26 + 2.6, -0.5, 0.45, 0, 7); ctx.fill();
  }
}

// p: {x,y,aim,team,op,walk,ads,crouch,downed,recoil,reload,brace,scan,melee,ally,flash,w}
export function drawOperator(ctx, p, t) {
  const o = OPERATORS[p.op]; if (!o) return;
  const u = curU = uniformOf(p.op, o.team), tc = SIDE_COL[o.team] || SIDE_COL.atk, acc = accentsOf(p.op);
  const skin = SKIN[(p.op.charCodeAt(0) + p.op.length) % SKIN.length];
  const ca = Math.cos(-p.aim), sa = Math.sin(-p.aim);
  LX = -0.6 * ca + 0.8 * sa; LY = -0.6 * sa - 0.8 * ca;
  ctx.save(); ctx.translate(p.x, p.y);
  ctx.strokeStyle = (p.ring ?? p.ally) ? 'rgba(70,170,255,0.7)' : 'rgba(255,120,40,0.75)'; ctx.lineWidth = 0.9;
  ctx.beginPath(); ctx.arc(0, 0, 13, 0, Math.PI * 2); ctx.stroke();
  const sg = ctx.createRadialGradient(2, 3, 2, 2, 3, 14); sg.addColorStop(0, 'rgba(0,0,0,0.45)'); sg.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(2, 3, 14, 0, 7); ctx.fill();
  ctx.rotate(p.aim);

  if (p.downed) {
    ctx.rotate(Math.PI * 0.85);
    limb(ctx, [-5, -3, -10, -4, -15, -3 + Math.sin(t * 2) * 0.8], 3.4, u.clothD);
    limb(ctx, [-5, 3, -10, 4.5, -15, 4], 3.4, u.clothD);
    ell(ctx, -15.5, -3, 2.4, 1.8, '#1a1a1a'); ell(ctx, -15.5, 4, 2.4, 1.8, '#1a1a1a');
    ell(ctx, -1, 0, 7.5, 8, u.cloth); box(ctx, -5.5, -5.5, 9.5, 11, 2.5, u.vest);
    limb(ctx, [1, -6.5, 5, -10, 10, -9.5], 3, u.cloth); limb(ctx, [1, 6.5, 6, 9, 11, 7 + Math.sin(t * 3) * 0.6], 3, u.cloth);
    ctx.save(); ctx.translate(7.5, 0); ell(ctx, 0.8, 0, 4.3, 4.3, skin); const hgD = HEADGEAR[p.op]; if (hgD) hgD(ctx, { ell, box, cap, shade, OUT, o, t, hair: hairOf(p.op) }); else ell(ctx, 0, 0, 4.8, 4.8, o.helmet); ctx.restore();
    ctx.restore(); return;
  }

  // ---- legs (they step when walking AND when turning on the spot) ----
  const bw = bodyW(p.op); // skinnier build: legs, back gear and torso squeezed sideways (not the head)
  ctx.save(); ctx.scale(1, bw);
  const walk = p.walk || 0, st = Math.sin(walk), cr = !!p.crouch && !p.prone;
  if (p.prone) { // lying down (he asked): legs stretched out behind, kicking a little as you crawl
    for (const s of [1, -1]) { const k = s * st * 1.6 * (p.legs ?? 1); limb(ctx, [-3, s * 3, -10 + k, s * 4, -17 + k, s * 4.6], 3.6, u.clothD); ell(ctx, -18 + k, s * 4.6, 2.3, 2.2, '#1c1b1a'); }
  }
  if (p.slide) { // power slide (he asked, like modern CoD): feet first, one leg out straight, the other bent over on its side
    limb(ctx, [0, 4, 8, 7, 15.5, 7.4], 3.6, u.clothD); ell(ctx, 16.7, 7.5, 3.4, 2.3, '#1c1b1a');
    limb(ctx, [0, -3, 7, -9.5, 11.5, -2.2], 3.6, u.clothD); ell(ctx, 7, -9.5, 1.6, 1.7, '#1d1f22'); ell(ctx, 12.3, -1.6, 3.2, 2.2, '#1c1b1a');
  }
  const stride = st * (cr ? 2.2 : 4.6) * (p.legs ?? 1); // feet come back together when standing still
  const feet = cr ? [[5.5 + stride * 0.3, 4.2], [4 - stride * 0.3, -4.6]] : [[stride, 4.8], [-stride, -4.8]];
  for (const [fx, fy] of p.prone || p.slide ? [] : feet) {
    const hip = [-1, fy > 0 ? 3.2 : -3.2];
    const knee = cr ? [fx + 2.5, fy * 1.15] : [(hip[0] + fx) / 2 + 0.8, (hip[1] + fy) / 2 + (fy > 0 ? 0.3 : -0.3)];
    limb(ctx, [hip[0], hip[1], knee[0], knee[1], fx, fy], 3.6, u.clothD);
    if (cr) ell(ctx, knee[0], knee[1], 1.5, 1.6, '#1d1f22');
    ell(ctx, fx + 1, fy, 3.4, 2.3, '#1c1b1a');
    ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fillRect(fx + 2.6, fy - 1.4, 1.2, 2.8);
  }

  if (p.slide) ctx.translate(-3, 0); // sliding: the body leans back behind the legs
  // ---- leaning (he asked): the legs stay planted, everything from the hips up tips to the side ----
  if (p.lean) { const L = Math.max(-1, Math.min(1, p.lean));
    ctx.fillStyle = u.cloth || '#333'; ctx.beginPath(); ctx.ellipse(0, L * 2.2, 3.2, 4 + Math.abs(L) * 2, 0, 0, 7); ctx.fill(); // the hips bend toward the lean
    ctx.translate(0, L * 5.5 / bw); ctx.rotate(L * 0.14); }
  // ---- back gear ----
  const id = o.ability.id;
  if (id === 'cutter') { box(ctx, -12.5, -4.5, 5.5, 9, 2.6, '#c8601f'); ctx.fillStyle = '#222'; ctx.fillRect(-12, -1, 4.5, 2); cap(ctx, -9, 3.5, -3, 8, 0.8, '#222'); }
  else if (id === 'panel') { box(ctx, -12.5, -6, 4.5, 12, 1, '#59626b'); ctx.fillStyle = '#d9b02a'; for (let i = 0; i < 3; i++) ctx.fillRect(-12.3, -5 + i * 4, 4, 1); }
  else if (id === 'jammer') { box(ctx, -11.5, -4, 4.5, 8, 1.2, '#2b2f36'); ctx.fillStyle = '#55c1e8'; ctx.fillRect(-10.5, -2.5, 1.2, 1.2); cap(ctx, -9, -3, -14, -9, 0.6, '#999'); }
  else drawPack(ctx, PACK[p.op], o, u); // every operator carries something of their own
  if (acc.has('pack') && PACK[p.op] !== 'none') { box(ctx, -12, -1.6, 2.6, 3.2, 0.6, tc, false); ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 0.3; ctx.strokeRect(-12, -1.6, 2.6, 3.2); }

  // ---- torso & plate carrier ----
  const sh = cr ? 0.93 : 1;
  drawTorso(ctx, p.op, o, u, sh);
  { // side trim (he asked): a wide armband on each shoulder, attackers orange and defenders blue, plus this operator's own accents
    if (acc.has('vest')) { ctx.fillStyle = tc; ctx.fillRect(-5.4, -5.6 * sh, 1.7, 11.2 * sh); ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(-3.7, -5.6 * sh, 0.35, 11.2 * sh); }
    for (const s of [-1, 1]) { ctx.fillStyle = tc; ctx.beginPath(); ctx.ellipse(-1, s * 7.9 * sh, 2.7, 1.7, 0, 0, 7); ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,0.55)'; ctx.lineWidth = 0.35; ctx.stroke(); } }
  if (o.team === 'def') { box(ctx, -1.8, -6.2, 1.8, 2.4, 0.4, '#141518'); cap(ctx, -1, -6, -1.5, -10, 0.5, '#111'); } // radio
  if (id === 'slug' || id === 'sticky') { cap(ctx, -4.5, -6.5, 3.5, 6.5, 1.6, '#3a2a1a'); ctx.fillStyle = '#b02a2a'; for (let i = 0; i < 6; i++) ctx.fillRect(-4 + i * 1.3, -5.2 + i * 2.05, 0.9, 1.1); }
  if (id === 'emp') { for (const yy of [-3, 1.5]) { ell(ctx, -2.5, yy, 1.4, 1.4, '#7d4fb0'); ctx.fillStyle = `rgba(200,150,255,${0.5 + 0.5 * Math.sin(t * 4 + yy)})`; ctx.beginPath(); ctx.arc(-2.5, yy, 0.5, 0, 7); ctx.fill(); } }
  if (id === 'mine') { for (const yy of [-7.4, 7.4]) { box(ctx, -4, yy - 1, 2.6, 2, 0.5, '#33402a'); ctx.fillStyle = '#8fd14f'; ctx.fillRect(-3, yy - 0.3, 0.6, 0.6); } }
  if (id === 'stim') { ctx.fillStyle = '#fff'; ctx.fillRect(-3, 6.6, 2.4, 1.6); ctx.fillStyle = '#c22'; ctx.fillRect(-2.2, 6.7, 0.8, 1.4); ctx.fillRect(-2.8, 7.1, 2, 0.6); }
  if (id === 'panel') { for (const yy of [-1, 1]) { ctx.save(); ctx.scale(1, yy); box(ctx, -4.5, 6.5, 6, 3.4, 1.5, '#5d666f'); ctx.restore(); } }

  ctx.restore();
  if (p.slide) ctx.translate(-3, 0);
  if (p.lean) { const L = Math.max(-1, Math.min(1, p.lean)); ctx.translate(0, L * 5.5); ctx.rotate(L * 0.14); } // arms, gun and head lean with the torso

  // ---- weapon & arms ----
  const shield = (id === 'brace' || p.riot) && p.brace, shieldBack = id === 'brace' && !p.brace && !p.riot, R = RIOT[p.riot];
  const pistol = WEAPONS[p.w] && (WEAPONS[p.w].cls === 'Pistol' || WEAPONS[p.w].cls === 'MP');
  const rec = p.recoil || 0, mel = p.melee || 0, L = WEAPONS[p.w] ? WEAPONS[p.w].len : 12;
  ctx.save();
  if (mel > 0) ctx.rotate(-Math.sin(mel * Math.PI) * 0.9);
  if (p.reload) ctx.rotate(0.38 + Math.sin(t * 9) * 0.05);
  if (p.sprint) ctx.rotate(p.sprint * 0.85); // sprinting: gun down across the body
  ctx.translate(p.ads || p.slide ? 2 : 0, p.ads || p.slide ? 0 : 1.4); // sliding: the gun is up as if aiming in, the only way you can hold it
  const up = p.up > 0.02 ? Math.min(1, p.up) : 0; // aiming up through a hatch (he asked, pose only): seen from above the raised gun and arms look short
  if (up) { ctx.translate(-1.5 * up, 0); ctx.scale(1 - 0.55 * up, 1 + 0.08 * up); }
  const gc = acc.has('gloves') ? tc : '#1f1f20', glove = (x, y) => { ell(ctx, x, y, 1.7, 1.6, gc); };
  if (shield) { // the shield hand holds the grip on the inside of the shield, wherever it has swung to (he asked)
    const sp = p.shieldPose || { rot: 0 }, ga = sp.rot - 0.45, hx = -2 + 10.6 * Math.cos(ga), hy = 10.6 * Math.sin(ga);
    const sx = -0.5, sy = -7 * bw, ex = (sx + hx) / 2 + Math.cos(ga - 1.2) * 2.2, ey = (sy + hy) / 2 + Math.sin(ga - 1.2) * 2.2;
    limb(ctx, [-0.5, 7 * bw, 3, 6.5, 8.5 - rec, 2.6], 3.1, u.cloth); drawGun(ctx, p.w, rec); glove(8.5 - rec, 2.6);
    limb(ctx, [sx, sy, ex, ey, hx, hy], 3.1, u.cloth); glove(hx, hy);
  } else if (pistol) {
    limb(ctx, [-0.5, 7 * bw, 3, 5.5, 7 - rec, 1.4], 3.1, u.cloth); limb(ctx, [-0.5, -7 * bw, 3, -5.5, 7 - rec, 1.2], 3.1, u.cloth);
    drawGun(ctx, p.w, rec); glove(7 - rec, 1.4); glove(7.3 - rec, 0.4);
  } else {
    limb(ctx, [-0.5, 7.2 * bw, 2.2, 7.8, 5.5 - rec, 2.6], 3.2, u.cloth);
    drawGun(ctx, p.w, rec);
    limb(ctx, [-0.5, -7 * bw, 4, -6.5, 4 + L * 0.52 - rec, 0.9], 3.2, u.cloth);
    glove(5.5 - rec, 2.6); glove(4 + L * 0.52 - rec, 0.9);
  }
  if (up && WEAPONS[p.w] && !shield) { // the muzzle points at you: its dark bore and a bright rim at the gun's front
    const mx = (pistol ? 7.5 : 4 + L) - rec, r = 0.9 + 0.7 * up;
    ctx.save(); ctx.translate(mx, 1.2); ctx.scale(1 / (1 - 0.55 * up), 1);
    ctx.fillStyle = '#0b0c0e'; ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.fill();
    ctx.strokeStyle = 'rgba(190,200,210,0.75)'; ctx.lineWidth = 0.45; ctx.stroke(); ctx.restore();
  }
  if (id === 'dart') { box(ctx, 5 + L * 0.2, -4.8, 3.5, 1.8, 0.5, '#2b3a38'); ctx.fillStyle = '#4fb3a9'; ctx.fillRect(7.6 + L * 0.2, -4.4, 0.8, 0.8); }
  if (id === 'scan') { box(ctx, 4 + L * 0.2, -5.4, 3.6, 2.2, 0.5, '#1d2030'); ctx.fillStyle = p.scan ? '#a0b0ff' : '#4656c0'; ctx.fillRect(4.6 + L * 0.2, -4.9, 2.4, 1.2); }
  if (p.flash && WEAPONS[p.w]) {
    const mx = 4 + L - rec + 2.2;
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(mx, 1.5, 0, mx, 1.5, 10); g.addColorStop(0, 'rgba(255,240,190,0.95)'); g.addColorStop(0.35, 'rgba(255,170,60,0.6)'); g.addColorStop(1, 'rgba(255,120,20,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(mx, 1.5, 10, 0, 7); ctx.fill();
    ctx.fillStyle = '#fff6d0';
    ctx.beginPath(); ctx.moveTo(mx - 1, 0.2); ctx.lineTo(mx + 7 + Math.random() * 3, 1.5); ctx.lineTo(mx - 1, 2.8); ctx.fill();
    ctx.beginPath(); ctx.moveTo(mx, 1.5); ctx.lineTo(mx + 3, -1.8 - Math.random()); ctx.lineTo(mx + 1, 1.5); ctx.lineTo(mx + 3, 4.8 + Math.random()); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
  }
  ctx.restore();
  if (shieldBack) { // slung on the back while the pistol is out
    ctx.strokeStyle = '#22252a'; ctx.lineWidth = 3.4; ctx.beginPath(); ctx.arc(2, 0, 11, Math.PI - 0.8, Math.PI + 0.8); ctx.stroke();
  }
  if (shield) { // pose from shieldPose (shared/operators.js): exactly where the server's shield stops bullets
    const sp = p.shieldPose || { rot: 0, arc: 0.95 }, arc = sp.arc;
    ctx.save(); ctx.rotate(sp.rot); if (sp.off) ctx.globalAlpha *= 0.75;
    ctx.lineCap = 'butt';
    ctx.strokeStyle = OUT; ctx.lineWidth = 5.4; ctx.beginPath(); ctx.arc(-2, 0, 14, -arc, arc); ctx.stroke();
    ctx.strokeStyle = R ? R.col : '#22252a'; ctx.lineWidth = R && R.plant && arc > R.arc ? 5.2 : 4.4; ctx.beginPath(); ctx.arc(-2, 0, 14, -arc, arc); ctx.stroke();
    ctx.strokeStyle = R ? R.rim : '#5a626b'; ctx.lineWidth = R ? 1.3 : 0.9; ctx.beginPath(); ctx.arc(-2, 0, 15.8, -arc, arc); ctx.stroke();
    if (R && R.stun) { ctx.fillStyle = R.rim; for (const a of [-0.5, 0, 0.5]) { ctx.beginPath(); ctx.arc(-2 + Math.cos(a * arc) * 16.6, Math.sin(a * arc) * 16.6, 1, 0, 7); ctx.fill(); } } // THORN's studs
    ctx.save(); ctx.rotate(-0.12); ctx.fillStyle = '#8fd0f2'; ctx.fillRect(11.3, -2, 1.6, 4); ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.fillRect(11.4, -1.8, 0.5, 1.5); ctx.restore();
    ctx.save(); ctx.rotate(0.5); ctx.fillStyle = '#d84a4a'; ctx.fillRect(11.2, -1, 2.2, 2); ctx.restore();
    ctx.restore();
  }

  if (p.slide) { ctx.translate(3.4, 0.5); ctx.rotate(0.14); } // sliding (he asked): the head leans down onto the gun, as when aiming in
  // ---- head & headgear ----
  if (up) ctx.translate(-1.6 * up, 0); // head tipped back
  ell(ctx, 0.8, 0, 4.3, 4.3, skin);
  const earCups = () => { ell(ctx, 0, -4.7, 1.8, 1.3, '#151618'); ell(ctx, 0, 4.7, 1.8, 1.3, '#151618'); };
  const hg = HEADGEAR[p.op];
  if (hg) hg(ctx, { ell, box, cap, shade, OUT, o, t, hair: hairOf(p.op) });
  else switch (o.look) {
    case 'cap':
      earCups(); ell(ctx, 0, 0, 4.6, 4.6, o.helmet);
      ctx.beginPath(); ctx.ellipse(4.4, 0, 2.8, 3.9, 0, -Math.PI / 2, Math.PI / 2); ctx.fillStyle = shade(o.helmet, 0.7); ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 0.5; ctx.stroke();
      cap(ctx, -0.5, -4.6, -0.5, 4.6, 0.7, '#111');
      ctx.fillStyle = o.color; ctx.beginPath(); ctx.arc(-1.8, 0, 1, 0, 7); ctx.fill();
      break;
    case 'mask':
      ell(ctx, 0.6, 0, 4.7, 4.7, shade(o.helmet, 0.75));
      box(ctx, 2.6, -3.2, 2.4, 6.4, 1, '#0a0a0b'); ctx.fillStyle = o.color; ctx.fillRect(4, -2.6, 0.9, 2); ctx.fillRect(4, 0.6, 0.9, 2);
      earCups();
      break;
    case 'goggles':
      earCups(); ell(ctx, 0, 0, 5.2, 5.2, o.helmet);
      ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(-3.5, -0.4, 4, 0.8);
      box(ctx, 2.8, -3.8, 2.6, 7.6, 1.2, '#101010'); ctx.fillStyle = o.color; ctx.fillRect(4.6, -3.1, 0.9, 2.4); ctx.fillRect(4.6, 0.7, 0.9, 2.4);
      break;
    case 'visor':
      ell(ctx, 0, 0, 5.7, 5.7, o.helmet);
      ctx.beginPath(); ctx.arc(0, 0, 5.7, -0.95, 0.95); ctx.lineTo(0, 0); ctx.closePath();
      const vg = ctx.createLinearGradient(0, -5, 5, 5); vg.addColorStop(0, 'rgba(160,210,240,0.95)'); vg.addColorStop(1, 'rgba(60,110,150,0.95)');
      ctx.fillStyle = vg; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 0.5; ctx.stroke();
      break;
    case 'hood':
      ell(ctx, -1.2, 0, 6, 5.9, shade(o.helmet, 1.25));
      ell(ctx, 1.2, 0, 4.3, 4.1, '#0d0e10'); ctx.fillStyle = o.color; ctx.fillRect(4, -1.5, 0.9, 3);
      break;
    default: // ballistic helmet
      earCups(); ell(ctx, 0, 0, 5.4, 5.4, o.helmet);
      ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(-1.5, -5.4, 1.2, 10.8);         // side rails
      box(ctx, 3.4, -1.4, 1.8, 2.8, 0.4, '#141516');                                   // NVG mount
      ctx.fillStyle = o.color; ctx.fillRect(-4.5, -0.6, 3.2, 1.2);
      if (id === 'stim') { ctx.fillStyle = '#fff'; ctx.fillRect(-3.2, -1.7, 3.4, 3.4); ctx.fillStyle = '#c22'; ctx.fillRect(-2.1, -1.4, 1.2, 2.8); ctx.fillRect(-2.9, -0.6, 2.8, 1.2); }
  }
  if (acc.has('band')) { ctx.strokeStyle = tc; ctx.lineWidth = 1.3; ctx.lineCap = 'butt'; ctx.beginPath(); ctx.arc(0, 0, 4.2, Math.PI - 1.15, Math.PI + 1.15); ctx.stroke(); } // a band round the back of the headgear
  if (up) { // tipped back, the face shows past the front of the helmet: chin and eyes
    ctx.globalAlpha *= Math.min(1, up * 1.4);
    ell(ctx, 4.6, 0, 1.9, 3.1, skin); ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(5.8, -1.6, 0.5, 3.2);
    ctx.fillStyle = '#121314'; for (const yy of [-1.4, 1.4]) { ctx.beginPath(); ctx.arc(4.2, yy, 0.5, 0, 7); ctx.fill(); }
    ctx.globalAlpha /= Math.min(1, up * 1.4);
  }
  if (p.scan) { ctx.strokeStyle = `rgba(140,160,255,${0.4 + 0.3 * Math.sin(t * 10)})`; ctx.lineWidth = 0.6; ctx.beginPath(); ctx.arc(0, 0, 9 + (t * 20) % 8, 0, 7); ctx.stroke(); }
  ctx.restore();
}

export function drawCorpse(ctx, c) {
  drawOperator(ctx, { ...c, downed: true }, 0);
}

export function drawDrone(ctx, d, t, ally) {
  const spd = d.spd || 0, wheel = d.wheel || 0, lean = Math.min(1, spd / 115); // 115 = drone top speed (DRONE_SPEED)
  const rel = (d.mvAng ?? d.ag) - (d.ag || 0);
  ctx.save(); ctx.translate(d.x, d.y);
  ctx.rotate(d.ag || 0); ctx.scale(0.7, 0.7); // 30% smaller (he asked)
  // about a foot long (10 px, 1 m = 36 px) and half as wide: a low rectangle on four little wheels
  if (ally) { ctx.strokeStyle = 'rgba(70,170,255,0.45)'; ctx.lineWidth = 0.4; ctx.beginPath(); ctx.roundRect(-5.8, -3.5, 11.6, 7, 2); ctx.stroke(); }
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(0.5, 0.8, 5.2, 2.9, 0, 0, 7); ctx.fill();
  for (const [wx, wy] of [[-3.1, -2.1], [3.1, -2.1], [-3.1, 2.1], [3.1, 2.1]]) {
    ctx.fillStyle = '#121314'; ctx.beginPath(); ctx.roundRect(wx - 1.3, wy - 0.55, 2.6, 1.1, 0.5); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.12)'; const off = (wheel * 1.1) % 0.9;
    for (let i = -1.3 + off; i < 1.3; i += 0.9) ctx.fillRect(wx + i, wy - 0.55, 0.2, 1.1);
  }
  ctx.save(); ctx.translate(-Math.cos(rel) * lean * 0.35, -Math.sin(rel) * lean * 0.35 + (spd > 20 ? Math.sin(wheel) * 0.15 : 0));
  const g = ctx.createLinearGradient(-4.6, -1.7, 4.6, 1.7); g.addColorStop(0, '#4a4f55'); g.addColorStop(1, '#2a2d31');
  ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(-4.6, -1.7, 9.2, 3.4, 0.8); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 0.3; ctx.stroke();
  ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(-3, -1.1, 0.3, 2.2); ctx.fillRect(-2.3, -1.1, 0.3, 2.2);
  ctx.fillStyle = '#16181b'; ctx.beginPath(); ctx.arc(4.1, 0, 1, 0, 7); ctx.fill();           // camera
  ctx.fillStyle = 'rgba(140,200,240,0.5)'; ctx.beginPath(); ctx.arc(4.35, -0.3, 0.3, 0, 7); ctx.fill();
  // the giveaway: one small red dot in the middle of the top
  ctx.fillStyle = `rgba(255,40,40,${0.75 + 0.25 * Math.sin(t * 4)})`; ctx.beginPath(); ctx.arc(0, 0, 0.6, 0, 7); ctx.fill();
  ctx.strokeStyle = '#6d7278'; ctx.lineWidth = 0.25; ctx.beginPath(); ctx.moveTo(-4.2, -0.8);
  ctx.lineTo(-5.8 - (d.sway || 0) * 0.6, -0.8 - (d.sway || 0) * 1.5); ctx.stroke();
  ctx.restore();
  if (d.gr) parasiteVeins(ctx, t, 6); // MAGPIE's parasite has hold of it: green veins crawl over it while it reshapes
  if (d.j) {
    ctx.strokeStyle = `rgba(150,200,255,${0.4 + Math.random() * 0.5})`; ctx.lineWidth = 0.5; ctx.beginPath();
    for (let i = 0; i < 4; i++) { ctx.moveTo((Math.random() - 0.5) * 12, (Math.random() - 0.5) * 12); ctx.lineTo((Math.random() - 0.5) * 12, (Math.random() - 0.5) * 12); }
    ctx.stroke();
  }
  ctx.restore();
}

function camDot(ctx, x, y, r, off, ally, t) {
  const on = Math.floor(t * 1.2) % 2;
  ctx.fillStyle = off ? 'rgba(80,110,255,0.85)' : ally ? (on ? '#46ff7a' : '#1f8a3f') : (on ? '#ff3a30' : '#7a1610');
  ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
  if (!off) { ctx.fillStyle = ally ? 'rgba(70,255,120,0.25)' : 'rgba(255,58,48,0.25)'; ctx.beginPath(); ctx.arc(x, y, r * 2.2, 0, 7); ctx.fill(); }
}
export function drawCam(ctx, c, t, ally) {
  if (c.wn !== undefined) return drawWallCam(ctx, c, t, ally);
  ctx.save(); ctx.translate(c.x, c.y);
  ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.beginPath(); ctx.arc(1, 1.5, 5, 0, 7); ctx.fill();
  if (!c.hp) {
    ctx.fillStyle = '#2a2a2a'; ctx.beginPath(); ctx.arc(0, 0, 4, 0, 7); ctx.fill();
    ctx.strokeStyle = '#555'; ctx.lineWidth = 0.6; ctx.beginPath(); ctx.moveTo(-3, -2); ctx.lineTo(2, 3); ctx.moveTo(2, -3); ctx.lineTo(-1, 2); ctx.stroke();
  } else {
    if (c.ag !== undefined) { ctx.save(); ctx.rotate(c.ag); const g = ctx.createRadialGradient(0, 0, 2, 0, 0, 22); g.addColorStop(0, 'rgba(255,60,60,0.35)'); g.addColorStop(1, 'rgba(255,60,60,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, 22, -0.95, 0.95); ctx.fill(); ctx.fillStyle = '#2a2c30'; ctx.fillRect(2, -1.6, 4, 3.2); ctx.restore(); }
    if (c.tu) { // turret camera: armoured octagon with a laser barrel
      ctx.save(); ctx.rotate(c.ag || 0); ctx.fillStyle = '#3a1e1e'; ctx.fillRect(3, -1, 6, 2); ctx.fillStyle = '#ff4040'; ctx.fillRect(8, -0.5, 1.5, 1); ctx.restore();
      ctx.fillStyle = '#5c6268'; ctx.beginPath(); for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2 + Math.PI / 8; ctx.lineTo(Math.cos(a) * 5.4, Math.sin(a) * 5.4); } ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#2a2d31'; ctx.lineWidth = 0.6; ctx.stroke();
    } else { ctx.fillStyle = '#d7d9db'; ctx.beginPath(); ctx.arc(0, 0, 4.4, 0, 7); ctx.fill(); }
    ctx.fillStyle = '#1b1d20'; ctx.beginPath(); ctx.arc(0, 0, 2.8, 0, 7); ctx.fill();
    camDot(ctx, 2.6, -2.6, 1.1, c.off, ally, t); // green = your team's, red = the enemy's (he asked)
  }
  ctx.restore();
}

// a map camera hung on a wall (or up in a corner): small and dark like a fitting of the building, its
// view cone shown only to defenders, a faint red light the only giveaway
function drawWallCam(ctx, c, t, ally) {
  ctx.save(); ctx.translate(c.x, c.y);
  const ag = c.ag ?? c.wn;
  if (ally && c.hp && !c.off) { ctx.save(); ctx.rotate(ag); const g = ctx.createRadialGradient(0, 0, 2, 0, 0, 20); g.addColorStop(0, 'rgba(255,60,60,0.3)'); g.addColorStop(1, 'rgba(255,60,60,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, 20, -0.95, 0.95); ctx.fill(); ctx.restore(); }
  ctx.save(); ctx.rotate(c.wn); // mounting plate against the wall face, short arm out to the camera
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(-2.6, -2.4, 3.4, 5.4);
  ctx.fillStyle = '#3a3d41'; ctx.fillRect(-3, -2.6, 1.4, 5.2); ctx.fillRect(-2, -0.5, 2, 1);
  ctx.restore();
  if (!c.hp) { // shot down: cracked housing hanging off its plate
    ctx.fillStyle = '#222428'; ctx.beginPath(); ctx.arc(0.6, 0.8, 2.2, 0, 7); ctx.fill();
    ctx.strokeStyle = '#4a4d52'; ctx.lineWidth = 0.5; ctx.beginPath(); ctx.moveTo(-0.8, -0.6); ctx.lineTo(1.8, 2); ctx.moveTo(1.6, -0.4); ctx.lineTo(0, 1.6); ctx.stroke();
  } else {
    ctx.save(); ctx.rotate(ag); ctx.fillStyle = '#26282c'; ctx.fillRect(0.4, -1.2, 2.6, 2.4); ctx.fillStyle = '#0d0e10'; ctx.fillRect(2.6, -0.8, 0.8, 1.6); ctx.restore();
    ctx.fillStyle = '#34373c'; ctx.beginPath(); ctx.arc(0, 0, 2.3, 0, 7); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.beginPath(); ctx.arc(-0.6, -0.7, 1, 0, 7); ctx.fill();
    camDot(ctx, 0, 0, 0.8, c.off, ally, t);
  }
  ctx.restore();
}

// MAGPIE (he asked): green parasite veins, branching out from the middle and pulsing
function parasiteVeins(ctx, t, r) {
  ctx.save(); ctx.lineCap = 'round';
  for (let i = 0; i < 6; i++) {
    const a = i * 1.047 + Math.sin(t * 1.3 + i) * 0.25, l = r * (0.65 + 0.35 * Math.sin(t * 5 + i * 2.1));
    ctx.strokeStyle = `rgba(110,240,140,${0.55 + 0.35 * Math.sin(t * 6 + i)})`; ctx.lineWidth = 0.35;
    ctx.beginPath(); ctx.moveTo(0, 0);
    const mx = Math.cos(a) * l * 0.55 + Math.cos(a + 1.4) * 0.8, my = Math.sin(a) * l * 0.55 + Math.sin(a + 1.4) * 0.8;
    ctx.quadraticCurveTo(mx, my, Math.cos(a) * l, Math.sin(a) * l);
    ctx.moveTo(mx, my); ctx.lineTo(mx + Math.cos(a - 0.9) * l * 0.35, my + Math.sin(a - 0.9) * l * 0.35);
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(140,255,160,0.8)'; ctx.beginPath(); ctx.arc(0, 0, 0.7, 0, 7); ctx.fill();
  ctx.restore();
}
// MAGPIE's bird: the attacker drone's grey body bent into a bird. Its wheels have folded out into segmented wing
// plates, the camera is now the eye at the tip of the head, the antenna is the tail, and green parasite veins glow
// through it. Flying, the wings beat (faster the faster it goes); landed, they fold along the body. b.fl = 0..1 flap.
export function drawBird(ctx, b, t, ally) {
  const fl = b.pe ? 0 : (b.fl ?? 0.5), beat = b.pe ? 0 : Math.sin(t * (10 + fl * 10)) * (0.4 + fl * 0.6);
  ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.ag || 0); ctx.scale(0.75, 0.75);
  if (ally) { ctx.strokeStyle = 'rgba(70,170,255,0.45)'; ctx.lineWidth = 0.4; ctx.beginPath(); ctx.arc(0, 0, 8, 0, 7); ctx.stroke(); }
  if (!b.pe) { ctx.fillStyle = 'rgba(0,0,0,0.22)'; ctx.beginPath(); ctx.ellipse(-1, 3.5, 4.5, 2.2, 0, 0, 7); ctx.fill(); } // shadow on the floor below: it is in the air
  const body = ctx.createLinearGradient(-5, -2, 5, 2); body.addColorStop(0, '#50565c'); body.addColorStop(1, '#2a2d31');
  for (const s of [-1, 1]) { // wing: three overlapping plates (the old wheels and side panels), tips forward
    const open = b.pe ? 0.15 : 0.75 + beat * 0.5;
    ctx.save(); ctx.scale(1, s); if (b.pe) { ctx.translate(-1.5, 0.6); ctx.scale(1.1, 0.32); } ctx.rotate(-open * 0.9); // landed: folded flat along the body
    for (let i = 0; i < 3; i++) {
      ctx.fillStyle = i === 2 ? '#1a1c1f' : i ? '#34383d' : '#464b51';
      ctx.beginPath(); ctx.moveTo(-1 - i * 1.4, 0.8); ctx.lineTo(1.5 - i * 1.6, 7.5 - i * 0.6); ctx.lineTo(-1.2 - i * 1.6, 7 - i * 0.5); ctx.lineTo(-3 - i * 1.4, 1); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 0.2; ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(110,240,140,0.55)'; ctx.lineWidth = 0.25; ctx.beginPath(); ctx.moveTo(-1.5, 1); ctx.lineTo(0, 6.4); ctx.stroke(); // a vein along the wing
    ctx.restore();
  }
  ctx.fillStyle = '#1e2124'; ctx.beginPath(); ctx.moveTo(-4, 0); ctx.lineTo(-8.5, -1.6); ctx.lineTo(-8, 0); ctx.lineTo(-8.5, 1.6); ctx.closePath(); ctx.fill(); // tail (the antenna, split)
  ctx.fillStyle = body; ctx.beginPath(); ctx.ellipse(-0.6, 0, 4.4, 2.1, 0, 0, 7); ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 0.3; ctx.stroke();
  ctx.fillStyle = '#3e4348'; ctx.beginPath(); ctx.ellipse(3.6, 0, 1.8, 1.4, 0, 0, 7); ctx.fill(); // head
  ctx.fillStyle = '#16181b'; ctx.beginPath(); ctx.moveTo(5.1, -0.6); ctx.lineTo(7, 0); ctx.lineTo(5.1, 0.6); ctx.closePath(); ctx.fill(); // beak
  ctx.fillStyle = `rgba(120,255,150,${0.7 + 0.3 * Math.sin(t * 4)})`; ctx.beginPath(); ctx.arc(4.2, 0, 0.55, 0, 7); ctx.fill(); // the camera, now a green eye
  parasiteVeins(ctx, t, 3.4);
  if (b.pe && b.au) { ctx.strokeStyle = `rgba(255,215,90,${0.6 + 0.3 * Math.sin(t * 5)})`; ctx.lineWidth = 0.7; ctx.beginPath(); ctx.arc(0, 0, 6.5, -0.7, 0.7); ctx.stroke(); } // AUTO: armed (a gold arc in front)
  ctx.restore();
}
// the swarm: a cloud of tiny dark parasites with green glints, swirling round itself and streaming behind
export function drawSwarm(ctx, s, t) {
  ctx.save(); ctx.translate(s.x, s.y);
  const r = s.gr ? 4 : 6;
  ctx.fillStyle = 'rgba(60,160,90,0.10)'; ctx.beginPath(); ctx.arc(0, 0, r + 2, 0, 7); ctx.fill();
  for (let i = 0; i < 26; i++) {
    const ph = i * 2.399, sp = 3 + (i % 5), a = ph + t * sp * (i % 2 ? 1 : -1), rr = r * (0.3 + 0.7 * ((i * 0.618) % 1)) * (0.8 + 0.2 * Math.sin(t * 7 + i));
    const x = Math.cos(a) * rr - (s.vx || 0) * 0.02 * (i % 3), y = Math.sin(a) * rr * 0.8 - (s.vy || 0) * 0.02 * (i % 3);
    ctx.fillStyle = i % 4 ? '#111410' : `rgba(110,240,140,${0.6 + 0.4 * Math.sin(t * 9 + i)})`;
    ctx.fillRect(x - 0.35, y - 0.35, 0.7, 0.7);
  }
  ctx.restore();
}

// Each gadget wears a small symbol badge in its team's colour (he asked: tell what it is by looking, without pinging).
// Glyphs are drawn in a 6 x 6 box round the badge centre with plain strokes so they read at any zoom.
const GLYPH = {
  jammer: g => { g.arc(0, 1.6, 0.6, 0, 7); g.moveTo(-1.8, -0.2); g.arc(0, 1.6, 2.4, -2.4, -0.74); g.moveTo(-1.1, 0.6); g.arc(0, 1.6, 1.4, -2.5, -0.64); },
  mine: g => { g.moveTo(0, -2.2); g.quadraticCurveTo(2, 0.6, 0, 2.2); g.quadraticCurveTo(-2, 0.6, 0, -2.2); },
  claymore: g => { g.moveTo(-2.2, 1.6); g.lineTo(0, -2); g.lineTo(2.2, 1.6); g.closePath(); g.moveTo(0, -0.6); g.lineTo(0, 0.5); },
  wire: g => { g.moveTo(-2.4, 0); for (let i = 0; i < 5; i++) g.lineTo(-2.4 + (i + 1) * 0.96, i % 2 ? 1 : -1); },
  cutter: g => { g.moveTo(0, 2.2); g.quadraticCurveTo(-2.2, 0, 0, -2.2); g.quadraticCurveTo(2.2, 0, 0, 2.2); },
  breach: g => { g.rect(-2.2, -1.4, 4.4, 2.8); g.moveTo(-1, -1.4); g.lineTo(-1, 1.4); g.moveTo(1, -1.4); g.lineTo(1, 1.4); },
  dart: g => { g.moveTo(-2.2, 2.2); g.lineTo(2.2, -2.2); g.moveTo(2.2, -2.2); g.lineTo(0.6, -2); g.moveTo(2.2, -2.2); g.lineTo(2, -0.6); },
  prox: g => { g.arc(0, 0, 0.7, 0, 7); g.moveTo(1.6, 0); g.arc(0, 0, 1.6, 0, 7); g.moveTo(2.4, 0); g.arc(0, 0, 2.4, 0, 7); },
  concuss: g => { for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2, r = i % 2 ? 1 : 2.4; i ? g.lineTo(Math.cos(a) * r, Math.sin(a) * r) : g.moveTo(Math.cos(a) * r, Math.sin(a) * r); } g.closePath(); },
  clamp: g => { g.arc(0, 0, 2, 0.6, Math.PI * 2 - 0.6); },
  sensor: g => { g.moveTo(-2.4, 0); g.quadraticCurveTo(0, -2.4, 2.4, 0); g.quadraticCurveTo(0, 2.4, -2.4, 0); g.moveTo(0.7, 0); g.arc(0, 0, 0.7, 0, 7); },
  grid: g => { g.moveTo(0.6, -2.4); g.lineTo(-1.2, 0.3); g.lineTo(0.8, 0.3); g.lineTo(-0.6, 2.4); },
  plates: g => { g.moveTo(0, -2.4); g.lineTo(2, -1.4); g.lineTo(1.6, 1.2); g.lineTo(0, 2.4); g.lineTo(-1.6, 1.2); g.lineTo(-2, -1.4); g.closePath(); },
  cluster: g => { for (const [x, y] of [[-1.3, 1], [1.3, 1], [0, -1.3]]) { g.moveTo(x + 0.8, y); g.arc(x, y, 0.8, 0, 7); } },
  sticky: g => { for (const [x, y] of [[-1.3, 1], [1.3, 1], [0, -1.3]]) { g.moveTo(x + 0.8, y); g.arc(x, y, 0.8, 0, 7); } },
  pace: g => { g.moveTo(-2, 1.4); g.lineTo(0, -0.4); g.lineTo(2, 1.4); g.moveTo(-2, -0.4); g.lineTo(0, -2.2); g.lineTo(2, -0.4); },
  scope: g => { g.moveTo(1.6, 0); g.arc(0, 0, 1.6, 0, 7); g.moveTo(-2.5, 0); g.lineTo(2.5, 0); g.moveTo(0, -2.5); g.lineTo(0, 2.5); },
  slug: g => { g.moveTo(-2.2, -0.9); g.lineTo(0.8, -0.9); g.quadraticCurveTo(2.4, 0, 0.8, 0.9); g.lineTo(-2.2, 0.9); g.closePath(); },
  saw: g => { for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2, r = i % 2 ? 1.5 : 2.4; i ? g.lineTo(Math.cos(a) * r, Math.sin(a) * r) : g.moveTo(Math.cos(a) * r, Math.sin(a) * r); } g.closePath(); },
  spike: g => { g.moveTo(0, -2.4); g.lineTo(1, 2); g.lineTo(-1, 2); g.closePath(); },
  pick: g => { g.moveTo(-2, 2); g.lineTo(1.2, -1.2); g.lineTo(2.2, -1); g.moveTo(1.2, -1.2); g.lineTo(1, -2.2); },
  alarm: g => { g.moveTo(-1.8, 1.2); g.quadraticCurveTo(-1.8, -2.2, 0, -2.2); g.quadraticCurveTo(1.8, -2.2, 1.8, 1.2); g.closePath(); g.moveTo(0.5, 2); g.arc(0, 2, 0.5, 0, 7); },
  echobox: g => { g.rect(-2.2, -0.9, 1.4, 1.8); g.moveTo(-0.8, -0.9); g.lineTo(0.8, -2.2); g.lineTo(0.8, 2.2); g.lineTo(-0.8, 0.9); g.moveTo(1.6, -1); g.quadraticCurveTo(2.4, 0, 1.6, 1); },
  radar: g => { g.arc(0, 0, 2.3, Math.PI, Math.PI * 2); g.moveTo(0, 0); g.lineTo(1.7, -1.6); g.moveTo(-2.3, 0); g.lineTo(2.3, 0); },
  station: g => { g.moveTo(-2.2, 0); g.lineTo(2.2, 0); g.moveTo(0, -2.2); g.lineTo(0, 2.2); },
  catcher: g => { g.moveTo(-1.8, -2); g.lineTo(-1.8, 0.4); g.arc(0, 0.4, 1.8, Math.PI, 0, true); g.lineTo(1.8, -2); },
};
const NO_BADGE = new Set(['defuser', 'healzone', 'nade', 'cover']);
function badge(ctx, e, ally) {
  const f = GLYPH[e.ty]; if (!f || NO_BADGE.has(e.ty)) return;
  ctx.save(); ctx.translate(e.x + 6.5, e.y - 6.5);
  ctx.fillStyle = 'rgba(10,12,16,0.85)'; ctx.beginPath(); ctx.arc(0, 0, 3.9, 0, 7); ctx.fill();
  ctx.strokeStyle = ally ? '#46a8ff' : '#ff8a3d'; ctx.lineWidth = 0.7; ctx.stroke();
  ctx.scale(0.95, 0.95); ctx.strokeStyle = '#fff'; ctx.lineWidth = 0.6; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath(); f(ctx); ctx.stroke();
  ctx.restore();
}
export function drawGadget(ctx, e, t, ally) {
  drawGadgetBody(ctx, e, t, ally);
  badge(ctx, e, ally);
}
// Ability looks (he asked): each gadget drawn as the real thing it is, in its operator's colours. The operator's colour
// glows round it for their own team only (he asked: it must not make gadgets easier for the enemy to spot), and range
// rings are for the owner's team only, dashed (a circle only where a circle is the real reach).
const GADGET_OP = { jammer: 'veil', mine: 'lynx', prox: 'bramble', concuss: 'gravel', clamp: 'snare', sensor: 'shade', grid: 'shunt', plates: 'rampart',
  pace: 'rally', sticky: 'salvo', saw: 'torque', spike: 'echo', pick: 'wren', alarm: 'latch', echobox: 'ruse', radar: 'audit', station: 'tonic', healzone: 'patch',
  catcher: 'ward', dart: 'hound', cover: 'trench', cluster: 'ember', cutter: 'rivet', scope: 'tether', drill: 'gimlet', htrap: 'lockjaw', dropch: 'deadfall' };
const glowCache = {};
function glow(ctx, ty, r = 9) { // a soft halo in the operator's colour, from a small cached picture (cheap to draw)
  const op = OPERATORS[GADGET_OP[ty]]; if (!op || typeof document === 'undefined') return;
  let g = glowCache[op.color];
  if (!g) { g = glowCache[op.color] = document.createElement('canvas'); g.width = g.height = 32; const c = g.getContext('2d'), gr = c.createRadialGradient(16, 16, 0, 16, 16, 16); gr.addColorStop(0, op.color + '88'); gr.addColorStop(0.5, op.color + '33'); gr.addColorStop(1, op.color + '00'); c.fillStyle = gr; c.fillRect(0, 0, 32, 32); }
  ctx.drawImage(g, -r, -r, r * 2, r * 2);
}
function reach(ctx, r, col, a = 0.22) { ctx.save(); ctx.setLineDash([3, 4]); ctx.strokeStyle = `rgba(${col},${a})`; ctx.lineWidth = 0.5; ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.stroke(); ctx.restore(); }
const opCol = ty => (OPERATORS[GADGET_OP[ty]] || {}).color || '#888';
function drawGadgetBody(ctx, e, t, ally) {
  ctx.save(); ctx.translate(e.x, e.y); if (!NO_BADGE.has(e.ty)) ctx.scale(1.2, 1.2); // a little bigger, so the shapes read
  const blink = Math.floor(t * 4) % 2 === 0;
  if (ally && GADGET_OP[e.ty] && e.ty !== 'cover' && e.ty !== 'healzone') glow(ctx, e.ty, e.ty === 'station' ? 11 : 9);
  switch (e.ty) {
    case 'cover': { // TRENCH's plate: thin steel on two little feet, with a narrow sight slit
      const h = e.hl || 17; ctx.rotate(e.ag || 0);
      ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(-h + 1, -1, h * 2, 4.5);
      ctx.fillStyle = '#4b535c'; ctx.fillRect(-h, -2, h * 2, 4); ctx.fillStyle = '#6d7782'; ctx.fillRect(-h, -2, h * 2, 1.2);
      ctx.fillStyle = '#1b1e22'; ctx.fillRect(-4, -0.6, 8, 1.2); ctx.fillStyle = ally ? '#46a8ff' : '#ff8a3d'; ctx.fillRect(-h, 1.2, h * 2, 0.8);
      for (const s of [-1, 1]) { ctx.fillStyle = '#2a2e33'; ctx.fillRect(s * (h - 4) - 1.5, 2, 3, 2.5); }
      break; }
    case 'jammer': // VEIL's jammer: a ribbed box with three antennas fanned out and a running LED bar
      ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fillRect(-3, -2, 8, 6);
      box(ctx, -4, -3, 8, 6, 1, '#2b2f36'); ctx.fillStyle = 'rgba(255,255,255,0.08)'; for (let i = -3; i < 3; i += 1.4) ctx.fillRect(-3.4, i, 6.8, 0.4);
      for (const a of [-0.5, 0, 0.5]) cap(ctx, 3, 0, 3 + Math.cos(a) * 5, Math.sin(a) * 5, 0.5, '#9aa0a6');
      for (let i = 0; i < 4; i++) { ctx.fillStyle = Math.floor(t * 8) % 4 === i ? opCol('jammer') : '#1a1c20'; ctx.fillRect(-3 + i * 1.3, 1.6, 1, 0.8); }
      if (ally) reach(ctx, 90, '85,193,232', 0.14 + Math.sin(t * 3) * 0.04);
      break;
    case 'mine': // LYNX's paint trap: a squat paint canister with a nozzle and drips of her colour
      ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(-2.6, -2, 6.4, 5.4);
      box(ctx, -3.2, -2.8, 6.4, 5.6, 1.4, '#3a3d3a'); ctx.fillStyle = opCol('mine'); ctx.fillRect(-3.2, -0.6, 6.4, 1.2);
      ctx.beginPath(); ctx.moveTo(-1, -2.8); ctx.lineTo(-1.4, -4.4); ctx.lineTo(-0.2, -4.4); ctx.lineTo(0.2, -2.8); ctx.fill(); // drip
      cap(ctx, 3.2, 0, 4.6, 0, 1, '#1a1a1a'); ctx.fillStyle = blink ? '#ff3b3b' : '#5a1010'; ctx.fillRect(1.4, -2.3, 0.9, 0.9);
      if (ally) reach(ctx, 22, '255,80,80');
      break;
    case 'claymore':
      ctx.rotate(e.ag || 0);
      ctx.fillStyle = '#4a5233'; ctx.beginPath(); ctx.moveTo(-2, -4); ctx.quadraticCurveTo(3, 0, -2, 4); ctx.lineTo(-3.5, 4); ctx.quadraticCurveTo(1, 0, -3.5, -4); ctx.fill();
      ctx.strokeStyle = 'rgba(255,40,40,0.5)'; ctx.lineWidth = 0.4;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(-0.7) * 44, Math.sin(-0.7) * 44); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(0.7) * 44, Math.sin(0.7) * 44); ctx.stroke();
      break;
    case 'wire': {
      ctx.rotate(e.ag || 0);
      ctx.strokeStyle = '#8b8f93'; ctx.lineWidth = 0.55;
      for (let i = 0; i < 9; i++) { ctx.beginPath(); ctx.ellipse(-16 + i * 4, 0, 4, 9, 0.3, 0, 7); ctx.stroke(); }
      ctx.strokeStyle = 'rgba(200,205,210,0.5)'; ctx.lineWidth = 0.3;
      for (let i = 0; i < 9; i++) { ctx.beginPath(); ctx.ellipse(-16 + i * 4 + 1, 0, 3.5, 8, -0.3, 0, 7); ctx.stroke(); }
      break;
    }
    case 'cutter': case 'breach': {
      const cutter = e.ty === 'cutter';
      ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fillRect(-4, -3, 9, 7);
      ctx.fillStyle = cutter ? '#c9611f' : '#4c5a3a'; ctx.fillRect(-5, -4, 10, 8);
      ctx.fillStyle = '#222'; ctx.fillRect(-3.5, -2.5, 7, 5);
      ctx.fillStyle = e.j ? '#55c1e8' : (blink ? '#ff3030' : '#601010'); ctx.fillRect(-1, -1, 2, 2);
      if (cutter && !e.j && e.t < 5) {
        ctx.globalCompositeOperation = 'lighter';
        const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 14); g.addColorStop(0, 'rgba(255,190,90,0.6)'); g.addColorStop(1, 'rgba(255,120,30,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 14, 0, 7); ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
      }
      break;
    }
    case 'dart': // a spotter dart stuck in place: a needle with three fins and a blinking tip
      ctx.rotate(e.ag || 0.6);
      cap(ctx, -4, 0, 3, 0, 0.7, '#c8ccd2'); ctx.fillStyle = opCol('dart');
      for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(-4, 0); ctx.lineTo(-5.5, s * 2); ctx.lineTo(-2.5, 0); ctx.fill(); }
      ctx.fillStyle = blink ? '#7fffe8' : '#2a6a62'; ctx.fillRect(2.4, -0.6, 1.2, 1.2);
      if (ally) reach(ctx, 170, '79,179,169', 0.12 + 0.08 * Math.sin(t * 6));
      break;
    case 'nade': {
      const col = { frag: '#3d4a2c', smoke: '#7a7f86', stun: '#2c3e5a', impact: '#6a3a2a', nitro: '#5a5f2c', emp: '#a46ad6', sonar: '#5fd3e8', gas: '#7f9c2c', cam: '#d7d9db' }[e.kd] || '#555';
      ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.beginPath(); ctx.arc(1, 1.2, 2.6, 0, 7); ctx.fill();
      ctx.fillStyle = col; ctx.beginPath(); ctx.arc(0, 0, e.kd === 'nitro' ? 3.2 : 2.5, 0, 7); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.beginPath(); ctx.arc(-0.8, -0.8, 0.8, 0, 7); ctx.fill();
      if (e.kd === 'gas') { ctx.fillStyle = blink ? '#c8ff60' : '#3a4a10'; ctx.fillRect(-0.6, -0.6, 1.2, 1.2); }
      if (e.kd === 'nitro') { ctx.fillStyle = blink ? '#ff3030' : '#601010'; ctx.fillRect(-0.6, -0.6, 1.2, 1.2); }
      break;
    }
    case 'prox': { // BRAMBLE's charge: a brick of explosive wrapped in thorny wire, a sensor eye on top
      ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fillRect(-3.4, -2, 8, 5.4);
      box(ctx, -4, -2.8, 8, 5.6, 0.8, '#4a5226'); ctx.fillStyle = '#5c6630'; ctx.fillRect(-3.4, -2.2, 6.8, 1.4);
      ctx.strokeStyle = '#3a2a1a'; ctx.lineWidth = 0.45; ctx.beginPath(); for (let i = 0; i <= 8; i++) ctx.lineTo(-4.4 + i * 1.1, i % 2 ? -3.4 : 3.4); ctx.stroke(); // the thorn wire round it
      ctx.fillStyle = '#1e2410'; ctx.beginPath(); ctx.ellipse(0, 0, 1.4, 1, 0, 0, 7); ctx.fill(); ctx.fillStyle = blink ? '#ffd040' : '#5a4a10'; ctx.fillRect(-0.4, -0.4, 0.8, 0.8);
      if (ally) reach(ctx, 42, '255,200,60');
      break;
    }
    case 'concuss': { // GRAVEL's daze mine: a hexagonal sticky puck, hazard-striped, with four grip spikes
      ctx.fillStyle = '#9aa0a6'; for (let i = 0; i < 4; i++) { const a = i * 1.571 + 0.785; ctx.beginPath(); ctx.moveTo(Math.cos(a - 0.3) * 3, Math.sin(a - 0.3) * 3); ctx.lineTo(Math.cos(a) * 4.6, Math.sin(a) * 4.6); ctx.lineTo(Math.cos(a + 0.3) * 3, Math.sin(a + 0.3) * 3); ctx.fill(); }
      ctx.fillStyle = '#3a3222'; ctx.beginPath(); for (let i = 0; i < 6; i++) { const a = i * 1.047; ctx.lineTo(Math.cos(a) * 3.3, Math.sin(a) * 3.3); } ctx.closePath(); ctx.fill();
      ctx.save(); ctx.clip(); ctx.strokeStyle = opCol('concuss'); ctx.lineWidth = 0.7; for (let x = -5; x < 5; x += 2) { ctx.beginPath(); ctx.moveTo(x, -4); ctx.lineTo(x + 3, 4); ctx.stroke(); } ctx.restore();
      ctx.fillStyle = '#1a1a1a'; ctx.fillRect(-1, -1, 2, 2); ctx.fillStyle = blink ? '#ffe070' : '#5a4a10'; ctx.fillRect(-0.5, -0.5, 1, 1);
      break;
    }
    case 'clamp': { // SNARE's trap: two half-moon steel jaws held open by flat springs on each side, a pressure plate between
      ctx.fillStyle = '#3a3d40'; ctx.fillRect(-1.6, -1.6, 3.2, 3.2); ctx.fillStyle = opCol('clamp'); ctx.fillRect(-0.9, -0.9, 1.8, 1.8);
      for (const s of [-1, 1]) {
        ctx.strokeStyle = '#7a7f84'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.arc(0, s * 1.2, 4.6, s > 0 ? 0.15 : Math.PI + 0.15, s > 0 ? Math.PI - 0.15 : -0.15); ctx.stroke();
        ctx.fillStyle = '#b0b6bc'; for (let i = 1; i < 6; i++) { const a = (s > 0 ? 0 : Math.PI) + i * 0.52, x = Math.cos(a) * 4.6, y = s * 1.2 + Math.sin(a) * 4.6; ctx.beginPath(); ctx.moveTo(x - 0.5, y); ctx.lineTo(x * 0.8, s * 1.2 + (y - s * 1.2) * 0.72); ctx.lineTo(x + 0.5, y); ctx.fill(); }
        box(ctx, s * 5 - 1.2, -1, 2.4, 2, 0.4, '#55595f');
      }
      break;
    }
    case 'sensor': { // SHADE's microphone: a mesh capsule on a little tripod; her team sees sound arcs coming off it
      for (const a of [0.6, 2.7, 4.8]) cap(ctx, 0, 0, Math.cos(a) * 4, Math.sin(a) * 4, 0.5, '#3a3e44');
      ctx.fillStyle = '#2b2f36'; ctx.beginPath(); ctx.ellipse(0, 0, 1.6, 2.6, 0, 0, 7); ctx.fill();
      ctx.strokeStyle = opCol('sensor'); ctx.lineWidth = 0.3; for (let y = -1.8; y <= 1.8; y += 0.9) { ctx.beginPath(); ctx.moveTo(-1.3, y); ctx.lineTo(1.3, y); ctx.stroke(); }
      if (ally) { const k = (t * 0.9) % 1; ctx.strokeStyle = `rgba(155,107,224,${0.5 * (1 - k)})`; ctx.lineWidth = 0.5; for (const a of [0, 2.09, 4.19]) { ctx.beginPath(); ctx.arc(0, 0, 4 + k * 8, a - 0.45, a + 0.45); ctx.stroke(); } }
      break;
    }
    case 'grid': { // SHUNT's static grid: a bracket clamped to the wall, a copper coil between two prongs, sparks jumping
      ctx.rotate(e.ag || 0);
      box(ctx, -3.5, -3, 3, 6, 0.6, '#26324e'); for (const s of [-1, 1]) cap(ctx, -0.5, s * 2.4, 3.5, s * 2.4, 0.7, '#9aa0a6');
      ctx.strokeStyle = '#c88a3a'; ctx.lineWidth = 0.55; ctx.beginPath(); for (let i = 0; i <= 8; i++) ctx.lineTo(0 + i * 0.4, (i % 2 ? 1 : -1) * 1.6); ctx.stroke();
      ctx.strokeStyle = `rgba(140,190,255,${0.4 + 0.4 * Math.random()})`; ctx.lineWidth = 0.4; ctx.beginPath(); ctx.moveTo(3.5, -2.4); for (let i = 1; i <= 3; i++) ctx.lineTo(3.5 + (Math.random() - 0.3) * 1.6, -2.4 + i * 1.6); ctx.stroke();
      break;
    }
    case 'plates': // RAMPART's armor bag: a duffel with grab handles, plates stacked inside the open zip
      ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fillRect(-4, -2, 10, 7);
      box(ctx, -5.5, -3.5, 11, 7, 2.6, '#4a4f38'); cap(ctx, -2.5, -3.5, 2.5, -3.5, 0.8, '#2a2d22'); cap(ctx, -2.5, 3.5, 2.5, 3.5, 0.8, '#2a2d22');
      ctx.fillStyle = '#1e2018'; ctx.fillRect(-4.2, -1.6, 8.4, 3.2);
      for (let i = 0; i < (e.c || 0); i++) { ctx.fillStyle = i % 2 ? '#8f9aa6' : '#a8b2bc'; ctx.fillRect(-3.8 + i * 1.6, -1.3, 1.2, 2.6); }
      break;
    case 'cluster': // Cluster Charge: a black box of four tubes
      ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fillRect(-4, -3, 9, 7);
      ctx.fillStyle = '#26282c'; ctx.fillRect(-5, -4, 10, 8);
      for (const [cx, cy] of [[-2.2, -1.8], [2.2, -1.8], [-2.2, 1.8], [2.2, 1.8]]) { ctx.fillStyle = '#55595f'; ctx.beginPath(); ctx.arc(cx, cy, 1.4, 0, 7); ctx.fill(); }
      ctx.fillStyle = blink ? '#ff3030' : '#601010'; ctx.fillRect(-0.6, -0.6, 1.2, 1.2);
      break;
    case 'pace': { // RALLY's pace beacon: a striped running cone; her team sees speed chevrons racing out of it
      ctx.rotate(e.ag || 0);
      ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.moveTo(4.5, 1); ctx.lineTo(-3, -2.4); ctx.lineTo(-3, 4); ctx.fill();
      ctx.fillStyle = opCol('pace'); ctx.beginPath(); ctx.moveTo(4, 0); ctx.lineTo(-3.5, -3.2); ctx.lineTo(-3.5, 3.2); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#f2f2f2'; ctx.fillRect(-1.2, -2.1, 1, 4.2);
      if (ally) { const k = (t * 1.6) % 1; for (let i = 0; i < 3; i++) { const x = 6 + ((k + i / 3) % 1) * 14; ctx.strokeStyle = `rgba(120,255,160,${0.6 * (1 - (k + i / 3) % 1)})`; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(x - 2, -2.5); ctx.lineTo(x, 0); ctx.lineTo(x - 2, 2.5); ctx.stroke(); } }
      break;
    }
    case 'scope': // Wall Scope: a lens poking out of the wall (TETHER's: a shimmering energy shield for its first 3 s)
      if (e.fl) { // LENS's periscope through the floor/ceiling: a round lens with an arrow (up or down)
        ctx.fillStyle = '#2b2f36'; ctx.beginPath(); ctx.arc(0, 0, 3.2, 0, 7); ctx.fill(); ctx.fillStyle = '#55c1e8'; ctx.beginPath(); ctx.arc(0, 0, 1.8, 0, 7); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.beginPath(); const d = e.fl === 'up' ? -1 : 1; ctx.moveTo(-1, 0.6 * d); ctx.lineTo(1, 0.6 * d); ctx.lineTo(0, -1 * d); ctx.fill();
        break;
      }
      if (e.sh) { const k = Math.min(1, e.sh), w = 0.5 + 0.5 * Math.sin(t * 12); ctx.strokeStyle = `rgba(120,230,255,${(0.35 + 0.35 * w) * k})`; ctx.fillStyle = `rgba(120,230,255,${0.12 * k})`; ctx.lineWidth = 0.6; // a hex-cell energy shield
        ctx.beginPath(); for (let i = 0; i < 6; i++) { const a = i * 1.047; ctx.lineTo(Math.cos(a) * (5.6 + w * 0.5), Math.sin(a) * (5.6 + w * 0.5)); } ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.beginPath(); for (let i = 0; i < 6; i++) { const a = i * 1.047; ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * 5.6, Math.sin(a) * 5.6); } ctx.stroke(); }
      ctx.rotate(e.ag || 0);
      ctx.fillStyle = '#2b2f36'; ctx.fillRect(-4, -1.5, 5, 3);
      ctx.fillStyle = '#6fbf73'; ctx.beginPath(); ctx.arc(1.5, 0, 1.5, 0, 7); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.beginPath(); ctx.arc(1.9, -0.5, 0.5, 0, 7); ctx.fill();
      break;
    case 'slug':
      ctx.fillStyle = '#ffcf6a'; ctx.beginPath(); ctx.arc(0, 0, 2, 0, 7); ctx.fill();
      break;
    // ---- the operators added to fill every role ----
    case 'sticky': { // SALVO's round: a finned launcher shell with a red band; stuck, its nose is splayed into the wall and a light pulses
      ctx.rotate(e.ag || 0);
      box(ctx, -3.6, -1.4, 6, 2.8, 1.2, '#2a2a2a'); ctx.fillStyle = '#c0392b'; ctx.fillRect(-0.6, -1.4, 1.1, 2.8);
      ctx.fillStyle = '#4a4a4a'; for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(-3.6, 0); ctx.lineTo(-5, s * 2.2); ctx.lineTo(-2.4, s * 1.2); ctx.fill(); }
      if (e.st) { for (const s of [-1, 0, 1]) cap(ctx, 2.4, 0, 3.8, s * 1.4, 0.4, '#777'); const k = 0.5 + 0.5 * Math.sin(t * 3); ctx.fillStyle = `rgba(255,74,58,${0.4 + 0.5 * k})`; ctx.fillRect(1, -0.5, 1, 1); }
      break;
    }
    case 'saw': { // TORQUE's saw disc: a spinning toothed blade with a blur ring
      ctx.rotate(t * 40);
      ctx.fillStyle = 'rgba(200,205,210,0.25)'; ctx.beginPath(); ctx.arc(0, 0, 5.2, 0, 7); ctx.fill();
      ctx.fillStyle = '#9aa0a8'; ctx.beginPath();
      for (let i = 0; i < 16; i++) { const a = i / 16 * 6.283, r = i % 2 ? 3.4 : 4.4; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
      ctx.closePath(); ctx.fill(); ctx.fillStyle = '#e0b53a'; ctx.beginPath(); ctx.arc(0, 0, 1.3, 0, 7); ctx.fill();
      break;
    }
    case 'drill': { // GIMLET's drill: a tripod with a spinning bit
      ctx.strokeStyle = '#2a2c2e'; ctx.lineWidth = 0.8; for (let i = 0; i < 3; i++) { const a = i * 2.09 + 0.3; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * 4.5, Math.sin(a) * 4.5); ctx.stroke(); }
      ctx.fillStyle = opCol('drill'); ctx.beginPath(); ctx.arc(0, 0, 2.2, 0, 7); ctx.fill();
      ctx.strokeStyle = '#d8dce0'; ctx.lineWidth = 0.5; const r = t * 30; ctx.beginPath(); ctx.moveTo(Math.cos(r) * 1.6, Math.sin(r) * 1.6); ctx.lineTo(-Math.cos(r) * 1.6, -Math.sin(r) * 1.6); ctx.stroke();
      break;
    }
    case 'htrap': { // LOCKJAW's hatch trap: a flat steel box with a red tell-tale, wired to the hatch
      ctx.fillStyle = '#3a3d42'; ctx.fillRect(-3.2, -2, 6.4, 4); ctx.strokeStyle = '#1a1c1e'; ctx.lineWidth = 0.4; ctx.strokeRect(-3.2, -2, 6.4, 4);
      ctx.fillStyle = (t * 2) % 1 < 0.5 ? '#ff4030' : '#601810'; ctx.fillRect(-0.6, -0.6, 1.2, 1.2);
      ctx.strokeStyle = opCol('htrap'); ctx.lineWidth = 0.4; ctx.beginPath(); ctx.moveTo(3.2, 0); ctx.lineTo(7, 1.5); ctx.moveTo(-3.2, 0); ctx.lineTo(-7, -1.5); ctx.stroke();
      break;
    }
    case 'dropch': { // DEADFALL's drop charge: a round shaped charge on the floor, blinking faster as it counts down
      ctx.fillStyle = '#4a4438'; ctx.beginPath(); ctx.arc(0, 0, 4, 0, 7); ctx.fill(); ctx.strokeStyle = '#e0c030'; ctx.lineWidth = 0.8; ctx.setLineDash([1.2, 1.2]); ctx.beginPath(); ctx.arc(0, 0, 3.2, 0, 7); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = (t * (e.t !== undefined && e.t < 1 ? 8 : 3)) % 1 < 0.5 ? '#ff3020' : '#501008'; ctx.beginPath(); ctx.arc(0, 0, 1, 0, 7); ctx.fill();
      break;
    }
    case 'spike': { // ECHO's seismic spike: a cross-headed stake hammered into the floor, cracks running out of the impact
      ctx.strokeStyle = 'rgba(20,20,20,0.6)'; ctx.lineWidth = 0.35;
      for (let i = 0; i < 5; i++) { const a = i * 1.26 + 0.3; ctx.beginPath(); ctx.moveTo(Math.cos(a) * 2, Math.sin(a) * 2); ctx.lineTo(Math.cos(a + 0.2) * 4, Math.sin(a + 0.2) * 4); ctx.lineTo(Math.cos(a - 0.1) * 6.5, Math.sin(a - 0.1) * 6.5); ctx.stroke(); }
      if (ally) { const k = (t * 2) % 1; ctx.strokeStyle = `rgba(94,196,182,${0.6 * (1 - k)})`; ctx.lineWidth = 0.4; for (let i = 0; i < 5; i++) { const a = i * 1.26 + 0.3; ctx.beginPath(); ctx.moveTo(Math.cos(a) * (2 + k * 5), Math.sin(a) * (2 + k * 5)); ctx.lineTo(Math.cos(a) * (3.5 + k * 5), Math.sin(a) * (3.5 + k * 5)); ctx.stroke(); } }
      ctx.fillStyle = '#9aa0a6'; ctx.fillRect(-2.6, -0.8, 5.2, 1.6); ctx.fillRect(-0.8, -2.6, 1.6, 5.2); ctx.fillStyle = opCol('spike'); ctx.fillRect(-0.7, -0.7, 1.4, 1.4);
      break;
    }
    case 'pick': // WREN's lockpick tools on the board
      ctx.strokeStyle = '#c8ccd2'; ctx.lineWidth = 0.6; ctx.beginPath(); ctx.moveTo(-3, -1); ctx.lineTo(3, 1); ctx.moveTo(-3, 1); ctx.lineTo(2, -1.5); ctx.stroke();
      break;
    case 'alarm': // LATCH's siren wire: a thin taut line between two posts, each with a little siren horn
      ctx.rotate(e.ag || 0);
      ctx.strokeStyle = 'rgba(220,230,120,0.75)'; ctx.lineWidth = 0.35; ctx.beginPath(); ctx.moveTo(0, -10); ctx.lineTo(0, 10); ctx.stroke();
      for (const s of [-1, 1]) { ctx.fillStyle = '#4a4d3a'; ctx.fillRect(-1, s * 10 - 1, 2, 2); ctx.fillStyle = opCol('alarm'); ctx.beginPath(); ctx.moveTo(1, s * 10 - 0.6); ctx.lineTo(2.8, s * 10 - 1.4); ctx.lineTo(2.8, s * 10 + 1.4); ctx.lineTo(1, s * 10 + 0.6); ctx.fill(); }
      break;
    case 'echobox': { // RUSE's echo box: a speaker cabinet with a big cone; her team sees the fake sound pouring out of it
      ctx.rotate(e.ag || 0);
      box(ctx, -3.2, -3, 5.4, 6, 0.8, '#2b2f36'); ctx.fillStyle = '#16181b'; ctx.beginPath(); ctx.moveTo(2.2, -2.6); ctx.lineTo(3.6, -3.4); ctx.lineTo(3.6, 3.4); ctx.lineTo(2.2, 2.6); ctx.fill();
      ctx.fillStyle = opCol('echobox'); ctx.fillRect(-2.4, -0.8 - (blink ? 0.3 : 0), 1, 1.6 + (blink ? 0.6 : 0));
      if (ally) { const k = (t * 2) % 1; ctx.strokeStyle = `rgba(138,106,214,${0.6 * (1 - k)})`; ctx.lineWidth = 0.5; for (const r of [5, 7.5]) { ctx.beginPath(); ctx.arc(0, 0, r + k * 3, -0.6, 0.6); ctx.stroke(); } }
      break;
    }
    case 'radar': { // AUDIT's drone radar: a parabolic dish on a tripod, turning; his team sees its sweep
      for (const a of [1, 3.1, 5.2]) cap(ctx, 0, 0, Math.cos(a) * 3.6, Math.sin(a) * 3.6, 0.5, '#3a3e44');
      ctx.rotate(t * 2);
      if (ally) { ctx.fillStyle = 'rgba(90,208,192,0.12)'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, 16, -0.25, 0.25); ctx.closePath(); ctx.fill(); }
      ctx.strokeStyle = '#c8ccd2'; ctx.lineWidth = 0.9; ctx.beginPath(); ctx.ellipse(0.4, 0, 1.4, 3.4, 0, -Math.PI / 2, Math.PI / 2); ctx.stroke();
      cap(ctx, 0, 0, 2.8, 0, 0.4, '#9aa0a6'); ctx.fillStyle = opCol('radar'); ctx.fillRect(2.6, -0.4, 0.8, 0.8);
      break;
    }
    case 'station': { // TONIC's heal station: an open medical case on fold-out legs, a pump and a drip line; her team sees its reach
      if (ally) reach(ctx, 24, '106,208,138', 0.3);
      for (const [x, y] of [[-4, -3], [4, -3], [-4, 3], [4, 3]]) cap(ctx, x * 0.8, y * 0.8, x * 1.25, y * 1.25, 0.6, '#55595f');
      box(ctx, -4.5, -3.2, 9, 6.4, 1, '#e8ece8'); ctx.fillStyle = '#3aa85a'; ctx.fillRect(-0.8, -2.2, 1.6, 4.4); ctx.fillRect(-2.2, -0.8, 4.4, 1.6);
      ctx.fillStyle = `rgba(106,208,138,${0.5 + 0.4 * Math.sin(t * 3)})`; ctx.fillRect(2.6, -2.6, 1.2, 1.2);
      break;
    }
    case 'healzone': { // PATCH's field kit burst open: drifting green mist puffs (not a circle), the empty kit in the middle
      for (let i = 0; i < 9; i++) { const a = i * 0.7 + t * 0.15 * (i % 2 ? 1 : -1), r = 12 + (i * 9.3) % 24; ctx.fillStyle = 'rgba(106,208,138,0.10)'; ctx.beginPath(); ctx.ellipse(Math.cos(a) * r, Math.sin(a) * r, 9 + (i % 3) * 3, 6 + (i % 2) * 3, a, 0, 7); ctx.fill(); }
      box(ctx, -3, -2.2, 6, 4.4, 0.8, '#e8ece8'); ctx.fillStyle = '#3aa85a'; ctx.fillRect(-0.5, -1.5, 1, 3); ctx.fillRect(-1.5, -0.5, 3, 1);
      break;
    }
    case 'catcher': { // WARD's grenade catcher: a post with a three-pronged emitter crown, a blue spark jumping between the prongs
      for (const a of [0, 2.09, 4.19]) { cap(ctx, 0, 0, Math.cos(a) * 3.6, Math.sin(a) * 3.6, 0.8, '#3a3e44'); ctx.fillStyle = '#9fc4ff'; ctx.fillRect(Math.cos(a) * 3.6 - 0.5, Math.sin(a) * 3.6 - 0.5, 1, 1); }
      box(ctx, -1.6, -1.6, 3.2, 3.2, 0.6, '#2b2f36');
      if (blink) { const a = Math.floor(t * 8) % 3 * 2.09; ctx.strokeStyle = 'rgba(160,200,255,0.9)'; ctx.lineWidth = 0.4; ctx.beginPath(); ctx.moveTo(Math.cos(a) * 3.6, Math.sin(a) * 3.6); ctx.lineTo(0.5, -0.4); ctx.lineTo(Math.cos(a + 2.09) * 3.6, Math.sin(a + 2.09) * 3.6); ctx.stroke(); }
      break;
    }
    case 'defuser': { // dropped on the floor (he asked: easy to notice): a soft pulsing yellow glow under it, drawn a size up
      const gl = ctx.createRadialGradient(0, 0, 0, 0, 0, 13); gl.addColorStop(0, `rgba(255,220,90,${0.35 + 0.2 * Math.sin(t * 5)})`); gl.addColorStop(1, 'rgba(255,220,90,0)');
      ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(0, 0, 13, 0, 7); ctx.fill(); ctx.scale(1.35, 1.35);
      ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fillRect(-4, -2, 9, 6);
      ctx.fillStyle = '#c9a227'; ctx.fillRect(-5, -3, 10, 6); ctx.fillStyle = '#222'; ctx.fillRect(-3, -1.5, 6, 3);
      ctx.fillStyle = blink ? '#ffef6a' : '#7a6a20'; ctx.fillRect(-0.7, -0.7, 1.4, 1.4);
      break;
    }
  }
  ctx.restore();
}

export function drawBomb(ctx, b, t, label) {
  ctx.save(); ctx.translate(b.x, b.y);
  ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.beginPath(); ctx.roundRect(-6, -4, 14, 11, 2); ctx.fill();
  ctx.fillStyle = '#5a4a1a'; ctx.beginPath(); ctx.roundRect(-7, -5, 14, 10, 2); ctx.fill();
  ctx.fillStyle = '#e6c440'; ctx.fillRect(-7, -5, 14, 2);
  for (const cx of [-4, 0, 4]) { ctx.fillStyle = '#2a2a2a'; ctx.beginPath(); ctx.arc(cx, 1, 1.8, 0, 7); ctx.fill(); }
  ctx.fillStyle = Math.floor(t * 1.5) % 2 ? '#ff4040' : '#702020'; ctx.fillRect(5, -3, 1.2, 1.2);
  ctx.restore();
}

// A larger portrait for the operator-select screen.
export function portrait(canvas, opKey) {
  const ctx = canvas.getContext('2d'), o = OPERATORS[opKey];
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const g = ctx.createRadialGradient(canvas.width / 2, canvas.height / 2, 4, canvas.width / 2, canvas.height / 2, canvas.width * 0.7);
  g.addColorStop(0, shade(o.color, 0.55)); g.addColorStop(1, '#0d0f12');
  ctx.fillStyle = g; ctx.fillRect(0, 0, canvas.width, canvas.height);
  const s = canvas.width / 46;
  ctx.save(); ctx.scale(s, s);
  drawOperator(ctx, { x: 21, y: 24, aim: -0.55, op: opKey, w: o.primary, ally: true, walk: 0.6 }, 0);
  ctx.restore();
}
