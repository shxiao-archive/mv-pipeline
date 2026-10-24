/* engine/timeline.js — STARTER for the INTERFACE style, treatise treatment (styles/treatise; read <skill>/styles/interface/BRIEF.md, then STYLE.md §B).
 * The song as plates from an illustrated technical treatise: ink and bone with one signal orange, a spark that drags a
 * line through every plate, each plate its own drawing idiom (chart, oscilloscope, form, survey map, prompt), every
 * lyric line set into the picture word by word, and one running number that the hooks raise.
 *
 * This starter builds a plain first cut from the song's sections and lyric lines so a new project renders at once:
 * the title sheet -> one plate per verse line (cycling idioms, light / dark rhythm) -> each chorus opens with the hook
 * slam and raises the number -> the sheet closes on the last frame (it matches the first). It is scaffolding: choose
 * each plate for what its line MEANS (a visual pun, not an illustration), write your deadpan copy (form fields, stamps,
 * labels), the number's name and its steps, and the hand-offs between plates, from YOUR shot list.
 * Lyric text never appears here: lines by index only (the plates read Z.LYR).
 */
(() => {
  'use strict';
  const Z = window.Z, TR = Z.TR;
  Z.TITLE = 'untitled';
  Z.TITLE_SUB = '';
  Z.ARTIST = '';
  Z.CREDIT = '';
  // the running number: its name and the value each chorus raises it to (REPLACE with the film's own)
  TR.NUM.label = 'p';
  const STEPS = [0.15, 0.42, 0.81, 0.99, 0.999];

  Z.setup = async (audio) => {
    const nb = t => audio.beats.reduce((b, x) => (Math.abs(x - t) < Math.abs(b - t) ? x : b), audio.beats[0] ?? t);
    const secs = audio.sections || [];
    Z.sectionAt = t => { let s = secs[0] || null; for (const x of secs) if (x.start <= t + 1e-6) s = x; return s; };
    const all = Z.LYR.map(l => l.text).join('');
    if (/[一-鿿぀-ヿ]/.test(all)) TR.useCJK(!/[぀-ヿ]/.test(all));
    Z.LOOK_DEFAULT = Object.assign({}, TR.post);
    await Promise.all(TR.fontsToLoad.map(f => document.fonts.load(f, 'Aa0あ')));

    const S = [], END = audio.music_cut || audio.duration, L = Z.LYR;
    const isChorus = s => /^(chorus|sabi|hook)/i.test(s.label), isPre = s => /^pre/i.test(s.label);
    const shot = (id, t0, t1, scene, args, extra = {}) => { if (t1 > t0 + 0.05) S.push(Object.assign({ id, t0, t1, scene, args, lyric: 'none', hud: false }, extra)); };
    const first = secs.length ? secs[0].start : 0, l0 = L.length ? nb(L[0].t - 0.05) : END;
    const open = Math.min(l0, first > 0.5 ? first : l0);

    // ---- 0. the title sheet: crop marks, the spark writes the title
    shot('s00', 0, open, 'trSheet', {}, { moment: 'the title sheet: crop marks fly in, the spark writes the title' });

    const keys = [[0, 0.02]];
    let k = 0, chorusN = 0, idiom = 0;
    const VERSE = [['trPlot', { mode: 'drop' }], ['trEngrave', { form: 'bulb' }], ['trScope', {}], ['trForm', {}], ['trField', {}], ['trContour', {}], ['trPlot', { mode: 'walk', inv: true }]];
    secs.forEach((sec, si) => {
      const a = Math.max(open, sec.start), b = Math.min(END, sec.end ?? END);
      if (b <= a + 0.3) return;
      const ls = L.filter(l => l.t >= a - 0.05 && l.t < b - 0.3), ci = isChorus(sec) ? chorusN++ : -1;
      const cuts = [a].concat(ls.map(l => nb(l.t - 0.05)).filter(t => t > a + 0.4 && t < b - 0.4));
      cuts.forEach((c0, j) => {
        const c1 = cuts[j + 1] ?? b, line = ls.find(l => Math.abs(nb(l.t - 0.05) - c0) < 0.01) || ls[j];
        if (ci >= 0 && j === 0 && line) {
          // ---- the hook: one word per hit, then the number takes the frame and rolls to its next value
          const n = Math.min(4, ci + 1), numT = Math.min(line.end, c1 - 1.0);
          keys.push([numT + 0.05, STEPS[Math.min(ci, STEPS.length - 1)]]);
          shot(`s${++k}`, c0, c1, 'trHook', { line: line.i, n }, { line: line.i, moment: `hook ${n}: the line slams word by word, the number rises (REPLACE: this hook's escalation)` });
        } else if (isPre(sec)) {
          shot(`s${++k}`, c0, c1, 'trPrompt', { line: line ? line.i : null }, { line: line ? line.i : undefined, moment: `prompt: line ${line ? line.i : '-'} typed as tokens (REPLACE: what is being asked for)` });
        } else {
          const [scene, args] = ci >= 0 ? (j % 2 ? ['trContour', { seed: 5 + j }] : ['trPlot', { mode: 'exp', inv: j % 4 === 2 }]) : VERSE[idiom++ % VERSE.length];
          shot(`s${++k}`, c0, c1, scene, Object.assign({ line: line ? line.i : null }, args),
            { line: line ? line.i : undefined, moment: line ? `line ${line.i} as a ${scene.slice(2).toLowerCase()} plate (REPLACE: the visual pun for this line)` : `${sec.label || 'section'}: an instrument plate` });
        }
      });
    });
    if (!secs.length) shot('s01', open, END, 'trPlot', { mode: 'exp', line: L.length ? 0 : null }, { line: L.length ? 0 : undefined, moment: 'a single chart plate' });

    // ---- the end: the sheet closes; its last frame is the first frame of the film
    shot('s99', END, END + 1.2, 'trSheet', { close: true }, { moment: 'the sheet closes back to the first frame', cue: Z.CUES.end ? 'end' : null });
    TR.NUM.keys = keys;
    Z.SHOTS = S;
    Z.VERTICAL_CFG = { full: [], planMap: {}, quiet: S.map(s => s.id), title: Z.TITLE, sub: Z.TITLE_SUB, artist: Z.ARTIST, credits: [0, END], ambience: [10, 10, 11] };
    window.__zankoMeta.duration = END + 1.2;   // a short close: a long still card fails motion_check
  };
})();
