# 06 — JIZURA 字面 as the lyric layer

Contents: 1 What it is · 2 How it's wired in · 3 Plans · 4 Styles · 5 Curation (deny-lists) · 6 Character shots & text-behind · 7 Debugging · 8 Vertical 9:16 · 9 Licence

## 1. What it is

[JIZURA 字面](https://github.com/852wa/JIZURA) (MIT, Copyright (c) 2026 hakoniwa) is a browser app that auto-builds 文字PV lyric-motion videos: give it lyrics (+ LRC times) and a song, and it plans cuts from ~860 parts in 10 groups (layout, enter, hold, exit, decor, treat, bg, cam, fx, trans) and 27 styles, with beat-snapping, 2コマ打ち, chromatic ghosts and transparent front/back export. We use its **engine** (not its UI) as a deterministic lyric layer inside our renderer.

It is one optional lyric layer. A film may set its words with its own type in its scenes, mix the two by section, or
show no lyrics; the concept's lyric-system slot decides. The plan values, styles and deny-lists quoted below are the
vocaloid demo timeline's (`--style vocaloid`), shown as API examples, not as defaults for a film.

## 2. How it's wired in

- `setup` clones the repo to `vendor/JIZURA`; `node tools/build_jizura_bundle.mjs` concatenates `src/*.js` (minus the UI) into `jizura/app/jizura_engine.js` — byte-for-byte the upstream engine, no patches.
- **Pinned version.** Setup checks out the tested commit `fc16bfe43ea4a6c25a21f1caf04d17326de14f00` (v0.10.1), so part names, part tags and scheme indices (the deny-lists in §5, the scheme lists in §4) stay valid. Set `JIZURA_REF` to a branch, a tag or a full 40-character sha to override it (`JIZURA_REF=main` follows upstream); a local clone given in `JIZURA_DIR` still wins over both. Setup never moves an existing `vendor/JIZURA` (it only warns when it is not at the pin): delete it and re-run setup to switch. After moving to another version: rebuild the bundle, dump the parts again (`node tools/jizura_parts.mjs`), re-check the deny-lists and scheme indices, and re-render the stills (cuts can re-roll).
- `jizura/app/jizura_adapter.js` exposes `window.JZ`:
  ```js
  JZ.setAudio({ duration, beats, energy: null, energyRate: 0 });   // our librosa beat grid, not JIZURA's detector
  await JZ.addPlan('main', projectSettings);                        // builds J.plan(project, audio), loads fonts
  JZ.drawPlan('main', ctx, t, 'front');                             // 'front' | 'back' | 'transparent' | 'normal'
  JZ.cutsOf('main');                                                // planned cuts (layout/enter/exit/… per cut)
  ```
  Rendering is a pure function of `t`: the planner is seeded; the renderer's only `Math.random` use is at construction (grain/paper), and every page seeds `Math.random` before the bundle loads, so all render workers draw identical frames.
- `engine/core/main.js` draws the active shot's plan into the **text layer** after the scene (`shot.lyric`: `'front'` default, `'full'` = JIZURA's own backgrounds, `'backfront'`, `'none'`, or `{plan, mode}`).

## 3. Plans

A plan = one JIZURA project. Make several and pick per shot (`shot.plan`). The demo timeline's plans:

```js
const common = { lyrics: lrc, fps: 30, res: 1080, aspect: '16:9', seed: 2609,
  unify: true,      // 統一感: repeated lines come back with the same treatment, キメ lines, morphs
  typeset: true,    // 文字整列: kana tracking, small particles, text 0.2 s before the voice
  extra: true, wa: false, horror: false,          // part sets: extra on, 和風 props off, horror off
  enabled,                                        // curated part pool (§5)
  colors: { accentOn: true, accent: '#FFA552', ghostA: '#39C6E0', ghostB: '#C8373A' },  // palette accent + ghost colours
  schemes: 'dark',                                // adapter option: 'dark' = light text for night films | 'light' = dark text for daylight films | [indices] (§4)
  fx: { motion: 0.7, glitch: 0.45, chroma: 0.6, decor: 0.45, density: 0.5, texture: 0.5, flash: false, koma: 12, hud: 'off' } };
await JZ.addPlan('main', { ...common, style: 'gold', mood: 'emotional' });                 // verses / default
await JZ.addPlan('cf',   { ...common, style: 'gold', mood: 'emotional', centerFree: true }); // character shots
await JZ.addPlan('noir', { ...common, style: 'noir', mood: 'glitch' });                      // pre-chorus tension
await JZ.addPlan('mono', { ...common, style: 'mono', mood: 'graphic', seed: 2610 });         // last chorus
```
- `mood` is a label only: `J.plan` never reads it (JIZURA's おまかせ randomiser is the only reader). The tone of a plan comes from `style` and its `schemes`, `fx` (motion / glitch / chroma / decor / density) and the part pool `enabled` (§5).
- Lyrics: LRC with markup — `/` forces a cut break, `*word*` emphasis (bigger, impact parts), trailing `!` = キメ line (flash + shake), `[間奏]` = instrumental line (keeps the previous line from lingering).
- Remove `[ti:]` from the LRC unless you want JIZURA's own title card.
- Turn JIZURA's own flashes off (`flash: false`) and let the engine's post pass own full-frame flashes, so the 3-flashes-per-second rule is enforced in one place.
- Changing the part pool or seed **re-rolls every cut** in that plan — re-review after any curation change.

## 4. Styles

Probe styles the way the film will draw them: a test timeline with one `illust` shot per candidate plan over one of **your own** backgrounds (a bright plate for a daylight film), with the same `enabled` / `schemes` / `colors` as `timeline.js`:
```js
// engine/tests/jz_styles.js
(() => { const Z = window.Z; Z.setup = async (audio) => { /* copy the JIZURA block of timeline.js (lrc, DENY, enabled, common), then: */
  await JZ.addPlan('p_ocean', Object.assign({}, common, { style: 'ocean', schemes: 'light' }));
  await JZ.addPlan('p_sunset', Object.assign({}, common, { style: 'sunset', schemes: 'light' }));
  Z.SHOTS = [{ id: 'a', t0: 0, t1: 30, scene: 'illust', args: { bg: 'assets/bg/bg_beach.png' }, plan: 'p_ocean' },
             { id: 'b', t0: 30, t1: 60, scene: 'illust', args: { bg: 'assets/bg/bg_beach.png' }, plan: 'p_sunset' }];
  window.__zankoMeta.duration = 60; }; })();
```
```bash
node tools/stills.mjs --url "engine/index.html?tl=tests/jz_styles.js" --times <lyric onsets inside each shot> --sheet jz_styles
```
`node tools/jizura_probe.mjs --style gold --lrc analysis/lyrics_mv.lrc --times 18.5,25.2 --modes front` only checks raw JIZURA (transparent PNGs; no curation, `schemes` or `colors`): fine for timings and cut lists, not for judging readability.

**Schemes.** Each style has 2–4 colour schemes and the cuts rotate through them; many styles include a light-background "swap" scheme whose text is dark. The adapter option `schemes` remaps every cut of the plan into a subset:
- `'dark'` — schemes with background luminance < 0.25: light text (for text over dark pictures);
- `'light'` — schemes with background luminance > 0.6: dark text (for text over bright pictures);
- `[i, …]` — explicit scheme indices of the style.

A style with no matching scheme keeps JIZURA's own choice.

What some styles draw: **gold** (金夜: ivory/gold mincho); **noir** (white + cyan/amber ghosts, glitch layouts); **mono** (white mincho, strong RGB split); **ocean** (blues). **sumi** (and the light schemes of most styles) draw dark ink text → invisible on night scenes, hence `schemes: 'dark'`. **crimson** has no light scheme: its text is white or pink, and its near-black is only the accent / ink colour (`#140509`).

**Text over bright pictures needs the opposite** — ivory text disappears on a sunny sky:
- `schemes: 'light'` (dark text), or pin one scheme, e.g. `style: 'ocean', schemes: [2]` (navy on pale blue);
- or bring your own colours: `colors: { enabled: true, bg: '<colour the text sits on>', fg: '#0B2A4A', sub: '#2F5E86', accentOn: true, accent: '#FF5A3C' }, schemes: [0]` — `enabled` replaces scheme 0's `bg` / `fg` / `sub`; with `accentOn` the accent and ghost colours apply to every scheme, contrast-fitted against its `bg`.

Light-background schemes at the pinned JIZURA (fc16bfe; style, scheme indices, text colour): ocean 2 navy · sakura 0, 3 plum · sunset 1, 3 violet · forest 1, 3 dark green · vapor 1, 2 indigo · candy 0–2 violet / plum · kraft 0, 1 · sumi 0, 3 ink · gold 1 (black on gold) · specimen 1 · noir 1 · newsprint 0 · paper 0 navy · rouge 0 · caution 0 (black on yellow) · mint 2 · acid 1 · blueprint 2 (blue) · magenta 1 (magenta). No light scheme: crimson, hud, mono, synth80. Avoid transit with `'light'`: its scheme 2 (grey `#9C9A94`, luminance 0.60) passes the test but keeps white text.

Keep one dark plan for night or shadowed shots and choose the plan per shot from the luminance behind the text; `check_shots.mjs` reports LYRICS LOW CONTRAST (under 3:1 against the picture around the words). Where the luminance behind one line changes a lot, a plan per region or a change in the picture is the film's choice; the check reports where.

## 5. Curation (deny-lists)

Random parts are curated for the film's own tone. The template timeline builds `enabled` from JIZURA's registries (`J.GROUP_KEYS`; `J.registry(group)` = `J.LAYOUTS`, `J.ENTER`, `J.HOLD`, `J.EXIT`, `J.DECOR`, `J.TREAT`, `J.BG`, `J.CAMERA`, `J.FXE`, `J.TRANS`; keys in `J.order(group)`): a part is off if it is on a deny-list or belongs to the horror set (`hr*` keys, `set: 'horror'`).

Optional mood filter, `MOODS` in `timeline.js`: `null` (default) = no filter — the demo is curated by the deny-lists alone. An array of JIZURA tags (`glitch calm pop graphic editorial emotional`) keeps only the parts whose registry entry's `tags` include one of them; untagged parts (the plain `cut` / `none` entries) stay on. Setting it re-rolls every cut. The plan's `mood` field is not a filter (§3).

The demo's deny-lists. The rows about opaque cards, full-frame effects and plates that cover the picture are defects
(measure them with `jizura_cover.mjs` below); the rest are the demo's tone, and a film's own lists follow its concept:

| group | denied | why |
|---|---|---|
| layout | crossword, keycaps, slotMachine, stickerBomb, bubble(s), chat, notification, searchBar, ticket, priceTag, nameTag, stickyNotes, karuta, ema, tanzaku, omikuji, chochin, noren, shoji, kakejiku, stationSign, routeMap, calendar, newspaper, vinyl, cassette, polaroid, postcard, letterPaper, genkou, panels, splitScreen, splitHalves, subtitleBar, tile, kaleido, **wall, cylinder, cube** (opaque 3D boxes), and other pop/novelty objects | gimmicks, or opaque plates that cover the scene in front mode |
| cam | **knCardFlip, knTiltKick, knReadPan, knShearKick, knRushIn**, knJumpCut, jelly, bounce | kinetic cameras wrap the whole cut in an **opaque card** → full yellow/black frames over the picture |
| decor | UI gimmicks (cursorClick, windowChrome, progressBar, likeCounter…), 和 props (kamon, seigaiha, chochin…), confetti/hearts/memphis, **tyColophon** ("SCENE/CUT" slate), **tyTextRule**, dateStamp, tyTypeScale | off-tone or draw plates/blocks |
| fx | panelWipe, irisTrans, doors, blindsTrans, splitSlide, gridRepeat, white/blackFrame, strobe, colorBars, invert, flash, bloomFlash, kaleido, posterize, … | full-frame effects belong to our post pass (and photosensitivity budget) |
| treat | boxed, marker, sticker, circled, rainbow, chrome, splitColor, knWordPlate | pop plates |
| enter / exit | bubbles, stickerPeel, crumple, loadingBar, tokoroten / balloonOff, crumpleOut, peelOff | comic motion |
| bg (only `full` mode) | argyle, tartan, polka, checker, retroGrid, kaleidoscope, fireworks, sunburst, seigaiha, asanoha, … | pattern backgrounds clash with illustrated shots |

**JIZURA's own transitions between lyric cuts are off by default** (`TEXT_TRANS = false` in `timeline.js`): they
drew the outgoing and the incoming line on top of each other for a few frames, which a viewer read as overlapping
text. Each line now leaves by its exit and the next arrives by its enter; shot transitions are the engine's. Many
layouts also set the whole line small next to the words of a cut when a line is split with `/`; that copy is off
too (`fullLine: false` in the plans' common settings): each cut shows only its own words. An editorial film that
wants the whole line as a running caption sets `fullLine: true`.

**Captions and stacked repeats are off by default** (a jury round read them as a debug layer and as garbled text):
`fx.hideNo` / `fx.hideTime` drop the small "No.06 — 0:26.00" captions under the lines; the parts that still draw
digits (index numbers, timecodes, rulers, reticles, dimension marks: 25 decors, 5 layouts) and the layouts that draw
the line 4× more often than a plain one (a wall of copies, rings, echoes: 10 layouts and the `shadowSway` hold) are
denied in `timeline.js`. Both lists were measured by planning each part alone and counting the glyphs it draws (the
sample words had no digits). An editorial or HUD film can switch them back on. After the whole-line copy went off, a look at the demo's
stills found more copies of the line and denied them too: `stack`, `perspective`, `tyCross`, `vcols` (stacked, receding,
crossing and column copies), `circle` (words on a dark disc), the `romajiLine` decor (codepoints under kanji) and
`watermarkKanji` (one glyph huge behind the line), then `condensed` (a short word repeated), `knFlowSnap` (a cascade
of outline copies), the `tyToIndex` exit (letters turned into index numbers) and the edge layouts `tyCropGiant`,
`sideways`, `knQuarterTurn`. Two more sources of doubled words are handled in the adapter: JIZURA ends a split line
with a **recap** cut showing the whole line again when it has a spare cut (the adapter plans that line again with
its cut count fixed, `overrides[line].cuts`; a project that wants the recap sets `recap: true`), and its chroma
ghost passes, which lag a frame or two, are off on the frames where they would draw the previous line. The adapter
keeps the centre-free bands inside the 90 % title-safe box. Other plans can run to the edge; `tools/check_shots.mjs`
measures that box while a cut's words hold. Two ways out:
- `lyric: { mode: 'front', plan, safe: 0.9 }` scales that shot's lyric layer into the box;
- `crop: true` on a shot that crops on purpose (a monument kanji, 見切れ). It does not exempt GLYPH NEVER WHOLE:
  each glyph of the lyrics and the title must still be whole and uncovered on one frame of its shot.

Shrinking every shot's lyrics is not the only way to pass: big type that crops after it lands whole, where the film wants it, is marked `crop`. The check also records which lyrics
every frame around each cut draws (LYRIC OVERLAP): the JIZURA cuts and the lines the film's own type reads with
`Z.line(i).text`. The deny lists were found on the demo's Japanese lines; an
English film may meet more parts that split or repeat words: look at the cut strips.

**Measure, don't guess, which parts cover the picture:** `node tools/jizura_cover.mjs [--style gold]` plans sample
words with one part at a time (every other group pinned to its plain part), renders front mode where that part is used
and prints the parts that cover more than 30 % of the frame as ready `DENY.<group> += '...'` lines (`jizura/cover.json`
has every value). Three rounds of hand-made lists each missed some (`uncover`, `whipPan`, …); the template's lists
now include every plate it measured over 40 % in the gold, noir and mono styles the template's plans use. Run it again after changing styles, schemes or the JIZURA pin, and add what it
prints; big-type layouts it lists are a choice (they cover with letters, not plates): keep the ones the film wants.

Dump the registry with `node tools/jizura_parts.mjs` → `jizura/parts.json` (per part: name, tags in the `moods` field, set) when building a new deny-list.

## 6. Shots with a subject & text-behind

- **Centre-free plan** (`centerFree: true`, JIZURA 中央を空ける): lyrics split into left/right bands (or top/bottom on tall frames) — an option where the text must not cross the middle of the picture.
- **The character in front of the type** (`illust` char `front: true`; custom scenes draw into `S.fg` with the same transform): only where the words stay whole. `check_shots.mjs` flags a lyric more than 5 % under the foreground (LYRICS HIDDEN, an ERROR with `--strict`). Users read covered lyrics as a mistake, not depth.
- Shots whose scene *is* the typography use `lyric: 'none'`.

## 7. Debugging

- A lyric frame looks wrong → find the cut: `node tools/jz_cuts_at.mjs 25.5,37.5,45.0 main` prints layout / enter / hold / exit / decor / treat / bg / cam / fx per plan at those times. Deny the culprit part, re-render the stills.
- Typical culprits we hit: full yellow frame (knTiltKick card), "SCENE 48 / CUT 121" slate (tyColophon), white extruded box (wall), empty grey frame (mono plan in `full` mode during a gap with no lyric — replace with an illustrated shot), lyric over a face (another plan, or the subject in front).

## 8. Vertical 9:16

`engine/vertical.js` builds plans at `aspect: '9:16'` with `centerFree: true, centerDir: 'tb'` from the 16:9 plans' projects, so JIZURA re-typesets every line natively for the tall frame (top/bottom bands around the picture band). The 16:9 engine runs with `Z.NO_LYRICS` so lyrics are not baked into the picture. The vertical plans take their scheme set from `Z.VERTICAL_CFG.schemes` (default `'dark'`, whatever the 16:9 plan used): the bands sit on the blurred, tinted surround, so a daylight film with a light `ambience` sets `schemes: 'light'` there too. See `08-render-and-delivery.md` §5.

## 9. Licence

JIZURA is MIT (the repository is github.com/852wa/JIZURA; its LICENSE reads "Copyright (c) 2026 hakoniwa"). The kit fetches it at setup and does not vendor it; keep `jizura/app/JIZURA_LICENSE.txt` with any built bundle you redistribute, and credit it (e.g. "JIZURA 字面 (c) 2026 hakoniwa (github.com/852wa), MIT").
