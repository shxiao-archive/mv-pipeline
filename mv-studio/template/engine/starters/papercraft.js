/* engine/timeline.js — STARTER for the PAPERCRAFT style (styles/papercraft; read <skill>/styles/papercraft/BRIEF.md, then its STYLE.md).
 * A cut-paper collage picture book, read aloud: every shot is a spread of the open book (scene pcStory), the lyric line
 * is set on the page as the story's text and inks in as it is sung, the camera holds while the cast walks across the
 * spread, and the pages turn between spreads.
 *
 * This starter builds a plain first cut from the song's sections and lyric lines so a new project renders at once:
 * the book opens -> one spread per lyric line, a new land and a page turn per section, the travellers crossing left to
 * right -> the book closes. It is scaffolding: cut YOUR cast from generated reference sheets (tools/cut_puppet.py;
 * until then the roles draw as flat PC.doll stand-ins), and design the story's pages from your shot list.
 * Lyric text never appears here: lines by index only.
 */
(() => {
  'use strict';
  const Z = window.Z, PC = Z.PC, P = PC.PAL;
  Z.TITLE = 'untitled';
  Z.TITLE_SUB = '';
  Z.ARTIST = '';
  Z.CREDIT = '';
  // the cast: roles cut into assets/cast/ by tools/cut_puppet.py; LOOK is the PC.doll stand-in until they are (REPLACE)
  const LOOK = { hero: { hairStyle: 'mop', hair: '#4A3428', outfit: P.blue, seed: 3 }, companion: { hairStyle: 'braid', hair: P.gold, outfit: P.pink, seed: 5 } };
  const LANDS = ['meadow', 'dusk', 'snow', 'meadow'];
  const SC = 0.7, STRIDE = 127 * SC / 0.5, V = 110;              // puppet scale, px per walk cycle, walking speed px/s

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
    // the travellers cross the spread at walking pace, centred on it; the first role leads on the left
    const walkers = (who, t0, t1) => S => who.map((w, k) => { const x = 960 - V * (t1 - t0) / 2 - 150 + k * 320 + V * (S.t - t0); return { who: w, x, face: 1, walk: 1, phase: x / STRIDE, s: SC, look: LOOK[w] }; });
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
        shot(`s${++k}`, c0, c1, 'pcStory', { land, line: li, textAt, cast: walkers(who, c0, c1) }, {
          line: li ?? undefined, trans: { type: 'pageTurn', dur: (j ? 1 : 2) * beat },
          moment: line ? `line ${line.i}: a page of the story in the ${land} (REPLACE: what happens on this page)` : `${sec.label || 'section'}: the ${land}`,
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
