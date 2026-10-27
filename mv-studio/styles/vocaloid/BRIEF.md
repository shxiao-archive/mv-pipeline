# Vocaloid — the ボカロPV (preset)

Use this preset only when the user asked for a ボカロPV, a 手書き / 文字PV film or "vocaloid" (SKILL.md). The technical
manual is `styles/vocaloid/STYLE.md`; `styles/vocaloid/look.jpg` shows what
its starters render with no art of yours (look at it once: a floor to rise above, not the target).

**Reads as:** a ボカロPV. The lyrics are the main subject of the picture; motion-graphics layers and symbols surround
an original world; the editing rides the song; a few still illustrations come alive through camera, layers and
limited animation; one visual idea about the song runs through it all.

## 1. The feel

1. **The lyrics are the subject** (文字PV). Text isn't a subtitle. It rotates, scales, bounces, stacks, shatters,
   stands huge beside the character and fills the frame as one monument kanji, in time with the beat. *Why:* ボカロ
   audiences read the song; the typography *is* the performance. *Shows as:*
   - a word slammed on the chorus downbeat;
   - a line cascading down vertically on 8th notes;
   - a kanji too big for the frame (見切れ);
   - a word decoded from noise;
   - ruby as a second voice.

   **Size is the point.** Every section has at least one frame where the type *is* the picture: a word or a line that
   fills half the frame or more, cropped by the edge, the character small beside it or gone. Every chorus has several,
   and the chorus downbeat is one. Lyrics at caption size beside a centred girl, shot after shot, is the commonest
   failure. In iteration 6, two of three films did exactly that and read as an illustrated karaoke. The film that
   felt like a ボカロPV filled the frame with `kanjiSlam`, `titleRiff` and full-frame JIZURA layouts.
2. **One thesis, told in symbols rather than plot.** A full story isn't required. There is a motif bank where each
   motif has one meaning, a master shape and a secondary one, and a "red thread" that returns changed each chorus.
   *Why:* symbols carry feeling faster than plot in 3–4 minutes, and they let the film rhyme with itself. *Shows as:*
   - a circle that is the sun, a lamp, a full stop and an iris;
   - a motif cracked in the last chorus;
   - surreal juxtapositions (a classroom underwater, a city of glyphs).
3. **A motion-graphics layer.** Geometric shapes, colour blocks, lines, arrows, brackets, dimension lines, grids,
   screentone, UI fragments, HUD meta-type, all layered over or around the picture. *Why:* graphic overlays make a
   still look designed and give the beat something to hit. *Shows as:*
   - rings that pulse on the kick;
   - a hazard stripe that wipes;
   - a full-frame colour block on a punctuation beat;
   - brackets that open around a word and break.
4. **Editing driven by rhythm.** Cuts follow drum hits, the melody and the sections: flash frames, shake, crash zooms,
   rapid transitions, a cut one frame early, a black 溜め before the chorus. At full speed the overload comes from cut
   *frequency* plus meaningless filler frames, not from a dense frame ("疾走 = 剪辑速度"). *Why:* the film should feel
   played, like an instrument.
5. **One visual identity.**
   - One palette system applied as gradient maps over everything; generated art is made grey or neutral and coloured
     in the grade.
   - Fixed type roles.
   - A small set of symbols.
   *Why:* mixed sources (AI art, code, 3D) must read as one hand.
6. **Limited animation and reuse, as a strength.**
   - A few illustrations brought to life by camera push and pull, parallax, light, particles and type.
   - Partial animation (a blink, hair, a hand) on twos or threes, with line boil.
   - Loops of 2–3 frames; a new pose per beat; the same illustration returning re-framed.
   *Why:* this *is* the tegaki look; full animation would read as anime, not ボカロPV.
7. **Mixed media, held by the grade.** Hand-drawn, collage, pixel art, glitch and signal decay, retro UI, terminal
   junk, neon, cinematic painted backgrounds. A strong version sets **order against chaos**: a narrator layer (grid,
   log, readouts, brackets) snapped to the beat, against a world that drifts, tilts and piles up off the beat, slowly
   winning.
8. **Restraint, then escalation.**
   - Outside the climaxes, one screen effect and one decoration per shot.
   - Effects on a reserve list that unlocks by section.
   - Choruses call back the first chorus's layouts with one thing raised (boil, zoom, afterimage, cut density).
   - At least three real holds.
   - The ending is an idea (a hard cut on the dead stop, then an afterimage).

## 2. Art construction (what makes a frame look finished)

- **The illustrated plate and the character.**
  - Painted places with their hour.
  - The character grounded on the plate: a contact shadow, the plate's light on her, things that touch painted in one
    image.
  - Three depth layers, often a blurred dark foreground.
  - When she must stay the brightest thing, grade her separately and cap the light sources below her white.
- **Colour craft.**
  - Gradient-map LUTs per section, or one heat curve: cold → hot → drained.
  - The accent takes ≤ ~8 % of the frame; line colour comes from the palette's ink; pure black only on hard-cut
    frames.
  - Motivated inversions; colour-block punctuation frames.
- **A type system.** Roles such as:
  - monument mincho (huge, cropped);
  - lyric mincho;
  - gothic impact;
  - a hand;
  - a pixel face for the system voice, at its grid multiples only;
  - ruby.

  Set on a type scale and a 12-column grid, centre-free when the subject is central, with 縦横混植 for キメ frames and
  no faux-bold CJK.
- **Texture is the glue:** grain and paper always on, boil on the drawn layers, a bloom only on light.
- **In signal passages:** tear bands, chroma split, multipath ghost, a rolling band, vertical-hold jumps; sensor
  sparkles and hot pixels that accumulate over the song and never heal; scanlines; a vignette.
- **Composition:**
  - The subject on a third, facing the open side, the lyric in the other two thirds, clear of her.
  - A shot vocabulary for fast sections: full / crop (eye, mouth, hand, neck) / cut-out / silhouette / split panels /
    the word full frame. Each cut re-rolls its framing.
  - Scale and place change from shot to shot. The same standing pose in the middle of the same plate, with a caption
    on each side, is one shot repeated, however many plates you generated.
- **Finished versus amateur:** a finished frame has a designed graphic layer, type set as part of the picture, and
  one accent. An amateur frame is a centred anime girl in front of a sunset glow, with a subtitle.

## 3. Motion vocabulary

| move | feel | when | not when | size |
|---|---|---|---|---|
| per-mora pop | playful, sung | verse lines, ruby | over a busy picture | backOut, 4–6 frames, drawn at 12 fps |
| word slam | the キメ lands | chorus キメ and section entries, ≤ 2 per bar | every verse line (it cheapens) | scale 3 → 1 in 2 frames, 1-frame flash, 6 px shake over 6 frames |
| monument kanji | weight, awe | chorus downbeats and the title on the riff, cropped by the frame | small or centred | lands on the downbeat −1 frame, not on the first sung word |
| vertical cascade | falling, flowing | lines about falling, rain, time | fast choruses | staggered by 8th notes |
| decode / weight bloom / glyph morph | a word forming or changing its mind | a turn in the lyric | every line | scramble 6–10 frames; morph over 1 beat |
| chaos lyric | panic, overload | the sprint | quiet sections | a new layout each beat, 3-frame overshoot, ghosts of earlier lines at 10–24 % |
| beat zoom | breathing with the music | everywhere, scaled by section | — | 0.008 in verses up to 0.03 in choruses |
| crash zoom | a lunge into the hit | the 3 frames before a downbeat | more than once a phrase | 3 frames |
| punch / shake entry | a cut that hits | fast sections | quiet sections | scale 1.22 → 1 in 4 frames; shake 34 px decaying over 5 frames |
| fast transitions | speed | between motifs at the fast end | slow sections | whips, push with a white seam, zoom-through, spin, slices: 4 frames with directional blur |
| drift on every cut | stills never sit dead | the fast end | holds | 120–380 px/s |
| burst per beat | a flurry | at most 2 bars | longer (it numbs) | one framing per beat |
| match cut on the master shape | rhyme | section changes, the turn | — | iris or shape cut, 0.3–0.5 s |
| 溜め / black hold | the breath before | before a chorus, on a stop | — | 6–12 frames still or black |
| freeze / rewind / melt | time breaking | the bridge, a repeated line | — | — |
| afterimage | something persists | endings, memory | — | 2–3 s fade |

**The motion feel:**
- Drawn layers (character poses, boil, loops) step on twos or threes. Camera, light, particles and grain run on ones.
- Type pops with overshoot.
- Cuts land a frame early and flash on the beat. A section (chorus, drop, riff) enters on the band's downbeat slam,
  even when the first sung word comes a beat later.
- Hits are hard. A pulse on the beat, a slam, an abrupt JIZURA entrance: `pops.mjs` lists these as HITs and passes
  them. Never smooth a hit into a soft wave to pass a check.
- The fast end drifts constantly and snaps on the grid. The calm end holds and pushes slowly.
- Contrast is what makes speed: if every section sprints, nothing is fast.

## 4. Let the song choose

All of this is the identity; what each section uses comes from the song. Place each section on a few ranges, and say
in the concept where each sits and why:

| range | from | to |
|---|---|---|
| speed | held pictures | half-beat cuts with fillers and inserts |
| picture | painted places with a character | crops, symbols and pure type |
| integrity | clean | decaying |
| colour | a light per section | one heat curve |
| type | lyrics living in depth | the machine's stamped type |

Many films travel along these ranges, and the travel is the story.

## 5. How the reference films were made

- **「残光」:**
  - A research bible with sources; a palette contact sheet; shader previews on a test scene.
  - Three master candidates for the character, then every pose generated from the master with one shared style
    block.
  - A probe of the lyric layouts; deny lists grown from failures.
  - Midpoint stills → a full render → review sheets every 1.8 s, over 2–3 passes. The reviews changed the storyboard.
- **熱異常 PV:**
  - Storyboard v3 → v4 → v5 replaced only the shot layer.
  - The creator's own calibrations are dated: overload 10 → 8; a third of the inserts turned into transitions; the
    distortion kept weak while cold; the burst placed before the lyric.
  - Ideas that didn't work were dropped (giant-kanji windows, collage, a counting rule).
  - A character lock document; one neutral-colour asset table with review sheets.

## 6. Craft notes

- Lyrics are readable for ≥ max(0.7 s, 0.09 s × characters).
- **Every sung word is whole and stands apart from the picture.**
  - The character never covers the words (`check_shots.mjs`: LYRICS HIDDEN, ≤ 5 %). Only decoration and monument
    shapes go behind her.
  - Contrast is at least 3:1 against what surrounds the words (LYRICS LOW CONTRAST). On a busy or same-hue picture,
    give them an outline, a shadow or a plate, or a value from the other end of the palette. In iteration 6, purple
    and gold type on purple neon read as texture, not words.
- One lyric system on screen at a time.
- Full-frame white flashes only at 3–6 key points, never twice within a second; inserts stay dark; `check_flash.py`
  on every render.
- A new pose comes with a cut or as a per-beat drawn sequence of *one* action, never A → B → A inside a shot
  (`check_shots.mjs` warns).

## 7. Avoid

- A generic "anime girl + sunset + glow" disconnected from the lyrics.
- Every shot at the same intensity; effects stacked on everything; no holds.
- Impacts too small to read (a 1–3 px wiggle); glitch as a filter with no cause.
- Type that only fades; one layout for every line; lyrics over the face.
- Copying a reference film's motifs, character, palette or lyrics.

## 8. Where it lives

Search `grep '"vocaloid"' index/index.jsonl`, or by word. In a vocaloid film these stock scenes are yours to use;
pass your own art, glyphs and colours in their args (their default image paths name the demo's files, which a new
film doesn't have: a missing file stops the preload). Reaching for them first beats rewriting them in a film file:
- `scene:illust` (the character on a plate, lit, grounded);
- `scene:titleRiff` (the title as cropped monument glyphs on the riff; `glyphs`, `ruby`, `sky`, `final`, `char`);
- `type-scene:kanjiSlam` (one kanji per beat, full frame; `char`, `bg`), `type-scene:typeCard` (a line as the whole picture),
  `type-scene:tunnel`;
- `scene:burst` (one framing per beat), `scene:panels` (split panels), `scene:ref` (freeze / rewind / melt of
  another shot), `scene:converge`, `scene:afterimage` (the end card);
- the JIZURA plans (`lyric-plan:*`, references/06);
- the shape kit and type moves (`core/mg.js`, `core/typefx.js`);
- `helper:Z.impact`;
- `helper:SIG.cuts` and `scene:sigShot` (speed, the fast shot vocabulary);
- `helper:SIG.heat`, `helper:SIG.install` (the heat grade and the decay layer, limited to sections with `spans`);
- the device HUD (`SIG.hud`);
- the grade (shot `post`);
- the film's own `engine/scenes/<film>.js`.

Starter: `--style vocaloid`, a first cut that cycles illustrated shots and signal runs through the lyric lines (a
hand-built tegaki film: `demo/hotarubi.js`). An example to rewrite.
