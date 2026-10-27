# Style: VOCALOID — the ボカロPV tradition: an illustrated story, or a recording device failing

**Technical manual of this style pack** (API, building, assets, safety). The creative brief — what the film is, its
elements, motion and ways of thinking — is BRIEF.md next to this file: read that first, and open only the section here
that the build needs.

One style with two equal libraries: two kits that share a cast, a lyric voice and an engine. A film takes each shot
from either one, as the song asks. Neither is the default, and no rule ties a kit to a section or a tempo.

| kit | its shots ARE | pictures | lyrics |
|---|---|---|---|
| **tegaki** | an illustrated 手書き story with an original character: light, colour script, signature set pieces | generated character + backgrounds (+ Blender toon 3D), `engine/styles/vocaloid/*.js` | JIZURA plans + custom type scenes |
| **signal** | footage from a device being destroyed while it records: speed is editing, heat colours everything, the signal decays | generated NEUTRAL images + code fillers, `engine/styles/signal/` | the device's type: vertical mincho, beat-stamped lines, big WORD frames |

The starter (`--style vocaloid`, `engine/starters/vocaloid.js`) is a first cut that cycles shots from both kits through
the song's lines; rewrite it from the shot list. A hand-built tegaki film, the demo 「蛍火」, is `demo/hotarubi.js`.
Combining them:
- **Signal spans.** The heat grade, the decay layer and the device HUD run only inside `Z.SIG.spans = [[t0, t1], ...]`
  (with `Z.SIG.install()`; the starter derives the spans from where its signal shots fell). A span can be one line in
  an illustrated verse or a whole bridge that breaks down. Prepare a long one: the colour script heats up before it,
  hot pixels appear a line earlier, and the shot after it shows the damage (or the recovery).
- **The character seen whole:** tegaki shots show the character whole; signal shots cut to crops of the same one, so
  the sprint means something.
- **One character for both:** design the cast once (character bible, references/04). Signal needs extra crops of the
  same character (eye, mouth, hand, back, silhouette), generated neutral; tegaki uses the coloured master and poses.
- Lyrics: JIZURA on tegaki shots, the signal HUD (`SIG.hudCfg.lyrics` spans) on signal shots; never both at once.

---

## A. Tegaki — illustrated MV with an original character (the base kit's style)

This is the kit vocaloid-style-mv-pipeline (NikusonP, MIT) was built for and documented in full; its references
are the guide. Engine: the pack `template/engine/styles/vocaloid/` (its scenes, light devices `fx.js`, transitions
`trans.js`, palettes P1–P5 and LUTs, cookbook tools), JIZURA lyric layer, Blender toon 3D. Starter: `engine/starters/vocaloid.js` (both kits); a
hand-built tegaki film: the demo 「蛍火」, `demo/hotarubi.js`.
Case study 「残光」: https://github.com/EGSECDA/vocaloid-style-mv-pipeline/tree/main/examples/zanko (© NikusonP — learn
from it, do not reuse its motifs, character or palettes).

Read, in order: `styles/vocaloid/DIRECTION.md` (thesis, colour script, motifs, signature moments, variation
matrix, bright films §13) → `references/04-asset-generation.md` (start at §0, the generation table: masters, expression sheets for the living
faces below, poses, plates; character bible §5; Codex §2–3,
Grok §11, NovelAI §12, choosing §13) → `references/05-engine.md` (timeline, `illust` and the scene library, post, LUTs; additions §12) →
`references/06-jizura.md` (lyric plans, curation) → `references/07-blender-3d.md` (optional) → `references/09` (QA).

### What our eval rounds added (apply them in every tegaki film)

- **Grounding.** Background plates come first; read each plate's surfaces with `python tools/art_grid.py
  assets/bg/<plate>.png` and pin characters and props to them: `chars: [{ img, pin: [u, v], pin2, h, ground: true }]`
  (moves and scales with the bg camera; contact shadow), floating things `water: { sink: 0.15, reflect: 0.5 }` at the
  waterline, `tint: { color: <the scene's light>, a: 0.4–0.6 }` so a cut-out takes the plate's light. Things that must
  touch (a train ON a bridge, a hand ON a rail) are best generated in ONE image; otherwise measure the contact line.
- **Light sources** are `fx: [{ type: 'light', pin: [u, v], core, color }]` (soft stacked halos), not discs.
- **Motion with weight:** moving props travel on arcs with anticipation and follow-through (`D.travel`, `D.along` bank
  angle); nothing glides at a constant speed on a straight line unless it is a machine on rails.
- **Placement varies:** most character shots put her on the left or right third (`x` ≈ 640 / 1280 or `pin` u ≈
  0.33 / 0.67), facing into the open side (`flip` when she looks the wrong way), with the lyric in the other two
  thirds; the centre is for frontal singing, kime lines and the climax. Change side and size from shot to shot (a
  cut from her small on the left third to a close-up on the right reads as a cut; the same spot twice reads as a
  jump), move her across the frame with `x2` / `pin2`, and give two-character shots both thirds. `tools/storyboard.mjs`
  warns when over half the character shots are centred or a third is never used (a Gemini film had 10 of 16 at u = 0.5).
- **Poses: an acting shot or a drawn beat sequence.** In an acting shot a character keeps one picture and her face
  lives through `chars[].anim` (blink, mouth, expressions); a new pose comes with a cut to a new framing. The tegaki
  idiom of a new pose per beat is also right: a drawn sequence of ONE action, in order, stepped on twos or threes, or
  a 2–3 frame loop (hair, a breath, a sway) — the drawn layer steps while the camera, light and grain run on ones.
  What reads as a glitch is going back and forth: A → B → A (a Gemini film stepped three poses on each band stop of its
  outro); `burst` (a mini-shot per beat) stays ≤ 2 bars and gives every cut its own framing and place.
  `tools/check_shots.mjs` warns on SPRITE PING-PONG (A → B → A within 2 s) and RAPID SWAPS (3+ changes in 3 s).
- **Composition:** subject on a third, three depth layers (a blurred foreground element sells depth cheaply), the lyric
  in a quiet zone (centre-free JIZURA plan `cf` when the subject is central); the final shot is a composed picture with
  a subject, depth and light — never one small object in an empty frame.
- **Story actions get time:** an action the lyric names (she lets go of the lantern, the door opens) needs ≥ 1.5–2 s and a
  clear before / after; set it up in the previous shot.
- **Type range:** at least three JIZURA plans / styles per film plus custom typographic scenes for the キメ lines.

---

## B. Signal — a recording device failing

Engine code: `template/engine/styles/signal/` (`signal.js`, `cuts.js`, `fill.js`, `shot.js`, `hud.js`). Starter:
`engine/starters/vocaloid.js` (`new_project.py --style vocaloid`; both kits). An original implementation for this kit, inspired
by the "signal degradation" look of a fan PV (v1Ta44/netsu-ijou-pv, CC BY-NC 4.0): no code, art, character or lyrics
from it are used, and none may be — that PV uses a real song, real lyrics and an existing character. Make your own film
from your song.

### B.1 The idea

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

### B.2 Tiers (pick one per section)

| tier | sections | grid | fillers | inserts | lyrics |
|---|---|---|---|---|---|
| **T1 sprint** | choruses, the fastest parts | ½ beat (`div: 2`) | 30 % | ~20 % | `stamp`: the line re-laid every beat |
| **T2 one gear lower** | pre-chorus, long-line choruses, bridge | 1 beat, anchor image returns A-B-A-C-A | 18 % | ~10 % | `center`: one big line, typed |
| **T3 slow** | intro, verses, breakdowns | 2–8 beats, xfade / signal-tear transitions | none | none | `vertical`: mincho 縦書き, per character |
| **hold** | a stop, a silence | one image | — | — | none / a single word |

T1 does not promise that every image is seen; T2 does (the anchor returns). Use the song's own stops: a held `NO
SIGNAL` frame on a dead stop, a black frame with only hot pixels breathing.

### B.3 Building it

```js
const SIG = Z.SIG;
SIG.heatKeys = [[0, 0], [B(17), 0.33], [B(33), 0.66], [B(65), 1], [END, 0.2]];   // the film's temperature
SIG.boost = { chorus: 0.14, 'pre-chorus': 0.06 };
// SIG.spans = [[B(49), B(65)]];                // only there (a tegaki film that breaks down); null = the whole film
SIG.install();                                  // grade + degradation layer (chains any Z.layerFX already set)
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
- In a mixed film, give the HUD only the signal shots (`hud: true` on them, `hud: false` on the tegaki shots).

### B.4 Assets

Generate **neutral** images (natural daylight colours, mid contrast, no heavy colour cast): places (ruins, a corridor,
a tower, sea, a field), objects (a recorder, cables, a CRT, a chair, a bell), one original character (front / back /
close-ups: eye, mouth, hand, neck — for crops), a few silhouettes. Pick crop focus points with `tools/art_grid.py`.
Pixel type sits on a 16 px grid (DotGothic16 at 16 / 32 / 48 / 64 px, integer positions); lyrics use mincho.

### B.5 Safety — this kit is where flashes happen

- Full-frame white flashes / inversions only at 3–6 key points of the film (a section's first hit, the title word),
  each a single event, never repeated within a second.
- Inserts are DARK (black, dim noise, dark fragments, `NO SIGNAL`) and at most one per 0.34 s (`cuts()` enforces it);
  `maxCutsPerSec` (6) caps hard changes. Do not put bright images in the insert pool.
- Keep consecutive T1 cuts within one luminance band (the heat grade helps: everything shares one ramp).
- **Run `python tools/check_flash.py` on every render** (and on clips of the sprint sections while building). FAIL →
  lower `ins`, raise `div` spacing, darken the offending motifs, or move a flash.
- Add a photosensitivity warning card before the film (and in the description) when the film is intense.

---

## Characters with a living face (optional, both kits)

A character may stay completely still; that is fine. If the film wants more, now and then she blinks, opens the mouth
or changes expression: a swap of the face, not an animation and not lip-sync (a viewer who watched the eval film: the mouth flapping on every syllable looked
wrong, and the pasted eye / mouth areas showed their edges). The engine does the timing; you supply the faces.

**The faces: pictures that differ only in the eyes or the mouth.** Best: repaint just that area of the approved picture
with the generator, so everything else stays identical and the whole picture can be swapped without a seam:
1. The base: the approved bust or half-body picture of the character (a char row, e.g. `CH03`, or the neutral figure
   of a sheet). Measure the eye box and the mouth box on it with `python tools/art_grid.py assets/gen/CH03.png`.
2. One variant row per face, repainting only its box (NovelAI infill: the pixels outside the box come back
   unchanged; inpainting costs Anlas):
   `{ "id": "CH03_blink", "variant_of": "CH03", "edit": "her eyes closed", "region": [0.30, 0.24, 0.62, 0.36],
   "ref_mode": "inpaint", "mode": "full", "takes": 3 }` — likewise `CH03_open` (the mouth box, "her mouth open, singing")
   and `CH03_smile`. `gen_table.py jobs --pass variants` → generate → `post`; `post` keeps the take that changed most
   inside the box and blends it into the base with a soft edge inside the figure (outside the face the picture is the
   base, pixel for pixel). Look at every final over the base. From the first test (16 inpaints of one bust):
   - keep each box **inside the face**: a box that crosses the chin or the face outline got key-coloured smudges;
   - an eye box must take in the upper lid line: one that stopped short of the fringe came back with the eyes open in
     4 of 4 takes; one that took in some fringe closed them and softened that bit of fringe;
   - takes differ a lot: `"takes": 3`, and look at all of them on `assets/gen/_review_<id>_takes.jpg` (the box from the
     base and from every take). `post` keeps the take that changed most, which is not always the closed eyes: set
     `"take": 2` on the row to keep another, and run `post` again;
   - if no take closed the eyes: a taller eye box (from mid-fringe to below the lower lashes) and `"noise": 0.15`;
   - the open mouth and the smile came out clean on the first good box; the blink was the hard one.
3. In the shot: `chars: [{ img: 'assets/gen/CH03.png', …, anim: { whole: true, blink: 'assets/gen/CH03_blink.png',
   mouth: 'assets/gen/CH03_open.png', expr: { smile: 'assets/gen/CH03_smile.png' }, exprAt: [[t, 'smile'], [t2, null]],
   seed } }]`. `whole: true` swaps the whole picture (mouth over blink over expression), with no pasting.

Fallback, **an expression sheet** (one generation of all faces, `"sheet": { "cells": ["neutral", "blink", "open",
"smile"], "cols": 4 }`, references/04 §0): the copies on a sheet are each redrawn (head angle, crop and collar move), so
`post` pastes only their eye / mouth boxes onto the neutral figure (`"eyes"`, `"mouth"` boxes measured on
`_CH03_grid.jpg`; set `"pick"` from `_CH03_figures.jpg`). Look at every patch at full size: where its edge shows, use
the variant rows above instead. `"faces": "whole"` writes the aligned copies whole, only for a sheet whose copies really
match outside the face (swapping redrawn copies reads as a jump cut).

Timing (engine): blinks on a seeded clock (`seed` per character, `period` 3.7 s); the mouth opens for about half a second
every 1.1–1.7 s while a line is sung and stays closed between lines (`sings: false` for a listener; `lipsync: true`
opens it on every sung character, rarely wanted); expressions change on cues (`exprAt`). `motion_check.py` counts a
living face under a slow push (≥ 40 % of its threshold) as motion, read from plan/shots.json `animFaces`.

Do not ask the generator for a changed version of a whole finished picture (a turned head, another pose): tested, it
either drifts in style or does not change. Other poses are other pictures, cut to, not morphed. (`anim.tilt` /
`anim.hair` mesh warps and `states` exist but are rarely needed.)

## Asset library and density (method: references/10 §3, team: 11)

- **Tegaki (「残光」):** a character bible, three master candidates → one master, about 20 poses and expressions keyed to
  RGBA, close-ups (eye, hands), 14 backgrounds from the lyric's imagery and the colour script, the story props; Blender
  shots for 1–2 showcases. Review every batch as one sheet (`art_grid.py`, `lineup.py`).
- **Signal (netsu-ijou-pv):** 3–10 style-test rounds before production; a locked character sheet (front, back, face,
  every design element written down); one generation table of ~40–60 components (≈ 18 places, ≈ 14 character framings
  incl. extreme crops of eyes / hands / neck, ≈ 22 objects), all NEUTRAL colour, with motion as separate images (a bird
  in three wing positions) and states (clean / soiled); proportions fixed after generation; a review sheet per
  category (BG / CH / OBJ).
- Both: prompts name what each reference image is for ("the first image is style only; the others are this character's
  design"); missing pictures go to `docs/WANTED_ART.md`; per lyric line 2–5 motif variants (signal), a composed picture
  per line (tegaki).

## Asset notes (moved from references/04: the 残光 film's own asset list and prompt blocks)

For a vocaloid preset film. **Copy the structure, not the words.**

### Style blocks of 残光

These are the blocks 残光 actually used. **Copy the structure, not the words**: a new film needs its own medium, palette words and mood. Keep each block identical across all jobs of its kind.

Character sentence (残光):
```text
The same original character as in the reference image (waist-length ink violet-black hair with sunset-orange inner
colour and tips, blunt bangs, amber-gold eyes, white headphones with glowing orange ring lights, setting-sun hairpin on
her right side, navy sailor blouse with vermilion tie, oversized cream knit cardigan, navy pleated skirt, black tights,
brown loafers, long vermilion ribbon tied on her LEFT wrist).
```
Character style block (appended to every character, close-up and prop prompt):
```text
Japanese Vocaloid music-video tegaki (hand-drawn) illustration: confident hand-inked line art with visible brush-pen
pressure (thick outer contour, thin inner lines), flat cel colours with ONE hard shadow tone, no airbrushed gradients on
skin or clothes, restrained dusk palette (ink violet-black, dusk magenta, vermilion, sunset orange, amber, cream), crisp
readable silhouette, looks like a key frame from an indie Vocaloid MV. No text, no watermark, no signature.
```
Background style block:
```text
Style: Japanese Vocaloid MV tegaki background art, hand-inked outlines on buildings and objects (coloured line art, not
pure black), flat cel colour areas with hard-edged shadow shapes, sky painted as a few posterised colour bands instead
of a smooth gradient, subtle paper grain, restrained palette of ink violet-black, dusk magenta, vermilion, sunset orange,
amber and cream. Wide 16:9 landscape composition. No people, no characters, no text, no readable signs, no watermark.
```
Daylight example (summer / sea film), palette words only (the 残光 blocks above name a dusk palette, and those words alone pull every image toward sunset):
```text
…high-key summer daylight, saturated sky cyan and sea teal, white cumulus, coral and sunflower accents, crisp cast
shadows, bright paper white, no dusk or night tones…
```



### The 残光 asset list (for ~70 shots)

| need | 残光 example | typical shots |
|---|---|---|
| reference / masters | `REF_master` (+ `master_a`, `master_c`) full body front | title lockup, afterimage, recaps |
| singing (2–3) | `bust_sing` (hand on headphone), `profile_sing` (side profile), `sing_power` (low angle, full voice) | chorus slams, panels, bursts |
| quiet / emotional (3–4) | `bust_calm` (eyes closed), `face_tear`, `lookup_tear`, `smile_dawn` | verses, breathing shots, ending |
| back view | `back_sunset` (hair and ribbon blowing) | establishing shots, small figure in a big world |
| full-body action (3–4) | `run` (to the left), `turn_smile`, `jump`, `fall` (seen from above), `reach_viewer` (foreshortened hand) | climaxes, bursts, the road |
| body language (2–3) | `hug_self`, `sit_knees`, `kneel_pick` | verses, despair, gathering |
| hands / close-ups | `hand_reach` (arm + ribbon only), `flame_hands`, `hands_shards`, `eyes_ecu` (**opaque 16:9** eye close-up) | lyric images (指先, 小さな火, 拾い上げて) |
| locations (8–14) | `bg_crossing`, `_night`, `_dawn`, `bg_platform`, `bg_embankment`, `bg_train`, `_night`, `bg_rooftop`, `bg_sky` (sky only), `bg_fireflies`, `bg_classroom`, `bg_vending`, `bg_door`, `bg_wetstreet` | every `illust` shot |
| props | `prop_heart` (cracked glass heart, RGBA) | the song's central metaphor |

## Scene catalogue (the tegaki scenes, `engine/styles/vocaloid/*.js`)

Written for the demo film 残光: their look (dusk colours, a singer, kanji, HUD) belongs to this preset. The shared
scenes `illust`, `solid` and `jz` are documented in references/05 §8.

Shot ids refer to 残光's `examples/zanko/timeline.js`. The case study is in the kit repo only, not in the installed skill folder — online: https://github.com/EGSECDA/vocaloid-style-mv-pipeline/tree/main/examples/zanko (raw file: https://raw.githubusercontent.com/EGSECDA/vocaloid-style-mv-pipeline/main/examples/zanko/timeline.js). Reuse classes:
- **generic (args only)**: `illust`, `solid`, `jz`, `panels` (`gutterColor`, `keyline`), `burst` (`grade` knows only `'night2dawn'`), `ref`, `seq`, `converge`, `afterimage` (pass `text`/`sub`/`credit`/`color`/`char`), `memories`;
- **generic once the daylight args are set (bright films)**: `kanjiSlam` (`sky: 'day'` or a real `bg`; otherwise it paints a dusk or night sky), `typeCard` (`paper`, `quiet` mode);
- **reusable once you pass your strings**: `titleRiff` (`glyphs`, `ruby`, `sub`, `hud` — otherwise it slams 残 / 光 and prints 残光's HUD; its sun disc and dusk palette stay);
- **残光 set pieces** with hard-coded strings, glyphs or image landmarks (Porting checklist, below) — rewrite them for your film rather than re-skinning: `ember`, `tunnel`, `wetFloor`, `train`, `heart`, `skyShatter`, `thread`, `fall`, `flame`, `ink`, `road`.

Scene defaults are 残光 dusk colours (ink `#140B1E`, amber rims and glows `#FFA552`). The 残光 timeline builds custom fx
as small factories: long cast shadow, light sweeps (train windows), sinking sun with a 残光 ring, glyph-shaped firefly swarm, sound rings per beat, heart glow, falling tear, crossing lamps pinned to background coordinates (`bgPt(S, u, v)` maps image-normalised coordinates through the current cover view).

**`intro.js` — light that opens and closes the film** (helpers `Z.INTRO.post.<scene>(S)`, `Z.INTRO.black(S)`)
| scene | what | args | 残光 |
|---|---|---|---|
| `ember` | `breathe`: one ember breathing with the envelope, black micro-stops · `ignite`: ember → ring of fire on the low hit, beat rings, cracks · `collapse`: the dawn world implodes into one point | `mode`, `stops [[t0,t1]…]`, `flares`, `thumps`, `blackFrom`, `crackAt`, `ring 176`, `bg` (collapse), `keys`, `grain` | s01, s02, s65 |
| `titleRiff` | title sequence on the riff: sun disc, monument glyphs slam on accents, HUD corners, silhouette in the sun, lockup; `outro` variant recaps 8–12 earlier frames per beat | `variant 'intro'\|'outro'`, `recap [{bg, char, view, h, cy}]`, `char`, `sky`, `cues {sun, hud, zan, ko, split, sil, lock, exit}` (beat indices), `exit`, `final`, `glyphs ['残','光']` (the two slammed glyphs), `ruby ['ざん','こう']` (reading per glyph in the lockup; `false` = none), `sub 'afterglow'` (lockup line), `hud {title, when, bpm, geo, place, len}` (the six HUD corner strings; defaults are 残光's) | s03, s64 |
| `converge` | every motif spirals into one point → white-out | `seed`, `whiteAt` (default shot end) | s51 |
| `afterimage` | the negative of the title lockup fading on the retina + credit | `text '残光'`, `sub`, `credit`, `color '#39C6E0'`, `char` | s66 (end card) |

**`typo.js` — typographic set pieces** (`Z.typo.post.{kanjiSlam, typeCard, tunnel}`)
| scene | what | args | 残光 |
|---|---|---|---|
| `kanjiSlam` | monument kanji slammed per beat behind a singer, damped-spring camera kicks, ink/light speed lines, rim-lit character, optional fire | `glyphs` (one per beat; take them from the lyric, never type them: `[...Z.line(12).text.replace(/\s/g, '')]`, or a slice of it — `check_no_lyrics` flags typed lyric glyphs), `char`, `bg`, `variant 'default'\|'night'\|'hand'`, `fire`, `sky 'sunset'\|'night'\|'day'` (set by the variant: `'sunset'`, or `'night'` for the `night` variant; `'day'` keeps the plate as painted — no dusk multiply, no low sun — and `Z.typo.post.kanjiSlam` then adds no palette LUT and little bloom), `skyGrad [[k, c]…]` (the `'day'` sky when `bg` is null; default a blue daylight gradient), any preset field (`charX/Y/H`, `face [fx,fy]`, `color`, `fam`, `weight`, `rim`, `slots`, `frames`, `wind`, `lines`) | s16, s38, s52, s56 |
| `typeCard` | `quiet`: one small mincho line typed in on black (or `paper`) with a vermilion hairline · `flicker`: glitching word per beat building to white | `lines`, `mode`, `size 42`, `fam 'mincho'`, `weight 500`, `color`, `paper` (background colour; default near-black; on a light paper the text defaults to ink and `Z.typo.post.typeCard` drops the bloom; `flicker` is additive light, keep its paper dark), `ruleColor` (hairline colour, default vermilion), `vertical`, `rule`, `sub`, `lead .1`, `stagger`, `fade .6`, `gap .36`, `x`, `y` | s29, s37 |
| `tunnel` | one-take push through rings of lyric text (beats 1 & 3), dial and Latin rings, toward a light that blooms | `words [5]`, `plan [[t, word]…]`, `toward 'dawn'`, `f 820`, `v0 3.1`, `v1 9.5`, `fadeIn`, `reveal` | s61 |

**`glass.js` — glass heart and shattering sky**
| scene | what | args | 残光 |
|---|---|---|---|
| `heart` | `shatter`: radial fracture, slow-motion burst · `gather`: shards drift back into her hands (fireflies if the bg says so) · `burn`: shards on fire · `sun`: embers and shards spiral into a reborn sun | `mode`, `heart`, `char`, `bg`, `breakBeat`, `x 960`, `y 470`, `charX/charY/charH`, `n 24`, `fuseBeat 2`, `sunX/sunY/sunR` | s18, s19, s40, s53, s54 |
| `skyShatter` | the painted sky cracks and falls away in bands per beat, revealing night; silhouette figure | `bg`, `char`, `night '#070b1c'`, `seed`, `impact`, `releaseBeat 1`, `bands 5` | s39 |

**`dark.js` — night-side set pieces** (12 fps drawn motion)
| scene | what | args | 残光 |
|---|---|---|---|
| `thread` | wrist ribbon unravels into one travelling thread toward a far light; holds on the stop, whips on the accent | `hand`, `light [x,y]`, `stops`, `kickAt`, `arriveAt`, `handX/Y/H/Rot` | s06 |
| `fall` | falling toward a square of dawn; light streaks; time-freeze on audio stops | `char`, `freeze [[t0,t1]]` (default: stops in the shot), `pulse`, `vp [x,y]`, `speed`, `h` | s12 |
| `flame` | cupped hands with a breathing flame (`breathe`/`grow`), or a face lit from below (`dark`) | `mode`, `img`, `face`, `stops`, `flameAt`, `zoomAt`, `zoomTo`, `igniteAt`, `faceAt`, `facePos` | s15, s31, s50 |
| `ink` | sumi tendrils curl around her in a pale fog void, lurching per beat | `char`, `seed 7`, `h`, `x 960`, `y 992` | s46 |

**`night.js` — rain, wet floor, passing train** (`Z.night.post.{fall, count, train}`)
| scene | what | args | 残光 |
|---|---|---|---|
| `wetFloor` | `fall`: glowing words fall like drops (one landing per beat), splash, perspective ripples · `count`: top-down puddle, one drop per beat, DotGothic counter + HUD | `mode`, `bg`, `words`, `spots`, `heroSpot`, `lead`, `heroAt`, `from`/`to` views, `shimmer`, `hudColor`, `hudAlpha` | s24, s25 |
| `train` | night crossing, lamps alternating per beat, a train strobes through with her images in lit windows, freezes on the stop, leaves streaks | `bg`, `chars`/`windowChars`, `freeze [t0,t1]`, `exitAt`, `side`, `hero`, `heroX`, `cars`, `shutter .5`, `taps 7` | s33 |

**`memory.js`**
| scene | what | args | 残光 |
|---|---|---|---|
| `memories` | faded polaroids drop onto a desk on beats, captions write themselves (Klee One), window light leaves, prints burn from the edges; the photo with her burns last | `photos [{bg, caption, date, view, char}]`, `char`, `charIn`, `order`, `dropBeats [0,2,4,6,7,8]`, `burnBeats`, `pushAt`, `endZoom 1.9`, `seed 45` | s45 |
| `road` | `tear`: a glass tear falls in slow motion, splash, a line of light races to the horizon, the road of light opens · `run`: tracking shot of her running on the glowing road, slow-mo, freeze | `mode`, `char`, `impact`, `horizon`, `open`, `dolly` (default: beats 3/6/8/12 after the shot start), `slowAt`, `freezeAt`, `freezeStyle 'photo'` | s48, s49 |

**`meta.js` — scenes about other shots** (private buffers per nesting depth)
| scene | what | args | 残光 |
|---|---|---|---|
| `panels` | manga コマ割り: slanted ink gutters, staggered 8th-note openings, per-beat punch-ins, collapse into one panel | `panels [{bg\|img, view, viewTo, char, charX/Y/H, flip, tone, lines 'focus'\|'speed', punch, alt, lamps, tint, fx, fxBack, illust:{…}}]`, `collapseAt`, `hero`, `gutter 22`, `margin 22`, `gutterColor`, `keyline`, `openAt`, `openDur .36`, `order`, `layout`, `collapseDur .2`, `collapseZoom .045`, `shake 7` | s20, s41 |
| `burst` | one composed mini-shot per beat: framing, character pop, smear, flash, speed lines; optional night→dawn grade; ≤ 2 bars, no A → B → A sprite order (check_shots warns) | `cuts [{bg, view, viewTo, char, charX/Y/H, flip, rim, tint, dir, lamps}]`, `every 1`, `lead 1/30`, `flash 'alt'\|'all'\|'none'\|[k…]`, `flashColor`, `speed`, `grade null\|'night2dawn'`, `roll .018` | s55, s59 |
| `ref` | re-renders another shot: `freeze` (desaturate, crack, split), `rewind` (VHS, OSD), `melt` (columns drip, cool to blue) | `shot`, `mode`, `at`; freeze: `live`, `crackAt`, `crackXY`, `crackAngle`, `desat .88`, `push`, `jitter`, `split 8`; rewind: `span 3`, `from`, `follow`, `hold .1`, `fps 15`, `osd`; melt: `meltAt`, `meltEnd`, `cols`, `depth`, `drip`, `seed`, `rate` | s22, s43, s32 |
| `seq` | Blender image sequence in sync with song time | `pattern 'blender/renders/A/f_####.jpg'`, `t0` (shot t0), `fps 30`, `frames`, `offset 0`, `rate 1`, `view`, `prefetch 2`, `overlay {leak, flash, letterbox, introFlash, vignette, grade}` | s23, s44 |

## Porting checklist (song-specific constants of the tegaki scenes)

The stock scenes were written for 残光; before reusing one (in a vocaloid film, or as a technique source), check (and references/05 §10 for any film):
- **Image-pixel landmarks** tied to specific PNGs: `dark.js` `HR` (hand_reach pivot/ribbon tail), `FALL` (fall pivot/ribbon), `FLAME_AT` (flame core per image — or pass `flameAt`); `glass.js` kneeling-pose anchor points (chest shard, picking hand); `night.js` `WET` (horizon/vanishing point of bg_wetstreet), `FALL_HERO`, `LAMPS`/`ARM_LAMPS` (lamp lenses on bg_crossing_night); `meta.js` crossing-lamp positions; `memory.js` face position in turn_smile; `typo.js` `SLAM` presets (`face`, `charX/Y/H`). Measure the new image's pixels and override.
- **Hard-coded 残光 literals (not args — edit the file or write your own scene)**: `ember`'s typed '残光 / ZANKŌ' (`intro.js`); `tunnel`'s `LATIN` rings and railway crossbucks (`typo.js`); `wetFloor count`'s 23:41 timecode and 'RAIN 7.5mm/h 水面観測' (`night.js`).
- **残光 defaults you override with args**: `titleRiff` `glyphs` (残 / 光), `ruby` (ざん / こう), `sub` ('afterglow') and `hud` (title, DUSK / DAWN line, BPM 131, coordinates, 踏切 No.7, 03:44); `ember` `stops`, `flares`, `thumps`, `crackAt` (残光 intro micro-stops — pass from `audio.stops`); `train` `freeze [116.76,116.93]`, `exitAt 117.85`; `tunnel` words; `typeCard` default line and black paper; `kanjiSlam` dusk sky (`sky`); `afterimage` `text` / `sub` / `credit` / `color`; default asset paths (`assets/char/REF_master.png`, `bg_sky.png`, …) everywhere.
