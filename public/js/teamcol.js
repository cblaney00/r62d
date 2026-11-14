// Team colours in one place (he asked 2026-11-14).
// - In your own matches your team and the enemy are a setting (Settings → COLOURS), so they feel natural to each
//   player; so are the attacker / defender colours on clothing (armbands, vest trim).
// - On Esports TV each squad has its own colour: the pro teams Northwind (white-silver) and Ironclad (gold, both in
//   shared/pros.js), ordinary bot teams one of a few pairs (BOT_PAIRS, picked per match by the server: snapshot `cp`)
//   that never use the pros' colours, so those stay theirs.
export const DEFAULT_COLS = { ally: '#46a8ff', enemy: '#ff8a3d', atk: '#ff7a1f', def: '#2f93ff' };
// ready-made colours that read well on the map (the first is the default); a custom square opens a free picker
export const SWATCHES = {
  ally: ['#46a8ff', '#36d0c4', '#5fd06a', '#a98cff', '#f0f0f0', '#ff6fb5', '#ffd23f', '#ff8a3d'],
  enemy: ['#ff8a3d', '#ff4f4f', '#ff6fb5', '#ffd23f', '#c06cff', '#46a8ff', '#5fd06a', '#f0f0f0'],
  atk: ['#ff7a1f', '#ff4f4f', '#ffd23f', '#ff6fb5', '#c06cff', '#5fd06a', '#2f93ff', '#f0f0f0'],
  def: ['#2f93ff', '#36d0c4', '#5fd06a', '#a98cff', '#f0f0f0', '#ffd23f', '#ff4f4f', '#ff7a1f'],
};
export const BOT_PAIRS = [[['#36d0b0', 'TEAL'], ['#e0508a', 'ROSE']], [['#7ad04a', 'LIME'], ['#a070ff', 'VIOLET']], [['#ff5a5a', 'RED'], ['#4fd8ff', 'SKY']], [['#ff8fd0', 'PINK'], ['#62e08a', 'MINT']]];
export const COLS = { ...DEFAULT_COLS };
const HEX = /^#[0-9a-f]{6}$/i;
export const okHex = h => typeof h === 'string' && HEX.test(h);
const rgbOf = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
export const rgba = (h, a) => { const [r, g, b] = rgbOf(h); return `rgba(${r},${g},${b},${a})`; };
export const lighten = (h, k = 0.45) => '#' + rgbOf(h).map(v => Math.round(v + (255 - v) * k).toString(16).padStart(2, '0')).join('');
// the colours as CSS variables (killfeed, chat, side labels ...), light versions for text
function toCss() {
  if (typeof document === 'undefined') return;
  const r = document.documentElement.style;
  for (const k in COLS) { r.setProperty('--' + k, COLS[k]); r.setProperty('--' + k + 'L', lighten(COLS[k])); }
}
export function setCols(o, save = true) {
  for (const k in DEFAULT_COLS) if (o && okHex(o[k])) COLS[k] = o[k].toLowerCase();
  toCss();
  if (save) try { localStorage.setItem('r62d-cols', JSON.stringify(COLS)); } catch {}
}
try { setCols(JSON.parse(localStorage.getItem('r62d-cols') || 'null'), false); } catch { toCss(); }
// a squad's colour on Esports TV: the pro team's own, else this match's bot pair
export function squadCol(pro, pair, sq, PRO_TEAMS) {
  if (pro && PRO_TEAMS && PRO_TEAMS[sq]) return PRO_TEAMS[sq].colour;
  return BOT_PAIRS[(pair | 0) % BOT_PAIRS.length][sq ? 1 : 0][0];
}
export const squadName = (pair, sq) => BOT_PAIRS[(pair | 0) % BOT_PAIRS.length][sq ? 1 : 0][1];
