/* engine/timeline.js — STARTER for the INTERFACE style (styles/interface; read <skill>/styles/interface/STYLE.md first).
 * The song as a conversation on a screen: the singer is "me" (accent colour, serif), the listener is "you" (cream, sans,
 * never shown: only a cursor, typing, bubbles, presence), the client itself is "system" (mono). Three kinds of picture:
 * the INTERFACE (ifChat), PLATES (ifPlate: what "me" means and feels, printed in three flat inks) and CODE (ifCode).
 *
 * This starter builds a plain first cut from the song's sections and lyric lines so a new project renders at once.
 * It is scaffolding, not the film: replace it with YOUR shot list (moment / line / cue per shot; node tools/storyboard.mjs) — the moments of the
 * conversation, the colour states and the events that change them, which words become plates and what ends them.
 * Lyric text never appears here: shots take line indices (Z.LYR / Z.line(i)); tools/check_no_lyrics.mjs checks it.
 */
(() => {
  'use strict';
  const Z = window.Z, IF = Z.IF;
  Z.TITLE = 'untitled';
  Z.TITLE_SUB = '';
  Z.ARTIST = '';
  Z.CREDIT = '';

  Z.setup = async (audio) => {
    const lastBar = audio.bars.length ? audio.bars[audio.bars.length - 1].index : 0;
    const B = n => { const b = audio.bars.find(x => x.index === n); if (b) return b.start; if (n < lastBar) return 0;
      const db = audio.downbeats || [], k = db.findIndex(d => Math.abs(d - B(lastBar)) < 1e-3) + n - lastBar;   // a bar the song cuts into
      return k > 0 && db[k] < audio.music_cut ? db[k] : audio.music_cut; };
    const nb = t => audio.beats.reduce((b, x) => (Math.abs(x - t) < Math.abs(b - t) ? x : b), audio.beats[0] ?? t);
    const secs = audio.sections || [];
    Z.sectionAt = t => { let s = secs[0] || null; for (const x of secs) if (x.start <= t + 1e-6) s = x; return s; };
    if (/[一-鿿]/.test(Z.LYR.map(l => l.text).join('')) && !/[぀-ヿ]/.test(Z.LYR.map(l => l.text).join(''))) IF.useChinese();
    Z.LOOK_DEFAULT = Object.assign({}, IF.post);
    await Promise.all(IF.fontsToLoad.map(f => document.fonts.load(f, 'Aa0')));

    const S = [], END = audio.music_cut || audio.duration;
    const shot = (id, t0, t1, scene, args, extra = {}) => { if (t1 > t0 + 0.05) S.push(Object.assign({ id, t0, t1, scene, args, lyric: 'none', hud: false }, extra)); };
    const L = Z.LYR, first = L.length ? nb(L[0].t - 0.4) : B(2);
    // ---- colour states: they change only when something HAPPENS (here: the title lights the window up; choruses warm it)
    const states = [[0, 'off'], [first, 'on']];
    const isChorus = s => /^(chorus|sabi|hook)/i.test(s.label);
    for (const s of secs) if (isChorus(s)) states.push([s.start, 'warm']); else if (s.start > first) states.push([s.start, 'on']);
    // ---- the title: a plate, the first colour of the film
    shot('s00', 0, first, 'ifPlate', { state: 'paper', layers: [{ kind: 'keyword', text: Z.TITLE, at: 0.3, step: 0.08, maxSize: 220, y: 600 }] }, { moment: 'the title, printed: the first colour of the film' });
    // ---- per line: the line ARRIVES in the chat (typed with the voice), then the film cuts on a beat to a PLATE of what
    // it means (a glyph picture decoding + the line as a caption band; a kime / emphasised line becomes big keyword type).
    // An interface film is cut like this — every line or two — or it reads as a screenshot (motion_check fails).
    // REPLACE the generic pictures with ones for YOUR lines (IMGS: generated objects / silhouettes, glyph-printed).
    const IMGS = [];                                       // e.g. ['assets/props/lantern.png', 'assets/props/train.png']
    const SHAPES = [
      (g, w, h) => { g.fillStyle = '#fff'; g.beginPath(); g.arc(w / 2, h / 2, h * 0.42, 0, 7); g.fill(); g.fillStyle = '#000'; g.beginPath(); g.arc(w * 0.6, h * 0.42, h * 0.36, 0, 7); g.fill(); },
      (g, w, h) => { g.strokeStyle = '#fff'; for (let i = 1; i < 6; i++) { g.lineWidth = h * 0.05; g.globalAlpha = 1 - i * 0.14; g.beginPath(); g.arc(w / 2, h / 2, i * h * 0.085, 0, 7); g.stroke(); } },
      (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#000'); gr.addColorStop(0.55, '#fff'); gr.addColorStop(0.56, '#555'); gr.addColorStop(1, '#000'); g.fillStyle = gr; g.fillRect(0, 0, w, h); },
    ];
    const pics = IMGS.length ? IMGS : SHAPES;
    let k = 0, cur = first;
    const lines = L.filter(l => l.t >= first - 0.3 && l.t < END - 0.3);
    lines.forEach((l, n) => {
      const next = lines[n + 1] ? nb(lines[n + 1].t - 0.3) : END;
      const peak = l.kime || l.emph.length;
      const cut = peak ? nb(l.t - 0.1) : Math.min(next - 0.4, nb(l.t + Math.max(1.2, 0.55 * (l.end - l.t))));
      if (cut > cur + 0.3) shot(`s${++k}`, cur, cut, 'ifChat', chat(L.filter(x => x.t < cut), states, cur, cut),
        { line: l.i, moment: `line ${l.i} arrives in the chat (REPLACE: what happens in the window here)` });
      const a = Math.max(cur, cut);
      if (next > a + 0.2) shot(`s${++k}`, a, next, 'ifPlate', peak
        ? { layers: [{ kind: 'keyword', line: l.i, maxSize: 300, y: 620 }], misreg: 3, camera: { from: { zoom: 1.0, rot: -0.02 }, to: { zoom: 1.22, rot: 0.015 }, ease: 'linear' } }
        : { layers: [{ kind: 'glyph', img: pics[n % pics.length], key: 'pic' + (n % pics.length), rect: [1040, 110, 760, 760], reveal: [a, a + 0.6], decode: [a, a + 1.4], cell: 16 },
            { kind: 'band', line: l.i, x: 120, y: 980, size: 58 }], misreg: 2, camera: { from: { zoom: 1.02, x: n % 2 ? 160 : -160 }, to: { zoom: 1.16, x: n % 2 ? -160 : 160 }, ease: 'linear' } },
        { line: l.i, moment: peak ? `line ${l.i} as big type: the peak of its phrase` : `plate for line ${l.i} (REPLACE the generic picture with what the line means)` });
      cur = next;
    });
    // ---- the end: the other side goes offline; the window greys out (state 'ash')
    shot('s99', END, END + 3, 'ifChat', { state: [[0, 'warm'], [END + 0.2, 'ash']], presence: [[0, 'online'], [END + 0.2, 'offline']], title: Z.TITLE,
      msgs: L.slice(-2).map(l => ({ who: 'me', line: l.i, instant: true, at: -1 })), camera: { from: { zoom: 1.45, x: 150, y: -120 }, to: { zoom: 1.0 }, ease: 'outCubic' } },
      { moment: 'the other side goes offline; the window greys out', cue: Z.CUES.end ? 'end' : null });
    Z.SHOTS = S;
    window.__zankoMeta.duration = END + 3;

    function chat(lines, st, a, b) {
      return { state: st, title: Z.TITLE, presence: [[0, 'online']], items: [Z.TITLE || 'conversation'],
        msgs: lines.map(l => ({ who: 'me', line: l.i })),
        camera: 'follow' };   // re-frames on every line: the lines must read and the picture must move
    }
  };
})();
