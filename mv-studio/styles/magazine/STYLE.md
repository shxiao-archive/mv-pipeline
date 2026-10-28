# Magazine — technical manual

The brief (`styles/magazine/BRIEF.md`) says what the style is; this says how the pack works. Code:
`template/engine/styles/magazine/` (`press.js`, `layout.js`, `scenes.js`), starter `engine/starters/magazine.js`.
Everything is in the `Z.MZ` namespace; scenes are `mz*`. Open the section you need.

## 1. The two layers and the press

```js
Z.scene('myPage', { init: () => MZ.loadFonts(), draw(ctx, S) {
  const { P, I, F } = MZ.begin();                 // cleared layers (1920x1080 scene units) + press settings F
  P.fillStyle = '#fff'; P.fillRect(0, 0, 1920, 1080);           // proof: white = bare paper
  MZ.photo(P, 'assets/bg/sea.png', 70, 70, 820, 920);          // pictures in normal colour
  MZ.lyricV(I, S.args.line[0], S.t, 1500, 150, 92, { color: MZ.ink(MZ.K) });   // ink: channels, drawn 'lighter'
  Object.assign(F, MZ.LOOK, { cell: 6 });          // the film's inks, then this shot's settings
  MZ.react(F, S.t, S.args.react ?? 0);             // hat grain; with react 1, strong kicks punch and snares slip
  MZ.print(ctx, F, S.t, back);                     // back: a canvas behind the page (optional)
} });
```

- **Proof layer `P`:** normal 2D drawing. Where it is transparent, the press shows paper, or the `back` canvas raw
  (`F.backMode = 1`) or printed (`F.backMode = 2`).
- **Ink layer `I`:** black ground, `'lighter'` compositing, colours from `MZ.ink(MZ.K | MZ.A | MZ.B, alpha)`. Red
  means key, green spot A, blue spot B. Overlapping channels overprint, like real plates. To erase ink, draw
  `#000` with `'source-over'`.
- **The stock scenes** wrap this in `page(ctx, S, (P, I, F) => { ...; return back })`. They merge `MZ.LOOK` (the
  film), then the shot's `args.press`. Ink names from `MZ.INKS` are resolved to hex.
- **Post:** set `Z.LOOK_DEFAULT = Object.assign({}, MZ.post)` in the timeline. The press does its own grain and
  vignette, and the engine's bloom and LUT would wash the paper out.

## 2. Press settings (`MZ.defaults()`)

| key | default | range / notes |
|---|---|---|
| `paper`, `outside` | `#efebe2`, `#141312` | warm off-white; `outside` is what shows round a page that is zoomed out |
| `inkK`, `inkA`, `inkB` | black, red, teal | `MZ.INKS` names or `#hex`. Dark key; spots of different hue and similar density separate best |
| `mode` | 0 | 0 spot (K + A + B by density) · 1 process CMYK · 2 mono (`monoInk` 0/1/2) · 3 raw proof · 4 duotone (K + `duoInk` 1 A / 2 B, `duo` = [K from, K to, spot from, spot to] in darkness 0..1) |
| `scrType` | 0 | 0 euclidean dot · 1 line · 2 riso grain (`grain` px, 1.7) |
| `cell` | 5 | 5–6 magazine, 8–10 zine, 12–16 a poster or a transition |
| `ang` | [45°, 15°, 75°] | radians; the classic angles avoid moiré |
| `scrMix` | 0.8 | 0 = contone (no dots), 1 = pure dots. Photos need some contone to keep their detail: at 1 with a 7 px cell they read blurry at 1080p |
| `offK`, `offA`, `offB` | [0, 0] | px; misregistration. A slip is 4–8 px; a broken reprise 10–28 px |
| `tone` | [1, 1, 0, 1] | contrast, gamma, black point, white point of the proof before separation |
| `photoAmt`, `inkAmt` | 1 | fade the picture or the type out of the plate |
| `xf` | [1, 0, 0, 0] | zoom, rotation (rad), dx, dy (fractions of the frame): the page under the camera |
| `bleed` | 0 | px: wet ink spreading (2–4 for soaked paper) |
| `backMode` | 0 | 1 = `back` raw where the proof is transparent · 2 = `back` printed like a photo |
| `inkLight` | 0 | 1 = the ink layer prints as light (screen) in `lightK / lightA / lightB`: type over a dark world |
| `neg` | 0 | 0..1 negative reprint |
| `ca` | 0 | px of chromatic split (use sparingly) |
| `xerox` | 0 | copier streaks 0.2–0.5 |
| `vig`, `grainAmt` | 0.35, 0.025 | the press's own vignette and grain |
| `gain` | 1 | overall exposure |
| `flash` | [1, 1, 1, 0] | rgb + amount |

**Separation:** the proof's optical density is split into key (the shared darkness), then the remainder is solved
for the two spots. A spot-A colour prints in spot A, with a little key where it is dark, as a real separation
does. A colour that neither spot can make falls back to the nearer one. This is why mixed sources unify: everything becomes some mix of three inks.

## 3. Type and furniture (`layout.js`)

- **Lyrics** (line indices only, never text): `MZ.lyricV(c, i, t, x, y, size, o)` and `MZ.lyricH(...)`.
  - The reveal follows `Z.charTimes` (per character, from `analysis/lyric_timing.json`), else `Z.charsAt`; the newest
    character fades and pops in over about 70 ms.
  - Fit a long line with the scenes' `fit`, or compute `size = min(size, room / MZ.vheight(text, 1))`.
- **Paper band:** `band(P, I, lines, t, y, size)` in `scenes.js`. It is the sung line on a strip of bare paper over a
  picture, so the key ink always reads. Copy it when you need it.
- **Vertical rules:**
  - small kana and 、。 sit in the corner;
  - ー〜…, brackets and Latin are turned 90°;
  - the reveal is a float.
- **Furniture:**
  - `MZ.folio(c, t, { side, head })` sets the page number from `Z.clock.meter(t).bar + 1`;
  - `MZ.ruler(c, t, x, y, w)` draws the 16th ticks of the actual bar map, with bar lines labelled with their metre,
    taller ticks at group starts, and a fixed playhead;
  - `MZ.gauge(c, x, y0, y1, v0, v1, value, { label, readout, fmt })`;
  - `MZ.fig(c, n, x, y, tx, ty, label, { p })`;
  - `MZ.proofCircle(c, cx, cy, rx, ry, seed, p)`;
  - `MZ.strike(c, x0, y0, x1, y1, p, { mark })`;
  - `MZ.cropMarks`, `MZ.regMark`, `MZ.genko`, `MZ.grid`, `MZ.barcode(c, x, y, w, h, '123456789012')`,
    `MZ.meterGlyph(c, '5/8', x, y, size)`.
- **Proof helpers:** `MZ.photo(c, src, x, y, w, h, { crop, fx, fy, zoom, rot, flipX, filter, contain })` (src is a
  preloaded path or a canvas) and `MZ.tint(c, color, x, y, w, h, a)`.
- **Paths:** `MZ.dropPath` (ink drops, burn holes) and `MZ.tornPath` (a torn edge, filled up or down).

## 4. Scenes (`scenes.js`)

| scene | args | notes |
|---|---|---|
| `mzSpread` | `img, side, line, head, caption, gloss, fig {n, label, at}` | the default verse page: one line per shot |
| `mzContents` | `img, title` | rows from `audio.sections`, set on successive beats |
| `mzStrips` | `img, vertical, line` | groups from `Z.clock.meter`; flashes on group starts |
| `mzGrid` | `imgs, bars, open, line` | cells sized by bar length in tatums from the shot's first bar |
| `mzSlam` | `imgs, words, hits, every, line` | hits default to `audio.group_starts`, else beats; cycles the press mode per cut |
| `mzBurn` | `img, world, at, max, line` | holes at `at` or strong kicks (`audio.onsets.kick` ≥ 0.8) |
| `mzTear` | `img, world, at, open, line` | the sung line moves to a paper scrap in the gap |
| `mzContact` | `imgs, cols, rows, windows, world, pick, pickAt, line` | one frame lit per tatum |
| `mzDecon` | `parts [{ch, dx, dy, size, exit, at}], result, resultAt, size, line` | parts with `exit: null` stay until the result prints |
| `mzFlash` | `img, crop, raw` | use through `MZ.flash(t, args)` with `Z.withInserts` (one tatum; mark it `insert: true` and give an `offgrid` reason) |

- `world` is an image path or a stand-in name (`MZ.stand`: `horizon`, `figure`, `flora`, `city`, `deep`). It is
  drawn raw into `Z.scratch[2]` behind the page.
- **Putting an engine scene or a Blender render behind the page:**
  1. draw it into a canvas of your own (`Z.canvas()`, then `Z.SCENES[name].draw(g, S)`), or load the render as an
     image;
  2. return that canvas from your `page` callback;
  3. set `F.backMode` to 1 to see it raw through the holes, or 2 to print it.
- **Subliminal frames:** use `MZ.flash(t, args)` with `Z.withInserts(shot, [...])`. The starter puts one at the last
  tatum of every chorus shot.

## 5. Drums and metre

- **`Z.hit(kind, t, tau)`** returns the strongest recent onset of `audio.onsets[kind]` (`kick | snare | hat |
  vocal`), decaying `exp(-dt / tau)`. Also `Z.lastHit(kind, t, thr)` and `Z.hitCount(kind, from, t, thr)`.
- **`MZ.react(F, t, amt, { thr, gap })`** works the press from the drum *accents*:
  - a strong kick (strength at least `thr`, default 0.8, and at least `gap` s after the last one kept, default 0.6)
    zooms the page 1.5 %;
  - a strong snare slips spot A 6 px and spot B 3 px, in one direction per hit, springing back over 0.15 s;
  - hats add grain (+0.03), always.

  The stock scenes pass `react: 0` by default (grain only). Set `react: 1` on the shots that should hit, such as a
  chorus slam or a section's first bar. On every shot of a fast song it reads as camera shake.
- **Camera travel:** lerp `F.xf` (zoom, rotation, dx, dy) over `S.p` with one ease for the whole hold, e.g.
  `F.xf = [Z.lerp(1.04, 1.12, e), 0, Z.lerp(0.03, -0.03, e), 0]` with `e = Z.ease.inOutSine(S.p)`.
- **`Z.clock.meter(t)`** returns `{ bar, meter, len, q, group, groups, gq, gPhase, tatum }`. Also
  `Z.clock.groupPulse(t, k)`.
  - With no bar map, it is 4/4 from the beats.
  - With `analysis/meter.json`, written by `python tools/meter_probe.py` and then curated and re-analysed, it is any
    metre and any grouping.
  - `audio.group_starts` lists every group start: pops and storyboard count them as cut points.

## 6. Checks

- `node tools/check_shots.mjs --strict` checks one lyric line per frame: old lines kept on the page count as overlap.
- `node tools/storyboard.mjs` checks that every sung line is answered by a shot (`line` in the shot).
- `node engine/styles/magazine/press_selftest.mjs` checks the press: spot colours keep their hue, paper stays paper, key ink prints near
  black, and a hole shows the back raw.
- The press type is drawn by the scene, so LOW CONTRAST and HIDDEN cannot see it. Read your stills for contrast:
  key on paper, or a paper band.
- **Speed:** a frame costs one full-screen shader. On SwiftShader (no GPU) expect about 0.3–0.5 s a frame at 1080p.
