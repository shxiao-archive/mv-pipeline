/* engine/timeline.js — STARTER for the VOCALOID style, signal treatment (styles/signal; read <skill>/styles/vocaloid/BRIEF.md, then STYLE.md §B).
 * A recording device failing in heat: speed is editing (tiered cut engine with fillers and 1-2 frame inserts), one
 * number — HEAT — grades the whole film (cold navy -> amber -> vermilion -> white-hot), the signal degrades with it,
 * and the device's own HUD (REC, timecode, LOG, CORE TEMP) frames everything.
 *
 * This starter builds a plain first cut from the song's sections so a new project renders at once. It is scaffolding:
 * fill IMGS with your generated art (neutral colour: the heat grade tints it), write the motif lists per lyric line,
 * the LOG copy, the heat curve and the signature moments from YOUR shot list (moment / line / cue per shot; node tools/storyboard.mjs).
 * Lyric text never appears here: lines by index only. Run tools/check_flash.py on every render (fast cuts!).
 */
(() => {
  'use strict';
  const Z = window.Z, SIG = Z.SIG;
  Z.TITLE = 'untitled';
  Z.TITLE_SUB = '';
  Z.ARTIST = '';
  Z.CREDIT = '';
  const IMGS = [];             // e.g. ['assets/bg/ruins.png', 'assets/bg/tower.png', ...]   (backgrounds / objects / characters)
  const CHARS = [];            // cut-outs (RGBA), e.g. ['assets/char/unit_front.png']

  Z.setup = async (audio) => {
    const lastBar = audio.bars.length ? audio.bars[audio.bars.length - 1].index : 0;
    const B = n => { const b = audio.bars.find(x => x.index === n); if (b) return b.start; if (n < lastBar) return 0;
      const db = audio.downbeats || [], k = db.findIndex(d => Math.abs(d - B(lastBar)) < 1e-3) + n - lastBar;   // a bar the song cuts into
      return k > 0 && db[k] < audio.music_cut ? db[k] : audio.music_cut; };
    const secs = audio.sections || [];
    Z.sectionAt = t => { let s = secs[0] || null; for (const x of secs) if (x.start <= t + 1e-6) s = x; return s; };
    if (/[一-鿿]/.test(Z.LYR.map(l => l.text).join('')) && !/[぀-ヿ]/.test(Z.LYR.map(l => l.text).join(''))) SIG.useChinese();
    Z.LOOK_DEFAULT = { boil: 0.5, bloom: 0.25, bloomThreshold: 0.8, grain: 0.06, vignette: 0.4, lutMix: 0 };
    await Promise.all(['400 32px "DotGothic16"', '600 64px "Shippori Mincho B1"', '800 64px "Shippori Mincho B1"', '600 64px "Noto Serif SC"', '800 64px "Noto Serif SC"'].map(f => document.fonts.load(f, 'A0字')));
    const END = audio.music_cut || audio.duration;

    // ---- heat: cold at the start, a step up in every chorus, white-hot in the last one, cooling after the music
    const isChorus = s => /^(chorus|sabi|hook)/i.test(s.label);
    const heat = [[0, 0]], choruses = secs.filter(isChorus);
    for (const s of secs) heat.push([s.start, isChorus(s) ? 0.45 + 0.55 * ((choruses.indexOf(s) + 1) / Math.max(1, choruses.length)) : /pre|bridge/.test(s.label) ? 0.35 : 0.15]);
    heat.push([END, 0.3], [END + 3, 0.05]);
    SIG.heatKeys = heat;
    SIG.boost = { chorus: 0.14, 'pre-chorus': 0.06, 'post-chorus': 0.1 };
    SIG.install();
    if (IMGS.length) SIG.useImages(IMGS);

    // ---- HUD + lyric modes per section
    SIG.hudCfg.title = (Z.TITLE || 'UNIT') + ' / LOG';
    SIG.hudCfg.log = [[0.2, 'boot'], [0.6, 'sensor check ... ok'], [1.0, 'rec start']];
    SIG.hudCfg.lyrics = secs.map(s => ({ from: s.start, to: s.end ?? END, mode: isChorus(s) ? 'stamp' : /pre|bridge/.test(s.label) ? 'center' : 'vertical' }));
    SIG.hudCfg.hide = [[END + 0.5, END + 9]];
    Z.hud = SIG.hud;
    Z.hudShowsLyrics = true;                               // the HUD sets the lyrics (tools/storyboard.mjs counts it)

    // ---- motifs: what the cut engine alternates with fillers. Write real lists per lyric line for the film.
    const motifs = [];
    IMGS.forEach((img, i) => motifs.push({ scene: 'sigShot', args: { mode: ['full', 'crop', 'full', 'split'][i % 4], img, imgs: IMGS.slice(i, i + 3), focus: [0.3 + 0.4 * (i % 2), 0.4] } }));
    CHARS.forEach((c, i) => motifs.push({ scene: 'sigShot', args: { mode: i % 2 ? 'sil' : 'char', char: c, img: IMGS[i % Math.max(1, IMGS.length)] } }));
    Z.LYR.filter(l => l.emph.length || l.kime).forEach(l => motifs.push({ scene: 'sigShot', args: { mode: 'word', line: l.i } }));
    if (!motifs.length) motifs.push({ scene: 'sigTerm', args: { mode: 'hex' } });

    const S = [];
    const first = secs.length ? secs[0].start : 0;
    if (first > 0.05) S.push({ id: 'pre', t0: 0, t1: first, scene: 'sigTerm', args: { mode: 'nosignal' }, lyric: 'none', moment: 'no signal before the recording starts' });
    secs.forEach((s, i) => {
      const tier = isChorus(s) ? 1 : /pre|bridge|post/.test(s.label) ? 2 : 3;
      S.push(...SIG.cuts({ t0: s.start, t1: Math.min(END, s.end ?? END), tier, id: `s${i}_`, seed: 11 + i, motifs: tier === 3 ? motifs.filter(m => m.args.mode !== 'word') : motifs,
        moment: `${s.label || s.name}: tier ${tier} run (REPLACE: say what this section shows)` }));
    });
    S.push({ id: 'end', t0: END, t1: END + 3, scene: 'sigTerm', args: { mode: 'nosignal', copy: ['REC STOP'] }, lyric: 'none', moment: 'the recorder stops', cue: Z.CUES.end ? 'end' : null });
    Z.SHOTS = S.filter(x => x.t1 > x.t0 + 1e-3);
    window.__zankoMeta.duration = END + 3;
  };
})();
