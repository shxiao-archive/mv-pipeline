/* styles/stage — stage.js: the recurring theatre set, transitions, the karaoke ribbon and the paper finish.
 *
 *   ST.sunburst(cx, cy, a, b, rot, n, r, op)   alternating painted rays round a soft halo
 *   ST.backdrop(t, o)     wall + slowly turning sunburst (o.a / o.b colours, o.spin, o.wall) — or o.paint(t) instead
 *   ST.floor(o)           the stage boards from y (o.y 800, o.floor colour), in perspective, seams staggered
 *   ST.spot(x, col, o)    a soft spotlight beam + its pool on the boards at x (o.k 0..1 fades it, o.top, o.y)
 *   ST.curtains(t, k, o)  side drapes + a swagged valance with tassels; k 0 = open (drapes tied back) .. 1 = closed
 *   ST.alarm(k)           a red wash over everything (a siren beat)
 *   ST.confetti(t, t0, o) paper confetti tumbling from t0 (o.n, o.seed, o.cols, o.life)
 *   ST.flash(k, col)      full-frame wash (keep it soft and rare: check_flash.py)
 *   ST.karaoke(ctx, S)    the lyric ribbon at the bottom: a painted band whose sung part turns ochre (Z.charsAt, never
 *                         ahead of the voice). Set as the shot's `text` (the starter does).
 *   ST.install()          paper tooth + vignette multiplied over every stage shot (chains any Z.layerFX already set)
 *   transitions: 'brushWipe' (broad brush strokes sweep across the old shot and lift off the new one: o.cols),
 *   'irisInk' (the old shot closes into an ink blot, the new one opens from it: o.cx, o.cy)
 *   ST.fontsToLoad, ST.useChinese()
 *
 * mv-studio (MIT). This kit's own theatre: the set pieces, transitions, ribbon and finish are written for this engine.
 */
(() => {
  'use strict';
  const Z = window.Z, ST = (Z.ST = Z.ST || {}), W = 1920, H = 1080, TAU = Math.PI * 2;
  const P = () => ST.PAL;

  ST.sunburst = (cx, cy, a, b, rot = 0, n = 14, r = 2300, op = 0.45) => {
    for (let i = 0; i < n; i++) {
      const m = rot + (i + 0.5) * TAU / n, half = TAU / n * 0.3, r0 = 70;
      const ray = [[cx + Math.cos(m - half * 0.25) * r0, cy + Math.sin(m - half * 0.25) * r0], [cx + Math.cos(m - half) * r, cy + Math.sin(m - half) * r],
        [cx + Math.cos(m) * r * 1.03, cy + Math.sin(m) * r * 1.03], [cx + Math.cos(m + half) * r, cy + Math.sin(m + half) * r], [cx + Math.cos(m + half * 0.25) * r0, cy + Math.sin(m + half * 0.25) * r0]];
      ST.paint(ray, { fill: i % 2 ? a : b, fillOp: op, bleed: 0.12, tex: 0.45, border: 0.3, ink: null, still: true, seed: 300 + i });
    }
    ST.paint(ST.ell(cx, cy, 230, 230, 30), { fill: P().cream, fillOp: 0.35, bleed: 0.2, tex: 0.2, border: 0, ink: null, still: true, seed: 299 });
  };
  ST.backdrop = (t, o = {}) => {
    if (o.paint) return o.paint(t);
    ST.paint(ST.rect(-400, -400, W + 800, 1240), { wash: o.wall || P().wall, ink: null, still: true });
    ST.sunburst(960, 420, o.a || P().rose, o.b || P().ochre, t * (o.spin ?? 0.1));
  };
  ST.floor = (o = {}) => {
    const pal = P(), y = o.y ?? 800, fl = o.floor || pal.wood, vx = 960, vy = y - 900;          // vanishing point far above
    ST.paint([[-400, y], [W + 400, y], [W + 400, 1500], [-400, 1500]], { wash: fl, fill: pal.woodDk, fillOp: 0.22, bleed: 0.04, tex: 0.7, border: 0.5, sw: 1.2, still: true });
    const at = (xb, yy) => vx + (xb - vx) * (yy - vy) / (1500 - vy);          // a board line through (xb, 1500)
    for (let i = -12; i <= 12; i++) { const xb = vx + i * 230; ST.ink([[at(xb, y + 1), y + 1], [xb, 1500]], 0.5, pal.woodDk, { still: true }); }
    const rows = [y + 60, y + 150, y + 270];                                   // seams: short cross cuts, staggered per row
    rows.forEach((yy, r) => { for (let i = -12; i <= 12; i++) if ((i + r) % 3 === 0) { const xa = at(vx + i * 230, yy), xb = at(vx + (i + 1) * 230, yy); ST.ink([[xa, yy], [xb, yy + 2]], 0.4, pal.woodDk, { still: true }); } });
  };
  ST.spot = (x, col = P().cream, o = {}) => {
    const top = o.top ?? -80, fy = o.y ?? 860, k = Z.clamp(o.k ?? 1);
    if (k <= 0.003) return;
    for (const [w0, w1, a] of [[70, 300, 0.09], [55, 230, 0.1], [40, 160, 0.1]])                      // a beam with soft sides
      ST.paint([[x - w0, top], [x + w0, top], [x + w1, fy], [x - w1, fy]], { fill: col, fillOp: a * k, bleed: 0.03, tex: 0.15, border: 0, ink: null });
    ST.paint(ST.ell(x, fy, 300, 62, 26), { fill: col, fillOp: 0.22 * k, bleed: 0.12, tex: 0.2, border: 0.15, ink: null });
    ST.paint(ST.ell(x, fy, 190, 38, 22), { fill: col, fillOp: 0.25 * k, bleed: 0.1, tex: 0.1, border: 0, ink: null });
  };
  ST.curtains = (t, k = 0, o = {}) => {
    const pal = P(), cloth = o.col || pal.crimson, shade = o.dk || pal.crimsonDk, gold = pal.gold;
    k = Z.clamp(k);
    const tieY = 610, tied = k < 0.05;
    const drape = side => {
      const outer = side < 0 ? -90 : W + 90, edge = side < 0 ? Z.lerp(250, 975, k) : Z.lerp(1670, 945, k);
      const pull = y => (tied ? 150 * Math.exp(-Math.pow((y - tieY) / 240, 2)) : 0);      // tied back: the cloth pinches in at the tie
      const inner = y => edge - side * pull(y) + Math.sin(y * 0.011 + t * 1.6 + side) * 5;
      const ys = Array.from({ length: 13 }, (_, i) => -30 + i * 95);
      const pts = ys.map(y => [inner(y), y]).concat([[outer, ys[ys.length - 1]], [outer, -30]]);
      ST.paint(side > 0 ? pts.slice().reverse() : pts, { wash: cloth, ink: o.ink === undefined ? pal.ink : o.ink, sw: 1.4 });
      const folds = Math.max(3, Math.round(Math.abs(edge - outer) / 110));
      for (let f = 0; f < folds; f++) {                                         // folds: darker valleys between lit ridges
        const u0 = (f + 0.35) / folds, u1 = (f + 0.75) / folds, X = (u, y) => Z.lerp(outer, inner(y), u);
        const strip = ys.map(y => [X(u0, y), y]).concat(ys.slice().reverse().map(y => [X(u1, y), y]));
        ST.paint(strip, { fill: shade, fillOp: 0.4, bleed: 0.04, tex: 0.6, border: 0.2, ink: null });
      }
      if (tied) { const tx = inner(tieY) + side * 30; ST.paint(ST.ell(tx, tieY, 46, 20, 16), { wash: gold, sw: 0.8 }); ST.ink([[tx, tieY + 18], [tx + side * 8, tieY + 80]], 1.1, gold, { curv: 1 }); }
    };
    drape(-1); drape(1);
    const swags = 6, sw = (W + 160) / swags, val = [[-80, -40], [W + 80, -40]];
    for (let s = swags - 1; s >= 0; s--) for (let j = 8; j >= 0; j--) { const x = -80 + (s + j / 8) * sw; val.push([x, 70 + Math.sin(Math.PI * j / 8) * 70]); }
    ST.paint(val, { wash: cloth, fill: shade, fillOp: 0.35, bleed: 0.04, tex: 0.6, border: 0.5, sw: 1.4 });
    for (let s = 0; s < swags; s++) ST.ink(Array.from({ length: 9 }, (_, j) => [-80 + (s + j / 8) * sw, 60 + Math.sin(Math.PI * j / 8) * 62]), 1.1, gold, { curv: 1 });
    for (let s = 1; s < swags; s++) { const x = -80 + s * sw; ST.paint([[x - 10, 66], [x + 10, 66], [x + 6, 120], [x - 6, 120]], { wash: gold, sw: 0.7 }); }   // tassels
  };
  ST.alarm = k => { if (k > 0.01) ST.paint(ST.rect(-400, -400, W + 800, H + 800), { fill: '#D9293C', fillOp: 0.42 * Z.clamp(k), bleed: 0.02, tex: 0.4, border: 0.15, ink: null }); };
  ST.flash = (k, col = '#FFFCF4') => { if (k > 0.01) ST.paint(ST.rect(-60, -60, W + 120, H + 120), { wash: col, washOp: Z.clamp(k), ink: null }); };
  ST.confetti = (t, t0, o = {}) => {
    const n = o.n ?? 60, cols = o.cols || [P().rose, P().ochre, P().teal, P().sky, P().violet, P().sap], age = t - t0;
    if (age < 0 || age > (o.life ?? 6)) return;
    for (let i = 0; i < n; i++) {
      const s = (o.seed || 0) * 977 + i, fall = 180 + 220 * Z.rnd(s, 11), y = -90 + age * fall - Z.rnd(s, 12) * 600;
      if (y < -90 || y > H + 60) continue;
      const x = Z.rnd(s, 13) * W + Math.sin(age * (1.2 + Z.rnd(s, 14) * 1.6) + s) * 50, spin = age * (3 + 4 * Z.rnd(s, 15)) + s, flip = Math.cos(age * (5 + 5 * Z.rnd(s, 16)) + s);
      const sz = 12 + 9 * Z.rnd(s, 17), cs = Math.cos(spin), sn = Math.sin(spin), round = i % 4 === 0;
      const shape = round ? ST.ell(0, 0, sz * 0.55, sz * 0.55 * flip, 10) : [[-sz / 2, -sz * 0.3 * flip], [sz / 2, -sz * 0.3 * flip], [sz / 2, sz * 0.3 * flip], [-sz / 2, sz * 0.3 * flip]];
      ST.paint(shape.map(([px, py]) => [x + px * cs - py * sn, y + px * sn + py * cs]), { wash: cols[i % cols.length], ink: null });
    }
  };

  // ---------------------------------------------------------------- transitions
  Z.transition('brushWipe', (ctx, A, B, k, o) => {
    ctx.drawImage(k < 0.5 ? A : B, 0, 0);
    ST.begin(ctx, o.t || 0);
    const pal = P(), [c1, c2] = o.cols || [pal.crimsonDk, pal.crimson], strokes = 4, band = H / strokes + 120;
    ctx.save(); ctx.translate(W / 2, H / 2); ctx.rotate(0.12); ctx.translate(-W / 2, -H / 2);
    for (let i = 0; i < strokes; i++) {
      const lag = 0.22 * Z.rnd(i, 61), y0 = -140 + i * (H + 280) / strokes, q0 = Z.clamp(((k < 0.5 ? k * 2 : (k - 0.5) * 2) - lag) / (1 - lag));
      const q = Z.ease.inOutSine(q0), head = Z.lerp(-500, W + 500, q);
      const x0 = k < 0.5 ? -500 : head, x1 = k < 0.5 ? head : W + 500;                     // paint on, then lift off
      if (x1 - x0 < 20) continue;
      const pts = [];
      for (let j = 0; j <= 10; j++) pts.push([Z.lerp(x0, x1, j / 10), y0 + Z.noise1(j * 0.8, i) * 18]);
      for (let j = 1; j < 10; j++) pts.push([x1 + 70 * Math.abs(Z.noise1(j * 1.7, 40 + i)) + 20 * Math.sin(j * Math.PI / 10), y0 + band * j / 10]);
      for (let j = 10; j >= 0; j--) pts.push([Z.lerp(x0, x1, j / 10), y0 + band + Z.noise1(j * 0.9, 20 + i) * 18]);
      if (k >= 0.5) for (let j = 9; j > 0; j--) pts.push([x0 - 70 * Math.abs(Z.noise1(j * 1.3, 60 + i)), y0 + band * j / 10]);
      const fg = i % 2 ? c1 : c2;
      ST.paint(pts, { wash: fg, fill: i % 2 ? c2 : c1, fillOp: 0.25, bleed: 0.04, tex: 0.7, border: 0.4, ink: null });
      ctx.save(); ctx.beginPath(); ctx.rect(x0, y0, x1 - x0, band); ctx.clip();               // bristle streaks along the stroke
      for (let b = 0; b < 14; b++) { const by = y0 + band * Z.rnd(i, b, 62); ST.ink([[x0, by], [x1, by + Z.rnds(i, b, 63) * 10]], 0.35 + Z.rnd(i, b, 64) * 0.5, ST.mix(fg, pal.cream, 0.35), { op: 0.35 }); }
      ctx.restore();
    }
    ctx.restore();
  });
  Z.transition('irisInk', (ctx, A, B, k, o) => {
    const cx = o.cx ?? W / 2, cy = o.cy ?? H / 2, R = Math.hypot(W, H) * 0.62, r = k < 0.5 ? R * (1 - Z.ease.inCubic(k * 2)) : R * Z.ease.outCubic((k - 0.5) * 2);
    ctx.fillStyle = P().ink; ctx.fillRect(0, 0, W, H);
    if (r < 0.5) return;
    ctx.save(); ctx.beginPath();
    for (let i = 0; i <= 48; i++) { const a = i / 48 * TAU, rr = r * (1 + 0.035 * Z.noise1(i * 0.7, 9)); i ? ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr) : ctx.moveTo(cx + rr, cy); }
    ctx.closePath(); ctx.clip(); ctx.drawImage(k < 0.5 ? A : B, 0, 0); ctx.restore();
  });

  // ---------------------------------------------------------------- karaoke ribbon (text layer, lyric text from Z.LYR only)
  ST.karaoke = (ctx, S) => {
    const i = Z.lineAt(S.t, 0.15);
    if (i < 0) return;
    const L = Z.line(i), txt = L.text, a = L.t - 0.15, b = L.end;
    const open = Z.ease.outQuart(Z.clamp((S.t - a) / 0.22)) * (1 - Z.smooth(b - 0.14, b, S.t));
    if (open < 0.02 || !txt) return;
    ST.begin(ctx, S.t);
    let size = 52;
    const font = s => `800 ${s}px ${ST.FONTS.sing}`;
    ctx.font = font(size);
    let tw = ctx.measureText(txt).width;
    if (tw > 1580) { size = Math.floor(size * 1580 / tw); ctx.font = font(size); tw = ctx.measureText(txt).width; }
    const w = (tw + 1.2 * size) * open, x0 = 960 - w / 2, x1 = 960 + w / 2, top = 946, bot = 1018;   // inside the 5 % safe margin
    const band = [[x0, top]];
    for (let j = 1; j < 6; j++) band.push([Z.lerp(x0, x1, j / 6), top - 5 * Math.sin(j / 6 * Math.PI)]);
    band.push([x1, top], [x1 - 10, (top + bot) / 2], [x1, bot]);
    for (let j = 5; j > 0; j--) band.push([Z.lerp(x0, x1, j / 6), bot + 4 * Math.sin(j / 6 * Math.PI)]);
    band.push([x0, bot], [x0 + 10, (top + bot) / 2]);
    ST.paint(band, { wash: P().ink, washOp: 0.86, fill: P().indigo, fillOp: 0.3, tex: 0.6, border: 0.3, ink: null });
    for (const [ex, d] of [[x0, -open], [x1, open]])                           // the ribbon's folded tails, behind (unfolding with it)
      ST.paint([[ex, top + 8], [ex + d * 46, top + 22], [ex + d * 30, (top + bot) / 2 + 6], [ex + d * 48, bot + 10], [ex, bot - 6]], { wash: ST.mix(P().ink, P().violet, 0.3), washOp: 0.8, ink: null });
    // the words ride on the ribbon as it unrolls and rolls up: never a blank plate
    const chars = [...txt], sung = Z.charsAt(i, S.t, { lead: 0 }), x = 960 - tw / 2, y = (top + bot) / 2 + 2;
    ctx.save(); ctx.beginPath(); ctx.rect(x0, top - 10, w, bot - top + 20); ctx.clip(); ctx.font = font(size); ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
    ctx.fillStyle = P().cream; ctx.fillText(txt, x, y);
    if (sung > 0) { const sw = ctx.measureText(chars.slice(0, sung).join('')).width; ctx.beginPath(); ctx.rect(x - 2, y - 50, sw + 2, 100); ctx.clip(); ctx.fillStyle = P().ochre; ctx.fillText(txt, x, y); }
    ctx.restore();
  };

  // ---------------------------------------------------------------- finish: paper tooth + vignette multiplied over stage shots
  let finishC = null;
  const finish = () => {
    if (finishC) return finishC;
    finishC = Z.canvas(W, H); const g = finishC.getContext('2d');
    const T = Z.canvas(384, 384), tg = T.getContext('2d'), id = tg.createImageData(384, 384), d = id.data;
    for (let y = 0; y < 384; y++) for (let x = 0; x < 384; x++) {
      const k = (y * 384 + x) * 4, v = Z.rnd(x, y, 71), dent = v > 0.7 ? (v - 0.7) * 70 : 0, c0 = 255 - dent - Z.rnd(x >> 1, y >> 1, 72) * 7;
      d[k] = c0; d[k + 1] = c0 - 1; d[k + 2] = c0 - 4; d[k + 3] = 255;
    }
    tg.putImageData(id, 0, 0);
    g.fillStyle = g.createPattern(T, 'repeat'); g.fillRect(0, 0, W, H);
    const v = g.createRadialGradient(W / 2, H * 0.48, H * 0.5, W / 2, H / 2, H * 1.15); v.addColorStop(0, 'rgba(255,255,255,0)'); v.addColorStop(1, 'rgba(112,86,66,.3)');
    g.fillStyle = v; g.fillRect(0, 0, W, H);
    return finishC;
  };
  ST.isStage = shot => !!shot && /^st[A-Z]/.test(shot.scene);
  ST.install = () => {
    if (ST.installed) return;
    const prev = Z.layerFX;
    Z.layerFX = (L, t) => {
      if (prev) prev(L, t);
      if (!ST.isStage(L.shot)) return;
      L.scene.save(); L.scene.setTransform(1, 0, 0, 1, 0, 0); L.scene.globalCompositeOperation = 'multiply'; L.scene.drawImage(finish(), 0, 0); L.scene.restore();
    };
    ST.installed = true;
  };
  // the engine's own post would re-grade the watercolour: keep it light
  ST.post = { boil: 0, bloom: 0.08, bloomThreshold: 0.9, grain: 0.02, vignette: 0, lutMix: 0, ca: 0 };
  ST.fontsToLoad = ['400 64px "Reggae One"', '800 52px "M PLUS Rounded 1c"'];
  ST.useChinese = () => { ST.FONTS.sing = '"Noto Sans SC", sans-serif'; ST.fontsToLoad.push('800 52px "Noto Sans SC"'); };
})();
