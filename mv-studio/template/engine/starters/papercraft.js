/* engine/timeline.js — STARTER for the PAPERCRAFT style (styles/papercraft; read <skill>/styles/papercraft/BRIEF.md, then its STYLE.md).
 * A cut-paper collage picture book, read aloud: every shot is a spread of the open book (scene pcStory), the lyric line
 * is set on the page as the story's text and inks in as it is sung, the camera holds while the cast walks across the
 * spread, and the pages turn between spreads.
 *
 * This starter builds a plain first cut from the song's sections and lyric lines so a new project renders at once:
 * the book opens -> one spread per lyric line, a new land and a page turn per section, the shot size changing line by
 * line (wide: the travellers walk; medium: they stop and act, a townsperson steps in; close: a face reacts) -> the
 * book closes. It is scaffolding: give the roles YOUR looks (PC.story.folk, STYLE.md §2), and replace every spread with
 * the concrete event its line names (a prop handed over, something appearing; BRIEF §1.7), from your shot list.
 * Lyric text never appears here: lines by index only.
 */
(() => {
  'use strict';
  const Z = window.Z, PC = Z.PC, P = PC.PAL;
  Z.TITLE = 'untitled';
  Z.TITLE_SUB = '';
  Z.ARTIST = '';
  Z.CREDIT = '';
  // the cast: the folk rig, one look per role (REPLACE with the film's own; s 1 ~ 186 px); extras are townsfolk variants
  PC.story.folk.hero = { seed: 3, look: { H: 186, bw: 31, body: P.blue, sleeve: P.blue, trim: '#3f5f86', hair: 'short', hairC: '#4A3428',
    hat: 'straw', hatC: '#c9a46a', hat2: '#7a5a3a', acc: ['belt', 'satchel'], bag: '#a8784a', strap: '#5a3d2b', legs: '#5a4636', shoes: '#4a3428', skin: 'light' } };
  PC.story.folk.companion = { seed: 5, look: { H: 164, bw: 30, flare: 1.16, body: P.pink, sleeve: P.pink, trim: '#b8607a', hair: 'pigtails',
    hairC: P.gold, lashes: true, legs: '#f2e8d8', shoes: '#7a4a32', skin: 'light' } };
  const LANDS = ['meadow', 'dusk', 'snow', 'meadow'];
  const WIDE = 1.35, MED = 2.2, CLOSE = 4.2, MY = 960, CY = 1190, V = 110;  // shot sizes (cast s), feet y medium / close, walking px/s

  Z.setup = async (audio) => {
    const nb = t => audio.beats.reduce((b, x) => (Math.abs(x - t) < Math.abs(b - t) ? x : b), audio.beats[0] ?? t);
    const secs = audio.sections || [];
    Z.sectionAt = t => { let s = secs[0] || null; for (const x of secs) if (x.start <= t + 1e-6) s = x; return s; };
    if (/[぀-ヿ]/.test(Z.LYR.map(l => l.text).join(''))) PC.useJapanese();
    PC.install();
    Z.LOOK_DEFAULT = Object.assign({}, PC.post);
    await Promise.all(PC.fontsToLoad.map(f => document.fonts.load(f, 'Aa0字あ')));

    const S = [], END = audio.music_cut || audio.duration, L = Z.LYR, beat = 60 / (audio.bpm || 120);
    const shot = (id, t0, t1, scene, args, extra = {}) => { if (t1 > t0 + 0.05) S.push(Object.assign({ id, t0, t1, scene, args, lyric: 'none', hud: false, post: PC.post }, extra)); };
    // wide: the travellers cross the spread at walking pace, centred on it (the rig plants the feet from x)
    const walkers = (who, t0, t1) => S => who.map((w, k) => ({ who: w, x: 960 - V * (t1 - t0) / 2 - 150 + k * 260 + V * (S.t - t0), face: 1, walk: 1, s: WIDE }));
    // medium: they stop and act; a townsperson steps in from the right halfway (REPLACE: the line's own exchange)
    const meeting = (who, t0, t1, si) => S => {
      const k = Math.min(1, Math.max(0, (S.t - (t0 + t1) / 2) / 0.8)), c = [{ who: who[0], x: 760, y: MY, s: MED, face: 1, pose: 'point', expr: k ? 'happy' : 'curious' }];
      if (who[1]) c.push({ who: who[1], x: 1120, y: MY, s: MED * 0.95, face: -1, pose: 'lookUp', expr: 'smile' });
      if (k > 0) c.push({ folk: { variant: si % 12, seed: 20 + si }, x: 2100 - 560 * k, y: MY, s: MED * 0.9, face: -1, walk: k < 1 ? 1 : 0, pose: k < 1 ? 'walk' : 'wave', expr: 'smile' });
      return c;
    };
    // close: one face fills the page away from the text and reacts on the second half of the line (REPLACE)
    const closeUp = (w, t0, t1, textAt) => S => [{ who: w, x: textAt === 'L' ? 1300 : 620, y: CY, s: CLOSE, face: textAt === 'L' ? -1 : 1, pose: 'idle', expr: S.t < (t0 + t1) / 2 ? 'calm' : 'happy' }];
    const first = secs.length ? secs[0].start : 0, l0 = L.length ? nb(L[0].t - 0.05) : END, o0 = Math.min(l0, first > 0.5 ? first : l0);
    const open = o0 < 1.5 ? 0 : o0;                                             // singing from the first second: no time to open the book, start inside it

    shot('s00', 0, open, 'pcBook', { mode: 'open', pop: 'hills' }, { moment: 'the picture book opens' });
    let k = 0;
    secs.forEach((sec, si) => {
      const a = Math.max(open, sec.start), b = Math.min(END, sec.end ?? END);
      if (b <= a + 0.3) return;
      const ls = L.filter(l => l.t >= a - 0.05 && l.t < b - 0.3), land = LANDS[si % LANDS.length], textAt = si % 2 ? 'R' : 'L';
      const who = si ? ['hero', 'companion'] : ['hero'];                       // REPLACE: who is in the story when
      const cuts = [a].concat(ls.map(l => nb(l.t - 0.05)).filter(t => t > a + 0.4 && t < b - 0.4));
      cuts.forEach((c0, j) => {
        // a section that starts mid-line carries the line still being sung, not the next one (sung from the next cut)
        const c1 = cuts[j + 1] ?? b, line = ls.find(l => Math.abs(nb(l.t - 0.05) - c0) < 0.01) || (j ? ls[j] : L.find(l => l.t < c0 && l.end > c0 + 0.1)), li = line ? line.i : null;
        const size = (j + si) % 3, cast = size === 0 ? walkers(who, c0, c1) : size === 1 ? meeting(who, c0, c1, si) : closeUp(who[who.length - 1], c0, c1, textAt);
        shot(`s${++k}`, c0, c1, 'pcStory', { land, line: li, textAt, cast }, {
          line: li ?? undefined, trans: { type: 'pageTurn', dur: (j ? 1 : 2) * beat },
          moment: line ? `line ${line.i}: ${['wide', 'medium', 'close'][size]} in the ${land} (REPLACE: the event this line names)` : `${sec.label || 'section'}: the ${land}`,
        });
      });
    });
    if (!secs.length) shot('s01', open, END, 'pcStory', { land: 'meadow', line: L.length ? 0 : null, cast: walkers(['hero'], open, END) }, { line: L.length ? 0 : undefined, moment: 'the hero in the meadow' });
    shot('s99', END, END + 3, 'pcBook', { mode: 'close' }, { moment: 'the storyteller closes the book', cue: Z.CUES.end ? 'end' : null, trans: { type: 'pageTurn', dur: 0.8 } });
    Z.SHOTS = S;
    Z.VERTICAL_CFG = { full: [], planMap: {}, quiet: S.map(s => s.id), title: Z.TITLE, sub: Z.TITLE_SUB, artist: Z.ARTIST, credits: [0, END], ambience: [94, 60, 40] };
    window.__zankoMeta.duration = END + 3;
  };
})();
