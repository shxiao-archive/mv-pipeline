# 09 — QA: review loop, checklist, failure modes we hit

Contents: 1 The loop · 2 Checklist · 3 Failure modes & fixes (visual) · 4 Pipeline & tooling pitfalls · 5 Working with agents · 6 mv-studio checks · 7 Review order · 8 The jury (two rounds)

## 1. The loop

1. **Stills at shot midpoints** (fast, minutes): `node tools/stills.mjs --times <list> --out render/stills/passN --sheet passN`, then read the sheet image. For vertical: `--url engine/vertical.html --canvas vout` (the sheet keeps the 9:16 aspect).
2. **Dense stills where something moves** (transitions, stops, beat cuts): `--range 200:203.5:0.25`.
3. **Full render** (~4 min): `node tools/render_final.mjs --name mv`.
4. **Review sheets** from the MP4: `python tools/review_sheets.py render/mv.mp4 --step 1.8 --out render/reviewN` (5×5 timestamped frames per sheet). Portrait videos work the same (216×384 thumbnails): `python tools/review_sheets.py render/mv_vertical.mp4 --step 1.8 --out render/reviewN_v`.
5. Fix → re-render → re-review. Expect 2–3 full passes. Any change to a JIZURA plan's part pool re-rolls all its cuts, so re-check the whole film after curation edits.

A sampled black/odd frame in a sheet may be a *designed* beat (e.g. a 溜め black before the riff). Before "fixing", render dense stills around it.

## 2. Checklist (per pass)

- [ ] Lyrics readable for ≥ max(0.7 s, 0.09 s × characters); no light text on bright skies; nothing important hidden under the HUD.
- [ ] No lyric over the character's face/action in intimate shots (use the centre-free plan or text-behind).
- [ ] No opaque plates/cards/blocks from JIZURA covering the picture (see 06 §5).
- [ ] No dead air: no shot that is just black/grey without intent while the music plays.
- [ ] Exposure: bright scenes (dawn, flashes, white characters) not blown out — check bloom, glow fx, LUT mix and exposure together.
- [ ] Bright / daylight film (02 §13): lyrics in dark text wherever the sky is light (`schemes: 'light'` or `colors.enabled`, 06 §4); no milky bloom (threshold ≥ 0.9); no dusk tints leaking from scene and fx defaults (amber rims, `#140B1E` ink, the 残光 palettes, `kanjiSlam` without `sky: 'day'`); no additive particles clipping to white; no white flashes on white frames (use a colour flash or `invert`); the 9:16 surround and bands match the film's key (`Z.VERTICAL_CFG.ambience` / `schemes`).
- [ ] Flashes ≤ 3 per second; no saturated red full-frame flicker; fast stripes/spirals < 25 % of the frame.
- [ ] Cuts on beats/onsets; big hits on chorus downbeats; stops used (freeze/black/hold); the ending lands on the final cut.
- [ ] Character identical across shots; no green fringes; no cropped heads unless intended.
- [ ] Colour script reads: each section's palette is distinct and the arc is visible in the contact sheets.
- [ ] Transitions motivated (match shapes, barrier arms, shatter on impact), not decorative noise.
- [ ] Credits present (title lockup, outro, end card, 9:16 header artist and footer) and spelled exactly as given — no leftover demo title, subtitle or artist (`Z.TITLE`, `Z.TITLE_SUB`, `Z.ARTIST`, `Z.CREDIT`).
- [ ] Vertical version: graphic shots keep full composition; lyrics in the bands; header/footer not colliding.

## 3. Failure modes & fixes (visual) — all happened on 残光

| symptom | cause | fix |
|---|---|---|
| Crossword grid / mahjong-tile lyrics / speech-bubble pills | JIZURA pop/novelty layouts | curation deny-list (06 §5) |
| Full **yellow** or **black** frame with a lyric on it | JIZURA kinetic cameras (`knTiltKick`, `knCardFlip`, …) draw the cut as an opaque card | deny `kn*` cams |
| "SCENE 48 / CUT 121" slate, yellow highlighter boxes | `tyColophon`, `tyTextRule`, `marker`-type parts | deny |
| White extruded 3D box over a dark scene | layout `wall` (also `cylinder`, `cube`) | deny |
| Lyrics invisible at night | style scheme with a light background → dark text | `schemes: 'dark'` in the adapter; prefer gold/noir/mono |
| Giant lyric covers the kneeling girl (key action) | default plan | centre-free plan (`plan: 'cf'`) for that shot |
| Runner hidden behind a giant lyric | character drawn in the scene layer | also draw her into `S.fg` with the scene's transform (`S.fg.setTransform(ctx.getTransform())`) |
| 4 s of near-black / empty grey frames | JIZURA `full` mode during a lyric gap | replace with an illustrated shot; reserve `full` for dense typography moments |
| Dawn shots washed out, face blown | glow fx + screen tint + LUT + bloom stacked | lower glow (≈0.3), drop the screen tint, `bloom 0.3`, `bloomThreshold 0.8`, `exposure −0.12` |
| Climax burst wraps back to a night cut before the dawn shot | 7 beats, 6 cuts in the list | match cut count to beats; end the list on the target look |
| Burst never shifts night→dawn | arg name mismatch (`dawn: true` vs `grade: 'night2dawn'`) | read the scene's header comment for exact args |
| Glass cracks overpower the verse | full-intensity fx in a quiet section | scale fx per section (verse < chorus) |
| Over-busy pre-chorus | JIZURA noir + glitch + our CA | accept for tension, but keep the character readable |
| Vertical: title glyphs cropped | 6:5 centre crop on graphic shots | list graphic shots in `Z.VERTICAL_CFG.full` (whole 16:9 composition in the band) |
| Vertical: blurred ghost of title text in the ambience | ambience is a blurred copy of the frame | darken the ambience extra on FULL shots |

## 4. Pipeline & tooling pitfalls

| area | pitfall | fix |
|---|---|---|
| Codex images | worker can't see the generated file path → runner reports failure | read `~/.codex/generated_images/<thread_id>/` using the thread id from `codex exec --json` (tools/imagegen.py) |
| Codex images | `-i <FILE>...` swallows the positional prompt | pass the prompt on stdin (`-`) |
| Codex images | "lying down, seen from above" came back standing | make 2 takes of unusual poses; describe camera + body orientation very explicitly; check every image |
| JSON from PowerShell | UTF-8 **BOM** breaks `json.loads` | read with `utf-8-sig` |
| PowerShell | `$args` is reserved; `@('-vf', $x + ':flags')` splits wrongly (`,` binds tighter than `+`); string `.Replace` with `` `r`n `` misses LF files | use other names; parenthesise; prefer exact Edit tools or Python for file edits |
| Lyrics (ASR) | Whisper hallucinates 「ご視聴ありがとうございました」 on silence; misses lines; homophones (救って/掬って) | official lyrics as text, ASR/alignment only for timings; listen-check by aligning against the vocal stem |
| Lyrics | timings drift 0.3–0.7 s between a quick pass and forced alignment | re-time shot boundaries to aligned onsets (`nb(t)`) once alignment lands |
| Audio | fixed BPM assumption | tempo drifts; always use `audio.json` beats/bars |
| Engine | scene registry defined after scene files load | registries live in `core/util.js` (loads first) |
| Engine | WebGL in headless falls back to SwiftShader | Edge/Chrome channel + `--use-angle=d3d11 --enable-gpu --ignore-gpu-blocklist`; check `renderer` in `window.ready` |
| Render | progress can't be seen when output is piped | sample segment sizes / network or GPU counters, or tee the output |
| Upload | an ad link matched a loose URL regex → script stopped while the last file was at 47 % | strict pattern `https://NN.gigafile.nu/MMDD-<hash>`; verify each link's page (name + size) before sending |

## 5. Working with agents

- Give each agent **disjoint file ownership**, a test timeline, and the instruction to look at its own stills and iterate ≥3 times.
- Agents can be stopped by usage/session limits mid-run. They had written all scene files to disk before stopping; the lead reviewed, integrated and finished directly instead of re-running everything. Check the disk before re-running.
- The lead keeps the core (`engine/core`, `timeline.js`, `index.html`) and the creative direction; agents build scenes, assets and 3D.
- Visual review stays with the lead: read the contact sheets yourself before declaring anything done.

## 6. mv-studio checks (from blind reviews of eval films)

Run on every full render (and on clips of fast sections while building):
```bash
python tools/check_flash.py render/mv.mp4        # WCAG 2.3.1 approximation: general + red flashes <= 3/s -> PASS / FAIL (exit 1)
python tools/motion_check.py render/mv.mp4       # stretches where nothing moves (< 0.006 for >= 1.5 s); FAIL above 10 % (not counting the song's stops, the tail, `hold: true` shots; a slow push over a living face passes)
node tools/check_no_lyrics.mjs                   # lyric text only in analysis/ (code clean; --strict: docs too)
```
What reviewers flagged in films that passed every automatic check — look for these in the contact sheets:

| symptom | cause | fix |
|---|---|---|
| "a PPT", "a slideshow" | pictures held still behind slow crossfades | every shot moves: camera push / drift / parallax, typing, particles; motion_check |
| a train floating above its bridge, lanterns above the river | cut-outs placed by eye in frame coordinates while the plate pans | `art_grid.py` → `pin: [u, v]` on the plate, `ground`, `water`; or one image for things that touch |
| "the sun looks like a glass marble" | a bright gradient disc with an edge | `fx: 'light'` / `D.softLight` pinned to the painted sun |
| stiff, unnatural movement | linear moves at constant speed | eased arcs with anticipation / overshoot (`D.travel`), sway, secondary motion |
| a weak last shot ("a lone house") | the ending is an object in an empty frame | compose it: subject on a third, foreground + background, light, the motif's payoff |
| monotonous typography | one layout and one entrance for every line | vary per section (scale, layout, entrance, emphasis); keywords peak; custom type scenes |
| a story action you cannot see | the lyric's action happens in < 1 s or off-screen | ≥ 1.5–2 s, a clear before / after, set up in the previous shot |
| a cut-out in the wrong light | a white prop at dusk | `tint: { color: <the light>, a: 0.4-0.6 }` |
| unreadable lines in a chat / UI | the full window at 1:1 | camera on the thread; `sizes`; lines >= 40 px on screen |
| a fast-cut section fails check_flash | bright inserts, luminance jumps | dark inserts only, fewer per second, darker motifs, move the white flash |



## 7. Review order (mv-studio)

Automated first (cheap, catches the boring errors), then eyes, then an independent pass. Each must pass before the next.

| # | command | catches | when |
|---|---|---|---|
| 1 | `node tools/lint.mjs` | syntax errors, U+FFFD (CJK text lost in a write), `Math.random` / `Date.now` in engine code, lyric text in code | every change |
| 2 | `node tools/storyboard.mjs` | unknown scenes, black gaps, cuts off the grid, cuts far from their cue, sung lines no shot shows, shots without `moment`, unreadably short lines, line cues without hints; writes STORYBOARD.md | every edit of the timeline |
| 3 | `node tools/check_shots.mjs` | page errors per shot, black / flat frames, fonts that failed, character sprites swapped back and forth, lyrics outside the 90 % safe area while a cut's words hold, a JIZURA transition drawing two lines at once (LYRIC OVERLAP) (4 samples/s; `--sprite-fps 0` skips them; errors with `--strict`) | every edit |
| 4 | `node tools/cues_sheet.mjs` | the wrong picture for a line (look at it) | after the plan, after big changes |
| 5 | `node tools/pops.mjs` | JUMPs (an abrupt change inside a shot) and POPs (1-3 frames that flash and come back); a change on a beat, lyric cut or cue is a HIT, listed and allowed: never soften a hit to pass | before a full render |
| 6 | `node tools/regress.mjs snap a` / `snap b` + `python tools/compare_sheets.py a b` | a change to a shared file that altered finished shots | around every shared-file change |
| 7 | render → `check_flash.py`, `motion_check.py`, `check_sync.py` | flashes, stillness, picture / audio / lyric offsets | every render |
| 8 | contact / review sheets, read by the lead | everything else | every render |
| 9 | the jury, two rounds (§8): `tools/jury_pack.py`, an independent session scores and lists fixes → revise → back to 1 | what the builder no longer sees; film quality, not only correctness | before delivery |

P0 = wrong picture for its line, wrong time, a failing check, a page error, a broken brief rule or seam; P1 = not
refined; P2 = nice to have. Delivery needs P0 empty.

| symptom | tool | fix |
|---|---|---|
| `cut ... ms off the grid` | storyboard | place the cut with `nb()`, `B()` or `Z.cue()`; or `offgrid: 'why'` for a deliberate pickup |
| `sung at ... but no shot shows it` | storyboard | the shot over that line has `lyric: 'none'` and no line index in its args: show the line, or give the shot `line: i` with a scene that sets it |
| `BLACK frame` | check_shots | a scene that drew nothing (missing image, wrong time window); `allowBlack: true` only if intended |
| `JUMP` inside a shot | pops | a layer popping in without an entrance, a camera key with no ease, a parameter switching on a frame |
| `cuts median +1.5 frame(s)` | check_sync | beats or cues late (re-run analyze_audio; check timing.offset) |
| `lines N start INSIDE a sung phrase` | check_sync (`--lyrics-only` before rendering) | those lines are probably on the wrong phrase (bars counted wrong in an estimate): listen, move them in tools/lyric_editor |
| `lyrics best shift +150 ms` | check_sync | the LRC is early against the voice: estimated timing, or set timing.lyricOffset after checking by ear |
| changed frames outside the shots you edited | compare_sheets | the shared-file change leaked: fix it or scope it to the shots that need it |
| `overexposed ... s` | check_flash | most of the frame burnt white: a flash transition (`peak`, default 0.7), a light or glow that swells to fill the frame, bloom on bright type; lower it there |

## 8. The jury: an independent review in two rounds

The automatic checks prove a film is correct; they cannot say whether it is good. Before delivery the film goes through
**build → jury → revise → jury → revise** (the process of mg-styles-15, MIT, adapted to music videos). The jury is a
session that **did not make the film**: another model if the user has one (Gemini, GPT …), else a fresh Claude session
or a subagent started with no history. Never the builder judging its own film: it no longer sees what the film lacks.

1. Steps 1–8 of §7 green; `git commit` and `git tag review-1`; keep the render as `render/mv_r1.mp4`.
2. The pack: `python tools/jury_pack.py render/mv.mp4` → `render/jury/` (one contact sheet per section, filmstrips of
   every frame of 1 s at every chorus / hook and at `--hero t1,t2` (your signature moments), every frame around each shot cut and lyric
   cut and each flagged pop or flash, full-resolution stills, motion per second in `index.md`). Run
   `node tools/storyboard.mjs` first: it writes the lyric cut times to `plan/shots.json`. Add
   `docs/CONCEPT.md`, the film's style (the style block of `docs/CONCEPT.md`; for a preset also its `styles/<preset>/BRIEF.md`) and the output of
   the step-7 checks.
3. The jury prompt below → its answer saved as `docs/review/jury-1.md` and its JSON block as `docs/review/jury-1.json`.
4. The revise prompt below, in the building session. Then steps 1–8 again and render.
5. One round is the default: in the eval rounds a second jury round cost a full pack and review and did not raise the
   scores. Run a second only when the user asks for it. Critical issues map to P0 (§7: delivery needs them
   gone), the fix list to P1, nitpicks to P2. Log the rounds in `docs/PROGRESS.md`.

**The jury prompt** (paste with the paths filled in):
```text
You are a senior jury member for music videos and motion design (think: a Motionographer editor, the creative director
of an animation studio, a top ボカロP / MV director for the Japanese and Chinese styles). You did NOT make this film.
Judge it harshly and precisely so it can reach award level. Kindness is useless here; specificity is everything.

The film: <render/mv.mp4>, made for <song, length>. Its pack: <render/jury/index.md> (contact sheet per section,
filmstrips, every frame around the cuts, full-resolution stills, motion per second). The concept, which the film is judged against: <docs/CONCEPT.md>. What its style
should read as: <the style block of docs/CONCEPT.md; for a preset, the Reads-as line of styles/<preset>/BRIEF.md>. Automatic checks: <paste the check outputs>.

1. Look properly: every contact sheet, every filmstrip (motion: easing, spacing, overlap, holds), every cut strip
   (18 frames around a shot or lyric cut: two lines on top of each other, a pop, a flash, a transition that stutters,
   the same words drawn twice), every still at full
   resolution (edges, type setting, aliasing, banding, texture, clipping, AI-image errors such as hands, extra fingers,
   garbled text, a face off-model). Open the video itself where you can.
2. Score 1-10 per dimension (5 = competent student work; 6 = decent template; 7 = solid professional; 8 = high-end
   studio work; 9 = award shortlist; 10 = best in the world). Most first passes of a full song deserve 5-7. Do not
   inflate. Score the weakest section, not only the opening.
   - style_fidelity: the film has a visual identity of its own, carried through every shot with finish (the style
     block of the concept: palette, type, shapes, motion feel); for a preset the user asked for, an expert names the
     tradition at once. Judge the identity, not a checklist: a departure the concept argues for is not a fault; a
     preset's look adopted without being asked for is
   - concept_story: a visual idea about what the song is about; each line answered by a picture (not a literal
     illustration); a hook in the first 5 s; unmistakable hero moments; choruses that escalate; an ending, not a stop
   - motion_craft: easing, spacing, overlap, anticipation and follow-through, arcs, holds that are chosen; no dead or
     jittery motion, no sprites flipping back and forth
   - composition_type: framing and size vary (not always centred), depth, negative space; lyrics legible, set as part
     of the picture, inside the safe area; CJK and Latin type set well
   - finish: light, texture, grain and detail right for the style; consistent art; no banding, aliasing or artifacts
   - sync: cuts and hits on the music, sections change with the song, the lyric never ahead of the voice
   - technical: the automatic checks, fonts (no tofu or fallback), no pops, black frames or seams
3. Give 5-10 fixes ordered by impact on the final impression. Each: shot id or timecode, what is wrong (observable),
   why it matters, and how to fix it concretely (scene, args, easing, frames, px, colours, a different shot idea). Prefer
   a few big upgrades to many nitpicks. At least one fix must raise the wow factor, not just polish; at least one must
   lift the weakest section.
4. Flag as critical: anything generic or AI-template, an existing character, brand or real UI imitated, wrong or
   garbled lyric text, tofu, a failed check, an off-model character.
5. List the 3 strongest things, so the revision keeps them.
Return the score table, the critical issues, the fixes and the strengths, then one JSON block:
{"round": N, "scores": {"style_fidelity": 0, "concept_story": 0, "motion_craft": 0, "composition_type": 0,
 "finish": 0, "sync": 0, "technical": 0}, "critical": ["..."], "fixes": [{"at": "s12 / 1:02.4", "what": "...",
 "why": "...", "how": "...", "impact": "high|medium"}], "strengths": ["..."]}
```

**The revise prompt** (in the building session):
```text
An independent jury reviewed your film. Here is the full review: <docs/review/jury-N.md>
Raise the film to award level (target >= 8 in every dimension, 9 where the style allows):
- The current version is tagged review-N and kept as render/mv_rN.mp4; work on top of it.
- Implement every critical issue and every high-impact fix. You may replace a listed fix with a better solution if you
  are confident; say why. Go beyond the list where you see a bigger upgrade, above all for the wow factor and the
  weakest section. Do not regress anything the jury listed as a strength.
- Run the checks of references/09 §7 again, re-render, build a new pack and look at the frames until the fixes have
  truly landed.
- Write docs/REVIEW.md: each fix applied or skipped, and why. Name lyric lines by number (L05), never quote them:
  tools/check_no_lyrics.mjs scans docs/ (only the jury's own files in docs/review/ are skipped).
```
The jury's scores are a model's opinion, not a measurement: use them to find and rank problems and to compare rounds of
the same film, not as proof of quality. A judge from another model family sees more of the builder's blind spots.
