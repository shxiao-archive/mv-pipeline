/* styles/stage — stage.js: the recurring theatre set, transitions, the karaoke bar and the paper finish.
 *
 *   ST.backdrop(t, o)     wall + slowly turning watercolour sunburst (o.a / o.b colours, o.spin) — or o.paint(t) instead
 *   ST.floor(o)           wooden floor from y 800 (o.floor colour), converging planks
 *   ST.spot(x, col, o)    a spotlight cone + pool on the floor at x
 *   ST.curtains(t, k, o)  side curtains + valance with scallops and fringe; k 0 = open (tied back) .. 1 = closed
 *   ST.alarm(k)           a red wash over everything (a siren beat)
 *   ST.confetti(t, t0, o) painted confetti falling from t0 (o.n, o.seed, o.cols)
 *   ST.flash(k, col)      full-frame wash (keep it soft and rare: check_flash.py)
 *   ST.karaoke(ctx, S)    the lyric bar: a painted ink band at the bottom, the sung part of the line turns ochre
 *                         (Z.charsAt, never ahead of the voice). Set as the shot's `text` (the starter does); in the
 *                         9:16 version it stays inside the 16:9 band.
 *   ST.install()          paper grain + vignette multiplied over every stage shot (chains any Z.layerFX already set)
 *   transitions: 'brushWipe' (fat paint strokes cover the old shot, drag off the new one: o.cols), 'irisInk' (the old
 *   shot closes into a circle on ink, the new one opens from it: o.cx, o.cy)
 *   ST.fontsToLoad, ST.useChinese()
 *
 * mv-studio (MIT). Set and transitions after PDoomVideo's theatre (no licence published: no code taken).
 */
(() => {
  'use strict';
  const Z = window.Z, ST = (Z.ST = Z.ST || {}), W = 1920, H = 1080, TAU = Math.PI * 2;
  const P = () => ST.PAL;

  ST.sunburst = (cx, cy, a, b, rot = 0, n = 16, r = 2200, op = 0.5) => {
    for (let i = 0; i < n; i++) {
      const a0 = rot + i * TAU / n, a1 = a0 + TAU / n * 0.62;
      ST.paint([[cx, cy], [cx + Math.cos(a0) * r, cy + Math.sin(a0) * r], [cx + Math.cos(a1) * r, cy + Math.sin(a1) * r]], { fill: i % 2 ? a : b, fillOp: op, bleed: 0.2, tex: 0.5, border: 0.4, ink: null, still: true, seed: 40 + i });
    }
  };
  ST.backdrop = (t, o = {}) => {
    if (o.paint) return o.paint(t);
    ST.paint(ST.rect(-400, -400, W + 800, 1240), { wash: o.wall || P().wall, ink: null, still: true });
    ST.sunburst(960, 430, o.a || P().rose, o.b || P().ochre, t * (o.spin ?? 0.12));
  };
  ST.floor = (o = {}) => {
    const pal = P(), fl = o.floor || pal.wood, y = o.y ?? 800;
    ST.paint([[-400, y], [W / 2, y - 4], [W + 400, y], [W + 400, 1500], [-400, 1500]], { wash: fl, fill: pal.woodDk, fillOp: 0.25, bleed: 0.05, tex: 0.8, border: 0.6, sw: 1.3, still: true });
    for (let i = -9; i <= 9; i++) ST.ink([[960 + i * 150, y + 2], [960 + i * 255, 1500]], 0.55, pal.woodDk);
    for (const yy of [y + 80, y + 190]) ST.ink([[-400, yy], [W + 400, yy]], 0.45, pal.woodDk);
  };
  ST.spot = (x, col = P().cream, o = {}) => {                             // o.k 0..1: fade a spot on (several at once flash)
    const top = o.top ?? -60, fy = o.y ?? 860, k = Z.clamp(o.k ?? 1);
    if (k <= 0.003) return;
    ST.paint([[x - 90, top], [x + 90, top], [x + 260, fy], [x - 260, fy]], { fill: col, fillOp: 0.22 * k, bleed: 0.05, tex: 0.2, border: 0.1, ink: null });
    ST.paint(ST.ell(x, fy, 270, 55, 24), { fill: col, fillOp: 0.38 * k, bleed: 0.1, tex: 0.2, ink: null });
  };
  ST.curtains = (t, k = 0, o = {}) => {
    const pal = P(), cur = o.col || pal.crimson, dk = o.dk || pal.crimsonDk, gold = pal.gold;
    k = Z.clamp(k);
    const drape = side => {
      const edge = side < 0 ? Z.lerp(250, 985, k) : Z.lerp(1670, 935, k), outer = side < 0 ? -80 : W + 80, tie = k < 0.05, pts = [];
      const g = y => (tie && y > 380 && y < 740 ? -Math.sin((y - 380) / 360 * Math.PI) * 120 : 0);
      for (let i = 0; i <= 10; i++) { const y = -20 + i * 112; pts.push([edge + side * g(y) + Math.sin(i * 1.7 + t * 2) * 6, y]); }
      pts.push([outer, 1130], [outer, -20]);
      if (side > 0) pts.reverse();
      ST.paint(pts, { wash: cur, fill: dk, fillOp: 0.35, bleed: 0.05, tex: 0.8, border: 0.7, sw: 1.5 });
      const w = Math.abs(edge - outer), nf = Math.max(3, Math.round(w / 90));
      for (let f = 1; f < nf; f++) { const fx = Z.lerp(outer, edge, f / nf); ST.ink(Array.from({ length: 7 }, (_, i) => [fx + side * g(i * 185) * f / nf + Math.sin(i + f) * 8, i * 185]), 0.8, dk, { curv: 1 }); }
      if (tie) ST.paint(ST.rr(edge - side * 120 - 40, 544, 80, 32, 14), { wash: gold, sw: 0.8 });
    };
    drape(-1); drape(1);
    const v = [[-80, -40], [W + 80, -40]];
    for (let i = 12; i >= 0; i--) { v.push([i * 160 + 80, 118], [i * 160, 92]); }
    ST.paint(v, { wash: cur, fill: dk, fillOp: 0.45, bleed: 0.05, tex: 0.7, border: 0.6, sw: 1.5 });
    ST.ink(Array.from({ length: 25 }, (_, i) => [i * 80, i % 2 ? 106 : 96]), 1.2, gold);
  };
  ST.alarm = k => { if (k > 0.01) ST.paint(ST.rect(-400, -400, W + 800, H + 800), { fill: '#E0283F', fillOp: 0.45 * Z.clamp(k), bleed: 0.02, tex: 0.5, border: 0.2, ink: null }); };
  ST.flash = (k, col = '#FFFDF6') => { if (k > 0.01) ST.paint(ST.rect(-60, -60, W + 120, H + 120), { wash: col, washOp: Z.clamp(k), ink: null }); };
  ST.confetti = (t, t0, o = {}) => {
    const n = o.n ?? 60, cols = o.cols || [P().rose, P().ochre, P().teal, P().sky, P().violet, P().sap], age = t - t0;
    if (age < 0 || age > (o.life ?? 6)) return;
    for (let i = 0; i < n; i++) {
      const s = (o.seed || 0) * 1000 + i, x0 = Z.rnd(s, 1) * W, v = 220 + 260 * Z.rnd(s, 2), y = -60 + age * v - Z.rnd(s, 3) * 500;
      if (y < -80 || y > H + 60) continue;
      const x = x0 + Math.sin(age * (1.5 + Z.rnd(s, 4) * 2) + i) * 60, r = age * (2 + 4 * Z.rnd(s, 5)) + i, w = 18 + 10 * Z.rnd(s, 6);
      ST.paint([[x + Math.cos(r) * w, y + Math.sin(r) * w * 0.5], [x - Math.sin(r) * w * 0.4, y + Math.cos(r) * w * 0.25], [x - Math.cos(r) * w, y - Math.sin(r) * w * 0.5], [x + Math.sin(r) * w * 0.4, y - Math.cos(r) * w * 0.25]], { wash: cols[i % cols.length], ink: null });
    }
  };

  // ---------------------------------------------------------------- transitions
  Z.transition('brushWipe', (ctx, A, B, k, o) => {
    ctx.drawImage(k < 0.5 ? A : B, 0, 0);
    ST.begin(ctx, o.t || 0);
    const pal = P(), [c1, c2] = o.cols || [pal.crimsonDk, pal.crimson], n = 5, bh = (H + 420) / n + 40;
    ctx.save(); ctx.translate(W / 2, H / 2); ctx.rotate(-0.1); ctx.translate(-W / 2, -H / 2);
    for (let i = 0; i < n; i++) {
      const y0 = -230 + i * (H + 420) / n, d = [0, 0.14, 0.06, 0.18, 0.1][i];
      const q = k < 0.5 ? Z.ease.outCubic(Z.clamp((k * 2 - d) / (1 - d))) : Z.ease.inOutCubic(Z.clamp(((k - 0.5) * 2 - d) / (1 - d)));
      const x0 = k < 0.5 ? -300 : Z.lerp(-300, W + 400, q), x1 = k < 0.5 ? Z.lerp(-300, W + 400, q) : W + 400;
      if (x1 - x0 < 30) continue;
      const pts = [], rag = j => 40 + 50 * Z.rnd(i, j);
      for (let j = 0; j <= 8; j++) pts.push([Z.lerp(x0, x1, j / 8), y0 + Math.sin(j * 0.9 + i) * 14]);
      for (let j = 1; j < 9; j++) pts.push([x1 + rag(j) - 40, y0 + bh * j / 9]);
      for (let j = 8; j >= 0; j--) pts.push([Z.lerp(x0, x1, j / 8), y0 + bh + Math.sin(j * 0.8 + i * 2) * 14]);
      if (k >= 0.5) for (let j = 8; j > 0; j--) pts.push([x0 - rag(j + 20) + 40, y0 + bh * j / 9]);
      ST.paint(pts, { wash: i % 2 ? c1 : c2, fill: i % 2 ? c2 : c1, fillOp: 0.3, bleed: 0.05, tex: 0.8, border: 0.6, ink: null, hatch: { d: 44, a: 0, c: i % 2 ? c2 : pal.cream, w: 1.5, op: 0.35 } });
    }
    ctx.restore();
  });
  Z.transition('irisInk', (ctx, A, B, k, o) => {
    const cx = o.cx ?? W / 2, cy = o.cy ?? H / 2, R = Math.hypot(W, H) * 0.6, r = k < 0.5 ? R * (1 - Z.ease.inCubic(k * 2)) : R * Z.ease.outCubic((k - 0.5) * 2);
    ctx.fillStyle = P().ink; ctx.fillRect(0, 0, W, H);
    ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, Math.max(0.5, r), 0, TAU); ctx.clip(); ctx.drawImage(k < 0.5 ? A : B, 0, 0); ctx.restore();
  });

  // ---------------------------------------------------------------- karaoke bar (text layer, lyric text from Z.LYR only)
  ST.karaoke = (ctx, S) => {
    const i = Z.lineAt(S.t, 0.15);
    if (i < 0) return;
    const L = Z.line(i), txt = L.text, a = L.t - 0.15, b = L.end;
    const grow = Z.ease.outCubic(Z.clamp((S.t - a) / 0.18)) * (1 - Z.smooth(b - 0.12, b, S.t));
    if (grow < 0.02 || !txt) return;
    ST.begin(ctx, S.t);
    let size = 52;
    ctx.font = `800 ${size}px ${ST.FONTS.sing}`;
    let tw = ctx.measureText(txt).width;
    if (tw > 1600) { size = Math.floor(size * 1600 / tw); ctx.font = `800 ${size}px ${ST.FONTS.sing}`; tw = ctx.measureText(txt).width; }
    const w = (tw + 110) * grow, x0 = 960 - w / 2, y0 = 978;
    ST.paint([[x0, y0], [x0 + w / 2, y0 - 4], [x0 + w, y0], [x0 + w + 14, y0 + 44], [x0 + w, y0 + 88], [x0 + w / 2, y0 + 92], [x0, y0 + 88], [x0 - 14, y0 + 44]].map(p => [p[0] + ST.jit(6), p[1] + ST.jit(3)]),
      { wash: P().ink, washOp: 0.88, fill: P().violet, fillOp: 0.25, tex: 0.7, border: 0.4, ink: null });
    if (grow < 0.85) return;
    const chars = [...txt], sung = Z.charsAt(i, S.t, { lead: 0 }), x = 960 - tw / 2, y = 1022;
    ctx.save(); ctx.font = `800 ${size}px ${ST.FONTS.sing}`; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
    ctx.fillStyle = P().cream; ctx.fillText(txt, x, y);
    if (sung > 0) { const sw = ctx.measureText(chars.slice(0, sung).join('')).width; ctx.beginPath(); ctx.rect(x - 2, y - 50, sw + 2, 100); ctx.clip(); ctx.fillStyle = P().ochre; ctx.fillText(txt, x, y); }
    ctx.restore();
  };

  // ---------------------------------------------------------------- finish: grain + vignette multiplied over stage shots
  let grainC = null;
  const grain = () => {
    if (grainC) return grainC;
    grainC = Z.canvas(W, H); const g = grainC.getContext('2d'), id = g.createImageData(W, H), d = id.data;
    let s = 5;
    const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < d.length; i += 4) { const v = 255 - (rnd() < 0.55 ? rnd() * rnd() * 34 : 0); d[i] = v; d[i + 1] = v - 1; d[i + 2] = v - 3; d[i + 3] = 255; }
    g.putImageData(id, 0, 0);
    const gr = g.createRadialGradient(W / 2, H / 2, H * 0.45, W / 2, H / 2, H * 1.05); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(1, 'rgba(120,95,70,.35)');
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    return grainC;
  };
  ST.isStage = shot => !!shot && /^st[A-Z]/.test(shot.scene);
  ST.install = () => {
    if (ST.installed) return;
    const prev = Z.layerFX;
    Z.layerFX = (L, t) => {
      if (prev) prev(L, t);
      if (!ST.isStage(L.shot)) return;
      L.scene.save(); L.scene.setTransform(1, 0, 0, 1, 0, 0); L.scene.globalCompositeOperation = 'multiply'; L.scene.drawImage(grain(), 0, 0); L.scene.restore();
    };
    ST.installed = true;
  };
  // the engine's own post would re-grade the watercolour: keep it light
  ST.post = { boil: 0, bloom: 0.08, bloomThreshold: 0.9, grain: 0.02, vignette: 0, lutMix: 0, ca: 0 };
  ST.fontsToLoad = ['400 64px "Reggae One"', '800 52px "M PLUS Rounded 1c"'];
  ST.useChinese = () => { ST.FONTS.sing = '"Noto Sans SC", sans-serif'; ST.fontsToLoad.push('800 52px "Noto Sans SC"'); };
})();
