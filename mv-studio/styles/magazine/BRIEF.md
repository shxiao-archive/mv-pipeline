# Magazine — the experimental print-magazine film (preset)

Use this preset only when the user asked for it: a "magazine" / "zine" / "print" / "riso" film, a 雑誌 or 誌面 look,
an editorial or typeset lyric film, or "magazine" by name (SKILL.md). The technical manual is
`styles/magazine/STYLE.md`; `styles/magazine/look.jpg` shows what its starter renders with stand-in pictures (look at
it once: a floor to rise above, not the target).

**Reads as:** a Japanese experimental magazine in which the song is typeset, printed, and then something happens to the
page. The lyric is set in vertical mincho columns, the pictures are separated into three inks on uncoated paper,
small editorial marks keep time with the music, and the page has a fate (burned through, torn, flashed, soaked, closed)
that is the film's story.

## 1. The feel

1. **Everything is printed.** Every picture passes through the press: separated into spot inks, screened into dots,
   slightly out of register, on paper with fibre and voids. *Why:* the press is what makes it a magazine and not a
   slideshow; the dot and the slip are proof of a physical object. The unscreened picture is the exception and so the
   reveal: a hole in the page shows the world raw.
2. **Three inks unify anything.** Key plus two spots (black, a red, a teal is the classic) is the whole palette.
   Photographs, generated art, renders and drawings all come out of the same three drums. *Why:* a limited ink set
   makes mismatched sources one publication, and colour becomes a decision, not a mood. A fourth ink appears once,
   for the climax, or never.
3. **Editorial furniture is the grammar, and it keeps time.** Folios whose page number is the bar number, running
   heads, captions, `fig.` labels with leader lines, crop and registration marks, a 16th ruler with a playhead,
   gauges that rise, a barcode, a time signature in the corner. *Why:* the marks make it read as a designed page and
   carry the rhythm quietly; the sung word is the only big thing on the page.
4. **The page is a body with a fate.** The paper burns where the piano strikes, tears on the stab, gets wet, sinks,
   floats, closes again at the end. *Why:* an object with a fate gives a lyric film a story without a character.
   Decide the fate first; every chapter is a stage of it.
5. **Rhythm becomes layout.** A bar of 3+3+3+3+4 is five strips; a 5/8 bar is two groups; four bars become four cells
   whose widths are their lengths; the strip being played develops while the others stay paper. Cuts land on group
   starts. *Why:* the metre becomes something you see, which no other style does; it is strongest on a song whose
   metre moves.
6. **Characters are material.** A kanji is stamped across a photograph on every accent; a character is taken apart
   (a radical leaves as bubbles and what remains is a new word); a proofreader rings a word in red or strikes it out
   with トル. *Why:* Japanese type carries meaning in its parts; taking it apart is the film's way of thinking.
7. **When the paper is gone, type becomes light.** Over a dark world the ink layer prints as light (screen), not ink.
   *Why:* it says the page has been left behind while the words go on.
8. **Memory as a single frame.** A one-tatum flash of a picture from earlier or later in the film, key-only negative,
   at the end of a phrase. Four to six in a film. *Why:* foreshadowing and memory at the speed of a thought.
9. **Three climaxes, each bigger.** Draft the intensity table first (section by section, how loud and what is at
   stake) and give each chorus a larger fate: the first swallows a photograph, the second the camera, the last the
   whole page. *Why:* escalation is what keeps a quiet, typographic style from flattening out.

## 2. Art construction (what makes a frame look finished)

- **Two layers, one press.** Pictures go into the proof layer in normal colour on white. Type and rules go into the
  ink layer as solid channels: key, spot A, spot B. The press separates, screens and misregisters the proof and prints
  the ink layer solid. Never draw a "printed" look by hand: draw clean and let the press print it.
- **A spread, not a screen.** Most frames are a page or a two-page spread: a gutter, margins, a picture block with
  crop marks, a column of type, a folio. Full-bleed pictures are for the climaxes.
- **Vertical type as the lyric voice.** Shippori Mincho for the sung line, set vertically, small kana and punctuation
  in the corner, revealed character by character as sung. Gothic (Zen Kaku) for labels, Dela Gothic for stamps, IBM
  Plex Mono for the furniture, an italic serif (Cormorant) for glosses in your own words.
- **Screens with intent.** Euclidean dot for photographs; a line screen for a harsh section; riso grain for intimacy.
  A coarse cell (10–14 px) reads as a cheap zine, a fine one (5–6 px) as a magazine. The dots growing coarse until
  they become something else (bubbles, stars, noise) is a transition.
- **Misregistration as an event.** Plates in register most of the time; a snare knocks spot A off by a few pixels and
  it springs back. A broken reprise can print permanently out of register.
- **Pictures you choose.** Generated art, the user's photos or your own renders, chosen for shape: a horizon, a hand,
  an eye, a figure against light. Generate neutral, colour in the press. Keep a manifest of sources.
- **Finished versus amateur:** a finished frame is a quiet page with one big sung line, exact marks, three inks and
  visible dots. An amateur frame is a photo with a halftone filter and text dropped on top in the middle.

## 3. Motion vocabulary

| move | feel | when | not when | size |
|---|---|---|---|---|
| page punch | the page jumps at you | kick, in the band sections | quiet verses | zoom 2–3 %, back in 0.1 s |
| plate slip | the print shudders | snare | constantly | spot A 5–8 px, spring back 0.15 s |
| grain sparkle | air in the paper | hats | — | grain +0.03 |
| develop | a picture appears out of paper | a strip or cell on its own beat | everywhere at once | photo from 0 to full in 1–2 frames, or a slow tone-up over a bar |
| hard cut on the group | the metre made visible | 4+3+3, 3+3+2 accents | 4/4 verses (use the bar) | one picture per group |
| stamp / slam | a word as a blow | chorus accents, one character per cut | every line | scale 2.4 → 1 in 0.22 s, outExpo |
| mora reveal | the voice writing | every sung line | — | per character at its sung time; a 70 ms fade-in |
| proof mark | a reader's hand | a word to stress or doubt | more than twice a chapter | a ring drawn in 0.35 s; a strike + トル |
| burn-through | the page is mortal | piano notes, intros, a cue | under a lyric | holes grow 0.35 s, scorched rim |
| tear | the break | the stab before a chorus, the last chorus | twice in a row | 0.6 s, outCubic; the sung line moves to a paper scrap |
| negative reprint | the far side | a reprise, the second verse | as a filter | the whole page, key negative |
| xerox streak | a cheap copy | breakdowns | everywhere | 0.2–0.5 |
| subliminal frame | memory, foreshadowing | phrase ends, 4–6 per film | a lyric moment | one tatum |

**The motion feel:**
- The page holds still; the press moves. Most motion is print mechanics on the beat (punch, slip, develop), not the
  camera.
- Hard cuts on bars and groups, holds on whole phrases; no dissolves (a page is turned, torn or burned, never faded).
- Hits are cue-locked to real events (a piano note, a stab, a kick), never a constant pulse.

## 4. Let the song choose

| range | from | to |
|---|---|---|
| page | one quiet spread per verse | a montage of full-bleed slams |
| inks | key + one spot, coarse dot | key + two spots, then a fourth for one climax |
| fate | the page intact | burned, torn, sunk |
| metre | 4/4: bars and pages | odd metre: strips, groups, grids |
| type | small, many marks | one character the size of the page |

A slow ballad can be a single magazine read page by page that closes at the end; a math-rock song is a layout made
of its own bar lengths. Say where each section sits in the concept.

## 5. How the reference film was made

- **The reference (he-drowns-mv-v2):** a real-time film in which a Japanese experimental magazine falls into the sea.
  Version 1 was the magazine drowning slowly; version 2 tore, soaked and swallowed the page and put a 3D sea behind it.
  Its photographs were 30 CC0 images with a licence table; version 2 dropped every classical painting.
- **It started from the music.** The band played to a click, so one 16th grid was locked by a period / phase search
  over the onsets, and the bar map (4/4, 3/8, 2/4, 5/8 as 4+6 and 4+3+3, a 5-5-5-6 cycle) was drawn on the
  spectrogram until it matched by eye. Drums were split per 16th (kick / snare / hat) and every hit drove one press
  mechanic. Here: `tools/meter_probe.py`, `analysis/meter.json`, `Z.clock.meter`, `Z.hit`.
- **It was planned as a table:** time, picture, lyric or music, one row per moment, with the key word landing on the
  frame where it is sung (the wave swallows the camera on one character). Plus an intensity chart with three climaxes.
- **It was checked as contact sheets** of chosen times, and by measuring the frame time and the clock drift.
- **Lessons:** a raw picture is strongest when it is rare; furniture that tracks the music (a gauge rising, a
  ruler) earns its place, static decoration does not; the page's fate needs a beginning (a burned cover) and an end
  (the page closing over the world).

## 6. Craft notes

- The sung line prints in key, or in a spot with at least 3:1 contrast against the paper, or as light over a dark
  world, and is never set over a busy picture without a paper band. check_shots measures only the text layer, so a
  scene's own type is your job.
- One sung line per frame; the columns before it are empty squares, not old lines.
- The page's marks are small (13–16 px mono); the line is big (64–96 px vertical). Never the other way.
- Inks are a decision per chapter: write them in the concept (`MZ.LOOK`, and `press` per shot).
- A raw, unscreened picture appears only where the page is cut away.

## 7. Avoid

- More than three inks as the norm; full-colour photographs pasted unprinted.
- A halftone filter over everything with the type on top; type outlines, glows, drop shadows.
- Digital glow, lens flares, bloom; dissolves and crossfades.
- Random jitter as "print"; misregistration that never returns.
- The interface preset's cool, precise tech document (hairline charts, signal orange, a spark): this is warm,
  physical, editorial.
- The reference film's song, its sea, its moon, its eye, its kanji (海 → 母) or its photographs.

## 8. Where it lives

Search `grep '"magazine"' index/index.jsonl`, or by word:
- the press: `MZ.begin`, `MZ.print`, `MZ.react`, `MZ.INKS`, `MZ.LOOK`;
- type and furniture: `MZ.lyricV / lyricH`, `MZ.vtext / vruby`, `MZ.folio`, `MZ.fig`, `MZ.ruler`, `MZ.gauge`,
  `MZ.proofCircle`, `MZ.strike`, `MZ.cropMarks`, `MZ.genko`, `MZ.barcode`, `MZ.meterGlyph`;
- scenes: `scene:mzSpread / mzContents / mzStrips / mzGrid / mzSlam / mzBurn / mzTear / mzContact / mzDecon /
  mzFlash`, `MZ.flash` (a subliminal insert for `Z.withInserts`), `MZ.stand` (stand-in pictures);
- the metre: `Z.clock.meter`, `Z.clock.groupPulse`, `Z.hit`, `tools/meter_probe.py`.

Starter: `--style magazine`. It is an example to rewrite.
