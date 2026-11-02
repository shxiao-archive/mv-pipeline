# 09 — QA: review loop, checklist, failure modes we hit

Contents: 1 The loop · 2 Checklist · 3 Failure modes & fixes (visual) · 4 Pipeline & tooling pitfalls · 5 Working with agents · 6 mv-studio checks · 7 Review order · 8 The jury (one round)

## 1. The loop

1. **Stills at shot midpoints** (fast, minutes): `node tools/stills.mjs --times <list> --out render/stills/passN --sheet passN`, then read the sheet image. For vertical: `--url engine/vertical.html --canvas vout` (the sheet keeps the 9:16 aspect).
2. **Dense stills where something moves** (transitions, stops, beat cuts): `--range 200:203.5:0.25`.
3. **The checks that need no video, on what changed:** `check_shots.mjs`, and `pops.mjs --from <a> --to <b>` on the
   changed ranges. A defect found here costs seconds; found in a render it costs a render.
4. **One full render** (~4 min on NVENC, much longer on x264): `node tools/render_final.mjs --name mv`.
5. **Review sheets** from the MP4: `python tools/review_sheets.py render/mv.mp4 --step 1.8 --out render/reviewN` (5×5 timestamped frames per sheet). Portrait videos work the same (216×384 thumbnails): `python tools/review_sheets.py render/mv_vertical.mp4 --step 1.8 --out render/reviewN_v`.
6. **Fix in ranges, not in passes.** Check each fix with stills and `pops.mjs --from --to` over its range, then
   `node tools/render_final.mjs --name mv --patch s07,s12` (shot ids, or `<a>:<b>` in seconds) re-renders only those
   shots into the master (widened to its keyframes) and copies every other frame across. Once a master exists,
   `render_final.mjs` refuses a whole render without `--full`. Prefer fixes local to the shots that are wrong over a
   change to shared code. When a change does reach beyond its shots (a palette, a helper many shots use, the engine,
   `globalFX`, the timeline's timing, a JIZURA plan's part pool, which re-rolls all its cuts), try it on two or three
   affected shots first (`--start <a> --end <b> --name probe`, then the checks on `render/probe.mp4`), and re-render
   the whole film with `--full` once, after the fixes of that round are in, never once per fix.

A sampled black/odd frame in a sheet may be a *designed* beat (e.g. a 溜め black before the riff). Before "fixing", render dense stills around it.

## 2. Checklist (per pass)

- [ ] Lyrics readable for ≥ max(0.7 s, 0.09 s × characters); no light text on bright skies; nothing important hidden under the HUD.
- [ ] No lyric over what a shot is about, unless the concept wants it there (another plan, text-behind, or a different picture).
- [ ] No opaque plates/cards/blocks from JIZURA covering the picture (see 06 §5).
- [ ] No dead air: no shot that is just black/grey without intent while the music plays.
- [ ] Exposure: bright scenes (dawn, flashes, white characters) not blown out — check bloom, glow fx, LUT mix and exposure together.
- [ ] Text over bright pictures is dark where the picture is light (06 §4); no milky bloom; no additive particles clipping to white; no white flashes on white frames. Outside a vocaloid preset film: no defaults of the stock scenes leaking in (amber rims, `#140B1E` ink, the 残光 palettes). The 9:16 surround and bands are the film's (`Z.VERTICAL_CFG.ambience` / `schemes` / `chrome`).
- [ ] Flashes ≤ 3 per second; no saturated red full-frame flicker; fast stripes/spirals < 25 % of the frame.
- [ ] Cuts and hits where the concept's editing rhythm puts them (on the measured grid, never on a BPM count); stops handled on purpose; the ending lands on the final cut.
- [ ] A cast, if any, identical across shots; no green fringes; no cropped subjects unless intended.
- [ ] The concept's colour script reads in the contact sheets.
- [ ] Transitions motivated by the concept, not decorative noise.
- [ ] Credits present (title lockup, outro, end card, 9:16 header artist and footer) and spelled exactly as given — no leftover demo title, subtitle or artist (`Z.TITLE`, `Z.TITLE_SUB`, `Z.ARTIST`, `Z.CREDIT`).
- [ ] Vertical version: graphic shots keep full composition; lyrics in the bands; header/footer not colliding.

## 3. Failure modes & fixes (visual) — met on the vocaloid demo film 残光

| symptom | cause | fix |
|---|---|---|
| Crossword grid / mahjong-tile lyrics / speech-bubble pills | JIZURA pop/novelty layouts | curation deny-list (06 §5) |
| Full **yellow** or **black** frame with a lyric on it | JIZURA kinetic cameras (`knTiltKick`, `knCardFlip`, …) draw the cut as an opaque card | deny `kn*` cams |
| "SCENE 48 / CUT 121" slate, yellow highlighter boxes | `tyColophon`, `tyTextRule`, `marker`-type parts | deny |
| White extruded 3D box over a dark scene | layout `wall` (also `cylinder`, `cube`) | deny |
| Lyrics invisible at night | style scheme with a light background → dark text | `schemes: 'dark'` in the adapter |
| Giant lyric covers the key action | the shot's plan | a `centerFree` plan or text-behind for that shot |
| Runner hidden behind a giant lyric | character drawn in the scene layer | also draw the character into `S.fg` with the scene's transform (`S.fg.setTransform(ctx.getTransform())`) |
| 4 s of near-black / empty grey frames | JIZURA `full` mode during a lyric gap | replace with a picture; use `full` only where its own backgrounds are wanted |
| Dawn shots washed out, face blown | glow fx + screen tint + LUT + bloom stacked | lower glow (≈0.3), drop the screen tint, `bloom 0.3`, `bloomThreshold 0.8`, `exposure −0.12` |
| Climax burst wraps back to a night cut before the dawn shot | 7 beats, 6 cuts in the list | match cut count to beats; end the list on the target look |
| Burst never shifts night→dawn | arg name mismatch (`dawn: true` vs `grade: 'night2dawn'`) | read the scene's header comment for exact args |
| Glass cracks overpower the verse | full-intensity fx in a quiet section | scale fx per section (verse < chorus) |
| Over-busy pre-chorus | JIZURA noir + glitch + our CA | keep what the shot is about readable |
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

`node tools/verify.mjs render/mv.mp4` runs these with the page and start the render used (its manifest,
`render/mv.render.json`), and first lists what is out of date (`node tools/stale.mjs`): analysis made from an older
song or lyrics, or a render made from older files, fails — re-run `analyze_audio.py` → `make_cues.py` →
`render_final.mjs`. A video without a manifest (an older render) fails unless `--any-render`.

Run on every full render (and on clips of fast sections while building):
```bash
python tools/check_flash.py render/mv.mp4        # WCAG 2.3.1 approximation: general + red flashes <= 3/s -> PASS / FAIL (exit 1)
python tools/motion_check.py render/mv.mp4       # stretches where nothing moves in the picture, the camera taken out (< 0.006 for >= 1.5 s), with their times (not counting the song's stops, the tail, `hold: true` shots); verify lists it as INFO: a stillness the film means stays, one it doesn't is fixed in that shot
node tools/check_no_lyrics.mjs                   # lyric text only in analysis/ (code clean; --strict: docs too)
```
What reviewers flagged in films that passed every automatic check — look for these in the contact sheets:

| symptom | cause | fix |
|---|---|---|
| "a PPT", "a slideshow" | pictures held still behind slow crossfades | something happens in every shot, on the music: typing, drawing, an arrival, a reaction, a limited-animation loop; motion_check (it takes the camera out) |
| "too shaky", "restless" | the camera kept moving to make stills look alive: constant pans, floats, random reframes | the picture's own motion; the camera frames what the line is about and moves with a reason (a new framing on a word or event, follow the action, a hit) (the preset's STYLE.md) |
| a train floating above its bridge, lanterns above the river | cut-outs placed by eye in frame coordinates while the plate pans | `art_grid.py` → `pin: [u, v]` on the plate, `ground`, `water`; or one image for things that touch |
| "the sun looks like a glass marble" | a bright gradient disc with an edge | `fx: 'light'` / `D.softLight` pinned to the painted sun |
| stiff, unnatural movement | linear moves at constant speed | eased arcs with anticipation / overshoot (`D.travel`), sway, secondary motion |
| a weak last shot ("a lone house") | the ending is an object in an empty frame | compose it: subject on a third, foreground + background, light, the motif's payoff |
| monotonous typography | one layout and one entrance for every line | vary per section (scale, layout, entrance, emphasis); keywords peak; custom type scenes |
| a story action you cannot see | the lyric's action happens in < 1 s or off-screen | ≥ 1.5–2 s, a clear before / after, set up in the previous shot |
| a cut-out in the wrong light | a white prop at dusk | `tint: { color: <the light>, a: 0.4-0.6 }` |
| "strange textures" on an object | part of another picture pasted on for a changed state | generate the new state whole and cut to it (`references/04` §1, "Whole pictures, not patches") |
| "looks fake": a door closing, a lid opening | the event drawn in flat shapes over a still | whole pictures of the before and the after, or another shot idea (same section) |
| "the screen doesn't fit" | a separately drawn picture pasted into a painted monitor | generate the monitor with the picture on it, or cut to the picture full frame (same section) |
| unreadable lines in a chat / UI | the full window at 1:1 | camera on the thread; `sizes`; lines >= 40 px on screen |
| a fast-cut section fails check_flash | bright inserts, luminance jumps | dark inserts only, fewer per second, darker motifs, move the white flash |



## 7. Review order (mv-studio)

Automated first (cheap, catches the boring errors), then eyes, then an independent pass. Each must pass before the next.

| # | command | catches | when |
|---|---|---|---|
| 1 | `node tools/lint.mjs` | syntax errors, U+FFFD (CJK text lost in a write), `Math.random` / `Date.now` in engine code, lyric text in code | every change |
| 2 | `node tools/storyboard.mjs` | unknown scenes, black gaps, cuts off the grid, cuts far from their cue, sung lines no shot shows, shots without `moment`, unreadably short lines, line cues without hints; writes plan/storyboard.md | every edit of the timeline |
| 3 | `node tools/check_shots.mjs` | page errors per shot, black / flat frames, fonts that failed, character sprites swapped back and forth, a figure cut by the frame or by its own image's edge (FIGURE CUT; `crop: true` on a shot that crops on purpose), lyrics outside the 90 % safe area, under the character (LYRICS HIDDEN) or below 3:1 contrast (LYRICS LOW CONTRAST) while a cut's words hold, a JIZURA transition drawing two lines at once (LYRIC OVERLAP), a lyric or title glyph never once whole and uncovered in its shot (GLYPH NEVER WHOLE; `crop: true` does not exempt it), glyphs over half the frame high in more than two places (OVERSIZED TYPE) (4 samples/s; `--sprite-fps 0` skips them; errors with `--strict`) | every edit |
| 4 | `node tools/cues_sheet.mjs` | the wrong picture for a line (look at it) | after the plan, after big changes |
| 5 | `node tools/pops.mjs` | JUMPs (an abrupt change inside a shot) and POPs (1-3 frames that flash and come back); a change on a beat, a lyric cut, a cue, or a frame whose code reads a drum hit (`Z.hit`) is a HIT, listed and allowed: never soften a hit to pass; needs no render, so run it with `--from --to` on each changed range | before any render |
| 6 | `node tools/regress.mjs snap a` / `snap b` + `python tools/compare_sheets.py a b` | a change to a shared file that altered finished shots | around every shared-file change |
| 7 | render → `check_flash.py`, `check_sync.py`, `motion_check.py` (information) | flashes, picture / audio / lyric offsets, stillness | every render (after `--patch`, on the patched master) |
| 8 | contact / review sheets, read by the lead | everything else | every render |
| 9 | the jury, one round (§8): `tools/jury_pack.py`, an independent session scores and lists fixes → revise → back to 1 | what the builder no longer sees; film quality, not only correctness | before delivery |

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

## 8. The jury: an independent review

The automatic checks prove a film is correct; they cannot say whether it is good. Before delivery the film goes through
**build → jury → revise** (the process of mg-styles-15, MIT, adapted to music videos). The jury is a
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
of an animation studio, an experienced MV director and editor). You did NOT make this film. You judge it against
what its own concept sets out to do, not against a style you prefer.
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
     preset's overall look adopted without being asked for and without a reason from the song is; shared elements
     that serve the song are not
   - concept_story: the film does what its concept says; a visual idea about what the song is about; the lines
     answered the way the concept sets them; each section designed from its own lines and music (its own picture
     idea, composition, type, motif state and hand-over), not one treatment repeated; the moments the concept names
     as peaks land; an ending, not a stop
   - motion_craft: easing, spacing, overlap, anticipation and follow-through, arcs, holds that are chosen; the motion
     comes from what happens in the picture, on the music; the camera moves with a reason and holds otherwise; no dead
     or jittery motion, no camera drifting or shaking to keep stills alive, no sprites flipping back and forth, no
     lip-sync: a face changes only now and then, and a still face is fine
   - composition_type: composition and type as the concept intends, carried out with control; lyrics legible and
     inside the safe area; CJK and Latin type set well
   - finish: light, texture, grain and detail right for the style; consistent art; no banding, aliasing or artifacts;
     no visible patches (a pasted part of a picture, a flat shape standing in for an event, a picture sitting on a
     screen rather than in it). A fix for one is a new whole picture or another shot idea, never a better patch
   - sync: cuts and hits on the music, sections change with the song, the lyric never ahead of the voice
   - technical: the automatic checks, fonts (no tofu or fallback), no pops, black frames or seams
3. Give 5-10 fixes ordered by impact on the final impression. Each: shot id or timecode, what is wrong (observable),
   why it matters, and how to fix it concretely (scene, args, easing, frames, px, colours, a different shot idea). Prefer
   a few big upgrades to many nitpicks. At least one fix must raise the wow factor, not just polish; at least one must
   lift the weakest section.
4. Flag as critical: anything generic or AI-template, an existing character, brand or real UI imitated, wrong or
   garbled lyric text, tofu, a failed check, an off-model character, a preset's overall look adopted without being
   asked for or a reason from the song, sections that could be swapped without anyone noticing (the same layout and
   effects whatever the lines say), a material conflict with the agreed concept. A minor inconsistency (one
   element off the palette, a borrowed device not restyled) is a fix, not critical.
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
- The user's notes and the style's rules outrank the jury: a fix that breaks one (a mouth moving with the voice, say) is
  skipped and logged, or solved another way. Check every fix against them before applying it.
- Implement every other critical issue and high-impact fix. You may replace a listed fix with a better solution if you
  are confident; say why. Go beyond the list where you see a bigger upgrade, above all for the wow factor and the
  weakest section. Do not regress anything the jury listed as a strength.
- Run the checks of references/09 §7 again, re-render (`render_final.mjs --patch <shot ids>`; one `--full` render
  for all the round's shared changes, each tried on a range first, 09 §1), build a new pack and look at the frames until the fixes have truly landed.
- Write docs/REVIEW.md: each fix applied or skipped, and why. Name lyric lines by number (L05), never quote them:
  tools/check_no_lyrics.mjs scans docs/ (only the jury's own files in docs/review/ are skipped).
```
The jury's scores are a model's opinion, not a measurement: use them to find and rank problems and to compare rounds of
the same film, not as proof of quality. A judge from another model family sees more of the builder's blind spots.
