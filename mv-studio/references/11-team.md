# 11 — Team mode: a lead and parallel builders (how the reference films spent their budget)

Use this when the user wants the film at the level of the reference films and accepts the cost (`references/10` §0,
§9). It is the production process of *dalabengba-mv* (≈48 agents, 20–25 M tokens, 14 h for 3:28), adapted to this
engine; PDoomVideo and world-execute-me ran smaller versions of it (a lead + one agent per chapter / section).

**Before starting, tell the user the estimate and get a yes:**

| song | agents | tokens | wall clock |
|---|---|---|---|
| ≤ 1:30 | 12–20 | 4–8 M | 4–6 h |
| 3–4 min | 30–50 | 15–25 M | 8–14 h |

Scaffold with `new_project.py … --mode team`. Commit at the end of every phase (`git add -A && git commit`): when a batch
of agents dies on a usage limit, the half-finished edits can be compared with the last commit.

## 1. Roles

| role | does | never does |
|---|---|---|
| **lead (integrator)** — you | setup, timing, cues, the brief, the engine smoke test, the block list in `timeline.js`, starting and messaging agents, `docs/INTEGRATION_NOTES.md`, deciding conflicts, the integration fixes, the renders and the report | draws the film itself (beyond fixes) |
| storyboard proposers ×3 | a full storyboard each, from one stance | code |
| judges ×2 | score the proposals, list the best ideas and the mistakes to avoid | code |
| synthesiser (×1–2) | the final `docs/STORYBOARD.md`, `docs/ASSETS.md`, `plan/blocks.json` | code |
| asset builders (one per pack) | a rig / set / props / UI / effects pack, its model sheet, its API note | touch other packs, blocks or core |
| seam writer (if the film has invisible seams) | `engine/blocks/_seams.js` + its sheet | blocks |
| block builders (one per block) | `engine/blocks/<id>.js` (+ `engine/blocks/<id>/`) | shared files |
| reviewer-fixers (one per block, optional) | review a block against the storyboard, fix P0 / P1 | other blocks |

Start agents in the background (the Agent tool with `run_in_background`), one per pack or block; the lead stays
responsive, reads their reports, and sends running agents new information (`SendMessage`), e.g. "the UI pack is in:
call `PC.dialog(g, …)` like this".

## 2. Phases and gates

| # | phase | who | output | gate |
|---|---|---|---|---|
| 0 | setup | lead | project, `analysis/*` (timing, cues), `docs/BRIEF.md`, the style's smoke render | phases 0–1 of `references/01`; `analyze_audio.py`, `check_sync.py --lyrics-only` |
| 1 | storyboard | 3 proposers → 2 judges → synthesiser | `docs/design/proposal_{A,B,C}.md`, `judge_{1,2}.md`, `docs/STORYBOARD.md`, `docs/ASSETS.md`, `plan/blocks.json` | the lead reads the global rules and two blocks: can they be built? every cue has a picture? |
| 2 | asset library | one builder per pack, in parallel | `engine/styles/<film>/<pack>.js` (or `engine/blocks/_lib/`), `engine/sheets/<pack>.js`, `docs/api/<pack>.md` | every sheet looked at ≥ 2 rounds; the lead's lineup sheet (§4) |
| 3 | seams | seam writer, in parallel with 4 | `engine/blocks/_seams.js` (state at each invisible seam) + `engine/sheets/seams.js` | each seam's two sides match (`pops.mjs` across it) |
| 4 | blocks | one builder per block, in parallel | `engine/blocks/<id>.js`, `docs/blocks/<id>.md` (shot table, differences, problems, requests, **progress log**), `render/review/<id>/` | `lint.mjs`, `?only=<id>` stills, cue sheet, `pops.mjs` on the block |
| 5 | review + fix | reviewer-fixer per block (recommended) | `docs/review/<id>.md` (P0 / P1 / P2), fixes | the P0s are gone |
| 6 | integration | lead | the full film | `storyboard.mjs`, `check_shots.mjs`, `pops.mjs`, `cues_sheet.mjs`, full render, `check_flash.py`, `motion_check.py`, `check_sync.py` (09 §7) |
| 7 | revision round | lead → builders | `docs/REVISION.md` per section: keep / wrong / measured times / where in code | as phase 4–6 |
| 8 | jury, two rounds | a juror that built nothing (another model, or a fresh agent) → lead → builders | `docs/review/jury-{1,2}.md` + `.json` (09 §8): scores, critical issues, fixes by impact with shot ids; the lead splits the fixes into `docs/REVISION.md` per block | every critical issue gone; round 2 done |

## 3. Engine side: blocks

`core/blocks.js` lets each builder own one file. The lead's `engine/timeline.js` only lists the blocks:

```js
Z.setup = async (audio) => {
  const beat = 60 / (audio.bpm || 120), END = audio.music_cut || audio.duration;
  const B = n => (audio.bars.find(b => b.index === n) || {}).start, nb = t => audio.beats.reduce((b, x) => (Math.abs(x - t) < Math.abs(b - t) ? x : b), audio.beats[0] ?? t);
  // the style's install / look, shared HUD and VERTICAL_CFG are the lead's: set them here, once
  await Z.loadBlocks(['b01', 'b02', 'b03', /* … from plan/blocks.json */]);
  Z.SHOTS = Z.blockShots({ audio, beat, END, B, nb, cue: Z.cue, L: Z.LYR });
  window.__zankoMeta.duration = END + 3;
};
```

- A block file (`engine/blocks/_template.js`) registers `Z.block(id, { t0, t1, shots(ctx) })`; its shot ids start with
  the block id, its private scenes are named `<id>_xxx`, its range comes from cues / bars, never raw seconds.
- A builder renders only its block: `node tools/stills.mjs --url "engine/index.html?only=b05" --times … --out
  render/review/b05`. Several builders can render at once (each writes only under `render/review/<id>/`).
- A block that is missing or throws is reported (`[block] …`) and left out; `storyboard.mjs` then fails on the gap, so
  nothing broken ships silently.
- **Transitions:** the later block draws the transition (its first shot starts before the earlier block ends, with
  `trans`); the earlier block keeps acting until its end. **Invisible seams** (same place and camera): both blocks read
  the state from `_seams.js` and land on / start from it.

## 4. The shared contracts (every agent reads them)

- `docs/BRIEF.md` (the lead): hard rules (pure code or which art; the picture follows the cues, accent ≤ 0.15 s after
  the cue; no lyric text in code or on screen beyond what the style allows; deterministic; motivated cuts only), the
  style, the cast (each with its silhouette idea), the world map and screen direction, the colour script by section,
  the story beats, the motion principles and the continuity devices (`references/10` §4–6).
- `docs/STORYBOARD.md` (the synthesiser): visual thesis, colour script, global rules (scale table, framings, impact
  levels, direction rule, lyric band, timing rules, transition rules, performance budget), **fixed layouts of every
  recurring place with coordinates**, then 14–17 blocks of 8–18 s, each: id, file, range, cues, one-line summary,
  entry state, shot-by-shot table (time | line | shot in phases | out), exit state, handover to the next block; the
  running gags table; recurring props and set-ups; a cue coverage table; risks and fallbacks.
- `docs/ASSETS.md`: per pack — files, exported functions with signatures and parameter tables, coordinate conventions,
  the poses / states / variants the storyboard needs (counted from it), acceptance criteria for its model sheet. §0 is
  the common convention: `drawX(g, o)` with `x, y` = the feet in world coordinates, `s` (1 = full-shot height), `face`
  ±1, `t` for secondary motion, `pose` / `expr` enums with `{ from, to, k }` blending, `joints` / `jointsAdd`,
  `detail: 0`, `silhouette`, returns anchors; save / restore inside, no layers inside; palette only; one face
  construction (`Z.rig.face`); built on `Z.rig.biped` or the style's rig.
- `docs/api/<pack>.md` (each asset builder, from the code): 1 exports, 2 coordinates and anchors, 3 functions with
  parameter tables and defaults, 4 every enum value with the block that uses it, 5 3–6 copy-paste usages, 6 differences
  from ASSETS.md, 7 known limits, 8 its sheets.
- `docs/INTEGRATION_NOTES.md` (the lead): decisions and pitfalls reported by asset builders, global and per block
  ("the scarf hangs off narrow balconies: shorten it with `scarfLen`"); block builders read it before starting.

**The lineup check (lead, after phase 2):** one sheet with the whole cast at s = 1 on one ground line with the height
line, plus trial placements in two sets. It finds what no single pack builder can see.

## 5. Rules for block builders (put them in every block prompt)

1. Read, in order: `docs/BRIEF.md`, the block's section of `docs/STORYBOARD.md` + the global rules + the neighbours'
   handovers, `docs/INTEGRATION_NOTES.md`, the `docs/api/*.md` it uses and their sheets (`render/sheets/*`).
2. Write only `engine/blocks/<id>.js`, `engine/blocks/<id>/`, `docs/blocks/<id>.md`, `render/review/<id>/`. A missing
   pose: nearest pose + `jointsAdd`, or draw it locally, and write a request.
3. Pure functions of t; `Z.rnd` / `Z.hash` for randomness; `node tools/lint.mjs engine/blocks/<id>.js` after every edit.
4. Timing: one accent per cue at cue + 0–0.15 s, anticipation before, follow-through after; instrumental passages hold
   readable poses (other versions of the song may stretch them).
5. The polish rules of `references/10` §6 (composition, ≥ 3 depths, light from one side, palette, eased motion with
   follow-through, a camera that is always alive, everyone reacting, text rules, the lyric band, no dead 0.5 s).
6. Work in three passes and log each in `docs/blocks/<id>.md`: **A rough (~30 min)**: every shot exists, every cue has
   the right picture, timing right, no gaps; **B refine (~60 min)**: performance, depth, light, particles, impacts,
   transitions; **C polish (~30 min)**: every cue at full size, `pops.mjs`, the budget, another look. Do not wait for the
   neighbours.
7. Open every image you render (Read it) and check it against the storyboard; at least two full rounds.
8. Return: shot count and summary, differences from the storyboard, the seam / transition check, known problems,
   requests for the shared packs, 3–5 key frames.

## 6. Prompt templates (fill the `{…}`; every prompt names the project root, the files to read, the files it may write,
the rules, the checks and what to return)

**Proposer (×3, different stances)**
```
You are designing the storyboard of a music video for {song} in the mv-studio skill's {style} style ({style one-liner}).
Project root {ROOT}. Read docs/BRIEF.md, analysis/cues.json (lines by index; never quote lyrics), references/10-craft.md,
<skill>/styles/{style}/STYLE.md. Write documents only.
You are storyboard artist "{stance}": {A: continuity and camera — the film as one continuous take on paper: motivated
transitions, handover states, layers of depth, colour bridges | B: comedy and performance — the gags of every line,
how the running gag escalates each time, acting, type as a performer | C: production — what can be built well in this
engine, reuse, fixed layout coordinates, the list of poses / props / sets, how to split the work}.
Write docs/design/proposal_{X}.md: 1 thesis + ≤ 8 selling points; 2 colour script; 3 a shot table covering 0–{END}
with no gaps (shot, cue + time, length, place, framing and camera move, what happens in phases, text in frame, depth
layers, the exit: type + motive + who draws it); 4 continuity (map / route, screen direction, the recurring prop,
shape matches, camera system, fixed layouts); 5 the running gags, escalating per repeat; 6 the 5 hardest shots and how
to avoid failing them. Return the path, the thesis, your 5 best ideas.
```

**Judge (×2)**
```
{same background}. You are judge {N}, viewpoint: {1: director and audience — fit to each line, continuity, laughs,
emotional curve, the climaxes | 2: production and consistency — can it be made polished in this engine, reuse, one
style, block handovers, performance}. Read the three proposals. Score each 1–10 on fit, continuity, fun, buildable
polish, consistency, with reasons. List the 12–20 best ideas (source, time, why), 8–12 mistakes to avoid, and a
skeleton for the final storyboard (which proposal is the base, what to graft). Write docs/design/judge_{N}.md.
```

**Synthesiser (two steps: split it, one agent doing all of it took 3 h in dalabengba)**
```
{same background}. You are the director. Read the three proposals and two judgements.
Step 1 → docs/STORYBOARD.md §1–4: thesis, colour script, global rules (scale table, framings, impact levels,
direction, lyric band, timing and transition rules, performance budget), fixed layouts of every recurring place with
coordinates. Step 2 → §5–10: 14–17 blocks of 8–18 s (range on cues or natural cuts) each with id, file
engine/blocks/<id>.js, range, cues, summary, entry state, shot table (time | line | shot in phases | out), exit state,
handover (both sides of every handover must agree); the gags table; recurring props; cue coverage; handovers + shared
functions; risks and fallbacks. Also docs/ASSETS.md (per pack: files, signatures, parameters, conventions, the poses
and states counted from the storyboard, sheet acceptance criteria; §0 the common convention of references/11 §4) and
plan/blocks.json ([{ id, file, title, cues, summary, entry, exit, handoff_next }]).
```

**Asset builder (one per pack)**
```
You build the asset pack "{pack}" for a mv-studio music video ({style}). Project root {ROOT}.
Read docs/BRIEF.md, docs/ASSETS.md (§0 + your section), docs/STORYBOARD.md §2–4 (and grep §5 for shots that use your
pack), references/10-craft.md §2–5, the engine API (references/05 §12; Z.rig in engine/core/rig.js).
Write only {files}, the sheet engine/sheets/{pack}.js and docs/api/{pack}.md. Pure functions (t drives secondary
motion); save / restore inside, no layers inside; the film's palette only; the one face construction; rigs on
Z.rig.biped with every pose / expression / state the spec lists, `joints`, `detail: 0`, `silhouette`, anchors.
Process: implement → sheet (every pose in both facings, expressions, states, cycles at 8 phases, the closest zoom the
film uses, the variants) → node tools/stills.mjs --url "engine/index.html?tl=sheets/{pack}.js" --times … --out
render/sheets/{pack} → open every image and compare with the acceptance criteria → fix → at least two full rounds →
write the API note (references/11 §4, 8 sections). WRITE THE API NOTE DRAFT EARLY (an interrupted run keeps it).
Polish is the first requirement. Return: files, sheet paths, the API note, differences from the spec, open problems.
```

**Resume after an interruption**
```
You take over the {pack | block} "{name}". The previous agent did most of it and stopped (usage limit / error) before
it finished. Your job is to finish and deliver, not to redo. Current state (checked by the lead): {lint / sheet /
storyboard results}. What the previous agent was doing when it stopped: {its last messages}. Steps: 1 note the start
time, budget ~40 min; 2 read the files and the latest sheets; 3 write / update the delivery note at once; 4 finish the
interrupted change, render and look; 5 close small gaps the blocks need now without changing signatures or defaults;
6 delete your temporary files; 7 lint + checks pass, final sheet, final note.
```

**Seam writer**
```
{background}. {n} handovers are invisible seams (same place, same camera, no overlap): the last frame of one block and
the first of the next must match. The two builders cannot see each other's code, so write each seam's full state as
data: engine/blocks/_seams.js with SEAMS = { 'b04|b05': { T: c => c.cue('N1a'), place, cam, drift, light, actors:
[{ fn, params }], props, ui, fx, motion: 'what is moving across the seam', notes } } and drawSeam(g, t, key) as a
reference renderer; a sheet engine/sheets/seams.js; docs/seams.md (each seam: the picture, how the earlier block lands
on it, how the later one starts from it, how to check it). The state must match the storyboard at that moment;
decide what it leaves open in favour of the smoothest handover.
```

**Block builder (one per block)**
```
You build block {id} "{title}" of a mv-studio music video ({style}, 1920×1080, pure code animation). Project root
{ROOT}. {n} builders work at the same time; the asset packs are done and documented.
Before starting, read: references/11-team.md §5 (follow every rule), docs/INTEGRATION_NOTES.md (global + {id}),
the "{id}" section of docs/STORYBOARD.md and its global rules, the docs/api/*.md you use and their sheets.
Your block: file engine/blocks/{id}.js; range [{t0 expr}, {t1 expr}); cues {cues}. Entry: {transition you draw /
seam}. Exit: {who draws it; you act until your end}. Focus: {the block's climax, hits, traps}. Risks: {storyboard §10}.
Seams: {key, time}; until _seams.js exists build the middle of the block first.
Work in passes A / B / C, logging each in docs/blocks/{id}.md. Write only your files. Render with ?only={id}.
Return: shots and summary, differences from the storyboard, seam / transition check, known problems, requests,
3–5 key frames.
```

**Reviewer-fixer (one per block; the reference film skipped it under time pressure and regretted it)**
```
You review and fix block {id} (you did not write it). Against docs/STORYBOARD.md and docs/BRIEF.md render the cue
sheet, a contact sheet every 0.25 s, key frames, the seams and pops.mjs, and check every cue: is the picture what that
line is about, does the accent land 0–0.15 s after the cue, composition / depth / light / colour / performance, text
rules and the lyric band, seams and transitions, errors and gaps. Write every problem to docs/review/{id}.md as P0
(wrong picture / wrong time / broken seam / rule broken / error), P1 (clearly not polished), P2 (nice to have), then fix
them in that order, re-check, update docs/blocks/{id}.md. Change only this block's files.
```

## 7. Lessons from running it

- **All background agents can die at the same moment** (a gateway error, a usage limit). Ask every agent to write its
  delivery note and progress log first and keep it current; after a crash, read the tail of each agent's transcript and
  start a "resume" agent with it (§6); run the checks before trusting any report.
- Builders that cannot change shared files keep the film coherent; collect their requests and fix the packs once.
- One synthesis agent for a whole 3-minute storyboard is too slow: split it (global rules + layouts / blocks).
- The lead's lineup and integration notes save more time than any single fix: write pitfalls down the moment an agent
  reports one, and message the builders it affects.
- When the user wants delivery, broadcast a deadline: "stop polishing; cover every cue, no errors, seams aligned,
  delete temporary files, write the note; if it does not close, fall back to the last version that renders".
- Text written through tools can come back with U+FFFD (lost CJK characters): `lint.mjs` reports MOJIBAKE; fix with a
  context regex, not by retyping blind.
