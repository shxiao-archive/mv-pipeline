# mv-studio — notices and credits

mv-studio is a derivative of other people's open work. Keep these notices when you copy or publish it.

## Base: vocaloid-style-mv-pipeline — © 2026 NikusonP, MIT

https://github.com/EGSECDA/vocaloid-style-mv-pipeline. The engine (`template/engine/core`, `scenes`), the tools, the JIZURA
adapter, the Blender scripts, the palettes and LUTs, the demo song 「蛍火」, `scripts/` and the method references
(`references/01`–`09` and `effect-cookbook.md`; `02` and the cookbook now live in `styles/vocaloid/DIRECTION.md` and `COOKBOOK.md`) come from it, modified where marked (mv-studio). Licence:
`LICENSE` (= `licenses/LICENSE-vocaloid-style-mv-pipeline.txt`). Its third-party components (JIZURA, fonts, Playwright,
librosa, …): `THIRD_PARTY_NOTICES.md`. The 「残光」 song, lyrics, character and frames are © NikusonP, all rights
reserved, and are not part of this skill.

## Interface style (screen kit): adapted from world-execute-me-lyric-mv — © 2026 Nyankomint, code MIT

https://github.com/Nyankomintsu/world-execute-me-lyric-mv. `template/engine/styles/interface/` ports and adapts its
chat, cursor, plate, code and glyph components and its role-palette drawing context; `styles/interface/kit.js` (ink-plate
separation, parts, sagging type, masks), the time helpers in `core/util.js` (`withInserts`, `dropFrames`, `replay`,
`tear`), `Z.wordsAt` and the `rays` / `streak` post light follow its v4 kit (art.js, type.js, draw.js, post.js, kit.js); `tools/check_flash.py`,
`tools/check_no_lyrics.mjs` and the motion / storyboard ideas of the earlier lyric-mv skill also derive from it. Licence:
`licenses/LICENSE-world-execute-me-lyric-mv.txt`. NOT included: its character silhouettes (CC BY-NC-SA 4.0), its copy and
chat script, the song and lyrics (© Mili and rights holders), and its product branding (the interface here is generic;
the default palettes are new).

## Signal kit (vocaloid style): original code, inspired by netsu-ijou-pv

The look of v1Ta44/netsu-ijou-pv (a fan PV, CC BY-NC 4.0) — tiered cut speeds with filler frames, a heat-driven grade,
analog signal degradation, a recorder HUD — inspired `template/engine/styles/signal/`, which was written for this skill
without using that project's code, images, character or lyrics. That PV's song, lyrics and character belong to their
rights holders.

## mv-studio additions — MIT

Style packs (interface port, signal), `core/lyrics.js`, the layer hook, extra LUT ramps, grounding and light helpers,
`illust` pinning, starters, `estimate_lrc.py`, `art_grid.py`, `grokgen.py` / `grok_run.sh`, `novelaigen.py`, `artgen.py`, the motion check, the style
guides (`styles/`), the timing and review tools (`core/cues.js`, `lrc.py`, `make_cues.py`, `lyric_timing.py`,
`score_timing.py`, `lyric_editor/`, `storyboard.mjs`, `engine_page.mjs`, `lint.mjs`, `check_shots.mjs`, `cues_sheet.mjs`,
`pops.mjs`, `regress.mjs`, `compare_sheets.py`, `check_sync.py`, `measure_cues.py`), the project templates (`docs/`,
`project.json`) and the additions marked "mv-studio" in the references. Released under the MIT License on the same
terms as the base (`LICENSE`).

## Workflow ideas from other film projects

The rebuilt workflow (references/01, 09 §7) borrows methods, not code, from projects that published how they made
their films. All tools listed above were written for this skill.

- **world-execute-me-lyric-mv** (Nyankomint, code MIT): the sync check on the exported file and the cue measurement
  (`check_sync.py`, `measure_cues.py` follow its method), a storyboard generated from the shot list with checks,
  before/after regression sheets, a per-round progress log with places to check by ear, an art wish list, a
  photosensitivity preroll page with the computed flash range (`preroll.py`).
- **pdoom-video** (Giacomo Magnanini, MIT): measured timing with recorded confidence, approximate data first, a
  constant-tempo grid, sections with a pickup rule, an edit derived from the lyrics and the grid, per-section lyric
  treatments, a "not slop" list, revisions recorded with their reasons, a preview player with keys and deep links
  (`engine/core/player.js`), shutter motion blur.
- **dalabengba-mv** and **PDoomVideo** (no licence published, so ideas only): a director's brief read by everyone,
  cue tables with picture hints, labelled per-cue contact sheets, unplanned-jump detection, a lint for
  non-determinism and lost characters, P0 / P1 / P2 independent review, progress written before polish, git
  checkpoints; one short guide for every builder, a frame that returns, a motif that escalates each chorus, a
  line-up of all characters at one scale (`lineup.py`).
- **he-drowns-mv-v2** (longruizhi2-beep, MIT): a bar map with changing metre and beat groups checked against the
  spectrogram (`analysis/meter.json`, `Z.clock.meter`), per-drum hit envelopes driving the picture (`Z.hit`), a debug
  readout of the musical position in the preview player, an intensity chart with three escalating climaxes.
- **netsu-ijou-pv** (CC BY-NC 4.0, ideas only): per-character timing from the UTAU score, a local lyric-timing editor,
  cut-outs masked from a green redraw and a keyer for light-on-light subjects (`alpha_matte.py redraw`, `--seal`),
  reference images labelled as style or design.

## The stage style

`styles/stage/` and `template/engine/styles/stage/` were written for this skill after the look of **PDoomVideo** (a
watercolour stage-show MV painted with p5.brush; no licence published, so ideas only: no code, art or characters). Its
mascot belongs to another company and is not drawn; the default puppet is an original design.

## The treatise kit (interface style)

`styles/interface/` (§B) and `template/engine/styles/treatise/` follow **pdoom-video** by Giacomo Magnanini (MIT; licence in
`licenses/LICENSE-pdoom-video.txt`): its palette, the spark and its deterministic particles, the plate idioms and the
per-word karaoke rules, rewritten for this Canvas2D engine. `core/shade.js` (scene shaders, the engraving GLSL `hatch` /
`engrave`, the capsule line batch) and `core/stroke.js` (single-stroke fonts) follow its engine toolbox. Its song,
lyrics, timing data and scene copy are not used.

## Single-stroke fonts (`template/engine/fonts/stroke/`)

Unmodified SVG fonts converted by Windell H. Oskay (Evil Mad Scientist), taken from pdoom-video. Hershey Sans 1,
Hershey Script 1, Hershey Serif Med: the Hershey Fonts were originally created by Dr. A. V. Hershey while working at the
U. S. National Bureau of Standards; the format of the font data in this distribution was originally created by James
Hurt, Cognition, Inc. (full use restriction in each file's metadata). EMS Readability and EMS Allure (Sheldon B.
Michaels; derivatives of Source Sans Pro and Allura): SIL Open Font License 1.1, `fonts/stroke/OFL_ems.txt`.

## The papercraft style

`styles/papercraft/` and `template/engine/styles/papercraft/` adapt the paper-drawing primitives of **dalabengba-mv**
(licence ISC as declared in its package.json; text in `licenses/LICENSE-dalabengba-mv.txt`) and follow its pop-up book,
multiplane camera, paper RPG interface and transitions. Its song, lyrics, characters and story are not used; the
paper doll is a generic original rig. `template/engine/core/rig.js` (joint tables, keyed actions, gait phase from
distance, two-bone IK, ground contact, time-lagged trails) and `core/blocks.js` follow its rig and block methods; the
team process in `references/11-team.md` follows its reproduction manual. `references/10-craft.md` distils the process
documents of all six study films (methods only; none of their characters, songs, copy or art).

## The magazine style: adapted from he-drowns-mv-v2 — © 2026 ATRAXI (longruizhi2-beep), code MIT

https://github.com/longruizhi2-beep/he-drowns-mv-v2 (licence text in `licenses/LICENSE-he-drowns-mv-v2.txt`).
`template/engine/styles/magazine/press.js` adapts its print press (`js/print.js`: density separation into spot inks,
euclidean / line / grain screens with a tone LUT, plate offsets, riso paper, ink as light, negative and copier
streaks), rewritten for `core/shade.js` without its frame feedback; `layout.js` adapts its type and editorial marks
(`js/draw.js`, `js/scenes/common.js`: vertical type, ruby, crop and registration marks, proof rings, manuscript grid,
EAN-13, metre glyphs, ruler, gauge, ink drops, torn edges); `scenes.js` follows its page idioms (metre-as-layout strips
and grids, contents page, slam montage, burn holes, torn page, contact sheet, character decomposition, subliminal
frames). `tools/meter_probe.py` follows its `tools/tatum.py` and `tools/meter.py` (period / phase search, tatum
autocorrelation). Its song, lyrics, photographs, 3D sea and story are not used.

## Review process

The two-round jury of references/09 §8 (an independent session scores the film on an anchored 1-10 scale and lists
fixes by impact, with one that raises the wow factor; the builder revises; twice) follows the review prompt of
[mg-styles-15](https://github.com/Vincentwei1021/mg-styles-15) (Vincentwei1021, MIT), rewritten for music videos.
`tools/jury_pack.py` is our own.

## Fonts added by mv-studio (fetched at setup, not bundled)

Inter, IBM Plex Mono, Archivo, Cormorant Garamond, ZCOOL QingKe HuangYou, ZCOOL KuaiLe, ZCOOL XiaoWei and Fredoka
(SIL Open Font License 1.1), from github.com/google/fonts, like the base kit's fonts.

## Using the output

A film made with this skill contains the user's song and lyrics; their rights stay with their owners. Credit the
artist on screen. Generated images may carry the image model's terms. Never imitate existing characters, brands or
product UIs.
