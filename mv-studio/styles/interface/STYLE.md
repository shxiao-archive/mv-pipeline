# Style: INTERFACE — the song as a conversation on a screen

Engine code: `template/engine/styles/interface/` (`ink.js`, `chat.js`, `print.js`, `scenes.js`). Starter:
`engine/starters/interface.js` (`new_project.py --style interface`). Adapted from *world-execute-me-lyric-mv* by
Nyankomint (code MIT): its brief and kit are the worked example of this grammar — read them for craft, never reuse
its story, copy, character art (CC BY-NC-SA) or its product look.

## 1. The idea

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

## 2. Colour = state (it changes only when something happens)

States (`Z.IF.STATES`, original palettes — redefine per film): `off` (greyscale: not started / the other side gone),
`on` (live), `warm` (the conversation heats: same hue, brighter — a blend, never a hue jump), `error` (red appears: first
on ONE component, then it spreads), `ash` (after the errors), `dead` (powered down), `paper` (plates). Fixed meaning:
**accent = me, cream = you, red = error, grey = absence**. Keep red out of the film until the first error event.
In a shot: `state: [[t, 'off'], [t2, 'on'], [t3, ['on', 'warm', 0.5]]]` (changes blend over 0.6 s; on a cut it is a hard
switch). Set your own hues: `Z.IF.STATES.on.me = '#…'` etc. in `Z.setup` (all roles of all states that use it).

## 3. Scenes (args take lyric line INDICES, never text)

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
  with its shadow plate; `in` entrance), `custom`; `misreg` (px of out-of-register jitter at 12 fps), `ground` options.
- `ifCode` — `listing` (strings you write for the moment, or a lyric index as a quoted string), `current` steps,
  `terminal` entries (`text` or `line`), `odometer`.
- Helpers for your own scenes: `Z.IF.ink(ctx, state)` (role-coloured drawing), `Z.IF.chatLayout`, `drawThread`,
  `composer`, `toggle`, `slider`, `toast`, `card`, `ground`, `keyword`, `glyphPlate`, `listing`, `terminal`, `drawCursor`.
- Chinese lyrics: `Z.IF.useChinese()` (the starter does it automatically when the lyrics have Han but no kana).

## 4. Grammar that works

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

### Motion budget (measured — a UI is the hardest picture to keep alive)

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
- run `motion_check.py` on every render; the interface starter scores ~27 % static: your film must do better (≤ 10 %).

## 5. Review checks (in addition to references/09)

- [ ] Every sung line readable for its whole sung duration (thread lines ≥ 40 px on screen after camera zoom).
- [ ] Each plate: which word, which beat it lands on, what ends it. No plate fades in/out unmotivated.
- [ ] Colour states change only on events; no red before the first error.
- [ ] The user is never shown (no face, no avatar picture): cursor, typing, bubbles, presence only.
- [ ] No real product's branding, logo or exact UI; window `brand` empty or invented for the film.
- [ ] Motion check passes: chat shots have camera moves, typing, cursor; plates have landing letters, misregistration, drift.
