# Design a style — the default path

Unless the user asked for a preset, the film gets a style of its own, designed from this song. This file is how the
reference films built theirs. Their presets are examples of the method, not looks to pick from. Write the result
into the style block of `docs/CONCEPT.md`; the jury judges the film against it.

## 1. Start from one mechanism

A style that holds is one idea seen everywhere. Each signature effect is a form of the song's mechanism
(`direction.md` §2), not a decoration chosen separately.

Examples from the reference films:
- "light that remains after its source is gone" → afterimages, embers, fireflies, film burn, and an ending that is an
  afterimage of the title;
- "a device failing while it records" → the cut rate, the heat grade, tears and hot pixels that never heal;
- "a name too big for its world" → the name rebuilt in a new material each time, filling a wider space;
- "a conversation's state" → colour that changes only when something happens in the chat.

If an effect can't be explained as a form of the mechanism, it is probably noise.

## 2. The identity: decide it before any shot

**Reads as, plus 6–10 traits.** Write one line a viewer would use to name the film, then the traits that make it
feel that way. For example: "type is the subject", "everything is printed in three inks", "the world drifts while the
narrator snaps to the beat", "nothing is outlined", "the only red is the error". Traits describe a feeling with its
visible signs, not parameters.

**A palette system, not a palette:**
- **Roles.** Decide a ground, an ink, one accent, and any state colours. Give the accent a budget (≤ ~8 % of the frame
  in most shots) so it stays an event.
- **Line colour** comes from the palette's ink, not from black. Keep pure black and pure white for events (a hard cut,
  a white-out).
- **Colour changes are motivated:** along one curve (heat rising), or only when something happens (the first red is
  one component, then it spreads). A red ground held for 14 s had no rise or fall; a red *word* as an event worked.
- **Generated art comes out neutral** (natural colour, mid contrast) and the grade colours it, so different pictures
  become one film. Grade the subject separately when it must stay the brightest thing on screen.
- **At a hand-off between places**, keep a shared colour across the cut. At most 3 main colours and 2 accents at a
  time.

**Type roles:**
- At most 3 families, each with one job: the lyric voice, the impact or monument face, the machine or system voice, a
  hand. A scale and a grid to set them on.
- **Type as material.** It can be the subject (monument kanji, a word full frame), sit inside the world (on a surface,
  a name built from stone or fire), or carry pressure (a width axis that condenses on each
  kick).
- **The sung word stays readable:** whole (never under the character) and at least 3:1 against the picture around
  it, whatever the style. `check_shots.mjs` measures both: LYRICS HIDDEN and LYRICS LOW CONTRAST.
- **Craft is the quality bar:** kerning, no faux bold on CJK, punctuation used as graphics, symbols drawn rather than
  substituted, ruby as a second voice where it means something.

**A shape and motif grammar:**
- A master shape and a secondary one (a circle and a shard; a square and a line) that recur in props, frames,
  transitions and type.
- Each motif has one meaning, at most ~3 appear per shot, and their states change over the film (new, used, broken,
  lit, lost).
- Shapes that rhyme give match cuts: sun ↔ lamp ↔ full stop, moon ↔ coin, eye ↔ cave mouth.
- One continuous thread can tie very different pictures together: a spark that becomes a pen, a fuse, a cursor; a
  red line that is a bookmark, a scarf, a route.

**Material and finish:**
- **Pick the medium the film pretends to be,** then honour its physics: watercolour on paper, cut paper with shadows
  that grow with height, print inks out of register, a screen, a failing video signal, an engraving.
- **Every shot has three layers:** a ground that is never flat black, the subject, a foreground or chrome layer.
  Texture is the glue (paper, grain, fibre, a dot screen), applied where there is content so it doesn't grey the
  picture.
- **Light is exposure, not added glow.** Raise the light of the picture. Bloom belongs only to saturated colour; cream
  and white type stay crisp. Light added over large orange turns it yellow.
- **Graphic overlays** (screentone, grids, dimension lines, crop marks, UI fragments, a HUD) make a still look
  designed, when they belong to the film's medium.

## 3. The motion feel: choose it on purpose

- **Cadence.**
  - Drawn layers on twos or threes against a camera, light and grain on ones is the hand-made feel.
  - Line boil at about 12 per second; short loops of 2–3 frames; a new pose per beat as an idiom.
  - Everything on ones at 60 fps is the screen feel.
  - Dropped frames used as a look read as a low frame rate, not as style.
- **What is quantised.** Something snapped to the beat (a narrator, a HUD, type) against something that drifts (the
  world) is a strong device: order against chaos.
- **Beat-locked or cue-locked.** Dances and stamps lock to the beat. Acting locks to cues: one accent per cue, 0 to
  +0.15 s after it, anticipation 0.1–0.4 s before. When the beat phase is unreliable, cue-lock.
- **The easing family.**
  - Snaps with outExpo and holds: precise, technical.
  - outBack pops with overshoot: graphic, comic.
  - Sine drift: dreamy.
  - Linear only for machines and endless drifts.
- **An impact ladder with real sizes.** For example:

  | level | shake | flash | other |
  |---|---|---|---|
  | S | ~8 px | small | |
  | M | ~14 px | | |
  | L | ~22 px | | |
  | MAX | ~32 px | full | once in the film |

  For reference, the films use:
  - a word slam: scale 3 → 1 in 2 frames, a 1-frame flash, a 6 px shake over 6 frames;
  - an entry punch: scale 1.22 → 1 in 4 frames;
  - a shake on a fast cut: 34 px decaying over 5 frames.

  A 1–3 px wiggle reads as nothing.
- **Acting.**
  - Anticipation before, follow-through after.
  - Trails sampled back in time for scarves, hair and tails.
  - Groups staggered by 30–80 ms.
  - The face changes 2–4 frames before the action ("think, then act").
  - A hold of at least 0.2 s after an action so it reads.
  - A face never snaps: it blinks, takes, then opens on the new expression.
- **Keep stills alive.** At the fast end every cut drifts (120–380 px/s). On flat or dark pictures a slow push alone
  reads as static. A pan of ≥ 110 px/s, a 200 px entrance, or a cut does register (`motion_check.py`).

## 4. The editing rhythm

- **Section entries land on the music; accents inside a section land on the voice.**
  - A chorus, drop or riff starts with the band's downbeat slam (`audio.json` sections and impacts), not with its first
    sung word. That word often comes a beat or two later, and the cut, the new picture and the biggest hit belong on
    the slam. A 溜め (black or still hold) ends *on* the downbeat. In the iteration-6 film the chorus picture arrived
    with the first word, 0.85 s after the slam, and the payoff fell flat.
  - Inside a section the main event goes on the sung word; the drum gives the anticipation and the aftershock.
- **Cut grammar.**
  - Cut a frame early; flash on the beat frame; a black 溜め (hold) before the chorus.
  - At the fast end, a beat grid per section with filler frames and 1–2 frame inserts, and an anchor image returning
    (A-B-A-C-A).
- **Hand-offs, not dissolves.**
  - One picture's exit is the next one's entry: the curve plunges and the camera plunges with it; the next plate is
    rendered under the burning page; a shape-match cut.
  - Seams at the same place match to the pixel.
  - Some films use no dissolve at all.
- **Restraint.**
  - Outside the climaxes, one screen effect and one decoration per shot.
  - Effects sit on a reserve list and unlock section by section.
  - Choruses call back earlier layouts with one thing raised.
  - At least three real holds.
  - The climax may be the brightest, cleanest, *stillest* frame.
- **End on an idea:** a hard cut on the dead stop, an afterimage, the first frame returning, the book closing.

## 5. Process: how the films got there

1. **A style test before production.** Render a look sheet: 4–6 frames of signature moments, the palette with its
   roles, the type roles, a texture swatch. Show it to the user with the concept (◆), and change the style now,
   while it is cheap.
2. **Model sheets and check cards.** Every character, prop and recurring picture rendered alone, without lyrics. If
   it can't be named without the words, it fails.
3. **New shared effects default to off,** and are checked on regression sheets (`tools/regress.mjs`).
4. **Revisions with written reasons** in `docs/PROGRESS.md` ("read as uncanny", "the climax got darker while the
   music got fuller"), so the next round doesn't undo them. The reference films went through 3–6 rounds.

## 6. Borrowing: techniques yes, looks no

- **Any film may use the library's techniques** (search `index/index.jsonl`):
  - the JIZURA lyric layer, the transitions, camera and drawing helpers (`D.*`), `Z.withInserts`;
  - the signal decay layer, shaders and hairlines (`Z.shade`, `Z.lineBatch`), written type (`Z.stroke`);
  - the shape and type kits, paper and paint primitives.

  Restyle what you borrow to your palette, type and motion feel.
- **Not borrowable without the user asking for that preset:** a preset's look as a whole, meaning its palette, type
  system, cast and signature devices:
  - the AI-chat voices and colour states;
  - the treatise's spark-and-number plates;
  - the puppet troupe on its painted stage;
  - the paper RPG interface;
  - the three-ink magazine press with its folios, proof marks and vertical lyric columns;
  - the heat-grade recording device.

  If the song seems to want one of these, offer the preset to the user instead of drifting into it.

## 7. Signs of a finished frame

| finished | amateur |
|---|---|
| every shot has three layers and a texture that ties them | a flat ground with one thing on it |
| the accent is rare, so it means something | everything saturated, nothing stands out |
| type is kerned, set on a grid, part of the picture | a subtitle in the default font |
| motion has anticipation, overshoot, holds and stagger | everything eased the same way, nothing holds |
| impacts are big and short; the climax is earned | constant shake; a climax no different from the verse |
| sections enter on the downbeat slam, accents on the voice; hand-offs carry the eye | cuts on a timer; a chorus that arrives late; crossfades everywhere |
| the ending is an idea | the film stops when the audio does |
