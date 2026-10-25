# Design a style — the default path

Unless the user asked for a preset, the film gets a style of its own, designed from this song. This file is a
decision process: the questions to answer and the order to answer them in. It holds no answers. Every answer comes
from the song (`direction.md`), the user and you; none comes from a preset or an earlier film. Write the answers into
the style block of `docs/CONCEPT.md`; the jury judges the film against it.

## 1. Start from one mechanism

Name the one idea of this song that the film makes visible (`direction.md` §2). Then, for every signature effect you
consider, write the sentence "this is a form of the mechanism because …". An effect you can't finish that sentence
for doesn't belong to this film.

## 2. The slots

Answer each slot in `docs/CONCEPT.md`. Each answer is a decision with its reason in the song (a line, a sound, a
section, the mechanism). "None" is a valid answer wherever it fits.

| slot | the question |
|---|---|
| reads as + traits | What would a viewer call this film in one line? Which 6–10 visible traits make it feel that way? |
| medium | What is the film made of, or pretending to be made of? What physics does that material have? |
| palette roles | Which colours, and what is each one's job? How and when do they change over the film? |
| type roles | Which faces, and what is each one's job? Where does type live in the frame: over, in, or as the picture? |
| shape and motif grammar | Which shapes and motifs recur, what does each mean, and how do their states change? |
| motion feel | What moves, how (cadence, easing, physics), and what stays still? What is locked to the beat and what is not? |
| impacts | What happens on the song's hits, at what sizes? How does the biggest one differ from the rest? |
| editing rhythm | What decides a cut (the bar, the voice, a cue, a long take)? How do pictures hand over to each other? |
| lyric system | How do the words appear: a kinetic layer (JIZURA), the scene's own type, burned into the pictures, sparse, none? |
| cast | Is there a character at all? If so, who, how many, how drawn, and where in the frame? |
| picture source | Where do the pictures come from: generated, code-drawn, the user's own, photographic, 3D, none? |
| ending | What is the last idea the film leaves? |

Answer them in this order of dependency: the mechanism and medium first, then palette, type and shapes, then motion,
editing and lyrics. Don't fill a slot with what the engine or a starter already happens to do: the starters are API
examples, and their values are placeholders.

## 3. The look sheet ◆

Before production, render a look sheet: 4–6 frames of signature moments, the palette with its roles, the type roles,
a texture or material swatch. Show it to the user with the concept, and change the style now, while it is cheap.

## 4. The distance check

Before the look sheet goes to the user, compare your slots with each preset (`styles/<preset>/BRIEF.md`): one row per
slot, "same" or "different".

| slot | vocaloid | interface | stage | papercraft | magazine |
|---|---|---|---|---|---|
| reads as | | | | | |
| … one row per slot of §2 | | | | | |

If more than 3 rows match one preset, the film is drifting into it. Either offer the user that preset by name, or go
back and answer those slots again from the song. Record the table in `docs/CONCEPT.md`.

## 5. Borrowing: techniques yes, looks no

- **Any film may use the library's techniques** (search `index/index.jsonl`): the JIZURA lyric layer, the
  transitions, camera and drawing helpers (`D.*`), `Z.withInserts`, the decay layer, shaders and hairlines
  (`Z.shade`, `Z.lineBatch`), written type (`Z.stroke`), the shape and type kits, paper and paint primitives. Each
  one is restyled to your slots; its defaults are not a look.
- **Not borrowable without the user asking for that preset:** a preset's look as a whole, meaning its palette, type
  system, cast and signature devices:
  - the ボカロPV look: an illustrated original singer at the centre of the frame, lyric columns flanking the subject,
    the PV HUD, kanji slams, the 残光 palettes (P1–P5);
  - the AI-chat voices and colour states;
  - the treatise's spark-and-number plates;
  - the puppet troupe on its painted stage;
  - the paper RPG interface;
  - the three-ink magazine press with its folios, proof marks and vertical lyric columns;
  - the heat-grade recording device.

  If the song seems to want one of these, offer the preset to the user instead of drifting into it.

## 6. Process

1. **Model sheets and check cards.** Every character, prop and recurring picture the film has, rendered alone,
   without lyrics. If it can't be named without the words, it fails.
2. **New shared effects default to off,** and are checked on regression sheets (`tools/regress.mjs`).
3. **Revisions with written reasons** in `docs/PROGRESS.md`, so the next round doesn't undo them.
4. **Every shot is consistent with the style block.** When a shot and the block disagree, change one of them on
   purpose and write down which.

The checks still apply whatever the style: the sung word whole and readable (`check_shots.mjs` LYRICS HIDDEN, LOW
CONTRAST), flash safety, sync. They measure; they don't decide the look.
