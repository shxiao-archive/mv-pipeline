# Lyric MV project (mv-studio)

A lyric MV project made with the **mv-studio** skill, built on the **vocaloid-style-mv-pipeline** template (author: **NikusonP**,
MIT licence). Styles: vocaloid (tegaki: `engine/styles/vocaloid`; signal: `engine/styles/signal`),
interface (screen: `engine/styles/interface`; treatise: `engine/styles/treatise`), stage (`engine/styles/stage`), papercraft
(`engine/styles/papercraft`), magazine (`engine/styles/magazine`); starter timelines in `engine/starters/`. Every frame is drawn by a deterministic front-end engine (Canvas2D scenes + a transparent lyric layer +
a foreground layer + a WebGL2 post pass), rendered headless by Playwright and encoded by ffmpeg. The film is code:
`engine/timeline.js` is the edit, and re-rendering always gives the same frames.

> `scripts/new_project.py` copies the template's `PROJECT_README.md` to the new project as `README.md` (this file).
> The method (concept, assets, storyboard, review) lives in the skill: `SKILL.md` and `references/*.md`.

## 1. Setup (once per project; safe to re-run)

| OS | command (from this folder) |
|---|---|
| Windows | `powershell -ExecutionPolicy Bypass -File setup.ps1` |
| macOS / Linux / Git Bash | `./setup.sh` (or `bash setup.sh`) |
| any (Node) | `npm run setup` |

Setup installs Playwright (`npm install`), the Python packages (`requirements.txt`), downloads the fonts into
`engine/fonts/` (~260 MB, Google Fonts, OFL), clones [JIZURA 字面](https://github.com/852wa/JIZURA) into
`vendor/JIZURA` at the tested commit `fc16bfe` (set `JIZURA_REF` to another branch, tag or full sha, e.g.
`JIZURA_REF=main`; an existing clone in `JIZURA_DIR` wins) and builds `jizura/app/jizura_engine.js`, then runs the
environment check. Options:

| PowerShell | bash | what |
|---|---|---|
| `-Lyrics` | `--lyrics` | also install the lyric-transcription packages (faster-whisper, onnxruntime, …) |
| `-FontsFrom DIR` | `--fonts-from DIR` | copy the fonts from another project's `engine/fonts` instead of downloading |
| `-SkipPip` `-SkipFonts` `-SkipCheck` `-NoWebGL` | `--skip-pip` `--skip-fonts` `--skip-check` `--no-webgl` | skip a step |

Check the machine any time: `python tools/check_env.py --webgl` (REQUIRED vs OPTIONAL, project state, and the WebGL
renderer of the render browser — it must name your GPU, not SwiftShader / WARP / llvmpipe).
On macOS / Linux use `python3` wherever this file says `python`.

## 2. Smoke test: the demo film (no song, no art needed)

Run it in a throwaway project scaffolded without `--song` (`python <skill>/scripts/new_project.py _smoke --style vocaloid --setup`,
`<skill>` = the skill folder), never in your film's: the steps below write `audio/song.wav` (`make_demo_song.py`
refuses to replace a different existing file unless `--force`), `analysis/lyrics_mv.lrc` and `analysis/sections.json`.

```bash
python demo/make_demo_song.py                    # synthesizes audio/song.wav (24 s, 128 BPM, original)
cp demo/lyrics_demo.lrc analysis/lyrics_mv.lrc   # Windows: copy demo\lyrics_demo.lrc analysis\lyrics_mv.lrc
cp demo/sections_demo.json analysis/sections.json   # optional: curated section labels for the demo
python tools/analyze_audio.py                    # -> analysis/audio.json, envelope_30fps.json, overview.png
node tools/stills.mjs --times 1,3.5,8.4,10,12.5,13.6,18.4,19.5,21.2,23.3 --sheet smoke   # -> render/stills/smoke.jpg
node tools/render_final.mjs --name demo          # -> render/demo.mp4 (about 30 s on an RTX 3080)
node tools/render_final.mjs --name demo_vertical --url engine/vertical.html --selector canvas#vout --width 1080 --height 1920
python tools/review_sheets.py render/demo.mp4 --step 1 --out render/review
python tools/review_sheets.py render/demo_vertical.mp4 --step 1 --out render/review_v   # 9:16: 216x384 thumbnails
```

In a `--style vocaloid` project `engine/timeline.js` is that demo (a machine test, not a model for your film): 「蛍火」 (HOTARUBI), eleven shots built only from procedural scenes
and the JIZURA lyric layer. Look at `render/stills/smoke.jpg`: a night sky with a firefly light igniting, star
trails, a vortex, kanji slams, fireflies forming 蛍, a dawn and a violet end card mean the machine renders correctly
(reference: `docs/images/demo_sheet.jpg` in the kit repo,
https://github.com/EGSECDA/vocaloid-style-mv-pipeline/blob/main/docs/images/demo_sheet.jpg; it is a 1 s review sheet,
so compare it with `render/review/sheet_00.jpg`). See `demo/README.md`.

## 3. Making the MV for your song

Put the song at `audio/song.wav` (scaffold with `--song` does this) and work through the phases of the skill
(`SKILL.md`; details and acceptance criteria in `references/01-workflow.md`):

| phase | what you produce | main commands / files |
|---|---|---|
| 1 Listen | beat grid, bars, sections, stops, impacts | `python tools/analyze_audio.py`; look at `analysis/overview.png`; curate `analysis/sections_auto.json` → `analysis/sections.json`, re-run |
| 1 Listen: lyrics | `analysis/lyrics_mv.lrc` (official text, sung-onset times, JIZURA markup `/` `*…*` `!` `[間奏]`) | `references/03-audio-and-lyrics.md`; transcription / alignment only for timings: `tools/transcribe_*.py` (setup `-Lyrics`; forced alignment also needs CPU torch + torchaudio 2.8, best in `vendor/pydeps_torch`: `references/03` §9) |
| 2 Direct | `docs/CONCEPT.md` (with the film's style) | skill `direction.md` + `design-a-style.md` (or the preset's `BRIEF.md`) |
| 3 Plan | `engine/timeline.js` (shots with `moment` / `line` / `cue`) → `node tools/storyboard.mjs` → `docs/STORYBOARD.md` | `references/05-engine.md` (scenes, args, post, transitions) |
| 4 Art | the film's pictures, if it uses any (`assets/bg/*.png`, `assets/char/*.png` RGBA, …) | `python tools/artgen.py run <jobs.jsonl> --out-dir assets/char` (the generator in `art.config.json`: Codex, Grok, NovelAI or custom), `tools/alpha_matte.py`; `references/04-asset-generation.md` |
| 5 Build | the film's own scenes in `engine/scenes/*.js`; optional: JIZURA lyric plans, Blender shots | `references/05-engine.md`, `references/06-jizura.md`, `references/07-blender-3d.md` (`python tools/blender_run.py blender/shots/<shot>.py`) |
| 6 Render, 7 Review | stills → full render → review sheets → `node tools/verify.mjs render/mv.mp4`; one jury round (a second only if you ask) | `node tools/stills.mjs`, `node tools/render_final.mjs --name mv`, `python tools/review_sheets.py`, `python tools/jury_pack.py`, `node tools/jz_cuts_at.mjs <times>`; `references/09-qa-and-lessons.md` |
| 8 Deliver | 16:9 master, share encode, 9:16 vertical | `references/08-render-and-delivery.md` |

### Editing `engine/timeline.js`

`engine/timeline.js` starts as the starter of your `--style` (the blank one by default): an example of the API to
rewrite, not a look to keep.

- `Z.TITLE`, `Z.TITLE_SUB`, `Z.ARTIST`, `Z.CREDIT` at the top: the title, its small Latin line, the artist name and
  the exact credit line (ask the artist). Title and credit feed the HUD, the end card and the vertical header / footer;
  `Z.ARTIST` is the artist name in the 9:16 header. `new_project.py --title --title-sub --artist --credit` sets them
  when scaffolding (`--credit` alone also sets the artist: the name after its colon); otherwise they still hold the
  starter's placeholders.
- Inside `Z.setup(audio)`: `B(n)` = start of bar *n* (the bar numbers of `audio.json` / `sections.json`), `nb(t)` =
  nearest beat. Cut on bar starts at section changes and on `nb(lyric onset)` inside sections; never compute
  times from the BPM.
- `shot(id, t0, t1, scene, args, { lyric, plan, post, trans, text, hud })` — one call per shot, ids `s01…` in film order.
- If the film uses the JIZURA lyric layer: its plans (`Z.addPlan`) and curation lists are the film's own; re-check the
  stills after any change (any change re-rolls the cuts). Find a bad lyric frame with `node tools/jz_cuts_at.mjs 12.5 main`;
  list the parts that cover the picture with `node tools/jizura_cover.mjs`.
- `Z.LOOK_DEFAULT` / `Z.LOOKS` (per section label), `Z.globalFX` (flashes, kick shake), `Z.hud`.
- `Z.VERTICAL_CFG`: which shots keep the whole 16:9 composition in the 9:16 version (`full`), the plan map, header text
  (`title` / `sub` / `artist` = `Z.TITLE` / `Z.TITLE_SUB` / `Z.ARTIST`), when header and footer show (`credits`), the
  lyric schemes of the vertical plans (`schemes`), the tint of the blurred surround (`ambience`, default neutral black)
  and `chrome`, the film's own header / footer drawing (`false` = none; the credit must still appear somewhere).
- `window.__zankoMeta.duration`: the render length (song end + end-card tail).

Test a scene in isolation with its own timeline: `engine/tests/<name>.js` and
`node tools/stills.mjs --url "engine/index.html?tl=tests/<name>.js" --times …` (9:16: `--url "engine/vertical.html?tl=tests/<name>.js" --canvas vout`).

## 4. Command reference

| npm script | command | what |
|---|---|---|
| `npm run check` | `python tools/check_env.py` | environment + project state (`--webgl` probes the GPU) |
| `npm run env` | `node tools/kit_env.mjs` / `python tools/kit_env.py` | resolved paths and executables |
| `npm run analyze` | `python tools/analyze_audio.py` | audio analysis |
| `npm run stills -- --times 1,5` | `node tools/stills.mjs --times 1,5` | stills + contact sheet `render/stills/sheet.jpg` |
| `npm run render` | `node tools/render_final.mjs --name mv` | full 16:9 render + audio → `render/mv.mp4` |
| `npm run render:preview` | `node tools/render_final.mjs --name preview --preview` | half-resolution quick render → `render/preview.mp4` |
| `npm run render:vertical` | `node tools/render_final.mjs --name mv_vertical --url engine/vertical.html --selector canvas#vout --width 1080 --height 1920` | 9:16 version → `render/mv_vertical.mp4` |
| `npm run jizura:clone` | `git init` + shallow `git fetch` of JIZURA @ `JIZURA_REF` (default: the tested `fc16bfe…`) | fetch JIZURA into `vendor/JIZURA` (or `JIZURA_DIR`) without the rest of setup |
| `npm run jizura:build` | `node tools/build_jizura_bundle.mjs` | rebuild the JIZURA bundle after updating `vendor/JIZURA` |
| `npm run fonts` | `python tools/fetch_fonts.py` | (re)download fonts |
| `npm run lyrics:estimate -- <txt> --start S` | `python tools/estimate_lrc.py` | plain-text lyrics → ESTIMATED `analysis/lyrics_mv.lrc` |
| `npm run cues` | `python tools/make_cues.py` | cue table `analysis/cues.json` (lines, sections, stops, hits; your hints kept) |
| `npm run lyrics:status` / `lyrics:editor` / `lyrics:score -- <ust/mid>` | `tools/lyric_timing.py status` · `tools/lyric_editor/server.mjs` · `tools/score_timing.py` | lyric timing tiers, the tap editor (http://127.0.0.1:5178/), timing from the score |
| `npm run lint` · `storyboard` · `check:shots` · `check:pops` · `sheet:cues` | `tools/lint.mjs` · `storyboard.mjs` · `check_shots.mjs` · `pops.mjs` · `cues_sheet.mjs` | the checks before a render (skill references/09 §7) |
| `npm run check:sync` | `python tools/check_sync.py render/mv.mp4` | audio mux, cut frames and lyrics against the song |
| `npm run regress:snap -- before` … `regress:compare -- before after` | `tools/regress.mjs` · `tools/compare_sheets.py` | frames changed by an edit of a shared file |
| `npm run art:providers` | `python tools/artgen.py providers` | which image generators are available / chosen (`artgen.py use <name>` to choose) |
| `npm run art -- <jobs> --out-dir <dir>` | `python tools/artgen.py run` | generate with the chosen generator (per-job `"provider"` wins) |
| `npm run art:grok:plan -- <jobs> --out-dir <dir>` | `python tools/grokgen.py plan` | Grok images, step 1 (then `bash tools/grok_run.sh 4`, then `art:grok:collect`) |
| `npm run check:flash` | `python tools/check_flash.py render/mv.mp4` | photosensitivity check (PASS / FAIL) + warning ranges (`render/mv_flash.json`) |
| `npm run preroll` | `python tools/preroll.py render/mv.mp4` | share version with the warning card + description text (only when there are warning ranges) |
| `npm run preview` | `node tools/jizura_serve.mjs 5179` | preview player: open `…/engine/index.html?play` (keys on the HUD) |
| `npm run lineup` | `python tools/lineup.py` | all characters at one scale (+ `--bg` trial placements) → `render/lineup.jpg` |
| `npm run check:motion` | `python tools/motion_check.py render/mv.mp4` | static stretches ("slideshow" check) |
| `npm run check:lyrics` | `node tools/check_no_lyrics.mjs` | no lyric text outside `analysis/` |
| — | `python tools/art_grid.py assets/bg/<plate>.png` | labelled grid over a plate: read u, v for `pin` |

Every tool prints its options with `--help`. Without an NVIDIA GPU add `--codec x264` to `render_final.mjs`.
Palettes: edit `PALETTES` in `tools/style_palette_sheet.py`, then `python tools/style_palette_sheet.py` →
`assets/style/palettes.json`, LUTs and `docs/style_palettes.png` (`--plate assets/bg/<plate>.png` previews them on
one of your own backgrounds instead of the built-in dusk scene).

## 5. Environment variables

| variable | default | used for |
|---|---|---|
| `BROWSER_CHANNEL` | `msedge` (Windows), `chrome` (elsewhere); `chromium` = Playwright's own | render browser |
| `BROWSER_ANGLE` | `d3d11` (Windows), `metal` (macOS), Chromium default (Linux); `none` | GPU backend for WebGL |
| `PYTHON` | `python` / `python3` / `py -3` | Node tools that call Python, setup |
| `FFMPEG`, `FFPROBE` | `ffmpeg`, `ffprobe` on PATH | encode / mux / probes |
| `JIZURA_DIR` | `vendor/JIZURA` | an existing JIZURA clone (used as is; wins over `JIZURA_REF`) |
| `JIZURA_REF` | `fc16bfe43ea4a6c25a21f1caf04d17326de14f00` (tested) | JIZURA branch / tag / full commit sha that setup fetches (`main` = follow upstream; delete `vendor/JIZURA` to switch an existing clone, then re-check deny-lists and scheme indices) |
| `BLENDER`, `CODEX_BIN` | auto-detected | Blender shots, image generation |
| `FONT_DIRS`, `TORCH_DEPS_DIR`, `GITHUB_TOKEN` | — | Blender fonts, forced-alignment deps, font-download rate limit |

## 6. Troubleshooting

- **WebGL renderer is SwiftShader / WARP** (`check_env.py --webgl`): renders are ~10× slower. Update the GPU driver,
  try `BROWSER_ANGLE=gl` (or `vulkan`, `d3d11`), or another `BROWSER_CHANNEL`.
- **Browser fails to launch**: install Edge or Chrome, or `npx playwright install chromium` and `BROWSER_CHANNEL=chromium`.
- **`npm install` fails with EPERM on `npm-cache`** (a locked global cache): `npm install --cache ./.npm-cache`, delete
  `.npm-cache`, re-run setup.
- **NovelAI: `NOVELAI_API_KEY is not set`** → set it in your own shell (`setx NOVELAI_API_KEY "<token>"`, new terminal); never in a project file. HTTP 402 → subscription / Anlas (sizes > 1 MP, > 28 steps and references cost Anlas).
- **Grok images never start** when called from Python: run `bash tools/grok_run.sh` from a shell (`references/04` §11).
- **`setup.ps1` cannot be loaded** (execution policy): run it as `powershell -ExecutionPolicy Bypass -File setup.ps1`.
- **Font download hits the GitHub rate limit**: set `GITHUB_TOKEN`, or `-FontsFrom` / `--fonts-from` another project.
- **No network for JIZURA**: clone it elsewhere and set `JIZURA_DIR`, then `node tools/build_jizura_bundle.mjs`.
- **Frames differ between render workers / flicker at 1/3 and 2/3 of the film**: something in a scene depends on
  wall-clock time, unseeded randomness or state from the previous frame (`references/05-engine.md`).
- A tool prints `1 page errors/warnings`: read the line above it (missing asset path, JIZURA plan name …).

## 7. Credits and licences

- Engine, scenes, tools, demo song and demo lyrics: vocaloid-style-mv-pipeline by **NikusonP**, MIT licence. The demo lyrics
  (`demo/lyrics_demo.lrc`) and the synthesized demo song are original and free to use.
- [JIZURA 字面](https://github.com/852wa/JIZURA) (c) 2026 hakoniwa (github.com/852wa), MIT — fetched by setup,
  not vendored; keep `jizura/app/JIZURA_LICENSE.txt` with any bundle you redistribute.
- Fonts: Google Fonts families under the SIL Open Font License (`engine/fonts/OFL_*.txt`).
- Interface style: adapted from world-execute-me-lyric-mv by **Nyankomint** (code MIT). Signal style and the other
  mv-studio additions: MIT. Inter, IBM Plex Mono: SIL OFL.
- Your song, lyrics and generated art belong to their authors: credit them on screen and in your README.

---
Author: **NikusonP** · vocaloid-style-mv-pipeline (MIT)
