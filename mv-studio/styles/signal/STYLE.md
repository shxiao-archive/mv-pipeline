# Style: SIGNAL — a recording device failing

Engine code: `template/engine/styles/signal/` (`signal.js`, `cuts.js`, `fill.js`, `shot.js`, `hud.js`). Starter:
`engine/starters/signal.js` (`new_project.py --style signal`). An original implementation for this kit, inspired by the
"signal degradation" look of a fan PV (v1Ta44/netsu-ijou-pv, CC BY-NC 4.0): no code, art, character or lyrics from it are
used, and none may be — that PV uses a real song, real lyrics and an existing character. Make your own film from your song.

## 1. The idea

The film is footage from a device that is being destroyed — by heat, radiation, time, grief — while it keeps recording.
Three systems carry it, each driven by song time:

- **Speed is editing.** A single frame may be full, but the overload comes from how often the picture changes. Meaningful
  images (**motifs**) alternate with meaningless frames (**fillers**: terminal junk, fragments of earlier pictures,
  abstract fields) and **1–2 frame inserts**, on a beat grid, deterministically (`Z.SIG.cuts`).
- **Heat colours everything.** One number, `heat` 0..1 over the film, picks a gradient map: cold navy → amber → vermilion
  → white-hot (`sigCold sigWarm sigHot sigOver` ramps). Generated art comes out NEUTRAL (natural colour, mid contrast);
  the grade tints it, so the whole film shifts together as it heats up.
- **The signal decays.** Distortion `d = floor + gain·heat^1.3 + section boost·(0.5 + heat) + cut kicks`: horizontal tear
  bands (bursts of 1–4 frames), chroma shift, a rolling interference band, vertical-hold jumps, multipath ghost; sensor
  sparkles, **hot pixels that accumulate over the film and never heal**, CCD column smear, dropped rows. Weak while cold,
  never covering the subject; peaks in the last sprint; drains to the floor at the end.

## 2. Tiers (pick one per section)

| tier | sections | grid | fillers | inserts | lyrics |
|---|---|---|---|---|---|
| **T1 sprint** | choruses, the fastest parts | ½ beat (`div: 2`) | 30 % | ~20 % | `stamp`: the line re-laid every beat |
| **T2 one gear lower** | pre-chorus, long-line choruses, bridge | 1 beat, anchor image returns A-B-A-C-A | 18 % | ~10 % | `center`: one big line, typed |
| **T3 slow** | intro, verses, breakdowns | 2–8 beats, xfade / signal-tear transitions | none | none | `vertical`: mincho 縦書き, per character |
| **hold** | a stop, a silence | one image | — | — | none / a single word |

T1 does not promise that every image is seen; T2 does (the anchor returns). Use the song's own stops: a held `NO
SIGNAL` frame on a dead stop, a black frame with only hot pixels breathing.

## 3. Building it

```js
const SIG = Z.SIG;
SIG.heatKeys = [[0, 0], [B(17), 0.33], [B(33), 0.66], [B(65), 1], [END, 0.2]];   // the film's temperature
SIG.boost = { chorus: 0.14, 'pre-chorus': 0.06 };
SIG.install();                                  // grade + degradation layer (Z.layerFX)
SIG.useImages(['assets/bg/ruin.png', 'assets/bg/tower.png']);   // fragments of your art join the filler / insert pools
SIG.hudCfg.title = 'UNIT 07 / LOG.0001';  SIG.hudCfg.log = [[0.3, 'boot'], [B(9), 'temp rising'], [B(33), '!! surge']];
SIG.hudCfg.lyrics = [{ from: 0, to: B(17), mode: 'vertical' }, { from: B(17), to: B(25), mode: 'stamp' }];
Z.hud = SIG.hud;
S.push(...SIG.cuts({ t0: B(17), t1: B(25), tier: 1, seed: 3, id: 'c1_', motifs: [
  { scene: 'sigShot', args: { mode: 'crop', img: A + 'eye.png', focus: [0.52, 0.44] } },      // an extreme crop
  { scene: 'sigShot', args: { mode: 'sil', char: A + 'unit_run.png' } },                       // silhouette on a light ground
  { scene: 'sigShot', args: { mode: 'word', line: 14 } },                                      // the keyword, full frame
  { scene: 'sigShot', args: { mode: 'split', imgs: [A + 'ruin.png', A + 'tower.png', A + 'sea.png'] } } ] }));
```
- `sigShot` modes: `full` (cover + drift), `crop` (3–6× on a `focus` point), `char` (cut-out on a plate or flat ground,
  contact shadow), `sil` (black silhouette on a light ground), `split` (2–4 panels, widths swap with the beat), `word`
  (the line's *emphasis* or a char range, full frame; the HUD does not set that line again). `enter: 'punch' | 'shake'`.
- Fillers / inserts: `sigTerm` (`hex mem panic ps check coord nosignal bars progress`; `copy: [...]` = your system lines),
  `sigFrag` (crop of your images: `threshold mono posterize channel invert`), `sigAbs` (`noise scan stripes checker blocks
  black`). Default pools: `Z.SIG.FILLERS`, `Z.SIG.INSERTS` (dark only).
- Fast moves (3–4 frames): `whipL/R/U/D`, `push`, `zoomThru`, `slices`, `spin`; signal-loss transition `sigTear`.
- Per lyric line, write 2–5 motif variants (the cut engine wraps through them); repeated lines (×4, ×8) get one CHANGE per
  repeat (closer, darker, one more channel split, a counter) — repetition with change is what reads as authored.
- Section entrances land on the musical hit, which may be a beat BEFORE the first lyric: put the impact frame there.

## 4. Assets

Generate **neutral** images (natural daylight colours, mid contrast, no heavy colour cast): places (ruins, a corridor,
a tower, sea, a field), objects (a recorder, cables, a CRT, a chair, a bell), one original character (front / back /
close-ups: eye, mouth, hand, neck — for crops), a few silhouettes. Pick crop focus points with `tools/art_grid.py`.
Pixel type sits on a 16 px grid (DotGothic16 at 16 / 32 / 48 / 64 px, integer positions); lyrics use mincho.

## 5. Safety — this style is where flashes happen

- Full-frame white flashes / inversions only at 3–6 key points of the film (a section's first hit, the title word),
  each a single event, never repeated within a second.
- Inserts are DARK (black, dim noise, dark fragments, `NO SIGNAL`) and at most one per 0.34 s (`cuts()` enforces it);
  `maxCutsPerSec` (6) caps hard changes. Do not put bright images in the insert pool.
- Keep consecutive T1 cuts within one luminance band (the heat grade helps: everything shares one ramp).
- **Run `python tools/check_flash.py` on every render** (and on clips of the sprint sections while building). FAIL →
  lower `ins`, raise `div` spacing, darken the offending motifs, or move a flash.
- Add a photosensitivity warning card before the film (and in the description) when the film is intense.

## 6. Review checks (in addition to references/09)

- [ ] T2 / T3 images are readable (anchor returns); T1 overload builds and releases with the song, not constantly.
- [ ] Heat curve visible in the contact sheets (cold → hot → drained); hot pixels accumulate, never reset.
- [ ] Distortion never covers a face or a lyric for more than a frame; lyrics stay legible through tears.
- [ ] Every repeated line changes something per repeat.
- [ ] `check_flash.py` PASS; `motion_check.py` PASS (T3 sections still drift).
- [ ] No existing character, logo or song material imitated; LOG / TERM copy is your own.
