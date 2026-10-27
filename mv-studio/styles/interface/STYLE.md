# Style: INTERFACE — the song set on a screen or a page: a conversation, or plates from a treatise

**Technical manual of this style pack** (API, building, assets, safety). The creative brief — what the film is, its
elements, motion and ways of thinking — is BRIEF.md next to this file: read that first, and open only the section here
that the build needs.

One code-drawn, typography-led style with two equal libraries: two kits a film takes shots from freely, per shot, as
the song asks. Neither is the default, and no rule ties a kit to a section. In both, the words are part of the
picture, the pictures are drawn in code (no generated art needed), and the copy around the lyric (system messages,
form titles, stamps, axis labels) is your own, written per film.

| kit | its shots ARE | engine | lyrics |
|---|---|---|---|
| **screen** | one session on a screen: "me" (the singer) talks to "you" (never shown), the client itself reacts | `engine/styles/interface/` (`Z.IF`: `ifChat ifPlate ifCode`) | the conversation: lines are messages, keywords become plates |
| **treatise** | plates from an illustrated technical treatise on the song's subject: each plate its own idiom, one spark and one running number tie them together, deadpan | `engine/styles/treatise/` (`Z.TR`: `trSheet trPlot trScope trForm trPrompt trHook trContour`) | per word, set into each plate its own way |

The starter (`--style interface`, `engine/starters/interface.js`) is a first cut that cycles shots from both kits
through the song's lines; rewrite it from the shot list. Combining them:
- **A conversation and a treatise in one film:** a line arrives in the chat and the next is diagrammed on a plate (a
  chart of the feeling, a form it must fill, a map of where "you" went); a passage can stay on plates and come back to
  the chat. `ifPlate` and the treatise plates are both "plates": give them different jobs (what "me" means / the idea
  diagrammed), or use one family.
- **One palette.** The two kits share inks: set the screen's states from the treatise palette, or the other way
  round, in `Z.setup` (e.g. `Z.IF.STATES.on.me = Z.TR.PAL.signal`, `Z.IF.STATES.on.text = Z.TR.PAL.bone`), so accent =
  "me" = the spark, cream = "you" = bone. The starter does this.
- **One look per kit:** `Z.LOOK_DEFAULT = Object.assign({}, Z.IF.post)` and `post: Z.TR.post` on each treatise shot (or
  the other way round in a film that is mostly plates).
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
  out-of-register offset: fixed per plate, growing in a broken reprise, kicked apart on a hit and sprung back over
  0.25 s; never random per-frame jitter), `ground` options. `band` and `ifChat` 'me' messages take `words: true` (word by word).
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
- **Time effects:** `Z.replayMap` (the same gesture again from each start: a stuck loop), `Z.tear` (ONE tear whose pattern holds 0.1 s; a seed per frame strobes), a trail (`ink.trail`).
- **Light:** raise it as exposure (the picture gets lighter); bloom only on saturated colour (a high `bloomThreshold`,
  so cream type stays crisp); `streak`, `zoomBlur` for a push; no radiating wedge rays (they read as a flag). Dropped
  frames (`shot.fps`) read as a low frame rate, not as style: the reference film removed them. Build the light of a climax as a ratchet: it only rises inside a shot and falls on cuts. None is capped:
  `check_flash.py` on the render.
- **Type as a window:** `IF.masked(ink, content, mask)` (the picture seen through the letters).

### A.5 Grammar that works

- **Frame the thread.** A full window at 1920 px shows tiny text: push the camera to the region that matters (the newest
  line, the composer while the user types, a toggle). Change framing on the words or the event; a slow push inside
  every framing (the camera table under A.5).
- **Every line is a moment.** A line arrives (typing with the voice), the user answers (bubble, typing dots), the client
  reacts (status, toast, presence). Write the user's lines and system copy for the moment — short, original, English or
  the song's language; never invent extra lyrics.
- **Plates on the keywords and concrete nouns**, 1–4 per chorus, each ended by an event. Plate pictures read at a glance:
  big flat shapes, one subject, clean outline on the first frame; no line icons, nothing that reads as an emoji.
- **Escalate with the song:** verse = one window, few events; chorus = plates cut in on downbeats, warm state, faster
  camera; bridge = code; final chorus = earlier plates return broken (misregistered, a missing ink); ending = an event
  (presence goes offline, a message fails, the window closes), the state goes `ash` / `dead`.
- **Three layers in every picture** (room / window / content; paper / shadow plate / ink).

#### Motion: what happens in the window, not the camera

A chat window is mostly flat dark surfaces with small text: reviewers call such films "a slideshow". Moving the
camera over it does not fix that: a pan, a push, a float or a reframing snap over a window where nothing happens is a
still picture moved around, reads as shaky, and `motion_check.py` measures it as static (it takes the camera out).
What fixes it is something happening, on the music:
- messages arrive, are typed, deleted, retyped, fail, are answered; the presence changes; a reaction lands;
- a plate cuts in on a downbeat and something is drawn in it as the line is sung (a trace advancing, a chart filling,
  a form being stamped); entrances with real travel (`in: { dy: 200 }`), misregistration, landing letters;
- cut every line or two (chat → plate → chat) rather than holding one window framing past ~4 s;
- a `backdrop` (the place, blurred) adds depth behind the window; it moves only if the place does.

#### The camera, as the two reference films use it

Neither film holds the camera still by default, and neither moves it to fill time. In both, the camera is always
*framing the thing the line is about*, and it moves when that thing changes or moves:

| | world-execute-me (screen) | pdoom-video (treatise) |
|---|---|---|
| framing | each shot framed on one region (`frameRect`: the newest message, the composer, a toggle, a card), close (1.4–3×) or the whole client | each plate a list of framings on the sung words (the caret, the typed word, the whole field), zoom 1–2.7 |
| inside a framing | a slow push: 3–7 % zoom and ≤ 30 px over the shot | a push of 3–6 % per second |
| between framings | an eased move (0.4–1.5 s) timed to an event in the shot: a setting toggled, a message sent, "done" clicked | a hard snap on the word in driving passages; 1.2–1.6 s eased blends in the quiet breakdown |
| following | the cursor or the newest line | the caret (smoothed, ~0.45 s), the spark it chases: hold, chase, brake, land |
| big moves | a fly-in or pull-out as the transition to the next picture | named where the lyric asks: a whip-pan on a turn, a fall one block per beat, a rush at the camera on ⏎ |
| hits | shake 5–9 px, decaying in ~0.1 s, on a click, a thud, a failed send; a little roll on a toggle | shake and a 2.5–6 % zoom punch on a slam, a stamp, an eye opening, set to zero at the still; ~1 % on kicks |
| ambient | the bass breathes the frame by 0.5 %; nothing else | none: "no floaty, generic screensaver motion: strong eases, holds, then snaps" |
| locked | a few shots have no camera | where the picture itself moves ("a still, locked-off oscilloscope") |

So in this style:
- **frame what the line is about** and change framing on its words or on the event (`ifChat` `'follow'` re-frames on
  each new message; `camera.focus` for timed framings; `TR.cam` `shots` on the sung words, `blend: 0` to snap in a
  driving passage, `blend: 1.4` in a quiet one); a slow push inside every framing;
- **follow what moves** (`'follow'`, `TR.cam` `follow`: the caret, the spark, the pen);
- **shake and punch only on a named hit**, decaying, and never while a line has to be read;
- **lock it** where the picture's own motion carries the shot;
- **never** a lateral drift between messages (`camera: { pan }` stays 0), framings changed on a timer, seeded
  offsets, a constant sway or a float. Those are what made a test film read as shaky.

---

## B. Treatise — the song as plates from an illustrated technical treatise

Engine code: `template/engine/styles/treatise/` (`treatise.js`, `plates.js`). Starter: `engine/starters/interface.js`
(`new_project.py --style interface`; both kits). After *pdoom-video* by Giacomo Magnanini (MIT, see
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
  big display type. Fonts come with `npm run fonts` (Archivo, Cormorant Garamond added for this kit).
- **Tone:** impressive, not cute; funny the way a straight-faced scientist is funny: deadpan captions, footnotes, stamps,
  probability bars. **No mascots, no cartoon faces, no emoji.**
- **Not slop:** no purple / cyan neon, glowing brains, code rain, lens flares, particle nebulae or stock "AI" imagery.
  Never copy existing artworks, meme drawings, logos or real product UIs.
- **Dynamic:** something is always being drawn, written, filled or stamped; big changes land on the beat. Hard cuts
  on downbeats; inside a plate, the camera frames what is sung and snaps to the next framing on a word (`cam.shots`),
  **tracks the action** (`cam.follow`: the caret, the spark, the pen), and punches only on a named hit (the camera
  table under A.5). A camera drifting over hairlines is still a still picture (and `motion_check.py`, which takes the
  camera out, says so).

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
  ease`, or `shots / push / blend`; `follow / followK / snap`). `trPrompt` frames the caret on its words by default;
  `trScope` is locked off.
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
- **Motion on paper:** the plate itself moves: the pen writes, the curve runs, the field combs, the number rolls, the
  stamp lands. A chart under a camera move with nothing drawn is static (`motion_check.py`). Something drawn moving
  at least every 1.5 s, on the music (§A.5).
- **Lyrics stay in frame:** cameras push and reframe; keep set words inside the central 90 % at the shot's widest
  zoom, and look at the stills for cropped words (`check_shots.mjs` warns for the lyric layer and `shot.text`; words a scene
  draws itself are not seen). `TR.write` lines in the GPU plates are drawn in
  screen space for this reason.
- **No GPU:** an integrated GPU runs these plates fine; with no GPU at all Chrome falls back to SwiftShader and everything renders, slower. Give `Z.shade` a `rect` and keep marches ≤ 96
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
  camera choreography (sub-cuts that each frame a new detail, a tracking camera that follows the pen), the spark and the running number threaded
  through all of them, each plate's exit turning into the next plate's entry; type crafted per word (kerning, width
  animation, written strokes); a revision round per plate after the first cut (pdoom-video went through five).

Targets: cut every line or two; 3–6 events per shot (a message, a reply, a reaction of the client, a plate's landing
letters); every plate a visual pun, never a literal illustration.

Those events are drawn in the film's own scene file (`engine/scenes/<film>.js`, references/10 §7), not set as
arguments of the starter's scenes in `timeline.js`: Screen, the conversation's beats (a message that arrives word by
word, the cursor that hesitates, an error that spreads, a plate that lands and is struck by the next event); Treatise,
one drawing module per plate with its own camera. In the acceptance test the screen film kept everything in
`timeline.js` (9 own lines per shot) and the treatise film had too thin a plate file (22): the bar is 30.
