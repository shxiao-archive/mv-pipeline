# Direction — how a film finds its ideas

Read this before the concept, whatever the style. `design-a-style.md` (the default) and the preset briefs
(`styles/<preset>/BRIEF.md`) give the visual identity and the methods; this file is how to think with them. Nothing here is a quota: every rule says why, so you can
break it on purpose when the song asks for it.

## 1. The order of work (it protects the ideas)

1. **The song first.** Read the lyrics as a poem and the music as a map (§2), with no engine, index or starter open.
2. **An idea bank** (§4): about 20 picture ideas from this song's own words.
3. **The concept** in `docs/CONCEPT.md`: thesis, the style and the methods each section uses, frame and arc, signature moments (§5). ◆ Show
   it to the user.
4. **Only now the library.** For each chosen idea, search the index (`grep -i <words> index/index.jsonl`) and decide:
   use it as it is, use it with its knobs, copy it into the film's own `engine/scenes/<film>.js` and change it, or write
   something new. The library implements ideas; it is not where ideas come from. Browsing it first gives every film
   the same 24 scenes.

## 2. Read the song

- **The words.** List the concrete nouns (a door, a thread, a floor, fire), the verbs of motion and state (fall, pick
  up, crumble, won't go out), the sensations (cold fingertips, a wet floor) and the addressee (who is sung to). This
  list is specific to this song, which is what keeps the film from looking like the last one.
- **The music.** Use `analysis/overview.png`: where it breathes (stops, breakdowns), where it explodes (chorus
  downbeats, post-chorus hits), its tempo and feel, how it ends (fade or dead stop). Stops are gifts: a freeze, a
  black frame, a held breath.
- **The turn.** Most songs move from one state to another (despair → resolve, longing → letting go). The film's light,
  colour and composition travel the same way.
- **The thesis.** One sentence that turns the song into a *visual mechanism*, not a mood. "Afterglow" → *light that
  remains after its source is gone* (afterimages, embers, a sky still glowing). Forgetting → *things lose their
  outlines*. Waiting → *time loops* (the same shot again with one change). Anger → *pressure until it breaks*.

## 3. What each part of the song is for

| part | its job | usual treatment (depart from it with a reason) |
|---|---|---|
| intro | promise the world | sparse, one image or idea; the title on the riff |
| verse (Aメロ) | tell | slower cuts, wider or intimate shots, small type, one effect at a time |
| pre-chorus (Bメロ) | build tension | closer, shorter cuts, the light starts to change, a hold (溜め) before the hook |
| chorus (サビ) | pay off | full palette, the biggest type, the key picture, cuts on downbeats, キメ on the hits |
| interlude (間奏) | show off | no vocals: a set piece, a camera move, pure motion |
| second verse | vary | the first verse's grammar plus one new element |
| bridge (Cメロ) | turn | another place, time or palette; the film's reveal |
| drop chorus (落ちサビ) | strip back | one picture, one light, the voice alone |
| last chorus (ラスサビ) | maximum | earlier pictures return changed and bigger, plus one move never seen before |
| outro | resolve | the opening image returns transformed; a composed last picture |

## 4. Finding ideas (so they do not run out)

### The idea bank
Before any storyboard, write about 20 picture ideas, one or two lines each, from §2's lists: at least five literal,
five metaphorical, three that show the opposite of the words, two that are type alone. Then choose. Ideas that
survive a choice are better than the first ones that came.

### Operators on a lyric image
Take an image from a line and turn it:
- **literal**: what the words say;
- **metaphor**: what it feels like (a promise as a thread, waiting as a stopped clock);
- **opposite**: what the words deny ("I'm fine" over an empty room);
- **scale**: tiny in a huge frame, or so close it turns abstract;
- **material**: the thing made of something else (a city of paper, rain of type);
- **time**: the same place before or after; the moment just missed;
- **point of view**: from the object's side, from above, through glass, through a screen;
- **the word's motion**: what the verb does to the type and to the camera.

### Rules that force variety
- **Change two axes per cut**: framing size, side of frame, light, type treatment, motion speed, depth. The same spot
  at the same size twice reads as a jump, not a cut.
- **An escalation ladder**: decide what each chorus raises (closeness, warmth, type size, cutting speed, density) and
  raise one or two each time, so the last chorus still has room.
- **Motifs return changed**: a motif appears at least three times, each in a new state; the last answers the first.
- **Repetition with change**: a repeated line never gets the same shot twice.
- **One rule broken on purpose**: the only centred frame, the only colour outside the palette, the only silent second,
  placed on the song's biggest moment.
- **Something happens in every shot**: a picture that only illustrates a word is a caption.

### Make it different from the last film
Pick one option per axis from the song's own material, and if the picks match a film you already made (or a case
study) on more than three axes, push further: world, time arc, exposure (low-key night or high-key day), palette,
master shape (circle, frame, line, spiral, grid, wave), material (glass and light, paper and ink, water, smoke, static,
clockwork), line style, who is seen (a singer, an android, two people, hands only, nobody), typography voice,
transition grammar, ending, pacing (some songs want long takes), type density (some films are mostly text).

## 5. The concept (`docs/CONCEPT.md`)

Half a page; lyric lines by number only. The jury reads it and judges the film against it, so it says what the film
is trying to do, not what the style usually does:
- thesis and logline; the style, and per section the methods the song asks for, and why;
- the frame (how it opens and closes) and the one thing that escalates every chorus;
- 2–4 signature moments with their cues and why each is the peak there;
- how each section sets its lyrics (each its own way; the keyword is the peak of its phrase);
- the colour script, one line per section;
- a "not in this film" list: the clichés this song invites (generic particles, lens flares, stock "AI" imagery,
  default neon) and the look-alikes to avoid.

Record every later departure and every change the user asked for, with the reason, in `docs/PROGRESS.md`, so the next
round does not undo it.

## 6. Combining

A style's methods mix freely inside one film (an illustrated ボカロPV whose bridge breaks down at full speed, a chat
that cuts to treatise plates on its chorus), and styles can mix by section too (a stage show that opens in a pop-up
book). Make a switch work:
- **motivate it**: set it up before (the light heats, a glitch shows a line early) and let it be felt after (damage,
  recovery, a changed state);
- **keep one link** across it: the same cast, palette, motif or running number;
- **one lyric voice at a time**: never two lyric systems on screen at once (`check_shots.mjs` catches overlaps);
- **say it in the concept**: which sections use which methods, and why.

A style of your own is welcome too: write its idea, elements and motion in `docs/CONCEPT.md` the way the briefs do,
and build it from the shared engine.

## 7. Reading the library cheaply

`index/index.jsonl` has one line per scene, effect, transition, helper, lyric plan, grade and tool: what it shows, the
call, and `where` as `path:first-last` lines. Read that range (offset / limit), never the whole file; read a file's
header only when the range is not enough. Each style pack's `styles/<pack>/STYLE.md` is its technical manual: open
the section you need when you build with that pack.
