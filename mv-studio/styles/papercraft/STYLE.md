# Style: PAPERCRAFT — a pop-up paper storybook told as a retro RPG

Engine code: `template/engine/styles/papercraft/` (`paper.js`, `rpg.js`, `scenes.js`). Starter:
`engine/starters/papercraft.js` (`new_project.py --style papercraft`). After *dalabengba-mv* (ISC, see
`licenses/LICENSE-dalabengba-mv.txt`): its paper primitives are adapted, its pop-up book, multiplane camera, paper RPG
interface and transitions are followed. Its song, lyrics, characters and story are not ours: make your own film.

## 1. The idea

The world is a **moving pop-up book**, and the **RPG is its interface language**. The song is a quest: the book
opens, the hero sets out (left to right), crosses lands, fights, levels up, comes home (right to left), and the book
closes on the last frame.

- **Everything is cut paper.** Flat colour, a slightly wavy hand-cut edge, a soft drop shadow that grows with the
  piece's height above the page (`PC.cut(..., { shadow })`), a lit cut edge on top (`rim`), paper fibre printed on each
  sheet. Light from the top left, shadows to the bottom right.
- **Depth is multiplane.** Far layers move slowly, the subject plane at 1, the foreground faster and softer
  (`PC.applyCam(g, cam, depth)`). The camera is never dead: long tracking shots that follow the hero, pushes on emotion,
  a bump on each step and hit.
- **The RPG interface is paper:** cream card with an ink line, a dashed stitch and gold corners; red name tabs; the
  **dialogue box** (the lyric lines are the dialogue, typed as sung); HP / EXP bars, LV UP, a coin counter, a battle
  menu, damage numbers; the **map with a red dashed route** is the film's navigation prop (the oath → the full route →
  a corner mini-map on the road → the road home).
- **Running gags pay off.** Pick one or two (a counter that keeps rising, a name too long for its box, a prop that
  grows) and escalate them each chorus.

## 2. Look

- **One palette (`PC.PAL`):** paper / kraft / ink, royal red and gold, skies for day / dusk / night / doom, nature,
  skin, fire, coins. Colour script per chapter in `docs/CONCEPT.md` (dawn → noon green → golden village → cold snow →
  moonlit night → crystal cave → festive return).
- **Type:** ZCOOL QingKe HuangYou (round display: titles, big names), ZCOOL KuaiLe (playful: dialogue, UI), ZCOOL XiaoWei
  (storybook serif: narration, credits), Fredoka (round Latin: numbers, LV, HP). `npm run fonts` fetches them; Japanese
  lyrics: `PC.useJapanese()` (the starter calls it).
- **Characters:** `PC.doll` is a generic jointed paper doll (chibi, ~2.6 heads) pinned on the biped skeleton
  (`core/rig.js`): design your own cast with its options (hair style and colour, outfit, hat, scarf) and act with
  `pose`, `act`, `expr`, `emote`, `ik`, `hold`; or write your own rig in the same paper language. Never an existing
  character. Keep scale consistent (full shot ~260 px, medium ~420, close-up head ~360).
- **Text in the picture:** the lyric only in the dialogue box; otherwise only your own short UI words (menu items, name
  tabs, LV UP, coin counts), ≤ 5 characters of sound effects, and the credits.

## 3. Building it

```js
const PC = Z.PC, P = PC.PAL;
PC.install(); Z.LOOK_DEFAULT = Object.assign({}, PC.post);
const HERO = { hairStyle: 'spiky', hair: '#4A3428', outfit: P.blue, hat: 'cap', hatCol: P.red };
const FRIEND = { hairStyle: 'braid', hair: P.gold, outfit: P.pink, seed: 5 };
S.push({ id: 'v03', t0: B(6), t1: B(8), scene: 'pcWorld', lyric: 'none', hud: false, line: 3,
  trans: { type: 'pageTurn', dur: 2 * beat },
  moment: 'the hero reaches the village; every chest pops open',
  args: { biome: 'village', line: 3, speaker: '♪',
    cast: [Object.assign({ x: 200, walkTo: [[B(6), 200], [B(6) + 0.01, 1800]], walkDur: B(8) - B(6), walkEase: 'linear' }, HERO),
           Object.assign({ x: 1500, pose: 'shock', expr: 'shock', emote: '!' }, FRIEND)],   // walkers walk / run by speed
    cam: { from: PC.cam(960, 560, 1.05), to: PC.cam(960, 520, 1.2), follow: 0, lead: 200 },
    hud: { coins: [[B(6), 9], [B(7), 21]], lv: [B(7)] }, mini: { route: ROUTE, from: 0.3, to: 0.4 },
    burst: [{ at: B(7), x: 1200, y: 600, kind: 'coin', n: 16 }] } });
```
- **Scenes:** `pcBook` (`mode open | close`: the bookends), `pcWorld` (biomes `meadow village snow night cave dusk`,
  cast, HUD, mini-map, bursts, tracking camera), `pcMap` (the route drawn over the shot), `pcBattle` (paper theatre:
  plates, HP, menu, damage on beats). New scenes: name them `pcXxx`, draw with `PC.cut / poly / blob / ribbon / shade /
  glow / rays`, the multiplane camera, and the RPG kit (`PC.panel / nameTab / dialog / bar / lvUp / coins / menu / map`).
- **Transitions with a motive:** `pageTurn` between chapters, `shapeReveal` (circle / star / heart / keyhole) into a
  chorus or a reveal; shape-match cuts (moon ↔ coin, sword flash ↔ star, eye ↔ cave mouth); a whip with speed lines.
- **Lyrics:** every line shot passes `line` and the scene types it into the dialogue box as sung (never ahead of the
  voice). The speaker tab is your own word (`'♪'`, a role name), never lyric text.

## 4. Motion (it is a quiet, flat medium: make it move)

Flat paper colour changes few pixels when the camera drifts. Track the action (`cam.follow`), walk at a steady pace on
long tracks (`walkEase: 'linear'`), step the camera on beats, let the paper fibre travel with each layer (the scenes do),
add pop-up clutter with ink edges. Run `motion_check.py` on renders: static stretches ≤ 10 %.

## 5. Asset library and density (what dalabengba-mv built before its scenes; method: references/10, team: 11)

New scenes: name them `pcXxx` (the paper grain and vignette are applied only to scenes whose name matches `/^pc[A-Z]/`,
`PC.isPaper`), and add the file to `engine/index.html` **and** `engine/vertical.html` (references/05 §9). The doll's
arms do not reach above its head: hold or hang things at shoulder height, or draw a raised prop on its own.

Build these, each with a model sheet you have looked at (`engine/sheets/`; start from `sheets/papercraft_doll.js`),
before writing shots:
- **The cast on `PC.doll`** (34 poses and 19 expressions built in, `pose: { from, to, k }` blending, `act` actions,
  emotes, `hold` props, `detail: 0`, `silhouette`): per character one silhouette idea (a scarf too long, a crown too
  big) and its gag prop with 3–5 states; the film's own 5–12 actions as poses (`jointsAdd` on the nearest one, or a new
  entry in a film pose table passed through `joints`). Extras: 4–6 variants with `detail: 0`.
- **Creatures** (a horse, a dragon, monsters) on their own skeleton with the same tools: `Z.rig.keyed` actions, gait
  phase from distance (`Z.rig.cycle`), a long body as a spine of segments at equal arc length, tails and manes from
  `Z.rig.trail`.
- **Sets:** every recurring place with written coordinates; layers sky / far / mid / main / near / foreground
  (`PC.applyCam` depths 0.2–0.6 / 1 / 1.2–1.6); 2–4 lighting states (day, dusk, night, fire); named preset cameras
  (wide, two-shot, each character's reaction framing, close-up); 20–40 drawn things; pop-up mechanics (a flap that
  rises with `fold` 0..1, a hinged tower, a tab that slides).
- **The paper UI kit** (`PC.dialog / panel / nameTab / bar / lvUp / coins / menu / map`) plus the film's gag UI (a name
  box too small, an item bar, a damage counter); the map in all its forms sharing one (u, v) route.
- **Effects:** the impact levels (references/10 §5), speed lines, paper transitions (page turn, shape reveal, burning
  edge, paper tear, smoke wipe, split screen), `Z.burst` confetti / coins / ash.
- **One long take through the journey:** a camera on a spline, the hero's state from one function of time, zone changes
  hidden behind a foreground occluder (a tree, an arch) sweeping past.

Targets: 3–6 events per shot; the lead acts every cue (a pose change, an expression, a reaction); the running gag
escalates every repeat; bookends (the book opens / closes) match.

## 6. Review checks (in addition to references/09)

- [ ] Every object reads as cut paper (edge, shadow, rim); light from the top left; one palette.
- [ ] The map / route and the running gags pay off; outbound left → right, home right → left.
- [ ] The lyric only in the dialogue box, typed as sung, never ahead; boxes never hide the actors.
- [ ] Cast original and on-model; scale consistent.
- [ ] `motion_check.py` PASS; `check_flash.py` PASS (impact flashes 1–2 frames, rare); `pops.mjs`: the book cover's
      swing at the bookends shows as JUMPs — they are planned.
