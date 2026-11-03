# 01 — Workflow: from song to delivered MV

Contents: Phases at a glance · 0 Setup · 1 Listen (timing ground truth) · 2 Direct (style and concept) · 3 Plan (storyboard & timeline) · 4 Art · 5 Build · 6 Render · 7 Review (the jury) · 8 Deliver · Time budget · Parallelising · File conventions

All commands run from the **project root** (the folder created by `<skill>/scripts/new_project.py`; `<skill>` = the folder containing `SKILL.md`). Paths below are relative to it.

## Phases at a glance (mv-studio)

Each phase ends with files on disk and a check that must pass before the next. Commit the project (`git add -A &&
git commit`) at the end of every phase: `new_project.py` runs `git init`.

| phase | output | gate |
|---|---|---|
| 0 setup | env report; the art generator, credit line, solo or team, a preset or the film's own style (`project.json`, scaffold `--style`) | the user agreed (one line each) |
| 1 listen | `analysis/audio.json`, `overview.png`, `lyrics_mv.lrc`, `lyric_timing.json`, `cues.json` | `check_sync.py --lyrics-only`; `lyric_timing.py status` read; estimated lines listed for the user |
| 2 direct ◆ | `docs/CONCEPT.md` (with the film's style), `docs/BRIEF.md` | **checkpoint with the user** |
| 3 plan | the shot list in `engine/timeline.js` (`moment`, `line`, `cue` per shot) → `plan/storyboard.md`, `plan/shots.json` | `node tools/storyboard.mjs` PASS |
| 4 art ◆ | images on review sheets, `docs/WANTED_ART.md`, `render/lineup.jpg` (2+ characters) | every check sheet looked at |
| 5 build | the film's own `engine/scenes/<film>.js`, timeline | `node tools/verify.mjs --quick` PASS |
| 6 render ◆ | `render/mv.mp4`, stills, review sheets | `node tools/verify.mjs render/mv.mp4` (09 §7 order); every sheet read |
| 7 review | the jury round (`docs/review/jury-1.*`; a second only if the user asks), its fixes, `docs/REVIEW.md`, `docs/PROGRESS.md` | P0 empty; jury round done, its fixes made and re-verified |
| 8 deliver | master, share (+ preroll card when `check_flash` lists warning ranges), 9:16, credits | `check_flash`, `check_sync` PASS on the final file (`motion_check` is information) |

---

## 0. Setup

```bash
python <skill>/scripts/check_env.py                       # what's installed (REQUIRED vs OPTIONAL)
python <skill>/scripts/new_project.py my-mv --song song.wav --lyrics lyrics.txt \
       --title <title> --title-sub <Latin subtitle> --artist <artist> --credit "Music / Lyrics / Movie：<artist>" --setup
cd my-mv
```
`--title` / `--title-sub` / `--artist` / `--credit` set `Z.TITLE`, `Z.TITLE_SUB`, `Z.ARTIST`, `Z.CREDIT` in `engine/timeline.js` (HUD, end card, 9:16 header and footer). `--credit` alone also sets the artist (the text after the credit's last colon); `--title` alone empties the demo subtitle.
`--setup` runs `setup.ps1` / `setup.sh`: npm install (Playwright), pip install, font download (`tools/fetch_fonts.py` → `engine/fonts/`), `git clone` of JIZURA into `vendor/JIZURA` checked out at the tested commit `fc16bfe` (set the environment variable `JIZURA_REF` to another branch / tag / sha, e.g. `JIZURA_REF=main`, to follow upstream; a local `JIZURA_DIR` still wins), `node tools/build_jizura_bundle.mjs` → `jizura/app/jizura_engine.js`. Plain-text lyrics (no timestamps) need the alignment stack: add `--setup-args "-Lyrics"` (bash `"--lyrics"`) and install CPU torch into `vendor/pydeps_torch` (03 §9).

**Smoke test (recommended on a new machine) — in a throwaway project scaffolded without `--song`** (`python <skill>/scripts/new_project.py _smoke --setup`; it prints the steps), never in the film's project: the demo writes `audio/song.wav` and overwrites `analysis/lyrics_mv.lrc` and `analysis/sections.json`. In `_smoke`: `python demo/make_demo_song.py` → copy `demo/lyrics_demo.lrc` to `analysis/lyrics_mv.lrc` and `demo/sections_demo.json` to `analysis/sections.json` → `python tools/analyze_audio.py` → `node tools/stills.mjs --times 1,3.5,8.4,10,12.5,13.6,18.4,19.5,21.2,23.3 --sheet smoke` → look at `render/stills/smoke.jpg` (the full list, with the 16:9 and 9:16 renders, is in the project's `README.md` §2). If WebGL reports SwiftShader instead of the GPU, fix that first (GPU flags / browser channel) — software rendering is ~10× slower. Run the smoke test before scaffolding the film and the film's project can reuse its fonts: `--setup-args "-FontsFrom ../_smoke/engine/fonts"` (bash `--fonts-from`; sibling folders).

Acceptance: `window.ready` resolves with `renderer` naming the real GPU; a still renders in < 0.5 s.

## 1. Listen (analysis)

```bash
python tools/analyze_audio.py                 # audio/song.wav → analysis/audio.json, envelope_30fps.json, overview.png, sections_auto.json
```
- Open `analysis/overview.png` and **look at it**: waveform, energy, beats, section boundaries. Section labels are semi-manual (automatic grouping is unreliable on compressed masters): copy `analysis/sections_auto.json` to `analysis/sections.json`, fix boundaries / labels / groups by ear and by the plot, and re-run `analyze_audio.py` (it uses `sections.json` when present). `--bpm-range LO,HI` if the tempo octave is wrong.
- Note the special events: chorus downbeats, stops (silence gaps), post-chorus hits (biggest energy jumps), the final cut (dead stop or fade). These become your signature moments.
- Lyrics: get the **official text** from the user. Only transcribe when none exists (`references/03-audio-and-lyrics.md`). Use transcription/forced alignment for *timings* and keep the official *text*. Watch for lines the ASR missed entirely (残光's final "救って、救って" was absent from every pass).
- Write `analysis/lyrics_mv.lrc` — one display line per official line, LRC time = sung onset, JIZURA markup (`/` cut break, `*emph*`, trailing `!` for キメ lines, `[間奏]` for long instrumental gaps).

- **Timing ground truth** (03 §12): record where every line's time came from, best tier first: official timed LRC →
  the producer's score (`python tools/score_timing.py <ust|mid>`) → forced alignment (Japanese, 03 §9) → tapped in the
  editor (`node tools/lyric_editor/server.mjs`) → estimated (`estimate_lrc.py`). `python tools/lyric_timing.py status`
  lists the tiers; tell the user which lines are estimated.
- **Cue table:** `python tools/make_cues.py` → `analysis/cues.json` (one cue per line `L00…`, sections, stops, impacts).
  Write a **picture hint** for every line cue, in your own words (never the lyric). `python tools/measure_cues.py`
  compares cues with the onsets and only suggests; put a time you trust into the cue's `fix`.

Acceptance: beats look right on the overview; every lyric line has a time within ±0.15 s of the onset (or is listed as
estimated); sections labelled; every line cue has a hint.

## 2. Direct

The default is a style of the film's own (`design-a-style.md`; scaffold `--style own`, the blank starter). A preset
(SKILL.md table; `styles/<preset>/BRIEF.md`) only when the user asked for it. The choice decides the starter timeline
(`new_project.py --style`); what pictures the film needs and how lyrics are set follow from the concept, not from
the starter.

Read `direction.md`, then `design-a-style.md` (or the preset's BRIEF.md and, for vocaloid, `styles/vocaloid/DIRECTION.md`).
Produce `docs/CONCEPT.md` (≈1 page): thesis (one sentence about what the song is *about* visually), logline, arc per
section, the style block (`design-a-style.md` §2 slots and the §4 distance review on the look sheet; for a preset, the
study of its reference film), signature moments mapped to times, ending idea, and the **section-by-section table**:
for each section, from its lines and its music, the picture idea, composition and scale, how the lines are set, the
motif's state, what moves and on what, and the hand-over. A preset is a vocabulary to design with, not a set of
effects to apply: each section's row comes from the song, and two sections never get the same row. A cast summary
only if the film has a cast.

**Checkpoint:** summarise to the user in a few lines, with the section table.

## 3. Plan

1. **The shot list is the storyboard** (mv-studio): write the shots straight into `engine/timeline.js`, each with `moment` (what it shows and why, your words), `line` (the lyric line number it answers) and, where the cut belongs to a cue, `cue: 'L07'`; then `node tools/storyboard.mjs` writes `plan/storyboard.md` and `plan/shots.json` and checks coverage, the grid and the cues (09 §7). Never edit the generated `plan/storyboard.md`: change the shots. Size the list from the concept's editing rhythm. Map each lyric line to an image that *answers* it (`direction.md` §4), inside its section's row of the concept: each `moment` says what happens in the shot and on which beat, hit or sung word. Mark the signature moments.
2. `engine/timeline.js`: the edit. It starts as your `--style` starter (the blank one by default): keep its
   structure — film identity (`Z.TITLE`, `Z.TITLE_SUB`, `Z.ARTIST`, `Z.CREDIT`), helpers, `Z.LOOK_DEFAULT`,
   `Z.VERTICAL_CFG` — and replace its placeholder values and shots with the film's. Helpers inside `Z.setup(audio)`:
   - `B(n)` = start of bar *n* using the bar numbers of `audio.json` / `sections.json` (`bars[].index`; songs with a pickup have a bar 0, songs without don't — look the bar up by index, not by array position);
   - `nb(t)` = nearest beat to `t` (snap lyric onsets to the grid).
   ```js
   shot('s12', nb(47.00), nb(50.87), 'myScene', { /* the scene's args */ }, { lyric: 'none', trans: { type: 'black', dur: 0.3 } });
   ```
   Cut on lyric onsets snapped to beats (`nb(lyricTime)`) inside sections, and on bar starts (`B(n)`) at section changes. Give every shot an id (`s01…`), its lyric handling (a JIZURA plan the film defined, or `lyric:'none'` when the scene's own typography carries the line), post params if any, and a transition when it's motivated.
3. Render stills at every shot's midpoint immediately, even with placeholder scenes — an animatic of stills reveals pacing problems early. `node tools/cues_sheet.mjs` gives one labelled frame per line cue: the quickest "is this the picture for this line?" check.

## 4. Art

Only if the film uses generated or drawn pictures (the concept's picture-source slot). A code-drawn film skips to §5.
Read `references/04-asset-generation.md`, starting at §0: every generated image of the film is a row of ONE generation
table, `assets/gen/table.json` (`tools/gen_table.py`).
1. The table's **locks**, in your words from the concept: `STYLE` and `WORLD` always; if the film has a cast, a
   character bible `docs/CHARACTER.md` first, then `CHAR` (the character sentence) and `CHAR_BACK` (from behind, no
   face words; back-view rows say `"view": "back"`); `ISO` / `EMPTY` when the film needs them.
2. A few master rows (the key picture; the character if there is one) → generate → pick with the user → the table's
   `refs`. **Checkpoint:** contact sheet.
3. The rest of the rows, from the storyboard's needs: the pictures the concept names, with the variants (time of
   day, pose, face) the film actually uses.

```bash
python tools/artgen.py providers                                                # which generator? ask the user once
python tools/gen_table.py jobs assets/gen/table.json                            # -> assets/gen/jobs_base.jsonl
python tools/artgen.py run assets/gen/jobs_base.jsonl --out-dir assets/gen/raw  # Codex / Grok / NovelAI / custom (04 §13)
python tools/gen_table.py post assets/gen/table.json                            # finals, sheets split, _review_*.jpg
python tools/gen_table.py status assets/gen/table.json
```
Acceptance: every image viewed (`_review_*.jpg`); a cast, if any, recognisably identical across
pictures; no green fringes; nothing imitates an existing character.

## 5. Build

- **The film's own scene file** `engine/scenes/<film>.js` draws the film's pictures; `timeline.js` keeps the edit
  (`tools/storyboard.mjs` warns when there is none). Search the index for techniques to reuse
  (`references/05-engine.md`); a preset's scenes and devices live in its pack (`engine/styles/<preset>/`).
- New scenes register with `Z.scene(name, {preload, init, draw})`, one file per area.
- **Optional layers**, when the concept calls for them: JIZURA kinetic lyrics (`references/06-jizura.md`); Blender 3D
  shots (`references/07-blender-3d.md`; run them with `python tools/blender_run.py blender/shots/<shot>.py -- --mode full --res 100`,
  `--res 100` = true 1080p).
- Each scene author keeps a test timeline `engine/tests/<name>.js` and renders stills with `node tools/stills.mjs --url "engine/index.html?tl=tests/<name>.js" --times …`.

## 6. Render

```bash
node tools/stills.mjs --times <midpoints of all shots> --out render/stills/pass1 --sheet pass1
node tools/render_final.mjs --name mv                       # the first master + audio (≈4 min on RTX 3080); then --patch <shot ids>
python tools/review_sheets.py render/mv.mp4 --step 1.8 --out render/review1
```
Read every sheet. Before the render: `node tools/lint.mjs`, `node tools/storyboard.mjs`, `node tools/check_shots.mjs`, `node tools/pops.mjs`; after it: `python tools/check_flash.py render/mv.mp4`, `python tools/motion_check.py render/mv.mp4`, `python tools/check_sync.py render/mv.mp4` (the full order and what each catches: 09 §7). Before changing a shared file, `node tools/regress.mjs snap before`; after it, `snap after` and `python tools/compare_sheets.py before after`. Query JIZURA when a lyric frame looks wrong: `node tools/jz_cuts_at.mjs 196.8,203.5 main`. Render the whole film once; after that, fix in ranges: check each with stills and `pops.mjs --from --to`, then `render_final.mjs --patch <shot ids>` (09 §1). A change to shared code is tried on a range render first and goes into at most one `--full` re-render per review round.

**Checkpoint:** show the user a few stills and the verify summary.

## 7. Review

Write problems into `docs/REVIEW.md` (P0 / P1 / P2) and the round into `docs/PROGRESS.md`. Use `references/09-qa-and-lessons.md` (checklist + failure modes).

**The jury, one round, before delivery** (09 §8): `git tag review-1`, `python tools/jury_pack.py render/mv.mp4`, then a
session that did not make the film (another model if the user has one, else a fresh session or a subagent with no
history) reviews the pack, `docs/CONCEPT.md`, the style's Signature features and the check outputs with the jury prompt;
the building session revises with the revise prompt and renders (a second round only when the user asks for it).
**Checkpoint:** show the user the scores and fix list.

## 8. Deliver

`references/08-render-and-delivery.md`: 16:9 master, share encode, 9:16 vertical (`engine/vertical.html`, configured by `Z.VERTICAL_CFG` in the timeline: which shots keep their full 16:9 composition, plan map, header text, lyric `schemes` and the `ambience` tint of the surround), 720p previews, credits (title lockup + outro + end card + README), optional upload. Films with warning ranges in
`render/mv_flash.json` get the preroll card on the share version and the warning text in the description
(`tools/preroll.py`). Optional shutter motion blur (`project.json` `render.shutter`). Report: file list with sizes, durations, what was verified, what is uncertain (e.g. transcribed lyric lines).

---

## Time budget (measured on 残光: 3:46 song, RTX 3080, Windows 11)

| step | time |
|---|---|
| audio analysis | 35–60 s |
| lyric transcription (multi-pass + separation + alignment) | 30–60 min (skip with official lyrics + alignment only) |
| one generated image | 30–110 s; 8–10 in parallel; ~45 images ≈ 10–15 min |
| Blender EEVEE 1080p toon + line art | ≈0.7 s/frame; 7 s shot ≈ 3 min |
| still (engine, incl. PNG encode) | 0.1–0.45 s |
| full render 6796 frames 1080p, 3 workers | ≈4 min (≈30 fps); vertical ≈3.5 min |
| x264 CRF 19 share encode (slow) | ≈2–4 min each |

## Parallelising

- **Team mode** (`--mode team`): the full process with parallel agents, blocks in `engine/blocks/` and prompt templates — `references/11-team.md`.
- Split scene work by file (one per area in `engine/scenes/`) — one owner each, plus their own test timeline. Shared core files (`engine/core/*`, `index.html`, `timeline.js`) belong to the lead.
- Asset batches and Blender shots run independently of scene code.
- Long agent runs can stop on usage limits: have agents write files early and often; after an interruption, review what's on disk before re-running anything (in 残光 all seven scene modules were complete on disk even though every agent "failed" before reporting).

## File conventions

```
project.json (mode, style, timing offsets, review tolerances)    art.config.json (image generator)
audio/song.wav                       analysis/{audio.json, envelope_30fps.json, lyrics_mv.lrc, lyric_timing.json, cues.json}
plan/{shots.json, storyboard.md} (generated)   docs/{BRIEF.md, CONCEPT.md, PROGRESS.md, REVIEW.md, WANTED_ART.md; STORYBOARD.md: team mode, written by hand}
assets/char/*.png (RGBA, trimmed)    assets/bg/*.png (opaque 16:9)    assets/style/{palettes.json, luts/}
docs/CHARACTER.md (if the film has a cast)
engine/timeline.js                   engine/scenes/*.js               engine/tests/*.js
blender/shots/*.py → blender/renders/<shot>/f_####.jpg
render/{stills/, review*/, <name>.mp4}
```
