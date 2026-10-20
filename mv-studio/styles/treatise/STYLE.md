# Style: TREATISE — the song as plates from an illustrated technical treatise

Engine code: `template/engine/styles/treatise/` (`treatise.js`, `plates.js`). Starter: `engine/starters/treatise.js`
(`new_project.py --style treatise`). After *pdoom-video* by Giacomo Magnanini (MIT, see
`licenses/LICENSE-pdoom-video.txt`): its palette, the spark, the plate idioms and the karaoke rules, rewritten for this
Canvas2D engine. Its song, lyrics, timing data and its film's jokes are not ours: make your own film from your song.

## 1. The idea

The film is a series of **plates from an illustrated treatise** on the song's subject. Each set piece has its own
drawing idiom (a chart, an oscilloscope, a form, a survey map, a prompt, an engraving, a blueprint, a banknote), its own
deadpan humour, and treats concrete things as **visual puns and transformations**, never as literal illustrations of a
line. Around that variety, everything shares one palette, one type system, one grain:

- **The spark** runs through the whole film: one orange point dragging a hairline. It writes the title, draws the curve,
  travels the map, becomes whatever the song needs (a fuse, a pen, a cursor) and finally ends the film.
- **The running number** (`TR.NUM`): one value the song keeps raising, staged inside the plates (a readout on the chart,
  a field on the form, a contour label), never as a corner overlay. The hooks blow it up full-frame as it rolls to its
  next value. Name it after the song's subject; the steps are yours.
- **The hook** is one recurring typographic slam whose look escalates each time (`trHook n`: clean → on a signal field →
  hairline and eerie → maximal).
- **Bookends:** the film opens on a construction sheet with crop marks and closes back to it, so the last frame matches
  the first and the film loops.

## 2. Look and tone

- **Palette (`TR.PAL`):** ink `#0A0A0B`, ink2 `#151517`, graphite, ash, bone `#EEE9DF`, **signal** `#FF4D12` (the spark,
  the number, the sung word), ember, blood. One rare accent (`acid`) for one moment of the film only. Some plates invert
  to bone paper with ink lines (forms, charts), which gives the edit a light / dark rhythm; orange stays orange on both.
  Only signal and ember glow (the post's bloom threshold is set so); bone type stays crisp.
- **Type:** Archivo (the lyric voice; animate its **width** 62–125 and weight: condense under pressure, stretch on held
  notes), IBM Plex Mono (the machine: tokens, labels, forms, footnotes), Cormorant Garamond italic (the rare prophetic
  register). Swiss-grid discipline: asymmetric layouts, negative space, hairline rules, small mono annotations next to
  big display type. Fonts come with `npm run fonts` (Archivo, Cormorant Garamond added for this style).
- **Tone:** impressive, not cute; funny the way a straight-faced scientist is funny: deadpan captions, footnotes, stamps,
  probability bars. **No mascots, no cartoon faces, no emoji.**
- **Not slop:** no purple / cyan neon, glowing brains, code rain, lens flares, particle nebulae or stock "AI" imagery.
  Never copy existing artworks, meme drawings, logos or real product UIs.
- **Dynamic:** something always moves; big changes land on the beat. Hard cuts on downbeats; inside a plate, reframing
  snaps every half bar (`TR.cam` does it) and a camera that **tracks the action** (`cam.follow`: the spark, the pen).
  Hairlines on black change few pixels: a slow drift alone reads as a still (and fails `motion_check.py`).

## 3. Karaoke rules (every plate)

- Every line readable and **synced per word**: a word lights at its start, never ahead of the voice (`TR.words(i)`:
  per-character times from `analysis/lyric_timing.json` when present, else spread over the line; without word times the
  highlight is an estimate: say so in the report).
- Each plate sets the lyric **graphically and differently**: riding the curve (`trPlot`), on the trace (`trScope`), typed
  into a form (`trForm`), typed as tokens with next-token odds (`trPrompt`), slammed word by word (`trHook`), as map
  labels (`trContour`), written by the spark. The words are part of the picture, not subtitles.
- Unsung words dim (~30 % bone), sung bone or ink, the current word signal. Lines may show up to 0.4 s early.
- Keep lyrics inside the title-safe area (≥ 96 px from the edges) — check framing when the camera tracks or zooms.

## 4. Building it

```js
const TR = Z.TR;
Z.LOOK_DEFAULT = Object.assign({}, TR.post);
TR.NUM.label = 'p'; TR.NUM.keys = [[0, 0.02], [B(10) + 1.2, 0.15], [B(26) + 1.2, 0.42]];   // raised by the hooks
S.push({ id: 'p03', t0: B(6), t1: B(8), scene: 'trPlot', lyric: 'none', hud: false, line: 3,
  args: { line: 3, mode: 'drop', xl: 'step', yl: 'loss' }, moment: 'the curve falls off a cliff on the line\'s last word' });
```
- **Plates:** `trSheet` (bookend: crop marks, the spark writes the title; `close: true` at the end), `trPlot` (`mode
  drop | exp | walk`, `inv` for bone paper, axis labels), `trScope` (the song itself on an oscilloscope), `trForm` (form
  title, field label, `stamp` text, `stampWord` index), `trPrompt` (tokens + next-token distribution; the other candidates
  are other words of the song), `trHook` (`n` 1–4), `trContour` (survey map, `seed`). Every plate takes `cam` (`from / to /
  ease / follow / reframe`).
- **New plates:** write a scene named `trXxx` that paints in this palette with the kit: `TR.text / measure` (width axis),
  `TR.lineWords` (per-word karaoke with your own `place(word)`), `TR.spark / trail`, `TR.grid / axes / cropMarks /
  callout / stamp / hatch / contours / readout`, `TR.cam`. Engraving = `TR.hatch` (parallel hairlines, tone by spacing).
- **Copy:** write your own deadpan text (form titles, stamps, axis labels, footnotes) per film; never lyric text in code.
- Chinese / Japanese lyrics: the starter calls `TR.useCJK()` (Noto fallbacks behind Archivo / Cormorant).

## 5. Review checks (in addition to references/09)

- [ ] Each plate has its own idiom and a visual pun on its line; the spark and the running number tie them together.
- [ ] Every word lights at its start, never ahead; lines readable, inside title-safe, never cropped by the camera.
- [ ] Palette held: only signal / ember glow; the acid accent used once at most; light / dark rhythm across the edit.
- [ ] The hook escalates each time; the number rises in steps you can read.
- [ ] `motion_check.py` PASS (tracking camera and snaps, not slow drifts); `check_flash.py` PASS (the prompt's return
      flash and full-frame hits are single events).
- [ ] `pops.mjs`: the hook's word slams and the prompt's return rush show as JUMPs — they are the planned hits; any
      other JUMP is a bug.
- [ ] No mascots, faces, logos or product UIs; first frame = last frame.
