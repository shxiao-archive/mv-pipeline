# Interface — the digital-tech lyric film (preset)

Use this preset only when the user asked for it: a chat-log or AI-chat lyric video, a "technical diagram" or "treatise"
film, or "interface" (SKILL.md). The technical manual is `styles/interface/STYLE.md`; `styles/interface/look.jpg` shows what
its starters render with no art of yours (look at it once: a floor to rise above, not the target).

**Reads as:** a digital-tech film where the words are the picture. The song happens on an invented AI chat screen and
on high-precision technical plates (charts, oscilloscopes, forms, prompts, maps, engravings), drawn exactly in code,
lyrics set into the interface as they are sung, with deadpan copy of the film's own around them.

## 1. The feel

1. **The interface is the stage.** One session on one screen: *me* (the AI or the singer) speaks in an accent colour
   and a serif. *You* is never shown, only a cursor, typing, bubbles and presence. The *system* speaks in mono.
   *Why:* an interface makes the audience read the song as an event happening now. Silence on the other side is the
   strongest beat.
2. **Precision as an aesthetic.** Hairlines, Swiss grids, crop marks, registration targets, small mono annotations
   beside big type, an engraving whose tone is line width. *Why:* exactness is what makes it feel technical and
   expensive. Sloppiness breaks the spell faster than anything.
3. **Every plate is its own idiom, with a pun.** A chart, an oscilloscope, a form, a prompt with next-token odds, a
   survey map, a banknote's guilloché, a blueprint, an engraved 3D form. Each treats its line as a deadpan visual
   transformation: the curve falls off a cliff on the line's last word. *Why:* the variety of idioms is the range;
   the straight face is the humour.
4. **Colour is a state, not a look.** It changes only when something happens: off → on → warm → error → ash → dead.
   The first accent and the first red are held back for their moment, and red appears on one component before it
   spreads. Or, for plates, a strict document palette: ink, bone, one signal orange for the spark, the number and the
   sung word, one rare acid accent for about 2 s. *Why:* restraint turns colour into plot.
5. **One thread through everything.** A spark (one orange point dragging a hairline) writes the title, draws the
   curve, travels the map, becomes a fuse, a pen, a cursor. A running number rises inside the pictures, never in a
   corner, and is blown up at the hooks. *Why:* continuity across very different pictures.
6. **Restraint and an emotional arc.** Intimate, then broken. Matte surfaces, local glow only, no debug HUD, no filler
   text. The climax can be the *brightest, cleanest, stillest* frame: a held white with all motion off. *Why:* the
   opposite of what a "tech" cliché does, so it feels authored.
7. **Words placed per word, as sung.** Lines type with the voice. A keyword lights at its start, never ahead. Each
   plate sets the words its own way: riding the curve, on the trace, typed into a form, as tokens, as map labels,
   written by a pen.

## 2. Art construction (what makes a frame look finished)

- **Three layers in every shot:** a backdrop that is never pure black (warm near-black paper with a light pool in two
  flat steps, a 45° dot screen denser towards the bottom, fibre, crop marks), the subject, and chrome or a foreground.
- **Print, not render.** Plates are flat inks. Depth comes from a second ink or a shadow plate out of register.
  - Silhouettes are split into three cumulative ink masks, so registered plates never seam and a shifted plate shows
    the ink beneath.
  - Each plate takes a palette role and its own wipe-in.
  - Close-ups are traced to vectors.
- **Glyph pictures** built from characters that follow the shape's edge direction.
- **Engraving:** tone is line *width*; an always-on hairline plus crosshatch only in the deep shadows; lines filtered
  so they never shimmer (moiré); hairlines that keep their weight at any resolution.
- **Light.**
  - Bloom only on saturated colour: cream type stays crisp, the orange glows.
  - A tone shoulder rolls bright values to white.
  - A red-orange halation; grain stronger in the mid-tones.
  - Raise light as exposure, never as added glow over large orange (it turns yellow).
- **Type craft as the quality bar:**
  - a width-axis grotesque for the lyric voice (condensed under pressure, stretched on held notes), mono for the
    machine, a rare italic serif;
  - glyph-by-glyph kerning; symbols drawn, never substituted;
  - no outlined or haloed type.
- **Copy** written for each moment (the user's replies, system messages, form titles, stamps, axis labels,
  footnotes), short, never extra lyrics.
- **Finished versus amateur:** a finished frame is exact, quiet, three-layered, with one accent and kerned type. An
  amateur frame is a full window with tiny text, a neon glow and a stock "AI" brain.

## 3. Motion vocabulary

| move | feel | when | not when | size |
|---|---|---|---|---|
| typing with the voice | spoken, present | "me" lines | lines that are read (word by word instead) | per character at its sung time |
| reply on the downbeat | the other side answers | after a "me" line | off-beat (it reads as late) | lands on the bar |
| plate landing | the word takes over | keywords, concrete nouns, 1–4 per chorus | every line | off-beat cut: the word at the cut, the picture 0.23 s later on the strong beat |
| pressed-on letters | ink hitting paper | keyword plates | — | 108 % → 100 % in ~2 frames |
| cut-away that keeps time | the conversation went on without you | inserts into the chat | — | `Z.withInserts` |
| framing on the words | precision, a new detail | every UI shot and plate: the region the line is about (newest message, composer, caret, typed word) | framings changed on a timer, seeded or unaimed | snap on the word (driving), 1.2–1.6 s blend (quiet); push 3–7 % inside |
| eased move on an event | the action moves the view | a toggle set, a message sent, "done" | between events (no lateral drift) | 0.4–1.5 s, inOut |
| tracking camera | following the pen, spark, caret | a moving point | a camera with nothing to follow | lags the point slightly; the point's motion is the motion |
| hit shake / punch | impact | a slam, a stamp, a click, a failed send | while a line must be read; as an ambient sway | 5–9 px, zoom 2.5–6 %, decaying ~0.1 s |
| locked off | the picture moves itself | a trace, a typed field, a held word | — | no camera |
| hand-off | one picture becomes the next | between plates | — | the curve plunges and the camera with it; the next plate under the burning page |
| hook slam, escalating | a recurring blow, bigger each time | the hooks | — | 4 passes: clean → on a field → hairlines → strobing |
| width press | pressure | on the kick in tense lines | — | width 125 → 62 |
| odometer / number roll | the count rising | the running number at the hooks | — | spinning wheels with ghosts (a new digit per frame flickers) |
| stuck word / replay | a loop, a malfunction | a repeated line, the bridge | — | three chunks on three syllables, each leaving a ghost and a red edge |
| glitch event | a fault | once per kick in a fault section | as a constant filter | tear, mosaic and RGB split held exactly 6 frames |
| misregistration | the print slipping | broken reprises | random jitter | fixed, growing offsets (10 / 18 / 28 px), a slow drift, a kick apart with a 0.25 s spring back |
| light ratchet | rising pressure | the climax | — | rises inside a shot, falls on cuts |
| the still white | everything stops | the climax or the last frame | — | the brightest frame held ~1.2 s, all motion off |

**The motion feel:**
- Continuous 60 fps smoothness for the UI and for what moves behind still silhouettes.
- Snaps and holds with strong eases; hard cuts on downbeats.
- Hits on the *voice*; the drum gives the anticipation and the aftershock.
- Dropped frames as a look read as a low frame rate: don't.

## 4. Let the song choose

All of this is the identity; what each section uses comes from the song:

| range | from | to |
|---|---|---|
| address | spoken to someone: the chat | explaining an idea: the plates |
| tone | intimate | deadpan |
| picture | the interface framed close | full-frame plates |
| density | one window, few events | a plate per phrase, numbers rolling |

A chat can cut to plates diagramming what it says; plates can return broken in the last chorus. Say where each
section sits in the concept.

## 5. How the reference films were made

- **The chat film's v4 beat its v3** by:
  - leaving the interface for plates on the concrete nouns;
  - replacing painted illustrations with three-ink silhouettes;
  - rebuilding the climax, which had got darker while the music got fuller.

  Its fix round moved hits to the voice, removed the 12/8 fps "glitch" (it looked like a low frame rate) and raised
  the light to a true white-out.
- **Rules it kept:**
  - every picture passes a check card rendered alone, with no lyrics;
  - new effects default to off and go through regression sheets;
  - all off-grid times live in one cue file with their source;
  - flash safety is measured per section.
- **Lessons:** a uniform push through nested frames failed the flash check; radiating wedge rays read as a rising-sun
  flag; a red ground held 14 s had no rise or fall (a red *word* as an event worked).
- **The treatise film went through six revisions with reasons:** removed an uncanny eye and the captions; crop marks
  only at the bookends, so it loops; a typography pass (kerning, no outlines); no white washes, moiré-free hatching,
  seamless hand-offs.

## 6. Craft notes

- Every sung line is readable for its whole duration: thread text ≥ 40 px on screen after zoom; lyrics inside the
  central 90 % at the widest zoom.
- A plate is ended by an event, never by a fade.
- The user is never shown; no red before the first error.
- `motion_check.py` on every render. It takes the camera out: UI frames need things happening in them, or cuts.

## 7. Avoid

- "AI slop": purple / cyan neon, glowing brains, code rain, lens flares, particle nebulae, stock "AI" imagery.
- Outlined or haloed type; radiating wedge rays; mascots, faces, emoji.
- Tiny text in a full window; one framing for a whole verse; literal illustrations; one idiom plate after plate.
- A real product's UI, logo or brand; a reference film's story, copy, jokes or art.

## 8. Where it lives

Search `grep '"interface"' index/index.jsonl`, or by word:
- the screen: `scene:ifChat`, `scene:ifPlate`, `scene:ifCode`, `helper:Z.withInserts`, the `IF.*` drawing helpers;
- the plates: `scene:trSheet / trPlot / trScope / trForm / trPrompt / trHook / trContour`, the GPU plates
  `scene:trEngrave / trField`, the `TR.*` kit (text with a width axis, per-word karaoke, spark, write, hatch, cam,
  NUM);
- shaders and hairlines: `helper:Z.shade`, `helper:Z.lineBatch`, `Z.stroke`.

Starter: `--style interface`, a first cut that cycles chat shots and treatise plates through the lyric lines. An
example to rewrite.
