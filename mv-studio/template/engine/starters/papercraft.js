/* engine/timeline.js — STARTER for the PAPERCRAFT style (styles/papercraft; read <skill>/styles/papercraft/BRIEF.md, then its STYLE.md).
 * A pop-up paper storybook told as a retro RPG: every object is cut paper with a soft shadow, the camera is a multiplane
 * rig, the RPG interface (dialogue box, name tabs, coins, LV UP, a battle menu, the map with its red route) is made of
 * card, and the lyric lines are the dialogue, typed as they are sung.
 *
 * This starter builds a plain first cut from the song's sections and lyric lines so a new project renders at once:
 * the book opens -> each verse line is a step of the journey (left to right, a new land per section, coins and the
 * mini-map advance) -> the pre-chorus unfolds the map -> each chorus opens with a battle and ends with a LV UP -> the
 * book closes. It is scaffolding: design YOUR cast (PC.doll options), the lands, the quest, the running gags and the
 * shape-matched transitions from your shot list. Lyric text never appears here: lines by index only.
 */
(() => {
  'use strict';
  const Z = window.Z, PC = Z.PC, P = PC.PAL;
  Z.TITLE = 'untitled';
  Z.TITLE_SUB = '';
  Z.ARTIST = '';
  Z.CREDIT = '';
  // the cast: REPLACE with your own designs (PC.doll options); SPEAKER is the dialogue's name tab (your own word, not lyric)
  const HERO = { hairStyle: 'mop', hair: '#4A3428', outfit: P.blue, hat: 'cap', hatCol: P.red, seed: 3 };
  const FRIEND = { hairStyle: 'braid', hair: P.gold, outfit: P.pink, seed: 5 };
  const SPEAKER = '♪';
  const LANDS = ['meadow', 'village', 'snow', 'night', 'cave', 'dusk'];
  const ROUTE = [[0.08, 0.75], [0.22, 0.62], [0.38, 0.7], [0.52, 0.48], [0.68, 0.55], [0.86, 0.3]];

  Z.setup = async (audio) => {
    const nb = t => audio.beats.reduce((b, x) => (Math.abs(x - t) < Math.abs(b - t) ? x : b), audio.beats[0] ?? t);
    const secs = audio.sections || [];
    Z.sectionAt = t => { let s = secs[0] || null; for (const x of secs) if (x.start <= t + 1e-6) s = x; return s; };
    if (/[぀-ヿ]/.test(Z.LYR.map(l => l.text).join(''))) PC.useJapanese();
    PC.install();
    Z.LOOK_DEFAULT = Object.assign({}, PC.post);
    await Promise.all(PC.fontsToLoad.map(f => document.fonts.load(f, 'Aa0字あ')));

    const S = [], END = audio.music_cut || audio.duration, L = Z.LYR, beat = 60 / (audio.bpm || 120);
    const isChorus = s => /^(chorus|sabi|hook)/i.test(s.label), isPre = s => /^pre/i.test(s.label);
    const shot = (id, t0, t1, scene, args, extra = {}) => { if (t1 > t0 + 0.05) S.push(Object.assign({ id, t0, t1, scene, args, lyric: 'none', hud: false }, extra)); };
    const first = secs.length ? secs[0].start : 0, l0 = L.length ? nb(L[0].t - 0.05) : END, open = Math.min(l0, first > 0.5 ? first : l0);
    const journey = t => Z.clamp(t / END);                                     // the quest's progress = song time

    shot('s00', 0, open, 'pcBook', { mode: 'open' }, { moment: 'the storybook opens; the kingdom pops up' });
    let k = 0, chorusN = 0, land = 0, coins = 0;
    secs.forEach((sec, si) => {
      const a = Math.max(open, sec.start), b = Math.min(END, sec.end ?? END);
      if (b <= a + 0.3) return;
      const ls = L.filter(l => l.t >= a - 0.05 && l.t < b - 0.3), ci = isChorus(sec) ? chorusN++ : -1, biome = LANDS[land++ % LANDS.length];
      const cuts = [a].concat(ls.map(l => nb(l.t - 0.05)).filter(t => t > a + 0.4 && t < b - 0.4));
      const turn = { type: 'pageTurn', dur: 2 * beat };
      cuts.forEach((c0, j) => {
        const c1 = cuts[j + 1] ?? b, line = ls.find(l => Math.abs(nb(l.t - 0.05) - c0) < 0.01) || ls[j], li = line ? line.i : null;
        const enter = j === 0 ? { trans: ci >= 0 ? { type: 'shapeReveal', shape: ['star', 'heart', 'circle', 'keyhole'][ci % 4], dur: 2 * beat } : turn } : {};
        const meta = (m) => Object.assign({ line: li ?? undefined, moment: m }, enter);
        if (ci >= 0 && j === 0) {
          shot(`s${++k}`, c0, c1, 'pcBattle', { line: li, speaker: SPEAKER, hero: HERO }, meta(`chorus ${ci + 1}: a battle on the paper stage (REPLACE: what this chorus fights)`));
        } else if (isPre(sec)) {
          shot(`s${++k}`, c0, c1, 'pcMap', { line: li, speaker: SPEAKER, route: ROUTE, from: journey(c0), to: 1 }, meta(`the map: the whole road ahead is drawn (REPLACE: where the quest goes next)`));
        } else {
          coins += 3;
          shot(`s${++k}`, c0, c1, 'pcWorld', {
            biome, line: li, speaker: SPEAKER,
            cast: [Object.assign({ x: 200, walkTo: [[c0, 200], [c0 + 0.01, 200 + 520 * (c1 - c0)]], walkDur: c1 - c0, walkEase: 'linear' }, HERO)].concat(ci >= 0 ? [Object.assign({ walkTo: [[c0, -120], [c0 + 0.01, -120 + 520 * (c1 - c0)]], walkDur: c1 - c0, walkEase: 'linear', hop: true }, FRIEND)] : []),
            hud: { coins: [[c0, coins - 3], [c0 + 0.5, coins]], lv: ci >= 0 ? [c0 + 0.3] : [] },
            mini: { route: ROUTE, from: journey(c0), to: journey(c1) },
            burst: ci >= 0 ? [{ at: c0 + 0.3, x: 960, y: 420, n: 40 }] : [{ at: c0 + 0.5, x: 1500, y: 800, kind: 'coin', n: 12, speed: 500 }],
            cam: { from: PC.cam(960, 560, 1.05 + 0.1 * (j % 2)), to: PC.cam(960, 520, 1.2), follow: 0, lead: 200 },   // a long tracking shot, left to right
          }, meta(line ? `line ${line.i}: a step of the journey in the ${biome} (REPLACE: the gag for this line)` : `${sec.label || 'section'}: travelling through the ${biome}`));
        }
      });
    });
    if (!secs.length) shot('s01', open, END, 'pcWorld', { line: L.length ? 0 : null, speaker: SPEAKER, cast: [Object.assign({ x: 960 }, HERO)] }, { line: L.length ? 0 : undefined, moment: 'the hero in the meadow' });
    shot('s99', END, END + 3, 'pcBook', { mode: 'close' }, { moment: 'the storyteller closes the book', cue: Z.CUES.end ? 'end' : null, trans: { type: 'pageTurn', dur: 0.8 } });
    Z.SHOTS = S;
    Z.VERTICAL_CFG = { full: [], planMap: {}, quiet: S.map(s => s.id), title: Z.TITLE, sub: Z.TITLE_SUB, artist: Z.ARTIST, credits: [0, END], ambience: [94, 60, 40] };
    window.__zankoMeta.duration = END + 3;
  };
})();
