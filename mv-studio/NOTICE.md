# mv-studio — notices and credits

mv-studio is a derivative of other people's open work. Keep these notices when you copy or publish it.

## Base: vocaloid-style-mv-pipeline — © 2026 NikusonP, MIT

https://github.com/EGSECDA/vocaloid-style-mv-pipeline. The engine (`template/engine/core`, `scenes`), the tools, the JIZURA
adapter, the Blender scripts, the palettes and LUTs, the demo song 「蛍火」, `scripts/` and the method references
(`references/01`–`09`, `effect-cookbook.md`) come from it, modified where marked (mv-studio). Licence:
`LICENSE` (= `licenses/LICENSE-vocaloid-style-mv-pipeline.txt`). Its third-party components (JIZURA, fonts, Playwright,
librosa, …): `THIRD_PARTY_NOTICES.md`. The 「残光」 song, lyrics, character and frames are © NikusonP, all rights
reserved, and are not part of this skill.

## Interface style (screen treatment): adapted from world-execute-me-lyric-mv — © 2026 Nyankomint, code MIT

https://github.com/Nyankomintsu/world-execute-me-lyric-mv. `template/engine/styles/interface/` ports and adapts its
chat, cursor, plate, code and glyph components and its role-palette drawing context; `tools/check_flash.py`,
`tools/check_no_lyrics.mjs` and the motion / storyboard ideas of the earlier lyric-mv skill also derive from it. Licence:
`licenses/LICENSE-world-execute-me-lyric-mv.txt`. NOT included: its character silhouettes (CC BY-NC-SA 4.0), its copy and
chat script, the song and lyrics (© Mili and rights holders), and its product branding (the interface here is generic;
the default palettes are new).

## Signal treatment (vocaloid style): original code, inspired by netsu-ijou-pv

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
- **netsu-ijou-pv** (CC BY-NC 4.0, ideas only): per-character timing from the UTAU score, a local lyric-timing editor,
  cut-outs masked from a green redraw and a keyer for light-on-light subjects (`alpha_matte.py redraw`, `--seal`),
  reference images labelled as style or design.

## The stage style

`styles/stage/` and `template/engine/styles/stage/` were written for this skill after the look of **PDoomVideo** (a
watercolour stage-show MV painted with p5.brush; no licence published, so ideas only: no code, art or characters). Its
mascot belongs to another company and is not drawn; the default puppet is an original design.

## The treatise treatment (interface style)

`styles/interface/` (§B) and `template/engine/styles/treatise/` follow **pdoom-video** by Giacomo Magnanini (MIT; licence in
`licenses/LICENSE-pdoom-video.txt`): its palette, the spark and its deterministic particles, the plate idioms and the
per-word karaoke rules, rewritten for this Canvas2D engine. Its song, lyrics, timing data and scene copy are not used.

## The papercraft style

`styles/papercraft/` and `template/engine/styles/papercraft/` adapt the paper-drawing primitives of **dalabengba-mv**
(licence ISC as declared in its package.json; text in `licenses/LICENSE-dalabengba-mv.txt`) and follow its pop-up book,
multiplane camera, paper RPG interface and transitions. Its song, lyrics, characters and story are not used; the
paper doll is a generic original rig.

## Fonts added by mv-studio (fetched at setup, not bundled)

Inter, IBM Plex Mono, Archivo, Cormorant Garamond, ZCOOL QingKe HuangYou, ZCOOL KuaiLe, ZCOOL XiaoWei and Fredoka
(SIL Open Font License 1.1), from github.com/google/fonts, like the base kit's fonts.

## Using the output

A film made with this skill contains the user's song and lyrics; their rights stay with their owners. Credit the
artist on screen. Generated images may carry the image model's terms. Never imitate existing characters, brands or
product UIs.
