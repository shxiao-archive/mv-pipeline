/* engine/timeline.js — STARTER for the STAGE style (styles/stage; read <skill>/styles/stage/STYLE.md first).
 * A picture-book show on a painted theatre stage: watercolour + boiling ink on paper, an original puppet troupe acting
 * the song out, choruses back on the SAME stage escalating each time, brush wipes between chapters, a karaoke bar.
 *
 * This starter builds a plain first cut from the song's sections and lyric lines so a new project renders at once:
 * curtain up -> verses act each line in a painted place -> choruses dance on stage -> the curtain closes on a bow.
 * It is scaffolding, not the film: design YOUR troupe, write one gag per line (something HAPPENS in every shot), the
 * chorus escalation and the twist, from your shot list (moment / line / cue per shot; node tools/storyboard.mjs).
 * Lyric text never appears here: lines by index only (the karaoke reads Z.LYR).
 */
(() => {
  'use strict';
  const Z = window.Z, ST = Z.ST, PAL = ST.PAL;
  Z.TITLE = 'untitled';
  Z.TITLE_SUB = '';
  Z.ARTIST = '';
  Z.CREDIT = '';
  // the troupe: REPLACE with your own designs (colours, top, hats). The lead carries the story.
  const LEAD = { col: PAL.teal, top: 'sprout', blush: true };
  const TROUPE = [{ col: PAL.rose, top: 'ears', hat: 'party' }, { col: PAL.ochre, top: 'antenna', hat: 'bow' }, { col: PAL.violet, top: 'none', hat: 'top' }, { col: PAL.sky, top: 'sprout', hat: 'flower' }];
  const SFX = ['POP!', 'WOW!', 'BOOM', 'TA-DA!', 'ZOOM'];   // sound effects only: a few in the whole film, never the lyric

  Z.setup = async (audio) => {
    const lastBar = audio.bars.length ? audio.bars[audio.bars.length - 1].index : 0;
    const B = n => { const b = audio.bars.find(x => x.index === n); if (b) return b.start; if (n < lastBar) return 0;
      const db = audio.downbeats || [], k = db.findIndex(d => Math.abs(d - B(lastBar)) < 1e-3) + n - lastBar;   // a bar the song cuts into
      return k > 0 && db[k] < audio.music_cut ? db[k] : audio.music_cut; };
    const nb = t => audio.beats.reduce((b, x) => (Math.abs(x - t) < Math.abs(b - t) ? x : b), audio.beats[0] ?? t);
    const secs = audio.sections || [];
    Z.sectionAt = t => { let s = secs[0] || null; for (const x of secs) if (x.start <= t + 1e-6) s = x; return s; };
    if (/[一-鿿]/.test(Z.LYR.map(l => l.text).join('')) && !/[぀-ヿ]/.test(Z.LYR.map(l => l.text).join(''))) ST.useChinese();
    ST.install();
    Z.LOOK_DEFAULT = Object.assign({}, ST.post);
    await Promise.all(ST.fontsToLoad.map(f => document.fonts.load(f, 'Aa0あ')));

    const S = [], END = audio.music_cut || audio.duration, L = Z.LYR;
    const isChorus = s => /^(chorus|sabi|hook)/i.test(s.label);
    const linesIn = (a, b) => L.filter(l => l.t >= a - 0.05 && l.t < b - 0.05).map(l => l.i);
    const shot = (id, t0, t1, scene, args, extra = {}) => { if (t1 > t0 + 0.05) S.push(Object.assign({ id, t0, t1, scene, args, lyric: 'none', hud: false, text: ST.karaoke }, extra)); };
    const first = secs.length ? secs[0].start : 0, open = first > 0.5 ? first : nb(Math.min(2.5, END));

    // ---- 0. curtain up: the title on the backdrop, the lead pops up through the trapdoor and waves
    shot('s00', 0, open, 'stTitle', { lead: LEAD, open: Math.min(1.6, open * 0.6) }, { moment: 'curtain up: the title on the backdrop, the lead pops up and waves' });

    let k = 0, chorusN = 0;
    const skies = ['day', 'dusk', 'sea', 'room', 'night'];
    secs.forEach((sec, si) => {
      const a = Math.max(open, sec.start), b = Math.min(END, sec.end ?? END);
      if (b <= a + 0.3) return;
      const wipe = { type: 'brushWipe', dur: 0.6, cols: si % 2 ? [PAL.indigo, PAL.violet] : [PAL.crimsonDk, PAL.crimson] };
      if (isChorus(sec)) {
        // ---- chorus: the troupe dances on the stage; every chorus is bigger than the last (more dancers, spots, confetti)
        const ci = chorusN++, cuts = audio.bars.filter(x => x.start >= a - 0.01 && x.start < b - 0.5).filter((_, j) => j % 2 === 0).map(x => x.start);
        if (!cuts.length || cuts[0] > a + 0.01) cuts.unshift(a);
        const nT = Math.min(TROUPE.length, 2 + ci), spots = Array.from({ length: 1 + Math.min(3, ci) }, (_, j) => [480 + j * 960 / Math.max(1, Math.min(3, ci)), [PAL.cream, PAL.rose, PAL.sky, PAL.ochre][j]]);
        const cast = [Object.assign({ x: 960, y: 900, u: 46, move: 'mix', seed: 0 }, LEAD)]
          .concat(TROUPE.slice(0, nT).map((m, j) => Object.assign({ x: 960 + (j % 2 ? 1 : -1) * (360 + 220 * Math.floor(j / 2)), y: 840, u: 26, move: 'mix', seed: j + 1 }, m)));
        const angles = [{ from: { zoom: 1.0 }, to: { zoom: 1.06 } }, { from: { x: 960, y: 560, zoom: 1.55 }, to: { x: 960, y: 600, zoom: 1.7 } }, { from: { x: 760, zoom: 1.2, rot: -0.03 }, to: { x: 1160, zoom: 1.25, rot: 0.03 } }];
        cuts.forEach((c0, j) => {
          const c1 = cuts[j + 1] ?? b;
          shot(`s${++k}`, c0, c1, 'stShow', { backdrop: { a: [PAL.rose, PAL.sky, PAL.violet, PAL.teal][ci % 4], b: PAL.ochre, spin: 0.12 + 0.05 * ci }, spots, cast,
            camera: Object.assign({ beat: 0.02 + 0.01 * ci }, angles[j % angles.length]), confetti: j === 0 && ci > 0 ? [c0] : [] },
            Object.assign({ line: linesIn(c0, c1), moment: `chorus ${ci + 1}: the troupe dances on the stage (REPLACE: this chorus's escalation, one gag per line)` }, j === 0 ? { trans: wipe } : {}));
        });
      } else {
        // ---- verse / other: one painted place per section, one shot per line; the lead acts each line out
        const sky = skies[si % skies.length], ls = L.filter(l => l.t >= a - 0.05 && l.t < b - 0.3);
        const cuts = [a].concat(ls.map(l => nb(l.t)).filter(t => t > a + 0.4 && t < b - 0.4));
        cuts.forEach((c0, j) => {
          const c1 = cuts[j + 1] ?? b, line = ls.find(l => Math.abs(nb(l.t) - c0) < 0.01) || ls[j], peak = line && (line.kime || line.emph.length);
          const faces = ['normal', 'happy', 'look', 'spark', 'heart', 'scared'], f = faces[(j + si) % faces.length];
          shot(`s${++k}`, c0, c1, 'stSet', { sky, sun: sky === 'day' || sky === 'dusk' ? { x: j % 2 ? 420 : 1500, y: 240 } : null,
            cast: [Object.assign(j % 2 ? { x: 1180, walkTo: [[c0, 1180], [c0 + 0.6, 1060]], move: line ? 'hop' : 'walk' }          // close: steps in, hops
              : { x: 420, walkTo: [[c0, 420], [c0 + 0.1, 1500]], walkDur: Math.max(0.8, c1 - c0 - 0.3), move: 'hop' },             // wide: crosses the whole frame
              { y: 900, u: 44,
              mood: [[c0, 'normal'], [c0 + 0.25, f === 'normal' ? 'happy' : f, f === 'scared' ? 'sweat' : f === 'heart' ? 'heart' : 'music']], mouth: 'smile' }, LEAD)],
            camera: j % 2 ? { from: { x: 1120, y: 620, zoom: 1.3 }, to: { x: 980, y: 580, zoom: 1.5 }, beat: 0.025 } : { from: { zoom: 1.0, x: 820 }, to: { zoom: 1.15, x: 1080 }, beat: 0.025 },
            sfx: peak ? [{ text: SFX[(k + si) % SFX.length], at: c0 + 0.1, x: j % 2 ? 640 : 1300, y: 300, size: 150, col: PAL.ochre }] : [] },
            Object.assign({ line: line ? line.i : undefined, moment: line ? `line ${line.i}: the lead acts it out (REPLACE: the gag for this line)` : `${sec.label || 'section'}: the lead walks through ${sky}` }, j === 0 ? { trans: wipe } : {}));
        });
      }
    });
    if (!secs.length) shot('s01', open, END, 'stShow', { cast: [Object.assign({ x: 960, y: 900, u: 46, move: 'mix' }, LEAD)] }, { line: linesIn(open, END), moment: 'the lead dances on the stage' });

    // ---- the end: the whole troupe takes a bow and the curtain closes
    shot('s99', END, END + 3, 'stShow', { curtain: [[END, 0], [END + 1.2, 1]], spots: [[960, PAL.cream]],
      cast: [Object.assign({ x: 960, y: 900, u: 46, move: 'bow' }, LEAD)].concat(TROUPE.map((m, j) => Object.assign({ x: 960 + (j % 2 ? 1 : -1) * (330 + 200 * Math.floor(j / 2)), y: 860, u: 28, move: 'bow' }, m))),
      camera: { from: { zoom: 1.12 }, to: { zoom: 1.0 } } }, { moment: 'curtain call: the troupe bows, the curtain closes', cue: Z.CUES.end ? 'end' : null });
    Z.SHOTS = S;
    Z.VERTICAL_CFG = { full: [], planMap: {}, quiet: S.map(s => s.id), title: Z.TITLE, sub: Z.TITLE_SUB, artist: Z.ARTIST, credits: [0, END], ambience: [236, 226, 208] };   // paper-tinted surround, this film's header; quiet: no karaoke ghost in the blurred bands
    window.__zankoMeta.duration = END + 3;
  };
})();
