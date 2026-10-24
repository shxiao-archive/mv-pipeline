---
name: mv-studio
description: >-
  Make an original music video (MV / PV / lyric video) for a song from its audio and lyrics, rendered by a
  deterministic Canvas2D/WebGL2 engine. Strongest in the ボカロPV tradition — 手書き illustrated stories with an original
  character, JIZURA kinetic lyrics (文字PV, V家手书), signal-decay / glitch cutting (疾走感, 故障风) — and also screen /
  chat lyric videos, technical-treatise kinetic typography, watercolour picture-book stage shows (绘本风), pop-up
  papercraft RPG storybooks and experimental print magazines (riso / 雑誌); styles combine freely. Beat-locked editing, art from Codex / Grok / NovelAI or the
  user's own, optional toon 3D, 9:16 version. Use whenever the user wants an MV, PV, lyric video or beat-synced
  animation for a song ("make an MV for my song", "给这首歌做个MV", "この曲のMVを作って", "a lyric video like a chat
  log"), even with only a .wav/.mp3. Not for editing existing footage.
---

# mv-studio

Turns a song + its lyrics into a finished MV (16:9 master, 9:16, share encodes). Built on vocaloid-style-mv-pipeline
by NikusonP (MIT), with style packs adapted from other MIT / ISC projects; credits and licences in `NOTICE.md`.

**Every film is its own.** By default the film designs its own style from the song: its own palette, type, shapes,
motion feel and pictures. A **preset** is used only when the user asks for it — by name ("vocaloid", "stage") or by
clearly describing its tradition ("a ボカロPV", "手書きMV", "a chat-log lyric video", "a pop-up book RPG"). A song that
merely sounds like a preset is not a request for it.

## Load only what the task needs

1. Always: this file and `direction.md` (the order of work, how to find ideas, what each part of a song is for, the
   concept file).
2. The style:
   - **no preset asked for (the default):** `design-a-style.md` — how to build an original visual identity and motion
     feel from the song; scaffold with the blank starter (`--style own`, the default);
   - **a preset asked for:** its brief, `styles/<preset>/BRIEF.md` (the feel, the art construction, the motion
     vocabulary of that tradition), and its starter as an example to rewrite:

     | preset | in one line | starters (`--style`) |
     |---|---|---|
     | vocaloid | the ボカロPV: lyrics as the subject, motion-graphics layers, rhythm-driven editing, limited animation, symbols over plot | `vocaloid`, `vocaloid:signal` |
     | interface | a digital-tech look: the song on an AI chat screen and on high-precision technical plates | `interface`, `interface:treatise` |
     | stage | a watercolour picture-book show by an original puppet troupe | `stage` |
     | papercraft | a pop-up paper storybook told as a retro RPG quest | `papercraft` |
     | magazine | a Japanese experimental print magazine: three-ink press, vertical type, editorial marks that keep time, the page's fate | `magazine` |

   **Techniques yes, looks no.** Any film may use single modules from the library (a transition, the lyric layer, a
   camera helper, the decay layer, a shape kit). A film that designs its own style never adopts a preset's look —
   its palette, type system or signature devices — and a preset film keeps to its own.
3. When you build, search the index first: `grep -i <words> index/index.jsonl` — one line per scene, transition,
   effect, helper, lyric plan and grade, with what it shows, the call, and `where` as `path:first-last`. Read that
   line range only (offset / limit), never a whole engine file. A pack's technical manual is
   `styles/<preset>/STYLE.md`: open the section you need.
4. A reference manual only when you enter its phase (table below).

## Workflow

Each phase ends with files on disk and its check passing; commit the project after each (it is a git repo). Show the
user a 3–6 line summary plus an image at the checkpoints (◆).

| phase | output | check | read |
|---|---|---|---|
| 0 setup | env report; the user's choice of art generator; credit line; solo or team | `python <skill>/scripts/check_env.py` | references/01 §0 |
| 1 listen | `analysis/audio.json`, `overview.png`, timed lyrics, `analysis/cues.json` | `python tools/check_sync.py --lyrics-only`, `tools/lyric_timing.py status` | references/03 |
| 2 direct ◆ | `docs/CONCEPT.md` (with the film's style), `docs/BRIEF.md` | the user's go | `direction.md`, `design-a-style.md` or the preset's BRIEF.md |
| 3 plan | the shot list in `engine/timeline.js` (`moment`, `line`, `cue` per shot) | `node tools/storyboard.mjs` | references/05 §3 |
| 4 art ◆ | generated / drawn assets on review sheets, `docs/WANTED_ART.md` | look at every sheet (`art_grid.py`, `lineup.py`) | references/04, references/10 |
| 5 build | the film's own `engine/scenes/<film>.js` + timeline | `node tools/verify.mjs --quick` | references/05, 06, 07 |
| 6 render ◆ | `render/mv.mp4`, stills | `node tools/verify.mjs render/mv.mp4` | references/08 |
| 7 review | jury pack, one jury round, targeted fixes | `node tools/verify.mjs render/mv.mp4` | references/09 §8 |
| 8 deliver | master, share encode, 9:16, credits | — | references/08 |

Scaffold: `python <skill>/scripts/new_project.py <dir> --song <song> --lyrics <lyrics> [--style <preset>] [--art <gen>]
--title … --credit "Music / Lyrics / Movie：<artist>" --setup`. A large film with parallel builders: references/11.

## Checks guard the craft, not the taste

`node tools/verify.mjs` runs the automated checks in order and prints only what fails, each with its fix: determinism
and lint, no lyrics in code, storyboard and grid, lyric safe area and overlaps, sprite swaps, and on a render: flash
safety, static stretches, sync, unplanned pops. A failure is a technical defect to fix; no check decides what the film
should look like. Taste is judged by a jury that did not make the film, against your `docs/CONCEPT.md`, whether the
film reads as its style, and general craft (references/09 §8).

## Laws of the engine (why they matter)

- **A pure function of song time.** Workers render frames in any order: no wall clock, no unseeded randomness
  (`Z.rnd`, `S.rng`), no state carried between frames.
- **The beat grid is real.** Beat and bar times come from `audio.json` (`B(n)`, `nb(t)`, `Z.cue('L07')`), never
  `n * 60 / bpm`.
- **Lyrics live in one file.** Code takes line indices (`Z.line(i).text`, `line: i`); docs refer to lines by number.
- **Measure, don't guess.** Every lyric time has a recorded source; tell the user which lines are estimated. Sync,
  motion and flashes are measured on the rendered file.
- **Look at every result.** Render stills, look at them like an art director, fix, repeat.

## Never

- Copy lyrics, characters, logos, product UIs or other material that is not the user's; the case studies teach method.
- Ask for an API key or password in chat, or write one into a file (NovelAI reads `NOVELAI_API_KEY` from the env).
  If one shows up in chat, store it nowhere and tell the user to set the env var and rotate the key.
- Choose the art generator for the user: `python tools/artgen.py providers`, ask once, record it.
- Ship without `check_flash.py` PASS; add a photosensitivity card when the film is intense.
- Forget the credit: the artist on screen and in the README.

Requirements: Node 20+, Python 3.10+ (numpy, librosa, scipy, soundfile, pillow, matplotlib), ffmpeg, Edge or Chrome;
optional NVIDIA GPU (else `--codec x264`), an image generator, Blender 5.x. `check_env.py` says what is missing and
what it costs ("no Blender → the 3D moments become 2.5D", "no generator → a code-drawn style or the user's art").
