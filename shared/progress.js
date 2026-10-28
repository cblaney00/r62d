// Player levels: XP earned from matches. Each level needs a bit more XP than the last.
export const xpForLevel = n => 600 + 150 * (n - 1);
export function levelFor(xp) {
  let level = 1, left = xp || 0;
  while (left >= xpForLevel(level)) { left -= xpForLevel(level); level++; }
  return { level, into: left, need: xpForLevel(level) };
}
// XP for one match, itemised so the end screen can count it up line by line.
export function matchXp(pl, won) {
  const lines = [['Match completed', 150]];
  if (won) lines.push(['Victory', 300]);
  if (pl.roundsWon) lines.push([`Rounds won ×${pl.roundsWon}`, pl.roundsWon * 40]);
  if (pl.kills) lines.push([`Kills ×${pl.kills}`, pl.kills * 60]);
  if (pl.downs) lines.push([`Downs ×${pl.downs}`, pl.downs * 20]);
  const obj = (pl.plants || 0) + (pl.defuses || 0);
  if (obj) lines.push([`Objective plays ×${obj}`, obj * 100]);
  if (pl.revives) lines.push([`Revives ×${pl.revives}`, pl.revives * 50]);
  return { lines, total: lines.reduce((a, l) => a + l[1], 0) };
}
// One number for "who carried": used to pick the MVP.
export const matchScore = pl => (pl.kills || 0) * 100 + (pl.downs || 0) * 30 + ((pl.plants || 0) + (pl.defuses || 0)) * 150 + (pl.revives || 0) * 60 + (pl.damage || 0) * 0.4 + (pl.roundsWon || 0) * 20;
