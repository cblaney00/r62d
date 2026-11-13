// Game modes (he asked 2026-11-12): the menu lists them in this order. One table for the server (rules) and the
// browser (menu cards, lobby line). kind 'siege' = the normal attack/defend round game; 'arena' and 'zombies' are
// the fun modes (built later: `ready: false` shows them as coming next).
//   winRounds: rounds to win · overtime: at winRounds-1 each, play on to winRounds+1 (sides swap every overtime round)
//   swap: 'round' = sides swap every round, 'half' = after `half` rounds · bans: operator bans before round 1
//   ranked: the result changes your rank · help: beginner help (site shown, tip line, counts) · preBoards: doorways
//   already barricaded at the start of each round
export const MODES = {
  quick: { name: 'QUICK MATCH', blurb: 'Easier rules for learning: the site is shown, tips on screen, a couple of doors already boarded, no bans',
    kind: 'siege', winRounds: 3, swap: 'round', overtime: false, bans: false, ranked: false, help: true, preBoards: 2, ready: true },
  unranked: { name: 'UNRANKED', blurb: 'Full rules, your rank stays as it is: bans, first to 4, sides swap at half, overtime',
    kind: 'siege', winRounds: 4, swap: 'half', half: 3, overtime: true, bans: true, ranked: false, help: false, preBoards: 0, ready: true },
  ranked: { name: 'RANKED', blurb: 'Full rules and your rank is on the line. Bots play at the lobby\'s rank',
    kind: 'siege', winRounds: 4, swap: 'half', half: 3, overtime: true, bans: true, ranked: true, help: false, preBoards: 0, ready: true },
  oitc: { name: 'ONE IN THE CHAMBER', blurb: 'Everyone for themselves. One pistol, one bullet, three lives. A kill gives you another bullet',
    kind: 'arena', fun: true, ready: true },
  gungame: { name: 'GUN GAME', blurb: 'Everyone for themselves. Every kill moves you to the next gun; first through the knife wins',
    kind: 'arena', fun: true, ready: true },
  infected: { name: 'INFECTED', blurb: 'One player starts infected. Whoever they kill joins them. Survive until the clock runs out',
    kind: 'arena', fun: true, ready: true },
  zombies: { name: 'ZOMBIES', blurb: 'Hold out against wave after wave in a harbour town. Earn points, open the town, find better guns',
    kind: 'zombies', fun: true, ready: true },
};
export const MODE_LIST = Object.keys(MODES);
export const DEFAULT_MODE = 'quick';
// Tutorial, free play and Esports TV keep the old rules: first to 3, sides swap every round, no extras
export const CLASSIC = { name: 'CLASSIC', kind: 'siege', winRounds: 3, swap: 'round', overtime: false, bans: false, ranked: false, help: false, preBoards: 0 };

// which squad (0 or 1) attacks in a round, under these rules
export function attackSquad(rules, round) {
  if (rules.swap !== 'half') return round % 2 === 1 ? 0 : 1;
  const h = rules.half || 3;
  if (round <= h) return 0;
  if (round <= 2 * h) return 1;
  return (round - 2 * h) % 2 === 1 ? 0 : 1; // overtime: swap every round
}
// rounds needed to win now (overtime moves it up once both teams reach winRounds-1)
export function roundsToWin(rules, score) {
  const w = rules.winRounds || 3;
  return rules.overtime && score[0] >= w - 1 && score[1] >= w - 1 ? w + 1 : w;
}
export function inOvertime(rules, score) { return roundsToWin(rules, score) > (rules.winRounds || 3); }
// the lobby's one-line rule summary
export function ruleLine(rules) {
  if (rules.kind !== 'siege') return rules.blurb || '';
  return [`First to ${rules.winRounds} rounds`, rules.swap === 'half' ? `Sides swap after ${rules.half || 3}` : 'Sides swap every round',
    rules.overtime ? `Overtime at ${rules.winRounds - 1}-${rules.winRounds - 1}` : '', rules.bans ? 'Operator bans' : 'No bans', rules.ranked ? 'Rank on the line' : ''].filter(Boolean).join(' · ');
}
