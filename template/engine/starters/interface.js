/* engine/timeline.js — STARTER for the INTERFACE style (read <skill>/styles/interface/BRIEF.md, then STYLE.md).
 * The song set on a screen or a page, drawn in code, from two equal libraries a film takes shots from freely:
 *   SCREEN   (styles/interface, Z.IF: ifChat ifPlate ifCode) — a conversation: "me" (the singer: accent, serif) talks
 *            to "you" (never shown: a cursor, typing, presence), the client itself is "system" (mono); plates print
 *            what "me" means in three flat inks
 *   TREATISE (styles/treatise, Z.TR: trSheet trPlot trScope trForm trField trContour trEngrave trPrompt trHook) —
 *            plates from an illustrated technical treatise: each plate its own idiom, a spark that drags a line
 *            through them, one running number the hooks raise
 * Both share one palette here (the screen's "me" is the treatise's signal orange, its text the bone) — STYLE.md.
 *
 * This starter builds a plain first cut from the song's lyric lines so a new project renders at once: the title,
 * then one shot per line from POOL (both libraries, cycled in order), then the window goes offline. It is
 * scaffolding, not the film: replace the pool, or pick a builder per line yourself, from YOUR shot list (moment /
 * line / cue per shot; node tools/storyboard.mjs) — what each line MEANS decides whether it is a message or a plate.
 * Lyric text never appears here: shots take line indices (Z.LYR / Z.line(i)); tools/check_no_lyrics.mjs checks it.
 */
(() => {
  'use strict';
  const Z = window.Z, IF = Z.IF, TR = Z.TR;
  Z.TITLE = 'untitled';
  Z.TITLE_SUB = '';
  Z.ARTIST = '';
  Z.CREDIT = '';
  // the running number of the treatise plates: its name and the value each hook raises it to (REPLACE with the film's own)
  TR.NUM.label = 'p';
  const STEPS = [0.15, 0.42, 0.81, 0.99, 0.999];

  Z.setup = async (audio) => {
    const lastBar = audio.bars.length ? audio.bars[audio.bars.length - 1].index : 0;
    const B = n => { const b = audio.bars.find(x => x.index === n); if (b) return b.start; if (n < lastBar) return 0;
      const db = audio.downbeats || [], k = db.findIndex(d => Math.abs(d - B(lastBar)) < 1e-3) + n - lastBar;   // a bar the song cuts into
      return k > 0 && db[k] < audio.music_cut ? db[k] : audio.music_cut; };
    const nb = t => audio.beats.reduce((b, x) => (Math.abs(x - t) < Math.abs(b - t) ? x : b), audio.beats[0] ?? t);
    const secs = audio.sections || [];
    Z.sectionAt = t => { let s = secs[0] || null; for (const x of secs) if (x.start <= t + 1e-6) s = x; return s; };
    const all = Z.LYR.map(l => l.text).join('');
    if (/[一-鿿]/.test(all) && !/[぀-ヿ]/.test(all)) IF.useChinese();
    if (/[一-鿿぀-ヿ]/.test(all)) TR.useCJK(!/[぀-ヿ]/.test(all));
    // one palette for both libraries: accent = "me" = the spark, cream = "you" = bone
    for (const s of ['on', 'warm', 'paper']) Object.assign(IF.STATES[s], { me: TR.PAL.signal, meHot: TR.PAL.ember, text: TR.PAL.bone });
    Z.LOOK_DEFAULT = Object.assign({}, IF.post);
    await Promise.all([...IF.fontsToLoad.map(f => document.fonts.load(f, 'Aa0')), ...TR.fontsToLoad.map(f => document.fonts.load(f, 'Aa0あ'))]);

    const S = [], END = audio.music_cut || audio.duration;
    const shot = (id, t0, t1, scene, args, extra = {}) => { if (t1 > t0 + 0.05) S.push(Object.assign({ id, t0, t1, scene, args, lyric: 'none', hud: false }, extra)); };
    const L = Z.LYR, first = L.length ? nb(L[0].t - 0.4) : B(2);
    // ---- colour states of the screen: they change only when something HAPPENS (here: the title lights the window up)
    const states = [[0, 'off'], [first, 'on']];
    // ---- the title: a plate, the first colour of the film
    shot('s00', 0, first, 'ifPlate', { state: 'paper', layers: [{ kind: 'keyword', text: Z.TITLE, at: 0.3, step: 0.08, maxSize: 220, y: 600 }] }, { moment: 'the title, printed: the first colour of the film' });

    // ---- the shot builders: each takes a line and its span [a, b) and adds one or two shots. An interface film is cut
    // every line or two, or it reads as a screenshot (motion_check fails).
    const IMGS = [];                                       // e.g. ['assets/props/lantern.png'] (glyph-printed on screen plates)
    const SHAPES = [
      (g, w, h) => { g.fillStyle = '#fff'; g.beginPath(); g.arc(w / 2, h / 2, h * 0.42, 0, 7); g.fill(); g.fillStyle = '#000'; g.beginPath(); g.arc(w * 0.6, h * 0.42, h * 0.36, 0, 7); g.fill(); },
      (g, w, h) => { g.strokeStyle = '#fff'; for (let i = 1; i < 6; i++) { g.lineWidth = h * 0.05; g.globalAlpha = 1 - i * 0.14; g.beginPath(); g.arc(w / 2, h / 2, i * h * 0.085, 0, 7); g.stroke(); } },
      (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#000'); gr.addColorStop(0.55, '#fff'); gr.addColorStop(0.56, '#555'); gr.addColorStop(1, '#000'); g.fillStyle = gr; g.fillRect(0, 0, w, h); },
    ];
    const pics = IMGS.length ? IMGS : SHAPES;
    let k = 0, n = 0, hooks = 0;
    const numKeys = [[0, 0.02]], treatise = [];
    // SCREEN: the line ARRIVES in the chat (typed with the voice), then a cut on a beat to a plate of what it means
    // (a glyph picture decoding + the line as a caption band; a kime / emphasised line becomes big keyword type)
    const screen = (l, a, b) => {
      const peak = l.kime || l.emph.length;
      const cut = peak ? Math.max(a, nb(l.t - 0.1)) : Math.min(b - 0.4, nb(l.t + Math.max(1.2, 0.55 * (l.end - l.t))));
      if (cut > a + 0.3) shot(`s${++k}`, a, cut, 'ifChat', chat(L.filter(x => x.t < cut)),
        { line: l.i, moment: `line ${l.i} arrives in the chat (REPLACE: what happens in the window here)` });
      const c = cut > a + 0.3 ? cut : a, j = n++;
      shot(`s${++k}`, c, b, 'ifPlate', peak
        ? { layers: [{ kind: 'keyword', line: l.i, maxSize: 300, y: 620 }], misreg: 3, camera: { from: { zoom: 1.0, rot: -0.02 }, to: { zoom: 1.22, rot: 0.015 }, ease: 'linear' } }
        : { layers: [{ kind: 'glyph', img: pics[j % pics.length], key: 'pic' + (j % pics.length), rect: [1040, 110, 760, 760], reveal: [c, c + 0.6], decode: [c, c + 1.4], cell: 16 },
            { kind: 'band', line: l.i, x: 120, y: 980, size: 58 }], misreg: 2, camera: { from: { zoom: 1.02, x: j % 2 ? 160 : -160 }, to: { zoom: 1.16, x: j % 2 ? -160 : 160 }, ease: 'linear' } },
        { line: l.i, moment: peak ? `line ${l.i} as big type: the peak of its phrase` : `plate for line ${l.i} (REPLACE the generic picture with what the line means)` });
    };
    // TREATISE: the line set into a plate of one idiom; a kime / emphasised line is a hook (one word per hit, then the
    // running number takes the frame and rolls to its next value)
    const plate = (scene, args) => (l, a, b) => {
      const id = `s${++k}`;
      treatise.push(id);
      if (l.kime || l.emph.length) {
        const h = hooks++;
        numKeys.push([Math.min(l.end, b - 1.0) + 0.05, STEPS[Math.min(h, STEPS.length - 1)]]);
        return shot(id, a, b, 'trHook', { line: l.i, n: Math.min(4, h + 1) }, { line: l.i, post: TR.post, moment: `hook ${h + 1}: the line slams word by word, the number rises (REPLACE: this hook's escalation)` });
      }
      shot(id, a, b, scene, Object.assign({ line: l.i }, args), { line: l.i, post: TR.post, moment: `line ${l.i} as a ${scene.slice(2).toLowerCase()} plate (REPLACE: the visual pun for this line)` });
    };
    // REPLACE: the film's own order (or choose a builder per line). Any line may come from either library.
    const POOL = [screen, plate('trPlot', { mode: 'drop' }), screen, plate('trScope', {}), screen, plate('trForm', {}),
      screen, plate('trContour', { seed: 5 }), screen, plate('trEngrave', { form: 'bulb' }), screen, plate('trField', {})];

    const lines = L.filter(l => l.t >= first - 0.3 && l.t < END - 0.3);
    let cur = first;
    lines.forEach((l, i) => {
      const next = lines[i + 1] ? nb(lines[i + 1].t - 0.3) : END;
      if (next > cur + 0.2) POOL[i % POOL.length](l, cur, next);
      cur = Math.max(cur, next);
    });
    // ---- the end: the other side goes offline; the window greys out (state 'ash')
    shot('s99', END, END + 3, 'ifChat', { state: [[0, 'warm'], [END + 0.2, 'ash']], presence: [[0, 'online'], [END + 0.2, 'offline']], title: Z.TITLE,
      msgs: L.slice(-2).map(l => ({ who: 'me', line: l.i, instant: true, at: -1 })), camera: { from: { zoom: 1.45, x: 150, y: -120 }, to: { zoom: 1.0 }, ease: 'outCubic' } },
      { moment: 'the other side goes offline; the window greys out', cue: Z.CUES.end ? 'end' : null });
    TR.NUM.keys = numKeys;
    Z.SHOTS = S;
    Z.VERTICAL_CFG = { full: [], planMap: {}, quiet: treatise, title: Z.TITLE, sub: Z.TITLE_SUB, artist: Z.ARTIST, credits: [0, END], ambience: [10, 10, 11] };
    window.__zankoMeta.duration = END + 3;

    function chat(ls) {
      return { state: states, title: Z.TITLE, presence: [[0, 'online']], items: [Z.TITLE || 'conversation'],
        msgs: ls.map(l => ({ who: 'me', line: l.i })),
        camera: 'follow' };   // re-frames on every line: the lines must read and the picture must move
    }
  };
})();
