---
name: mv-studio
description: >-
  Make an original music video (MV / PV / lyric video) for a song from its audio and lyrics, rendered by a
  deterministic Canvas2D/WebGL2 engine, in one of four styles or a mix: VOCALOID (ボカロPV: 手書き illustration with an
  original character, JIZURA kinetic lyrics, optional toon 3D, or a failing recorder with fast cuts, heat grade and
  analog tearing; 文字PV, V家手书, glitch, 故障风, 疾走感); INTERFACE (the song as a chat on a screen, or as plates from a
  technical treatise: charts, forms, maps, per-word kinetic type; drawn in code); STAGE (a watercolour picture-book stage
  show with an original puppet troupe; cute, 绘本风); PAPERCRAFT (a pop-up paper storybook as a retro RPG). Beat-locked editing, art from Codex /
  Grok / NovelAI, flash / motion / no-lyrics-in-code checks, 9:16 version. Use whenever the user wants an MV, PV, lyric
  video or beat-synced animation for a song ("make an MV for my song", "给这首歌做个MV", "この曲のMVを作って", "a lyric
  video like a chat log"), even with only a .wav/.mp3. Not for editing existing footage.
---

# mv-studio — lyric MVs in four styles

This skill turns **a song + its lyrics** into a finished lyric MV (16:9 master, 9:16 vertical, share encodes). It is
built on **vocaloid-style-mv-pipeline** by **NikusonP** (MIT) — the engine, tools, scene library, JIZURA lyric layer,
Blender shots and the method references come from it — and adds two more **style packs** and the checks from our own
eval rounds. Credits and licences: `NOTICE.md`.

**The goal is a film of similar craft, not a copy.** Every song gets its own concept, palette, motifs and storyboard
from *its* lyrics and structure. The case studies behind each style are worked examples; reusing their look, story,
characters or copy defeats the point (and some of their material is not ours to reuse).

## Pick the style first (it changes the whole pipeline)

| style | what the film IS | pictures come from | lyrics are set by | read |
|---|---|---|---|---|
| **vocaloid** (default) | the ボカロPV tradition, two treatments: **tegaki** (default) — an illustrated story with an original character; light, colour script, signature set pieces; **signal** — a recording device failing: speed is editing, heat colours everything, the signal decays | tegaki: generated character + backgrounds (+ Blender toon 3D); signal: generated neutral images + code fillers | tegaki: JIZURA plans (+ custom type scenes); signal: the device's type (vertical mincho, beat-stamped lines, big WORD frames) | `styles/vocaloid/STYLE.md` |
| **interface** | the song set on a screen or a page, two treatments: **screen** (default) — a conversation: "me" (the singer) talks to "you" (never shown), the client reacts; **treatise** — plates from an illustrated technical treatise, each its own idiom (chart, oscilloscope, form, map, prompt, engraved 3D form, hairline field), one spark and one running number tie them together, deadpan | code (chat UI, plates, scene shaders with engraving shading, GPU hairlines, pen-written single-stroke type, Swiss typography); optional generated three-ink silhouettes printed from their ink plates | screen: lines are messages, keywords become plates; treatise: per word, set into each plate its own way | `styles/interface/STYLE.md` |
| **papercraft** | a pop-up paper storybook told as a retro RPG: a quest across cut-paper lands, a map with a red route, battles, LV UP | code (cut paper, multiplane camera, paper RPG interface); no generated art needed | the dialogue box: lines typed as sung | `styles/papercraft/STYLE.md` |
| **stage** | a watercolour picture-book show: an original puppet troupe acts every line as a cartoon gag; choruses return to the same stage, bigger each time | code-painted (watercolour + ink puppets, sets, props); optional generated picture-book cut-outs | a painted karaoke bar; a few big sound effects | `styles/stage/STYLE.md` |

Choose from the user's words ("chat", "terminal", "UI" → interface (screen); "diagram", "infographic", "chart",
"technical", "deadpan", "kinetic typography" (no character) → interface (treatise); "glitch", "fast", "VHS", "疾走",
"signal" → vocaloid (signal); "cute", "cartoon", "watercolour", "picture book", "mascot", "stage show", "绘本" → stage;
"paper", "pop-up book", "RPG", "adventure", "fairy tale", "剪纸", "童话" → papercraft; "illustrated", "anime girl",
"手書き", "ボカロ", "V家", or nothing said → vocaloid (tegaki)) and from the song (a song addressed to someone / about
machines → interface (screen); a song about an idea, science or technology, with no character → interface (treatise); a
frantic, high-BPM song → vocaloid (signal); a funny, bouncy or novelty song → stage; a story song with a quest, a journey
or a fairy tale → papercraft; a story or a ballad → vocaloid (tegaki)). When the user names none and the song fits two,
say which you picked in one line and why. Styles and treatments can be **mixed by section** — all scenes live in one
engine (e.g. a tegaki film whose bridge collapses into signal with `Z.SIG.spans`, or a chat film whose chorus cuts to
treatise plates). Scaffold with `--style vocaloid | vocaloid:signal | interface | interface:treatise | stage | papercraft`.

## What you have

- `template/` — a complete project: engine (`engine/core`), scene library (`engine/scenes/*.js`, vocaloid's tegaki), **style
  packs** (`engine/styles/signal/` (vocaloid), `engine/styles/interface/` + `engine/styles/treatise/` (interface),
  `engine/styles/stage/`, `engine/styles/papercraft/`), starters (`engine/starters/`), JIZURA adapter, all tools
  (`tools/`), Blender scripts, palettes/LUTs, a procedural demo song.
- `scripts/new_project.py` — scaffold (`--song --lyrics --title --title-sub --artist --credit --style --setup`);
  `scripts/check_env.py` — what's installed.
- `styles/<style>/STYLE.md` — the concept, grammar, API and review checks of each style.
- `references/` — the method (table at the end). The 残光 case study (tegaki) lives in the base repo:
  https://github.com/EGSECDA/vocaloid-style-mv-pipeline/tree/main/examples/zanko

## Requirements

Required: Node 20+, Python 3.10+ (numpy, librosa, scipy, soundfile, pillow, matplotlib), ffmpeg/ffprobe, Edge or Chrome.
Optional: NVIDIA GPU (NVENC; without it pass `--codec x264`), an image generator — **Codex CLI** (`tools/imagegen.py`),
**Grok Build CLI** (`tools/grokgen.py` + `tools/grok_run.sh`), **NovelAI** (`tools/novelaigen.py`, key in the env var
`NOVELAI_API_KEY`) or any tool plugged in as "custom", all behind `tools/artgen.py` — Blender 5.x (vocaloid 3D), the
lyric-alignment set.
Run `python <skill>/scripts/check_env.py` first and tell the user what is missing and what it costs ("no Blender → the
3D moments become 2.5D", "no image generator → interface style, or the user's own art").
**Art sources are the user's choice, never hard-coded.** `python tools/artgen.py providers` shows what is available;
ask the user which generator they want (once, or per kind of asset) and record it (`artgen.py use <name>` or
`new_project.py --art`). Never ask the user to paste an API key or a password into the chat and never write one into
a file: the CLIs use the user's own sign-in, NovelAI reads `NOVELAI_API_KEY` from the user's environment. If a key
shows up in the chat anyway, store it nowhere; tell the user to set the env var themselves and to rotate the key.
With no generator at all, interface, stage or papercraft (all code-drawn) are the natural styles.

## Workflow (phases; each ends with files on disk and a check that passes)

Details, commands and gates: `references/01-workflow.md` (phase table first); per-style differences: the style's
STYLE.md; the check order: `references/09` §7. Commit the project at the end of every phase (it is a git repo).

0. **Intake + scaffold** — style (above), image generator (`artgen.py providers`, the user's choice), credit line, and
   the **scale**: solo, or team mode at the reference films' level (`references/10` §9, `11`; tell the user the cost first).
   `python <skill>/scripts/new_project.py <dir> --song <song> --lyrics <lyrics> --style <style> [--art <gen>] --title …
   --credit "Music / Lyrics / Movie：<artist>" --setup`. npm can fail on a locked global cache: `npm install --cache
   ./.npm-cache` in the project, then re-run setup. Reuse fonts: `--setup-args "-FontsFrom ../<other>/engine/fonts"`.
1. **Timing ground truth** — `python tools/analyze_audio.py` → `audio.json` (beats, a constant-tempo fit when the song
   is metronomic, bars, sections, stops, impacts, kick / snare / vocal onsets) + `overview.png` (look at it). Lyric
   times, best tier first: official timed LRC → the producer's score (`tools/score_timing.py`) → forced alignment
   (Japanese, `references/03` §9) → tapped in `tools/lyric_editor` → estimate (`tools/estimate_lrc.py`).
   `python tools/lyric_timing.py status` shows each line's tier; tell the user which are estimated, and run
   `python tools/check_sync.py --lyrics-only` (are the lines on the right phrases?). Then
   `python tools/make_cues.py` → `analysis/cues.json`; write a picture hint (your words) for every line cue.
2. **Direction** — `docs/BRIEF.md` (hard rules, style, cast, colour script, motion, "not in this film") and
   `docs/CONCEPT.md` (thesis, frame and arc, what escalates each chorus, signature moments, how each section sets its
   lyrics). **Checkpoint:** a few lines to the user before generating art.
3. **Plan as data** — write the shot list straight into `engine/timeline.js` from the starter: every shot has
   `moment` (what it shows, why), `line` (the lyric line it answers) and, where it belongs to one, `cue`. Cuts come
   from the grid (`B(n)`, `nb(t)`, `Z.cue('L07')`, `Z.SIG.cuts`). `node tools/storyboard.mjs` writes
   `docs/STORYBOARD.md` + `plan/shots.json` and must PASS (every sung line shown, cuts on the grid / their cue, no gaps).
4. **Assets** — build the library before the shots, each asset checked on a model sheet (`engine/sheets/`, `references/10`).
   Generated art: one table (`tools/gen_table.py`); a character's expressions from one expression sheet (vocaloid STYLE.md).
   The style's list (STYLE.md): vocaloid = character bible + master + poses + backgrounds (tegaki), neutral
   images for full / crop / silhouette framings (signal); interface = code-drawn (screen: write the user's lines and
   system copy; treatise: write the deadpan copy and the number); stage = code-painted (design the
   troupe; optional picture-book cut-outs); papercraft = code-drawn
   cut paper (design the cast with PC.doll, the lands and the quest). `tools/artgen.py run` (`references/04`
   §11–13); **look at every check sheet**; missing pictures go into `docs/WANTED_ART.md`. Cut-outs: `alpha_matte.py`
   (`redraw` = mask from a green redraw, `--seal` for light-on-light); 2+ characters: `tools/lineup.py`.
5. **Build** — adapt scenes, write new ones for signature moments; one test timeline per new scene
   (`engine/tests/<name>.js`). After every change: `node tools/lint.mjs`, `node tools/check_shots.mjs`; stills and
   `node tools/cues_sheet.mjs` (one labelled frame per line: is it the picture for that line?). Around a change to a
   shared file: `node tools/regress.mjs snap before|after` + `python tools/compare_sheets.py before after`.
6. **Review** — `node tools/pops.mjs` (unplanned jumps, short flashes), full render, review sheets, then on the file:
   `check_flash.py` (must PASS), `motion_check.py` (static ≤ 10 %), `check_sync.py` (audio, cut frames, lyrics vs voice).
   Then the jury, two rounds (09 §8): `tools/jury_pack.py`, a session that did not make the film scores it against the
   style's Signature features and lists fixes by impact; revise (`docs/REVIEW.md`: applied / skipped), re-check, repeat
   once. Log the rounds in `docs/PROGRESS.md`
   (built, departures from the brief and why, ten places to check by ear).
7. **Deliver** — master, share encode (`tools/preroll.py` adds the warning card when `check_flash` lists warning
   ranges), 9:16, previews, credits (`references/08`). Review any time with `npm run preview` (`?play`, keys). Report what was verified and what is
   uncertain (estimated lyric timing, unchecked art), with the check results.

## Principles (why they matter)

- **Pure function of song time.** Parallel workers seek arbitrary frames: no wall clock, no unseeded randomness (`Z.rnd`,
  `S.rng`), no state carried between frames.
- **The beat grid is law.** Real beat/bar times from `audio.json`, never `n * 60 / bpm`.
- **Nothing is ever still.** Every shot has a camera move, drift, typing, particles or a cursor; the motion check
  (`motion_check.py`) fails a film that reads as a slideshow. Quiet ≠ static: slow and small, but alive.
- **Things stand on something.** A cut-out placed by eye floats. Read surfaces off the plate (`tools/art_grid.py`), pin
  props to them (`pin: [u, v]`), give contact shadows (`ground`), sink floating things into water (`water`), and match
  the scene's light (`tint`). Generate things that must touch in ONE image when you can.
- **Light is light, not a ball.** Suns, lamps and neon are `D.softLight` / `fx: 'light'` halos, pinned to the painting;
  a hard-edged gradient disc reads as a glass marble. Moving things travel on arcs with anticipation (`D.travel`).
- **Compose every frame.** Subject on a third, foreground / mid / background layers, a leading line, the lyric in a
  quiet zone; the last frame of the film is a composed picture, not an object alone in the middle of nothing.
- **Type has range.** Vary scale, layout, entrance and emphasis per section; keywords are the visual peak of their phrase;
  never one treatment for a whole film. Lyrics readable for ≥ max(0.7 s, 0.09 s × characters).
- **Colour carries story** (palette per section, interface states, signal heat) and changes on motivated events.
- **Safety:** ≤ 3 large-area flashes per second, no saturated-red flicker — fast-cut styles must pass `check_flash.py`.
- **Lyrics live in one file.** Code takes line indices (`Z.line(i).text`, `line: i` in scene args); docs of someone
  else's song stay index-only (`check_no_lyrics.mjs --strict`).
- **Original characters only.** Never imitate an existing character, real product UI or brand.
- **Measure timing, don't guess it.** Every lyric time has a recorded source; cut and lyric sync are measured on the
  rendered file (`check_sync.py`). An estimate is fine as a start, never as a silent final answer.
- **The plan is data.** Cues and shots carry their reasons (`hint`, `moment`, `line`) in files the checks read; the
  storyboard is generated from the timeline, so it cannot drift.
- **Look at every result.** Render stills, view them, critique like an art director, fix, repeat.

## Working style

Keep the user in the loop at the checkpoints (style + concept, art check sheet, first stills, first full render): a 3–6
line summary plus an image. Write files early (long runs can be interrupted); measure (ms per frame, flash and motion
reports) instead of guessing. Credit the artist on screen and in the README.

## References (read when the phase needs it)

| file | read when |
|---|---|
| `styles/<style>/STYLE.md` | always, for the chosen style(s) |
| `references/01-workflow.md` | starting a project; phases, commands, acceptance criteria, time budget |
| `references/02-creative-direction.md` | lyrics → concept, colour script, motifs, storyboard; variation matrix; bright films (§13); frame, arc, escalation (§14) |
| `references/03-audio-and-lyrics.md` | audio analysis, sections, lyrics, LRC markup; timing tiers, cues, offsets, score / editor (§12) |
| `references/04-asset-generation.md` | character bible, prompts, Codex / Grok / NovelAI generation (§11–13), chroma key, consistency |
| `references/05-engine.md` | engine API, layers, post, transitions, scene library; mv-studio additions (§12) |
| `references/06-jizura.md` | JIZURA lyric layer (tegaki) |
| `references/07-blender-3d.md` | toon 3D sequences (tegaki) |
| `references/08-render-and-delivery.md` | rendering, encodes, vertical 9:16, review tooling |
| `references/09-qa-and-lessons.md` | review checklist, failure modes; mv-studio checks (§6); the check order and P0 / P1 / P2 (§7) |
| `references/10-craft.md` | how the reference films reach their level: asset library first, rigs, sets, choreography and timing rules, density targets, model sheets, revision rounds, scaling to the budget |
| `references/11-team.md` | team mode: a lead + storyboard proposers, judges, asset builders, block builders and reviewers in parallel; `core/blocks.js`; the prompt templates; the budget table |
| `references/effect-cookbook.md` | motion / FX recipes, palette and typography systems, safety |

Base kit and 「残光」: **NikusonP** (vocaloid-style-mv-pipeline, MIT). JIZURA 字面: github.com/852wa/JIZURA (MIT).
Interface style: adapted from world-execute-me-lyric-mv by **Nyankomint** (code MIT). Signal style: an original
implementation inspired by a fan PV's "signal degradation" look (no code or assets from it). See `NOTICE.md`.
