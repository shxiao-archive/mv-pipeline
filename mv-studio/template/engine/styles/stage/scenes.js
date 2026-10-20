/* styles/stage — scenes.js: three scenes for a STAGE film (a picture-book show on a painted theatre stage).
 * Every time is song time; a list [[t, value], ...] means "value from t on" (eased over 0.4 s for numbers).
 * Lyric text never appears here: the karaoke bar reads Z.LYR (set `text: Z.ST.karaoke` on the shot).
 *
 * 'stShow'  the stage: { backdrop: { a, b, spin, wall } | { paint(t) }, floor, spots: [[x, col], ...] | (S) => [...],
 *            curtain: k | [[t, k], ...] (curtains: false = no side curtains or valance: full-width set), alarm: k | [[t, k], ...], cast, props(S, ST), front(S, ST),
 *            confetti: [t0, ...], sfx: [{ text, at, x, y, size, col, rot, life }], camera, flash: [[t, k], ...] }
 * 'stSet'   a painted place: { sky: 'day' | 'dusk' | 'night' | 'sea' | 'room' | [top, bottom], ground: { y, col } | false,
 *            sun: { x, y, r, col }, stars: n, clouds: n (drifting; default 3, 0 at night), img: 'assets/bg/x.png' (your painted background under a light wash),
 *            hills: true, cast, props, front, confetti, sfx, camera }
 * 'stTitle' curtain up: { title (default Z.TITLE), credit (default Z.CREDIT), open: 1.6 (s), lead: { col, top, hat }, a, b }
 *
 * cast: [{ x, y (ground, default 880), u, move ('bounce' ...; ST.move), seed, mood: [[t, eyes, emote], ...],
 *          walkTo: [[t, x], ...], ...any ST.puppet option }]  or  { img: 'assets/char/a.png', x, y, h, flip }
 *        (a generated cut-out standing on the set) — or (S) => that array. Drawn back to front by y.
 * camera: { from: { x, y, zoom, rot }, to: {...}, ease, beat (push on every beat, e.g. 0.03), shake (px on beats) }
 *        default: a slow push. Every stage shot moves.
 *
 * mv-studio (MIT).
 */
(() => {
  'use strict';
  const Z = window.Z, ST = (Z.ST = Z.ST || {}), W = 1920, H = 1080;
  const P = () => ST.PAL;
  const at = (v, t, dur = 0.4) => {
    if (!Array.isArray(v) || !Array.isArray(v[0])) return v ?? 0;
    let cur = v[0][1], prev = cur, t0 = -1e9;
    for (const [tk, x] of v) if (t >= tk) { prev = cur; cur = x; t0 = tk; }
    return typeof cur === 'number' ? Z.lerp(prev, cur, Z.ease.inOutSine(Z.clamp((t - t0) / dur))) : cur;
  };
  ST.at = at;

  const camera = (S, cam) => {
    cam = cam || { from: { zoom: 1.0 }, to: { zoom: 1.08 } };
    const k = (Z.ease[cam.ease || 'inOutSine'] || Z.ease.inOutSine)(S.p), a = cam.from || {}, b = cam.to || a;
    const push = (cam.beat ?? 0.015) * S.clock.pulse(S.t, 8), [sx, sy] = cam.shake ? ST.shake(S.t, cam.shake * S.clock.pulse(S.t, 10)) : [0, 0];
    ST.cam(Z.lerp(a.x ?? 960, b.x ?? 960, k) + sx, Z.lerp(a.y ?? 540, b.y ?? 540, k) + sy, Z.lerp(a.zoom ?? 1, b.zoom ?? 1, k) * (1 + push), Z.lerp(a.rot || 0, b.rot || 0, k));
  };
  const drawCast = (S, cast) => {
    const list = (typeof cast === 'function' ? cast(S) : cast || []).slice().sort((p, q) => (p.y ?? 880) - (q.y ?? 880));
    for (const m of list) {
      const y = m.y ?? 880;
      if (m.img) {
        const im = Z.imgSync(m.img); if (!im) continue;
        const h = m.h || 520, w = im.width * h / im.height, c = ST.ctx;
        ST.paint(ST.ell(m.x, y + 6, w * 0.42, h * 0.05, 18), { fill: P().ink, fillOp: 0.3, bleed: 0.25, ink: null });
        c.save(); c.translate(m.x, y); if (m.flip) c.scale(-1, 1); c.drawImage(im, -w / 2, -h, w, h); c.restore();
        continue;
      }
      const x = m.walkTo ? at(m.walkTo, S.t, m.walkDur ?? 0.8) : m.x;
      const o = Object.assign({}, m.move ? ST.move(m.move, S.t, m.seed || 0) : {}, m, m.mood ? ST.mood(S.t, m.mood) : {});
      if (m.walkTo) { const moving = Math.abs(at(m.walkTo, S.t + 0.05, m.walkDur ?? 0.8) - x) > 0.5; if (moving) o.walk = S.t * 2.5; }
      ST.puppet(x, y, m.u || 40, o);
    }
  };
  const extras = (S, a) => {
    for (const t0 of a.confetti || []) ST.confetti(S.t, t0, { seed: Math.round(t0 * 10) });
    for (const f of a.sfx || []) ST.sfx(f.text, f.x ?? 960, f.y ?? 300, f.size || 150, f.col || P().ochre, S.t - f.at, { rot: f.rot, life: f.life });
  };

  Z.scene('stShow', {
    preload: a => (Array.isArray(a.cast) ? a.cast.filter(m => m.img).map(m => m.img) : []),
    async init() { await Promise.all(ST.fontsToLoad.map(f => document.fonts.load(f, 'Aa0'))); },
    draw(ctx, S) {
      const a = S.args;
      ST.begin(ctx, S.t); ST.paper();
      camera(S, a.camera);
      ST.backdrop(S.t, a.backdrop || {});
      ST.floor({ floor: a.floor });
      for (const [x, col] of (typeof a.spots === 'function' ? a.spots(S) : a.spots || [])) ST.spot(x, col);
      if (a.props) a.props(S, ST);
      drawCast(S, a.cast);
      if (a.front) a.front(S, ST);
      extras(S, a);
      if (a.curtains !== false) ST.curtains(S.t, at(a.curtain, S.t, 1.2));
      ST.camEnd();
      ST.alarm(at(a.alarm, S.t));
      if (a.flash) ST.flash(at(a.flash, S.t, 0.15));
    },
  });

  const SKIES = { day: ['#8FC6E8', '#E8F2EC'], dusk: ['#5B4B8A', '#F2A27A'], night: ['#1E2450', '#3E4C8A'], sea: ['#7FC1E0', '#DDEFF0'], room: ['#E9D3B4', '#F6E6CC'] };
  Z.scene('stSet', {
    preload: a => [a.img, ...(Array.isArray(a.cast) ? a.cast.filter(m => m.img).map(m => m.img) : [])].filter(Boolean),
    async init() { await Promise.all(ST.fontsToLoad.map(f => document.fonts.load(f, 'Aa0'))); },
    draw(ctx, S) {
      const a = S.args, pal = P(), [top, bot] = Array.isArray(a.sky) ? a.sky : SKIES[a.sky || 'day'] || SKIES.day;
      ST.begin(ctx, S.t); ST.paper();
      camera(S, a.camera);
      const im = a.img && Z.imgSync(a.img);
      if (im) { const s = Math.max(W / im.width, H / im.height) * 1.1; ctx.drawImage(im, 960 - im.width * s / 2, 540 - im.height * s / 2, im.width * s, im.height * s); ST.paint(ST.rect(-200, -200, W + 400, H + 400), { fill: pal.paper, fillOp: 0.18, ink: null, still: true }); }
      else {
        for (let i = 0; i < 6; i++) ST.paint(ST.rect(-300, -300 + i * 200, W + 600, 260), { fill: ST.mix(top, bot, i / 5), fillOp: 0.8, bleed: 0.12, tex: 0.3, border: 0.2, ink: null, still: true, seed: 300 + i });
        for (let i = 0; i < (a.stars ?? (a.sky === 'night' ? 40 : 0)); i++) { const tw = 0.6 + 0.4 * Math.sin(S.t * 3 + i); ST.paint(ST.star(Z.rnd(i, 1) * W, Z.rnd(i, 2) * 600, (6 + 8 * Z.rnd(i, 3)) * tw, 0.4, 4), { wash: pal.cream, washOp: 0.85, ink: null }); }
        for (let i = 0; i < (a.clouds ?? (a.sky === 'night' ? 0 : 3)); i++) {         // drifting clouds: the sky is never still
          const cx = ((Z.rnd(i, 11) * 2400 + S.t * (25 + 20 * Z.rnd(i, 12))) % 2600) - 340, cy = 120 + 260 * Z.rnd(i, 13), s = 0.7 + 0.6 * Z.rnd(i, 14);
          ST.paint([[-150, 20], [-110, -30], [-40, -55], [30, -45], [90, -60], [150, -15], [170, 25], [-130, 40]].map(([x, y]) => [cx + x * s, cy + y * s]), { wash: pal.cream, washOp: 0.85, fill: '#FFFFFF', fillOp: 0.5, bleed: 0.15, sw: 0.8, curv: 1, seed: 600 + i });
        }
        if (a.sun) ST.paint(ST.ell(a.sun.x ?? 1400, a.sun.y ?? 260, a.sun.r || 110, a.sun.r || 110, 30, 2), { wash: a.sun.col || pal.ochre, fill: pal.cream, fillOp: 0.4, sw: 1.2 });
        if (a.hills !== false) [[620, pal.sap, 0], [700, ST.mix(pal.sap, pal.ink, 0.2), 1]].forEach(([hy, col, k]) => ST.paint(Array.from({ length: 13 }, (_, i) => [-200 + i * 193, hy + Math.sin(i * 1.3 + k * 2) * 60]).concat([[W + 300, 1400], [-300, 1400]]), { wash: ST.mix(col, top, 0.35), fill: col, fillOp: 0.4, bleed: 0.1, tex: 0.6, sw: 1, curv: 1, still: true, seed: 400 + k }));
      }
      if (a.ground !== false) { const g = a.ground || {}; ST.paint([[-300, g.y ?? 830], [W + 300, (g.y ?? 830) - 10], [W + 300, 1400], [-300, 1400]], { wash: g.col || ST.mix(pal.sap, pal.ochre, 0.4), fill: pal.woodDk, fillOp: 0.2, tex: 0.7, sw: 1.2, still: true, seed: 450 }); }
      if (a.props) a.props(S, ST);
      drawCast(S, a.cast);
      if (a.front) a.front(S, ST);
      extras(S, a);
      ST.camEnd();
    },
  });

  Z.scene('stTitle', {
    async init() { await Promise.all(ST.fontsToLoad.map(f => document.fonts.load(f, 'Aa0'))); },
    draw(ctx, S) {
      const a = S.args, pal = P(), open = a.open ?? 1.6, k = Z.ease.inOutCubic(Z.clamp(S.lt / open));
      ST.begin(ctx, S.t); ST.paper();
      ST.cam(960, 540, 1.02 + 0.04 * S.p);
      ST.backdrop(S.t, { a: a.a, b: a.b });
      ST.floor({});
      ST.spot(960, pal.cream);
      const title = a.title ?? Z.TITLE ?? '';
      if (title) {
        ST.paint(ST.rr(360, 210, 1200, 230, 40, 3), { wash: pal.cream, fill: pal.ochre, fillOp: 0.25, tex: 0.6, sw: 1.6 });
        ctx.save(); ctx.font = `400 ${Math.min(150, 2100 / Math.max(4, [...title].length))}px ${ST.FONTS.sfx}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillStyle = pal.ink; ctx.fillText(title, 966, 333); ctx.fillStyle = pal.crimson; ctx.fillText(title, 960, 326); ctx.restore();
      }
      const credit = a.credit ?? Z.CREDIT ?? '';
      if (credit) ST.letter(credit, 960, 478, 34, pal.ink, { ink: false, font: ST.FONTS.sing, weight: 800, alpha: Z.smooth(0.3, 0.9, S.lt) });
      const pop = Z.ease.outBack(Z.clamp((S.lt - open * 0.6) / 0.5), 2.2), L = a.lead || {};
      if (pop > 0.01) ST.puppet(960, 880, 46, Object.assign({ dy: (1 - pop) * 6, eyes: 'happy', mouth: 'grin', aR: 1.4 + 0.4 * Math.sin(S.t * 9), aL: 0.2, blush: true }, L));
      ST.curtains(S.t, 1 - k);
      ST.camEnd();
    },
  });
})();
