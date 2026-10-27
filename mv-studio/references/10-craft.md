# 10 — Craft: how the reference films reach their level, and how to do the same

The style guides say what a style looks like. This file says how the films behind them were **built**: in what order,
with which assets, which rules of motion and which review loop. It is distilled from the six study films (their
process documents and code): *dalabengba-mv* (paper RPG), *PDoomVideo* (watercolour stage show), *pdoom-video*
(treatise plates), *world-execute-me-lyric-mv* (chat interface), *netsu-ijou-pv* (signal), *vocaloid-style-mv-pipeline*
(tegaki, 「残光」). Use the methods; never their characters, songs, copy, art or look. The numbers below describe
those films; the film's own CONCEPT style block decides its targets.

## 0. Why they look better than a first pass

| film | code | assets before scenes | people / agents | revisions |
|---|---|---|---|---|
| dalabengba-mv | 46 k lines (rigs 9.2 k, sets 10.7 k, props 5.7 k, UI 3.3 k, scenes 14.5 k) + 9.5 k lines of docs | 12 asset packs, each with model sheets and an API doc; hero: 59 poses, 16 expressions | ~48 agents, 20–25 M tokens, 14 h | storyboard: 3 proposals → 2 judges → 1 synthesis |
| PDoomVideo | 7.7 k lines, 9 chapters of 400–900 lines | one mascot rig with ~15 eye shapes, 7 mouths, 14 hats, 11 emotes, 12 dance moves; a second character; a recurring stage set | lead + parallel chapter agents | 2 generations |
| pdoom-video | 25 k lines (TypeScript, three.js, GLSL) | engraving shaders, GPU line batches, single-stroke fonts, word-level alignment | one long collaboration | 5 revision rounds |
| world-execute-me | 13 k lines | per-section picture modules (objects, molecules, history strip, plates), silhouettes split into ink plates | lead + section agents | 4 versions; v4 alone took three sessions |
| netsu-ijou-pv | 1.5 k lines + 61 generated components | 10 style-test rounds, a locked character sheet, one generation table | one collaboration | storyboard v1 → v5 |

The gap between a first pass and these films is not one trick:
1. **An asset library comes first**, and every asset is checked alone on a model sheet before any shot uses it.
2. **Characters are rigs with large vocabularies**, not a few shapes with three moves.
3. **Every shot is choreographed by hand** with the same timing rules, and ends in a motivated handover.
4. **A process and a budget:** proposals and judges for the storyboard, rough → refine → polish per block, revision rounds
   with a written analysis of what to keep and fix. Roughly 10–70× the tokens of a single-agent pass.

A single agent cannot spend 20 M tokens. It can follow the same order and rules at a smaller scale (§9); the team
workflow (`references/11-team.md`) is how to spend a real budget.

## 1. Order of work

```
brief  →  storyboard (with fixed set layouts)  →  asset specs  →  ASSET LIBRARY (+ model sheets, API notes)
       →  shots / blocks (rough → refine → polish)  →  review sheets  →  revision round(s)  →  deliver
```

- Derive the asset list from the storyboard: every pose, expression, prop state, set and lighting state a shot needs
  (count them per shot; dalabengba's spec lists, per pose, the blocks that use it).
- Build and **look at** the library before writing shots: a shot author who has to invent a pose mid-shot draws it
  badly once; a library pose is drawn well once and reused.
- Shots may not change shared assets. A missing pose is made from the nearest pose plus joint offsets (`jointsAdd`), or
  drawn locally, and written down as a request for the library.

## 2. Characters drawn in code: rigs (if the film has a cast)

### 2.1 Design sheet (before code)

- Proportions in heads (the film's choice) and a **scale table**: height in px at full shot
  (s = 1, e.g. 260), medium (~420), close-up (head ~360). Every character of the film on one scale (a lineup sheet).
- One palette per part (skin, skin shade, hair, hair shade, outfit, outfit shade, accent); shades are mixes of the base
  with ink, never new hues.
- **One face construction for the whole cast**, written as ratios of head width: eye ellipse ~0.09 × 0.13 of the head
  width with a highlight at the upper left; blush ellipse at α ~0.45; mouth an ink arc, open mouth filled dark with a
  tongue; brows short arcs; at most one dot of nose. Same rules → the cast reads as one film.
- A recognisable silhouette per character (one big shape idea: a scarf too long, a crown too big, a tail with 13
  plates) — the silhouette is what reads at 1.4 s.

### 2.2 Skeleton and poses (`Z.rig`, core/rig.js)

- **Fixed bone lengths** (hip, torso, neck, upper arm, forearm, thigh, shin) in local units at s = 1.
- **A pose is a table of joint angles** (`{ lean, nod, aF: [shoulder, elbow, wrist], aB, lF: [hip, knee, ankle], lB, … }`),
  written as a function of context `c = { t, phase, act }`, so idle breathes and walk cycles.
- **Cycles from distance, not time:** `phase = distance travelled ÷ stride` (`Z.rig.cycle`): feet never slide. A run
  leans 10–15°, lifts the body twice per cycle, swings arms against legs.
- **One-off actions over `act` 0..1** with keyframes (`Z.rig.keyed(act, [[0, A], [0.3, B], [0.55, C], [1, D]])`,
  smoothstep per segment): anticipation key, contact key, overshoot key, settle key.
- **Blend poses** (`{ from, to, k }` → `Z.rig.mix`): every change of pose is a blend over 0.15–0.4 s, never a swap.
- **Two-bone IK** for hands that must reach something (a head to scratch, a rail, a hand to hold): `Z.rig.ik2`.
- **Ground contact:** after solving the legs, move the body so the lowest foot or knee sits on the ground line
  (`Z.rig.ground`); airborne actions switch it off.
- **Squash and stretch keeps area:** `[1/√(1+sq), 1+sq]` (`Z.rig.squash`), anchored at the feet.
- **Secondary motion** is a function of time too: blink every ~3–4 s with a seeded phase (`Z.rig.blink`), breathing
  over ~3.4 s, hair / scarf / tail / cape from **time-lagged sampling** of their root (`Z.rig.trail`: point k = root at
  t − k·0.035 s, minus the root now), plus a little noise for wind.
- **Return anchors** (head, mouth, eyes, neck, near hand, far hand, prop tip, seat, feet) so shots attach props, speech
  tails and particles without guessing; give a `rigOnly` call that solves without drawing.
- **Variants built in:** `detail: 0` (flat, for crowds and distance), `silhouette` (+ parts that keep their colour),
  `face: ±1` mirroring with text never mirrored, light direction fixed on screen whatever the mirroring.
- **Far side darker:** far arm and leg mixed 15–20 % with ink and drawn first.

### 2.3 Vocabulary (what the paper-RPG and stage films built; size the film's own from its storyboard)

| who | poses | expressions | states / props |
|---|---|---|---|
| lead | ≥ 30: idle, walk, run, jump (act), land, brake, think, scratch head, shrug, point, cheer, wave, bow, sit, kneel, fall (act), get up, hold prop, give, shout, gasp, + the film's own actions | ≥ 12: normal, happy, grin, smug, determined, shout, shock, worried (sweat), hurt, dizzy, shy (blush), relieved, + 2–3 of the film | the running gag's states (a scarf: notched, holed, patched, frozen), outfit changes, injuries, held props |
| each supporting character | ≥ 12 | ≥ 8 | its gag prop with 3–5 states (a crown: straight, tilted, slipped, squashed, popped off) |
| crowd / extras | 4–6 variants × 3 poses, `detail: 0` | 3 | — |

Expression changes never snap: close the eyes, squash 2–4 frames, pop an emote (sweat, spark, heart, "!"), open the new
eyes (`Z.rig.take`). The face changes 2–4 frames **before** the body acts (think, then move).

### 2.4 Model sheet (the acceptance test)

Render one sheet per rig (`engine/sheets/<name>.js`, §8; start from `sheets/biped.js`, or a style's own: `styles/papercraft/papercraft_doll.js`, `styles/stage/stage_person.js`): every pose in both facings, every expression, every state, the
walk and run at 8 phases, the close-up at the largest zoom the film uses, the `detail: 0` and silhouette versions. Look
at it; fix; render again; at least two full rounds. Then a **lineup**: every character at s = 1 on one ground line with
the height line, and trial placements in two of the film's sets (this is where a scarf turns out to hang off a balcony).

## 3. Characters and assets from an image generator (if the film uses one)

(Tools: `references/04`. Method from netsu-ijou-pv and 「残光」.)

1. **Style test rounds** before any production image: 3–10 rounds of the same two test subjects (the character, one
   place) until the look is locked; keep the winner as `assets/ref/style_ref.png`.
2. **Character lock:** a front and a back reference (and a face close-up) approved by eye; a written sheet of every
   design element (hair side, accessories, colours with hex, proportions in heads). Later images always get the style
   reference + the design references + the approved look, and the prompt says which image is for what: "the FIRST
   image is a drawing-style reference ONLY; the other images show this exact character; copy its design and face, not
   their rendering or pose".
3. **One generation table** for the whole film (`assets/gen/table.json` or the generator script): id, kind (char /
   world), size, transparent or not, extra references, post-processing (full / crop / none), subject sentence. Prefixes
   by kind (`BG01`, `CH-H2a`, `OBJ10b`). Locked blocks appended: STYLE, CHAR_LOCK, WORLD_LOCK ("no faces on objects"),
   ISO ("single isolated subject, transparent background"), EMPTY ("no people").
4. **Neutral colour, grade later:** generate natural colours at mid contrast; the film's colour comes from the grade in
   the engine (one palette for everything, see the signal kit's heat ramps).
5. **Expressions, if wanted:** blink, mouth open, smile … as variants that repaint only the eyes or the mouth, or
   from one sheet (`gen_table.py`): the character stays still and the face changes now and then (optional). Never ask for an edited copy of a
   finished picture for a bigger change (it drifts in style).
6. **Motion as separate images:** a bird in three wing positions (`OBJ10a/b/c`), hands clean and dirty (`H2a/H2b`), an
   object whole and broken. Animate by switching on the beat, plus the engine's drift and squash.
7. **Fix the proportions after generation** (scale the body below the chin to the target head count) and matte
   (`alpha_matte.py`); every asset then passes through the same prep script.
8. **Review sheets per category** (`_review_BG.png`, `_review_CH.png`, `_review_OBJ.png`): all of a kind on one page —
   style drift shows up side by side. Regenerate the odd one out.

## 4. Sets

- **Fixed layout, written down:** each recurring location gets its key coordinates in the storyboard (the window at
  (960, 430) r 70, the throne at x = 1580, 13 towers at x = 300 + 110·i). Every shot in that place uses them, so cuts
  between shots of one place match.
- **Layers with depth factors:** sky (0), far (0.2–0.6), mid, main (1), near (1.2), foreground (1.4–1.6, blur 3–5 px),
  each drawn through the multiplane camera (`PC.applyCam(g, cam, depth)` or `Z.cam*`). How many depths a frame has, and how
  full it is, is the film's.
- **Named preset cameras per set** (`CAMS.TR_2S`, `CAMS.CU_K`): wide, two-shot, each character's reaction framing
  (mirrored for answer shots), the close-up. Shots pick a preset and add drift and pushes.
- **Lighting states per set as parameters** (day, dusk, night, fire, alarm): one function, many moods; tint layers plus
  point glows for night and caves.
- **Set dressing density:** ground clutter with ink edges, props that react (a lantern sways when someone runs past),
  recurring props on set. The reference films' sets had 20–40 distinct drawn things.
- **Long takes through one world:** a continuous scrolling world, a camera on a spline (`journeyCam`), the character's
  state from one function of time shared by every shot that sees it (`heroState(T)`); zone changes (meadow → village)
  are hidden behind a foreground occluder sweeping past (a tree, an arch) — the seam sits behind it.
- **Set model sheet:** every lighting state and every preset camera of the set, rendered and looked at.

## 5. Props, effects and transitions

- **Impact levels** as a table, used everywhere the same way:

  | level | shake (px) | flash | hold | rays | use |
  |---|---|---|---|---|---|
  | S | 4–6 | 0 | — | no | a step, a small hit |
  | M | 10–14 | ≤ 0.2 | 1 frame | short | a punch line, a landing |
  | L | 18–24 | ≤ 0.35 | 1 frame | yes | a section's first hit |
  | MAX | 30+ | ≤ 0.5 | 2 frames | full | **once per film**, the climax |

  Flashes are safety-limited (`check_flash.py`); shake decays over 0.3–0.4 s.
- **Stateless particles** (`Z.burst`, `Z.stream`, `Z.field`, core/rig.js): a burst's position is analytic,
  `p = p0 + v·(1 − e^(−drag·age))/drag + ½·g·age²`, so any frame can be drawn alone; streams iterate only the living
  birth indices; fields loop falling things (snow, petals, fireflies) with `fract(r + v·t / w)·w`.
- **Transitions with a motive** (each shot names its exit): shape reveal (heart, circle, star, keyhole, an eye, a mouth),
  page turn, burning edge, paper tear, split screen, smoke wipe, whip curtain with speed lines, push through an object,
  match cut on a shape (moon ↔ coin, cave mouth ↔ dragon eye, sword flash ↔ star). The later shot draws the transition
  (it starts before the earlier one ends); the earlier one keeps acting until its end. Cross-dissolves only when the song
  asks for one.
- **Seams that must be invisible** (same place, same camera, two blocks): write the exact state at the seam (camera,
  every character's pose and parameters, props, UI) once as data, have both sides land on / start from it, and compare
  the two frames (`pops.mjs` around the seam).

## 6. Choreography of a shot

### 6.1 The shot spec

Write every shot as a row before coding it:

| time | line | shot (what happens, in phases) | out (how it hands over) |
|---|---|---|---|
| 9.0–12.4 | 4 | the lead hops onto the chart line, sleds down, teeters at the cliff edge, falls, lands in a paint splash | bursts out of the screen, person-sized |

Rule for every shot: **something happens** — a character does something, something breaks, transforms, chases or
falls. The picture tells the joke; text in the frame only when the joke needs a word.

### 6.2 Timing patterns the reference films share (the editing-rhythm slot decides)

- **One accent per cue**, landing at cue + 0.00…0.15 s; **anticipation** before it (0.1–0.4 s: a wind-up, a bulge, a
  squash); **follow-through** after it (overshoot `outBack`, settle `elastic`, secondary motion catching up).
- Groups **stagger 30–80 ms**; after an action, **hold ≥ 0.2 s** before the next one; uniform speed only for travel.
- Big changes land on beats; inside a phrase, reframe on half bars; a cut lands on a downbeat or on the cue.
- Name the phases inside a shot (hop → slide → teeter → fall → land) and give each its time from the cue sheet; a shot
  is a little sequence, not a pose that drifts.

### 6.3 Camera

- Drift, tracking, pushes and shake are the motion-feel slot's choice (a locked camera is a choice too). The
  reference films drifted 4–6 px at ~0.35 Hz.
- **Tracks the action with lag:** aim at the subject's position 0.1–0.15 s ago (`sledAt(t − 0.14)`), lead in the
  direction of travel; push in on emotion; shake on hits (§5); whip with speed lines between places.
- Framing follows the scale table: full / medium / close-up are fixed zooms, so the cast keeps its size across cuts.

### 6.4 Performance

- In the reference films everyone on screen reacts on cues (blink, turn, flinch).
- `motion_check.py` reports still 0.5 s windows; whether stillness is wanted is the film's.
- Keep faces and key action out of the lyric band (karaoke / subtitle zone) whenever a line is sung.

## 7. Density of the reference films (a measure, not a target)

| unit | reference films | a solo first pass usually has |
|---|---|---|
| bespoke code per shot | 80–150 lines (PDoomVideo: 9 chapters × 6–10 shots in 400–900 lines) | 5–15 lines of shot arguments |
| distinct drawn things in a set | 20–40 | 5–10 |
| poses of the lead | 30–60 | 3–8 |
| expressions of the lead | 12–16 | 2–4 |
| events per shot (actions, reactions, props, particles) | 3–6 | 1 |
| review rounds per shot (look at frames, fix) | ≥ 2 | 0–1 |

Each style's STYLE.md gives its own asset list and targets. Hitting them takes budget: plan it with the user (§9).

**Where that code goes: a scene file of the film's own.** In the iteration-4 acceptance test the two films that reached
the bar each wrote `engine/scenes/<film>.js` (papercraft 63 own lines per shot, stage 44); the three that stayed at
9–22 only filled stock scenes with arguments in `timeline.js` (a background, a camera move, a cut-out, the same few
effects in every shot). So every film:
1. creates `engine/scenes/<film>.js` (one IIFE, like the template's scene files; a `<script>` line in
   `engine/index.html` after the others) holding its library (the set, the props that react, the lead's actions, named
   cameras) and its scenes, registered with `Z.scene(name, { preload, init, draw })`;
2. draws 3–6 events per shot there, each on its cue: a train crossing the painted bridge (points of the background
   image mapped to the screen with `D.coverPt`, so it stays glued to the picture through the camera move), lanterns
   that flare on the beat, a blurred foreground branch passing the lens, a message that arrives and is answered;
3. keeps `timeline.js` for the edit: times, scene, arguments.

Build from what exists: `D.travel` / `D.along` (paths), `D.coverPt`, `D.contactShadow`, `D.onWater`, `D.glow`,
`D.softLight`, `D.dust` / `D.rain`, `Z.burst` / `Z.stream` (particles), `Z.tween`, `Z.rig`, and inside
`illust` an effect `{ type: 'custom', fn }`. `tools/storyboard.mjs` warns when a film of 12+ shots has no scene file of
its own; `evals/grade.py` counts own lines per shot (bar: 30).

## 8. Review

- **Model sheets** for every asset (§2.4, §4): `engine/sheets/<name>.js` is a timeline whose shots lay out a grid of
  labelled cells (`Z.sheetGrid`), rendered with `node tools/stills.mjs --url "engine/index.html?tl=sheets/<name>.js"
  --times 0.5,1.5 --out render/sheets/<name>`. Look at every sheet.
- **Check cards:** each concrete picture (an object, a plate, a set) rendered alone, without lyrics. If you cannot
  name it without the text, it fails (world-execute-me's rule).
- **Cue sheet** (`node tools/cues_sheet.mjs`): one frame per lyric cue — is it the picture for that line?
- **Motion around hits:** stills every 0.1 s across each accent; the anticipation, the contact and the settle must all
  be visible.
- **Two rounds minimum** of render → look → fix for every shot; open every image you render.
- **Revision rounds:** after the first full cut, write an analysis per section (what to keep, what is wrong, measured
  times of the key hits, where in the code) and a revision brief from it; the second pass works from that, not from
  memory. The reference films went through 2–5 such rounds.

## 9. Scale it to the budget

| budget | do |
|---|---|
| solo, ~300–600 k tokens | the order of §1 at small scale: write the shot specs; build a small library (the cast on `Z.rig.biped` (`PC.doll` / `ST.person`: 34 poses, 19 expressions built in) plus the film's own 5–10 poses and gag states, 2–3 sets with preset cameras and 2 lighting states, the gag prop); one model sheet per asset; then shots; one revision round on the worst third of the shots |
| solo, several sessions | as above, plus a revision brief between sessions (§8) and a second library pass |
| team, millions of tokens | `references/11-team.md`: storyboard proposals and judges, parallel asset builders with model sheets and API notes, seam contracts, parallel block builders, independent reviewers |

Tell the user which row you are in before starting, and what it buys.
