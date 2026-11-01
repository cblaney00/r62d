# Unfinished batch (paused 2026-10-31, out of tokens)

Done and pushed: Esports TV revives + Esc menu, gun reshape (Wasp, Halberd/V9 removed), semi-auto attachments
(`match` barrel, `trigger`/`pad` grips, `settle` mod in `gunMods`, passed to `aimHeat` everywhere).

His decisions already made (don't ask again):
- Ranks in R6 order: Copper, Bronze, Silver, Gold, Platinum, Diamond, Champion, Pro (Pro = the two pro teams).
- Ranked = MMR ladder: RANKED button in the lobby, everyone starts Silver, empty slots on both teams are bots at
  the lobby's average MMR, win raises / loss lowers (more for beating stronger bots), rank badge on profile + lobby.

Still to do, in this order (all are in r6-todo.md "To do"):
1. Revolver art (gunart.js: `bison` has `revolver: true`; draw a real frame, fluted cylinder, barrel with rib and
   front blade, hammer, curved wood grip instead of the pistol slide) + per-gun top-down features in sprites.js
   `drawGun` (export `G` from gunart.js: revolver cylinder, `double`, pump only if `pump`, `can`, drum, belt, bolt,
   bullpup mag). Also draw the new attachments (match barrel, trigger kit, recoil pad) in gunart.js.
2. Reticle moves outward ~1.3x faster in `freeMove` (and the Armory copy); aim-in start distance per sight:
   iron 2.5 m, red dot 3.5, holo 3, prism 5, 2x scope 6.5 (`adsReset`, touch `padReach`).
3. Subtle per-sight aim-in look (red dot glow, holo ring, prism amber chevron, scope lens vignette) - never in the way.
4. Difficulty tiers = the ranks (SKILL table in bots.js, BOT_LEVELS, lobby/free play buttons; tutorial stays easiest).
5. Ranked mode (above). 6. Above Silver defenders really set up site (gadgets, barricades) unless saving gadgets.
7. Higher ranks keep their drones alive; defenders wait on stairs for drones.
8. Defenders wander a bit; loud sounds (glass, gunshots, blasts) heard building-wide unless huge or a floor apart.
9. TV: director on/off toggle; director shows defender setup utility in prep but prefers the exciting action.
10. Map Knowledge: smooth magnifying-glass zoom (wheel + drag).
