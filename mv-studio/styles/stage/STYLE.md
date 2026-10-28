# Style: STAGE — a watercolour picture-book show on a painted theatre stage

**Technical manual of this style pack** (API, building, assets, safety). The creative brief — what the film is, its
elements, motion and ways of thinking — is BRIEF.md next to this file: read that first, and open only the section here
that the build needs.

Engine code: `template/engine/styles/stage/` (`paint.js`, `puppet.js`, `stage.js`, `scenes.js`). Starter:
`engine/starters/stage.js` (`new_project.py --style stage`). An original implementation for this kit, after the look of
*PDoomVideo* (a watercolour stage-show MV painted with p5.brush). That repo publishes no licence, so no code, art or
characters come from it. Its mascot is an existing company's character: never draw it, or any other existing
character. Design your own troupe for every film.

## 1. The idea

The film is a **stage show that the song puts on**. It opens on a painted curtain and ends on the same curtain. In
between, an original puppet troupe acts the song out, line by line, as cartoon gags. Often there is a twist at the end
("it was all a play": the camera pulls back, everyone bows).

- **The stage is the frame, not the location.** Each chapter happens in its own painted world (`stSet` or a scene of
  your own: a road, a market, a cliff, a sky, an inn), and most shots get a place of their own inside it. The stage
  (`stShow`) appears only at the opening curtain, the chorus returns (each bigger than the last) and the reveal and bow:
  about one shot in five. The reference film has 62 shots in about 35 places, and only about 10 shots on the stage.
  Cloths flown in behind the proscenium do not count as a world: a film that never leaves the boards reads as one
  static set, however many backdrops it changes.

- **Something happens in every shot.** A character does something, something breaks, transforms, chases or falls. A
  shot is 1.4–4 s, so the gag has to read instantly: one clear action, one big silhouette.
- **Text-light.** The karaoke bar already sets the lyric. Tell every joke with pictures and acting. Use a handful of
  big sound effects in the whole film (`ST.sfx`: POP!, BOOM, TA-DA!). No labels, captions or signs that repeat the lyric.
- **Faces never snap.** Mood changes go through a blink, a squash "take" and an emote, then the new face opens (`ST.mood`).
- **Motivated transitions.** Brush wipes (`brushWipe`) mark chapter breaks. Give a transition a whole number of beats
  (`dur: 60 / audio.bpm`), so the reveal ends on the beat (the grid check reads a transition's start or end). Inside a chapter, the action carries the cut:
  a chomp to black, a rocket, a fall, a zoom through an eye, a door slam, an iris into a mouth or a heart (`irisInk`).
- **Every shot moves.** A push, pan, tilt, whip, zoom-out or an on-beat push / shake (`camera.beat`, `camera.shake`).
- **Palette arc.** Each chapter has its own palette (warm lamp-lit → sky → violet night → alarm red → back to warm
  crimson and gold). Write it in `docs/CONCEPT.md` with one line per chapter.

## 2. The look

- **Hand-painted watercolour and ink, like a picture book.** Characters: flat `wash` colour + ink outline (sw 0.8–1.6 by
  size), a light pool on top and a darker settle along the bottom. Backgrounds: soft watercolour `fill` shapes, usually
  with no outline. Light and glows are low-opacity fills (`ST.spot`). Texture comes from the fills and the paper, not from
  noise.
- **Linework boils at 12 fps** (`ST.BOIL`): every wobble is re-drawn 12 times a second, like hand-drawn animation. Big
  backgrounds pass `still: true` so they do not shimmer.
- **Paper under everything.** `ST.paper()` is the first call of every scene, and a grain + warm vignette is multiplied
  over every stage shot (`ST.install()`). Avoid pure black and white: use `PAL.ink` / `PAL.night` and `PAL.cream`.
- **Colour:** fun and saturated but soft (`ST.PAL`). Contrast between character and background must be clear.

## 3. The troupe (design yours)

`ST.puppet(x, y, u, o)` is the default rig: an original gumdrop-shaped felt puppet (narrow crown, wide seated base, stub legs) with a top (`sprout | ears | antenna | none`), a face
library (`eyes`: normal, look, happy, closed, wink, star, heart, swirl, x, dot, scared, angry, sleepy; `mouth`: smile,
grin, o, O, flat, wobble, cat; `blush`), hats (`party crown top halo bow flower`), emotes (`sweat heart spark anger
music ! ? zzz`), arms with hand hooks for props (`armL / armR`), and a `draw` hook for accessories.

- **Make the cast yours:** colours (`col / dk / lt`), the top, hats, sizes. Write a one-paragraph bible per character in
  `docs/CONCEPT.md` (look, role, how it moves). For a different body, write your own draw function on the same API.
- **The lead carries the story;** the troupe are backup dancers, stagehands, a jury, a crowd. Guests appear in a verse
  and come back for the curtain call.
- **Scale:** tiny u ≈ 8–12, normal u ≈ 20–30, the lead in chorus and dance shots ≈ 40–50 (about 40 % of the frame height).
- Generated art can join the stage as cut-outs (`cast: [{ img, x, y, h }]`, references/04): ask for flat-colour
  picture-book characters with ink outlines on a plain background, so they match the painted troupe.

## 4. Building it

```js
const ST = Z.ST, PAL = ST.PAL;
ST.install(); Z.LOOK_DEFAULT = Object.assign({}, ST.post);          // paper finish; the engine post stays light
const LEAD = { col: PAL.teal, top: 'sprout', blush: true };
S.push({ id: 'c1', t0: B(10), t1: B(12), scene: 'stShow', text: ST.karaoke, lyric: 'none', hud: false, line: [6],
  trans: { type: 'brushWipe', dur: 0.6, cols: [PAL.indigo, PAL.violet] },
  moment: 'chorus 1: the lead pumps the meter, the troupe dances',
  args: { backdrop: { a: PAL.rose, b: PAL.ochre }, spots: [[600, PAL.cream], [1320, PAL.rose]],
    cast: [Object.assign({ x: 960, y: 900, u: 46, move: 'mix', mood: [[B(10), 'happy'], [B(11), 'spark', 'spark']] }, LEAD),
           { x: 560, y: 840, u: 26, move: 'hop', seed: 1, col: PAL.rose, hat: 'party' }],
    props: (S, ST) => { /* the meter, a pump, a rocket: ST.paint / ST.ink */ },
    camera: { from: { zoom: 1.0 }, to: { zoom: 1.1 }, beat: 0.03 }, confetti: [B(10)],
    sfx: [{ text: 'BOOM', at: B(11), x: 1300, y: 280, size: 170, col: PAL.ochre }] } });
```
- **Scenes:** `stShow` (the stage: backdrop, floor, spots, cast, props, curtains 0..1 or `curtains: false` for a
  full-width set, alarm wash), `stSet` (a painted
  place: sky preset or two colours, sun, stars, hills, ground, or your own background image), `stTitle` (curtain up with
  the title painted on a banner and `Z.CREDIT` under it). Anything else: write a scene that starts with `ST.begin(ctx, S.t); ST.paper();`,
  paints with `ST.paint / ST.ink`, and lists `stXxx` as its name (the paper finish applies to `st` + capital letter).
- **Painting API:** `ST.paint(pts, { wash, fill, bleed, tex, border, hatch, ink, sw, curv, still })`, `ST.ink(pts, sw,
  col)`, shapes `ST.rect ell rr star heart`, `ST.cam / camEnd / shake`, `ST.letter / sfx`, `ST.confetti`, `ST.flash`.
- **Timing:** `ST.move(style, t)` locks dances to the beat grid (`bounce hop sway spin wave roof stomp shimmy walk bow
  mix`). Put hits on beats: `Z.clock.pulse(t)` for squash and pushes, `B(n)` / `Z.cue('L07')` for events.
- **Lyrics:** `text: ST.karaoke` on every shot: a painted ink band at the bottom whose sung part turns ochre, never ahead
  of the voice (per-character times from `lyric_timing.json` when present). Keep faces and key action above y ≈ 930 (the ribbon sits at y 946–1018).
  Chinese lyrics: `ST.useChinese()`.
- **Performance:** a frame costs about 0.3 s at 1080p in the starter. Cost grows with the number of `fill` shapes, so
  prefer fewer, bigger ones; use `wash` for small or numerous shapes.

## 5. Escalation and the finale

Write the chorus escalation before any shot: what is added each time (dancers, spots, confetti, a prop that grows, an
alarm wash), and what the last chorus breaks. Keep one running prop or number that climbs through the film (a meter, a
pile, a giant version of the lead), so the choruses read as one story. End on the curtain: the troupe bows (`move:
'bow'`), the curtain closes (`curtain: [[END, 0], [END + 1.2, 1]]`).

## 6. Asset library and density (what PDoomVideo built before its chapters; method: references/10, team: 11)

Build these, each with a model sheet you have looked at (`engine/sheets/`; start from `engine/styles/stage/stage_person.js`):
- **The troupe on `ST.puppet`:** the lead's design plus 3–5 members (colour, top, hat); the vocabulary is the point:
  13 eye shapes, 7 mouths, 6 hats, 8 emotes, 12 beat-synced moves, `ST.mood` changes — use them all over the film.
- **A human on `ST.person`** (the biped skeleton: 34 poses, 19 expressions; coat, hair, glasses, bowtie): the "I" of the
  song or a stagehand; props in the hand (`hold`).
- **Guests:** each verse may bring a guest character, drawn by the chapter that introduces it and kept as a function so
  the finale can bring every guest back for the curtain call.
- **The stage set:** backdrop, floor, curtains, spotlights, and the **running prop on stage** that gets worse every
  chorus (a meter and a pump, a pile, a crack); one painted set per chapter with its palette.
- **Sound effects:** a handful in the whole film (`ST.sfx`), each a punch line.

Targets: chapters of 6–10 shots, each chapter in its own world; every shot a named gag in phases (hop → slide → teeter →
fall → land) with its own drawn place (the reference spends about 150 lines of drawing per shot); the lead about 40 % of
the frame height in chorus and dance shots; the stage only for the curtain, the chorus returns and the bow, escalating.
