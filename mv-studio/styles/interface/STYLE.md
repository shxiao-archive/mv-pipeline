# Style: INTERFACE — the song set on a screen or a page: a conversation, or plates from a treatise

One code-drawn, typography-led style with two treatments that a film can switch between by section. In both, the words
are part of the picture, the pictures are drawn in code (no generated art needed), and the copy around the lyric (system
messages, form titles, stamps, axis labels) is your own, written per film.

| treatment | the film IS | engine | lyrics | starter |
|---|---|---|---|---|
| **screen** (default) | one session on a screen: "me" (the singer) talks to "you" (never shown), the client itself reacts | `engine/styles/interface/` (`Z.IF`: `ifChat ifPlate ifCode`) | the conversation: lines are messages, keywords become plates | `engine/starters/interface.js` (`--style interface`) |
| **treatise** | plates from an illustrated technical treatise on the song's subject: each plate its own idiom, one spark and one running number tie them together, deadpan | `engine/styles/treatise/` (`Z.TR`: `trSheet trPlot trScope trForm trPrompt trHook trContour`) | per word, set into each plate its own way | `engine/starters/treatise.js` (`--style interface:treatise`) |

Pick by the song: a song addressed to someone / about machines → screen; a song about an idea, science or technology →
treatise. Mixing:
- **A conversation that turns into a treatise:** the chorus (or the bridge) cuts from the chat to plates that diagram
  what "me" is saying (a chart of the feeling, a form it must fill, a map of where "you" went); the plates return
  broken in the final chorus. `ifPlate` and the treatise plates are both "plates": pick one family per film, or give
  each section one.
- **One palette.** In a mixed film the two treatments share inks: set the screen's states from the treatise palette, or
  the other way round, in `Z.setup` (e.g. `Z.IF.STATES.on.me = Z.TR.PAL.signal`, `Z.IF.STATES.on.text = Z.TR.PAL.bone`),
  so accent = "me" = the spark, cream = "you" = bone.
- **One look per treatment:** `Z.LOOK_DEFAULT = Object.assign({}, Z.IF.post)` and `post: Z.TR.post` on each treatise
  shot (or the other way round in a treatise film with chat shots).
- **The running number and the spark** can live in the chat too (a counter in the status bar, the cursor's trail) — set
  them up there, pay them off in the plates.

---

## A. Screen — the song as a conversation on a screen

Engine code: `template/engine/styles/interface/` (`ink.js`, `chat.js`, `print.js`, `scenes.js`). Starter:
`engine/starters/interface.js` (`new_project.py --style interface`). Adapted from *world-execute-me-lyric-mv* by
Nyankomint (code MIT): its brief and kit are the worked example of this grammar — read them for craft, never reuse
its story, copy, character art (CC BY-NC-SA) or its product look.

### A.1 The idea

The whole film is one session on a screen. Three voices with fixed roles for the whole film:

| who | is | colour role | type | on screen as |
|---|---|---|---|---|
| **me** | the singer: almost every sung line is one of its messages | `me` (accent) | serif | lines in the thread, its avatar mark, plates |
| **you** | the person on the other side — never shown | `text` (cream) | sans | cursor, typing in the composer, bubbles, presence (online / away / offline) |
| **system** | the client itself | `mute` / `sub`, `err` | mono | boot log, labels, toasts, error codes, code |

Story beats come from the song: a conversation starts, warms, is interrupted, goes wrong, ends (someone leaves, the window
greys out). Write that arc in `docs/CONCEPT.md` before any shot: *which moment of this conversation is each section?*

Three kinds of picture:
- **INTERFACE** (`ifChat`) — what the user sees: the chat client drawn in code. The test of an interface shot: *which
  moment of this conversation is this?*
- **PLATE** (`ifPlate`) — what "me" means and feels: a full-frame print on dark textured paper, built only from three
  flat inks (`me`, `text`, `bg`): big keyword type, glyph pictures, flat-ink silhouettes, shapes. No gradients inside a
  shape; depth comes from a shadow plate printed out of register. The test: *which word is this, and what ends it?* A
  plate comes in ON A BEAT and is ended by something that happens (the user types, a toast, the next line) — never fades
  in and out for no reason.
- **CODE** (`ifCode`) — the machinery underneath: a listing with a current-line bar, a terminal, an odometer. Reserve it
  (a bridge, a loop section, a breakdown); it hits harder when rare.

### A.2 Colour = state (it changes only when something happens)

States (`Z.IF.STATES`, original palettes — redefine per film): `off` (greyscale: not started / the other side gone),
`on` (live), `warm` (the conversation heats: same hue, brighter — a blend, never a hue jump), `error` (red appears: first
on ONE component, then it spreads), `ash` (after the errors), `dead` (powered down), `paper` (plates). Fixed meaning:
**accent = me, cream = you, red = error, grey = absence**. Keep red out of the film until the first error event.
In a shot: `state: [[t, 'off'], [t2, 'on'], [t3, ['on', 'warm', 0.5]]]` (changes blend over 0.6 s; on a cut it is a hard
switch). Set your own hues: `Z.IF.STATES.on.me = '#…'` etc. in `Z.setup` (all roles of all states that use it).

### A.3 Scenes (args take lyric line INDICES, never text)

```js
Z.LOOK_DEFAULT = Object.assign({}, Z.IF.post);          // clean UI type: no boil, little bloom
shot('s07', nb(L(6).t - 0.3), B(22), 'ifChat', {
  state: [[0, 'on'], [B(21), 'warm']], title: 'late shift', presence: [[0, 'online'], [B(22) - 0.5, 'away']],
  msgs: [{ who: 'sys', text: 'connected', at: B(20) }, { who: 'me', line: 6 }, { who: 'you', text: 'you still up?', at: B(20) + 2.1 },
         { who: 'me', line: 7, thinking: [B(21) - 0.6, B(21)] }],
  compose: { text: 'you still up?', at: B(20) + 2.1 },                      // the user typing, sent at `at`
  cursor: [{ t: B(20), x: 1500, y: 900 }, { t: B(20) + 2.0, x: 1347, y: 930, click: true }],
  camera: { from: { zoom: 1.15, x: -40 }, to: { zoom: 1.28, x: -20, y: 30 } },  // frame the thread: lines must read
}, { lyric: 'none', hud: false });
shot('s08', B(22), B(23), 'ifPlate', { layers: [{ kind: 'keyword', line: 8, maxSize: 320, y: 620 }, { kind: 'band', line: 9, y: 1000 }] }, { lyric: 'none', hud: false });
```
- `ifChat` — `msgs` ('me' lines type out with the voice via `Z.charsAt`; `hot` = a keyword message, bigger; `tone: 'err'`;
  `status: 'failed'`; `ghost` (struck out); `outAt` (deleted, the row closes)), `compose`, `cursor` (waypoints, clicks
  burst), `toasts` (sit above the composer, never over the thread), `settings` + `drawer` (toggles / sliders the user
  plays with), `side`, `open`, `sizes: { me, hot, you }` (defaults 46 / 64 / 34 px), `fx(ink, S, L, items)` hook.
- `ifPlate` — `layers`: `keyword` (letters land one by one across the first half of the sung line; `parts` for
  syllables; `off` shadow plate), `band` (a caption line in serif on a paper strip), `glyph` (a picture printed in
  characters from an image or a draw function; `reveal`, `decode` spans), `print` (a cut-out as a flat-ink silhouette
  with its shadow plate; `in` entrance), `inks` (a three-ink cut-paper figure printed from its own plates, each in a
  palette role, each with its wipe-in and misregistration: §A.4), `limp` (a word that sags), `custom`; `misreg` (px of
  out-of-register jitter at 12 fps), `ground` options. `band` and `ifChat` 'me' messages take `words: true` (word by word).
- `ifCode` — `listing` (strings you write for the moment, or a lyric index as a quoted string), `current` steps,
  `terminal` entries (`text` or `line`), `odometer`.
- Helpers for your own scenes: `Z.IF.ink(ctx, state)` (role-coloured drawing), `Z.IF.chatLayout`, `drawThread`,
  `composer`, `toggle`, `slider`, `toast`, `card`, `ground`, `keyword`, `glyphPlate`, `listing`, `terminal`, `drawCursor`.
- Chinese lyrics: `Z.IF.useChinese()` (the starter does it automatically when the lyrics have Han but no kana).

### A.4 The v4 tools (what lifted world-execute-me's v4 over its v3)

```js
// a chat that cuts away to a plate on a beat and comes BACK in the state it would have by then (not where it left)
for (const s of Z.withInserts({ id: 's07', t0: B(20), t1: B(22), scene: 'ifChat', line: [6], args: {...}, moment: '...' },
  [{ t0: B(21), t1: B(21) + P, shot: { scene: 'ifPlate', args: { layers: [{ kind: 'keyword', line: 6 }] }, moment: 'the word' } }])) S.push(s);
// the figure printed from its plates: cream, then the accent, then the dark ink, each wiping in, out of register
{ kind: 'inks', img: 'assets/char/bust.png', h: 860, roles: ['text', 'me', 'panel'],
  reveal: [[B(8), B(8) + 0.5], [B(8) + 0.5, B(9), 'up'], [B(9), B(9) + 0.4, 'right']], keyline: { color: 'line', width: 3 } }
{ kind: 'limp', line: 9, sag: [B(30), B(31)], amount: 0.8, side: 'right' }      // the word goes soft
shot.fps = 8;                                                                      // the picture stutters, the lyric does not
post: S => Object.assign({}, Z.IF.post, Z.tear(S.t, B(40)), { rays: 0.8, raysAt: [960, 400], streak: 0.3 })
```
- **Cut-aways keep time.** A plate is a word; when it ends, the conversation has gone on without you (`Z.withInserts`).
- **Word by word** (`words: true`, `Z.wordsAt`): Latin lines come out whole words at their sung times; use it on lines
  that are read, keep character typing for lines that are TYPED in the story.
- **Ink plates, not pictures.** Art is a flat three-ink silhouette (cut paper: light / accent / dark; generate it so,
  `kit.js` separates it once by brightness). Every plate takes a palette role, so the figure greys out, warms up or turns
  red with the state like the UI. A plate can come in alone, be missing (a dashed ring where it should be), slip out of
  register in the broken reprise. `IF.inkClip` (a glyph field only inside the dark ink) and `IF.part(img, [u, v])` (one
  connected patch: her hand, an ear, cut out of the art, never drawn as a polygon) build on it.
- **Time effects:** `fps` (dropped frames on one-way moves), `Z.replayMap` (the same gesture again from each start: a
  stuck loop), `Z.tear` (ONE tear whose pattern holds 0.1 s; a seed per frame strobes), a trail (`ink.trail`).
- **Light:** `bloom` + low `bloomThreshold` (cream and hot accent bloom), `rays` from a point, `streak`, `zoomBlur`
  for a push. Build the light of a climax as a ratchet: it only rises inside a shot and falls on cuts. None is capped:
  `check_flash.py` on the render.
- **Type as a window:** `IF.masked(ink, content, mask)` (the picture seen through the letters).

### A.5 Grammar that works

- **Frame the thread.** A full window at 1920 px shows tiny text: push the camera to the region that matters (the newest
  line, the composer while the user types, a toggle). Change framing per phrase; a slow push inside every shot.
- **Every line is a moment.** A line arrives (typing with the voice), the user answers (bubble, typing dots), the client
  reacts (status, toast, presence). Write the user's lines and system copy for the moment — short, original, English or
  the song's language; never invent extra lyrics.
- **Plates on the keywords and concrete nouns**, 1–4 per chorus, each ended by an event. Plate pictures read at a glance:
  big flat shapes, one subject, clean outline on the first frame; no line icons, nothing that reads as an emoji.
- **Escalate with the song:** verse = one window, few events; chorus = plates cut in on downbeats, warm state, faster
  camera; bridge = code; final chorus = earlier plates return broken (misregistered, a missing ink); ending = an event
  (presence goes offline, a message fails, the window closes), the state goes `ash` / `dead`.
- **Three layers in every picture** (room / window / content; paper / shadow plate / ink).

#### Motion budget (measured — a UI is the hardest picture to keep alive)

A chat window is mostly flat dark surfaces with small text: typing, a blinking caret and glyph flicker are real motion
to the eye but barely change the picture at a distance, and reviewers call such films "a slideshow". Measured with
`tools/motion_check.py` on dark interface frames: a slow push (zoom 1.0 → 1.05 per shot), a gentle float or glyph
decoding alone stay STATIC; a lateral pan of ≥ ~110–130 px/s, a plate that slides 300+ px while pushing in, a picture
that enters with a 200 px move, and cuts between a close chat framing and a plate all register. So:
- cut every line or two (chat → plate → chat), never hold one window framing for more than ~4 s;
- `ifChat` default camera `'follow'` re-frames on every message and pans ~110 px/s in between (`camera: { follow: true,
  pan, creep, zoom }`); keep it unless a shot needs a designed still (and then make that still an event);
- plates move: default slide + push; give entrances real travel (`in: { dy: 200 }`), misregistration, landing letters;
- a `backdrop` (the place, blurred, drifting) adds a textured layer behind / through the window (`glass` 0.86);
- run `motion_check.py` on every render; the screen starter scores ~27 % static: your film must do better (≤ 10 %).

---

## B. Treatise — the song as plates from an illustrated technical treatise

Engine code: `template/engine/styles/treatise/` (`treatise.js`, `plates.js`). Starter: `engine/starters/treatise.js`
(`new_project.py --style interface:treatise`). After *pdoom-video* by Giacomo Magnanini (MIT, see
`licenses/LICENSE-pdoom-video.txt`): its palette, the spark, the plate idioms and the karaoke rules, rewritten for this
Canvas2D engine. Its song, lyrics, timing data and its film's jokes are not ours: make your own film from your song.

### B.1 The idea

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

### B.2 Look and tone

- **Palette (`TR.PAL`):** ink `#0A0A0B`, ink2 `#151517`, graphite, ash, bone `#EEE9DF`, **signal** `#FF4D12` (the spark,
  the number, the sung word), ember, blood. One rare accent (`acid`) for one moment of the film only. Some plates invert
  to bone paper with ink lines (forms, charts), which gives the edit a light / dark rhythm; orange stays orange on both.
  Only signal and ember glow (the post's bloom threshold is set so); bone type stays crisp.
- **Type:** Archivo (the lyric voice; animate its **width** 62–125 and weight: condense under pressure, stretch on held
  notes), IBM Plex Mono (the machine: tokens, labels, forms, footnotes), Cormorant Garamond italic (the rare prophetic
  register). Swiss-grid discipline: asymmetric layouts, negative space, hairline rules, small mono annotations next to
  big display type. Fonts come with `npm run fonts` (Archivo, Cormorant Garamond added for this treatment).
- **Tone:** impressive, not cute; funny the way a straight-faced scientist is funny: deadpan captions, footnotes, stamps,
  probability bars. **No mascots, no cartoon faces, no emoji.**
- **Not slop:** no purple / cyan neon, glowing brains, code rain, lens flares, particle nebulae or stock "AI" imagery.
  Never copy existing artworks, meme drawings, logos or real product UIs.
- **Dynamic:** something always moves; big changes land on the beat. Hard cuts on downbeats; inside a plate, reframing
  snaps every half bar (`TR.cam` does it) and a camera that **tracks the action** (`cam.follow`: the spark, the pen).
  Hairlines on black change few pixels: a slow drift alone reads as a still (and fails `motion_check.py`).

### B.3 Karaoke rules (every plate)

- Every line readable and **synced per word**: a word lights at its start, never ahead of the voice (`TR.words(i)`:
  per-character times from `analysis/lyric_timing.json` when present, else spread over the line; without word times the
  highlight is an estimate: say so in the report).
- Each plate sets the lyric **graphically and differently**: riding the curve (`trPlot`), on the trace (`trScope`), typed
  into a form (`trForm`), typed as tokens with next-token odds (`trPrompt`), slammed word by word (`trHook`), as map
  labels (`trContour`), written by the spark. The words are part of the picture, not subtitles.
- Unsung words dim (~30 % bone), sung bone or ink, the current word signal. Lines may show up to 0.4 s early.
- Keep lyrics inside the title-safe area (≥ 96 px from the edges) — check framing when the camera tracks or zooms.

### B.4 Building it

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
- **GPU plates:** `trEngrave` (an engraved 3D form under a raking light: burin lines that wrap it, line WIDTH is the
  light; `form bulb | sphere | torus`, `turn`, `light [a0, a1]`, `freq`; the line is written under it) and `trField`
  (57 000 hairlines combed round a pole that is the pen writing the line; it swells with the music). Both write the
  lyric with `TR.write` (single-stroke `script` by default: `font: 'sans' | 'serif' | 'readable' | 'allure'`).
- **New plates:** write a scene named `trXxx` that paints in this palette with the kit: `TR.text / measure` (width axis),
  `TR.lineWords` (per-word karaoke with your own `place(word)`), `TR.spark / trail`, `TR.grid / axes / cropMarks /
  callout / stamp / hatch / contours / readout`, `TR.cam`. Engraving = `TR.hatch` (parallel hairlines, tone by spacing).
- **Copy:** write your own deadpan text (form titles, stamps, axis labels, footnotes) per film; never lyric text in code.

### B.5 Shaders, hairlines and written type (what makes pdoom-video's plates)

pdoom-video's plates are not Canvas2D drawings: each draws its subject with its own shader, shades it like an
engraving, puts tens of thousands of hairlines on the GPU and writes its words with a pen. This engine has the same
three tools (`core/shade.js`, `core/stroke.js`; reference 05 §12):

```js
Z.scene('trLung', { init: async () => Z.stroke.load(['script']), draw(c, S) {
  c.fillStyle = TR.PAL.ink; c.fillRect(0, 0, 1920, 1080);
  Z.shade(c, `uniform float uTurn; uniform vec3 uBone, uInk2;
    float map(vec3 p){ p.xz = rot2(uTurn)*p.xz; return smin(sdSphere(p - vec3(-.45, 0., 0.), .7), sdSphere(p - vec3(.45, 0., 0.), .7), .3); }
    #include <raymarch>
    vec4 frag(vec2 p){
      vec3 ro = vec3(0., 0., 4.), rd = camRay(p, ro, vec3(0.), .8); float t = march(ro, rd, 10.); if (t < 0.) return vec4(0.);
      vec3 x = ro + rd*t, n = normal(x); float light = lambert(n, vec3(-.6, .8, .5))*softShadow(x + n*.004, vec3(-.6, .8, .5), 12.);
      return vec4(mix(uInk2, uBone, slice(x, vec3(0., 1., .3), 28., .07 + .93*light)), 1.);
    }`, { uTurn: S.p * 0.8, uBone: [0.93, 0.91, 0.87], uInk2: [0.08, 0.08, 0.09] }, { rect: [460, 90, 1000, 800] });
  TR.write(c, S.args.line, S.t, 960, 990, 64);
} });
```
- **Engrave, do not render.** Tone is line WIDTH (`hatch`), never grey fill; lines follow the form (`slice`: the form cut
  by parallel planes, or a coordinate of the surface: latitude, distance along a fibre); a hairline survives in the
  dark (`.07 + .93 * light`); a second set crosses only the deepest shadows (`slice2`, `engrave`). One accent: the
  signal on a rim, on a downbeat.
- **Hairline fields** (`Z.lineBatch`): fibres, field lines, fur, flow, rain, wireframes. Thousands of short segments
  at width < 1 px and alpha 0.2–0.5 with `blend: 'add'`: density becomes tone. Seed them on a jittered grid with
  `Z.rnd(i, j)` (never `Math.random`), advance them through a field that is a function of t.
- **Written type** (`TR.write`, `Z.stroke`): the pen writes the line as it is sung; the spark sits on the pen head; use
  the head as a pole, a light, a camera target (`cam.follow`).
- **No GPU:** Chrome falls back to SwiftShader; everything renders, slower. Give `Z.shade` a `rect` and keep marches ≤ 96
  steps; check the frame time in `stills.mjs` output.
- Chinese / Japanese lyrics: the starter calls `TR.useCJK()` (Noto fallbacks behind Archivo / Cormorant).

---

## Asset library and density (method: references/10, team: 11)

- **Screen (world-execute-me v4, 87 shots in 3:32):** the conversation as data (the user's lines, system copy, error
  texts per beat, in your own words); one picture module per section (its plates, objects, code pictures) with **check
  cards** — each picture rendered alone without lyrics (`engine/sheets/`): if it cannot be named without the text, it
  fails; silhouettes split into ink plates; every new shared effect off by default and checked with the regression
  sheets (`regress.mjs`).
- **Treatise (pdoom-video, 17 plates):** one plate module per section, each with its own drawing idiom and its own
  camera choreography (sub-cuts, half-bar reframes, a tracking camera), the spark and the running number threaded
  through all of them, each plate's exit turning into the next plate's entry; type crafted per word (kerning, width
  animation, written strokes); a revision round per plate after the first cut (pdoom-video went through five).

Targets: cut every line or two; 3–6 events per shot (a message, a reply, a reaction of the client, a plate's landing
letters); every plate a visual pun, never a literal illustration.

## Review checks (in addition to references/09)

Screen shots:
- [ ] Every sung line readable for its whole sung duration (thread lines ≥ 40 px on screen after camera zoom).
- [ ] Each `ifPlate`: which word, which beat it lands on, what ends it. No plate fades in/out unmotivated.
- [ ] Colour states change only on events; no red before the first error.
- [ ] The user is never shown (no face, no avatar picture): cursor, typing, bubbles, presence only.

Treatise plates:
- [ ] Each plate has its own idiom and a visual pun on its line; the spark and the running number tie them together.
- [ ] Every word lights at its start, never ahead; lines readable, inside title-safe, never cropped by the camera.
- [ ] Palette held: only signal / ember glow; the acid accent used once at most; light / dark rhythm across the edit.
- [ ] The hook escalates each time; the number rises in steps you can read; first frame = last frame.

Every film:
- [ ] A mixed film shares one palette and one look per treatment; the switch between screen and plates is an event.
- [ ] `motion_check.py` PASS (camera moves, tracking and snaps, not slow drifts); `check_flash.py` PASS (the prompt's
      return flash and full-frame hits are single events).
- [ ] `pops.mjs`: the hook's word slams and the prompt's return rush show as JUMPs — they are the planned hits; any
      other JUMP is a bug.
- [ ] No mascots, faces, logos, real product branding or exact UIs; window `brand` empty or invented for the film.
