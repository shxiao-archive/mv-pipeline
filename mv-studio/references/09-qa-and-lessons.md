# 09 — QA: review loop, checklist, failure modes we hit

Contents: 1 The loop · 2 Checklist · 3 Failure modes & fixes (visual) · 4 Pipeline & tooling pitfalls · 5 Working with agents

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
| 3 | `node tools/check_shots.mjs` | page errors per shot, black / flat frames, fonts that failed, character sprites swapped back and forth, lyrics outside the 90 % safe area (4 samples/s; `--sprite-fps 0` skips it; errors with `--strict`) | every edit |
| 4 | `node tools/cues_sheet.mjs` | the wrong picture for a line (look at it) | after the plan, after big changes |
| 5 | `node tools/pops.mjs` | JUMPs (an abrupt change inside a shot) and POPs (1-3 frames that flash and come back) | before a full render |
| 6 | `node tools/regress.mjs snap a` / `snap b` + `python tools/compare_sheets.py a b` | a change to a shared file that altered finished shots | around every shared-file change |
| 7 | render → `check_flash.py`, `motion_check.py`, `check_sync.py` | flashes, stillness, picture / audio / lyric offsets | every render |
| 8 | contact / review sheets, read by the lead | everything else | every render |
| 9 | independent review → `docs/REVIEW.md` (P0 / P1 / P2), fix, back to 1 | what the builder no longer sees | before delivery |

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
