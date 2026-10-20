/* styles/treatise — treatise.js: the house kit of a TREATISE film (the song as plates from an illustrated technical
 * treatise): one palette, one type system, per-word lyric timing, the spark, and the hairline primitives every plate
 * shares. Pure functions of their arguments; draw into the ctx you pass.
 *
 *   TR.PAL                  ink ink2 graphite ash bone signal ember blood (+ acid: one rare accent, one moment only)
 *   TR.font(px, o)          o: { face 'grotesk' | 'mono' | 'serif', weight, italic, width 62..125 (grotesk) }
 *   TR.text(ctx, s, x, y, px, o)   draws with the width axis (nearest font-stretch + a small horizontal scale); returns width
 *   TR.measure(ctx, s, px, o)
 *   TR.words(i)             words of lyric line i with times: [{ w, t0, t1, k }] (per-character times when the project has
 *                           them, else spread over the line like Z.charsAt); TR.prog(word, t) 0..1 sung; never ahead
 *   TR.lineWords(ctx, i, t, x, y, px, o)   a line set word by word: unsung dim, sung bone, the current word signal;
 *                           o: { face, weight, width, maxW, lead 0.4 (s shown early), align, sungCol, dimA, place(word, k) }
 *   TR.spark(ctx, x, y, t, o)          the spark head (white-hot core, orange halo, rays); o: { scale, seed, particles:
 *                           headAt(t) -> {x, y} for deterministic sputtering streaks }
 *   TR.trail(ctx, pts, o)   the hairline the spark drags (o: { col, w, glow })
 *   TR.grid / axes / ticks / cropMarks / callout / stamp / hatch / contours / readout   hairline primitives (see below)
 *   TR.value(t)             the film's running number from TR.NUM.keys [[t, v], ...] (steps up on beats); TR.fmt(v)
 *   TR.cam(ctx, S, cam)     camera: { from: { x, y, zoom, rot }, to, ease ('outCubic': moves at once after the cut) } +
 *                           a push on downbeats (cam.snap) + a reframing snap every half bar (cam.reframe 0..1) +
 *                           cam.follow [x, y] (a world point the camera tracks, weight cam.followK 0.45: the spark, the pen)
 *
 * mv-studio (MIT). Style after pdoom-video by Giacomo Magnanini (MIT): the palette, the spark and its deterministic
 * particles, per-word karaoke rules. Written for this Canvas2D engine; see licenses/LICENSE-pdoom-video.txt.
 */
(() => {
  'use strict';
  const Z = window.Z, TR = (Z.TR = Z.TR || {}), TAU = Math.PI * 2;
  TR.PAL = { ink: '#0A0A0B', ink2: '#151517', graphite: '#5E5B57', ash: '#9C978F', bone: '#EEE9DF', signal: '#FF4D12', ember: '#FF8A3D', blood: '#C21D0B', acid: '#D8FF3C' };
  const P = TR.PAL;
  TR.FACES = { grotesk: '"Archivo", "Inter", sans-serif', mono: '"IBM Plex Mono", monospace', serif: '"Cormorant Garamond", "Noto Serif JP", serif' };
  TR.fontsToLoad = ['400 40px "Archivo"', '900 40px "Archivo"', '400 40px "IBM Plex Mono"', '600 40px "IBM Plex Mono"', 'italic 500 40px "Cormorant Garamond"', '500 40px "Cormorant Garamond"'];
  TR.useCJK = (sc) => { const f = sc ? '"Noto Sans SC"' : '"Noto Sans JP"'; TR.FACES.grotesk = `"Archivo", ${f}, sans-serif`; TR.FACES.serif = `"Cormorant Garamond", ${sc ? '"Noto Serif SC"' : '"Noto Serif JP"'}, serif`; };

  // ---------------------------------------------------------------- type (Archivo's width axis via font-stretch + scale)
  const STRETCH = [[50, 'ultra-condensed'], [62.5, 'extra-condensed'], [75, 'condensed'], [87.5, 'semi-condensed'], [100, 'normal'], [112.5, 'semi-expanded'], [125, 'expanded']];
  const setFont = (c, px, o = {}) => {
    const face = TR.FACES[o.face || 'grotesk'], w = Z.clamp(o.width ?? 100, 62, 125);
    let best = STRETCH[4];
    if ((o.face || 'grotesk') === 'grotesk') for (const s of STRETCH) if (Math.abs(s[0] - w) < Math.abs(best[0] - w)) best = s;
    c.font = `${o.italic ? 'italic ' : ''}${o.weight || 400} ${px}px ${face}`;
    if ('fontStretch' in c) c.fontStretch = best[1];
    return (o.face || 'grotesk') === 'grotesk' ? w / best[0] : 1;          // residual horizontal scale
  };
  TR.measure = (c, s, px, o = {}) => { c.save(); const sx = setFont(c, px, o); const w = c.measureText(s).width * sx + (o.track || 0) * px * Math.max(0, [...s].length - 1); c.restore(); return w; };
  TR.text = (c, s, x, y, px, o = {}) => {
    c.save(); const sx = setFont(c, px, o);
    c.textBaseline = o.baseline || 'alphabetic'; c.textAlign = 'left'; c.fillStyle = o.col || P.bone; c.globalAlpha *= o.alpha ?? 1;
    const w = c.measureText(s).width * sx + (o.track || 0) * px * Math.max(0, [...s].length - 1);
    const x0 = o.align === 'center' ? x - w / 2 : o.align === 'right' ? x - w : x;
    c.translate(x0, y); if (o.rot) c.rotate(o.rot); c.scale(sx, 1);
    if (o.track) { let xx = 0; for (const ch of s) { c.fillText(ch, xx, 0); xx += c.measureText(ch).width + o.track * px / sx; } }
    else c.fillText(s, 0, 0);
    c.restore(); return w;
  };

  // ---------------------------------------------------------------- per-word lyric timing (text from Z.LYR only)
  const cache = new Map();
  TR.words = i => {
    const L = Z.line(i);
    if (cache.has(i) && cache.get(i).src === L) return cache.get(i).w;
    const chars = [...L.text], n = chars.length, ct = Z.charTimes(i);
    const over = Math.min(0.6 * (L.end - L.t), 0.09 * n), tOf = k => (ct && ct[k] != null ? ct[k] : L.t + (n ? k / n * over : 0));
    const spaced = /\s/.test(L.text), out = [];
    let k = 0;
    const toks = spaced ? L.text.split(/(\s+)/) : chars;                  // CJK: one token per character
    for (const tok of toks) { const len = [...tok].length; if (tok.trim()) out.push({ w: tok, k, t0: tOf(k) }); k += len; }
    out.forEach((w, j) => { w.t1 = j + 1 < out.length ? out[j + 1].t0 : Math.min(L.end, w.t0 + 0.6); w.i = j; });
    cache.set(i, { src: L, w: out });
    return out;
  };
  TR.prog = (w, t) => Z.clamp((t - w.t0) / Math.max(0.05, w.t1 - w.t0));
  TR.lineWords = (c, i, t, x, y, px, o = {}) => {
    const words = TR.words(i), lead = o.lead ?? 0.4, L = Z.line(i);
    if (t < L.t - lead || !words.length) return [];
    const sp = TR.measure(c, ' ', px, o) * (o.spaceK ?? 1), lh = px * (o.lh ?? 1.08), maxW = o.maxW || 1e9, out = [];
    let cx = 0, cy = 0, rows = [[]];
    for (const w of words) { const ww = TR.measure(c, w.w, px, o); if (cx > 0 && cx + ww > maxW) { cx = 0; cy += lh; rows.push([]); } rows[rows.length - 1].push({ w, x: cx, y: cy, ww }); cx += ww + sp; }
    for (const row of rows) {
      const rw = row.length ? row[row.length - 1].x + row[row.length - 1].ww : 0, dx = o.align === 'center' ? -rw / 2 : o.align === 'right' ? -rw : 0;
      for (const it of row) {
        const pr = TR.prog(it.w, t), cur = pr > 0 && pr < 1;
        const pos = o.place ? o.place(it.w, it.w.i, x + it.x + dx, y + it.y) : { x: x + it.x + dx, y: y + it.y };
        if (!pos) continue;
        const col = t >= it.w.t0 ? (cur ? (o.curCol || P.signal) : (o.sungCol || P.bone)) : (o.dimCol || P.bone);
        TR.text(c, it.w.w, pos.x, pos.y, px, Object.assign({}, o, { col, alpha: t >= it.w.t0 ? 1 : (o.dimA ?? 0.32), rot: pos.rot, align: 'left' }));
        out.push({ w: it.w, x: pos.x, y: pos.y, ww: it.ww, pr });
      }
    }
    return out;
  };

  // ---------------------------------------------------------------- the spark (and the hairline it drags)
  TR.spark = (c, x, y, t, o = {}) => {
    const s = o.scale || 1, seed = o.seed || 1;
    c.save(); c.globalCompositeOperation = 'lighter';
    if (o.particles) {                                      // sputtering streaks, born on a fixed clock: deterministic
      const rate = o.rate ?? 70, life = 0.45, n0 = Math.floor((t - life) * rate), n1 = Math.floor(t * rate);
      for (let n = n0; n <= n1; n++) {
        const tb = n / rate; if (tb > t) continue;
        const h = o.particles(tb); if (!h) continue;
        const age = t - tb, lf = life * (0.35 + 0.65 * Z.rnd(n, seed, 2)); if (age > lf) continue;
        const a = Z.rnd(n, seed) * TAU, sp = 260 * s * (0.25 + Math.pow(Z.rnd(n, seed, 1), 2) * 1.2), vx = Math.cos(a) * sp, vy = Math.sin(a) * sp - 80 * s;
        const pos = q => [h.x + vx * q, h.y + vy * q + 260 * q * q], [x1, y1] = pos(age), [x0, y0] = pos(Math.max(0, age - 0.02)), k = 1 - age / lf;
        c.strokeStyle = Z.rgba(k > 0.6 ? '#FFE6C8' : P.ember, Math.min(1, k * 1.4)); c.lineWidth = 1.6 * s * (0.5 + k * 0.7); c.lineCap = 'round';
        c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke();
      }
    }
    const pool = c.createRadialGradient(x, y, 0, x, y, 520 * s);           // the light it throws on the plate around it
    pool.addColorStop(0, Z.rgba(P.ember, 0.16 * (o.light ?? 1))); pool.addColorStop(1, Z.rgba(P.signal, 0));
    c.fillStyle = pool; c.beginPath(); c.arc(x, y, 520 * s, 0, TAU); c.fill();
    const flick = 0.85 + 0.15 * Math.sin(t * 91.7) * Math.sin(t * 57.3), g = c.createRadialGradient(x, y, 0, x, y, 26 * s);
    g.addColorStop(0, `rgba(255,250,240,${flick})`); g.addColorStop(0.18, 'rgba(255,170,90,0.95)'); g.addColorStop(0.45, Z.rgba(P.signal, 0.45)); g.addColorStop(1, Z.rgba(P.signal, 0));
    c.fillStyle = g; c.beginPath(); c.arc(x, y, 26 * s, 0, TAU); c.fill();
    c.strokeStyle = 'rgba(255,200,140,0.8)'; c.lineWidth = 1.2 * s;
    for (let i = 0; i < 4; i++) { const a = i * TAU / 4 + t * 3 + 0.4, r = (9 + 5 * Z.rnd(Math.floor(t * 30), i)) * s; c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); c.stroke(); }
    c.restore();
  };
  TR.trail = (c, pts, o = {}) => {
    if (pts.length < 2) return;
    c.save(); c.lineJoin = 'round'; c.lineCap = 'round';
    if (o.glow !== false) { c.globalCompositeOperation = 'lighter'; c.strokeStyle = Z.rgba(P.signal, 0.25); c.lineWidth = (o.w || 2) * 4; c.beginPath(); pts.forEach((p, i) => (i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]))); c.stroke(); c.globalCompositeOperation = 'source-over'; }
    c.strokeStyle = o.col || P.signal; c.lineWidth = o.w || 2; c.beginPath(); pts.forEach((p, i) => (i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]))); c.stroke();
    c.restore();
  };

  // ---------------------------------------------------------------- hairline primitives
  const line = (c, x0, y0, x1, y1) => { c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke(); };
  TR.grid = (c, x, y, w, h, step, o = {}) => {             // o: { col, a, major (every n), reveal 0..1 (draws in from the left) }
    c.save(); c.strokeStyle = o.col || P.graphite; c.lineWidth = 1; const r = o.reveal ?? 1;
    for (let gx = 0, k = 0; gx <= w + 0.5; gx += step, k++) { c.globalAlpha = (o.a ?? 0.35) * (o.major && k % o.major === 0 ? 2 : 1); if (gx / w <= r) line(c, x + gx, y, x + gx, y + h * Z.clamp(r * 1.4 - gx / w * 0.4)); }
    for (let gy = 0, k = 0; gy <= h + 0.5; gy += step, k++) { c.globalAlpha = (o.a ?? 0.35) * (o.major && k % o.major === 0 ? 2 : 1); line(c, x, y + gy, x + w * r, y + gy); }
    c.restore();
  };
  TR.axes = (c, x, y, w, h, o = {}) => {                   // origin bottom-left at (x, y + h); o: { col, xl, yl, ticks, k 0..1 draw-in }
    const k = o.k ?? 1, col = o.col || P.bone;
    c.save(); c.strokeStyle = col; c.lineWidth = 1.5;
    line(c, x, y + h, x + w * Z.ease.outExpo(k), y + h); line(c, x, y + h, x, y + h - h * Z.ease.outExpo(k));
    c.lineWidth = 1;
    for (let i = 1; i <= (o.ticks ?? 10); i++) { if (i / (o.ticks ?? 10) > k) break; const tx = x + w * i / (o.ticks ?? 10), ty = y + h - h * i / (o.ticks ?? 10); line(c, tx, y + h, tx, y + h + 10); line(c, x - 10, ty, x, ty); }
    c.restore();
    if (o.xl) TR.text(c, o.xl, x + w, y + h + 40, 22, { face: 'mono', col, alpha: 0.7 * k, align: 'right' });
    if (o.yl) TR.text(c, o.yl, x - 16, y - 14, 22, { face: 'mono', col, alpha: 0.7 * k });
  };
  TR.cropMarks = (c, x, y, w, h, o = {}) => {              // the printed sheet's corners; o.k 0..1 flies them in
    const k = o.k ?? 1, L = 40, off = (1 - k) * 400;
    c.save(); c.strokeStyle = o.col || P.bone; c.lineWidth = 1.2; c.globalAlpha = k;
    for (const [cx, cy, sx, sy] of [[x, y, -1, -1], [x + w, y, 1, -1], [x, y + h, -1, 1], [x + w, y + h, 1, 1]]) {
      const X = cx + sx * off, Y = cy + sy * off; line(c, X + sx * 12, Y, X + sx * (12 + L), Y); line(c, X, Y + sy * 12, X, Y + sy * (12 + L));
    }
    c.restore();
  };
  TR.callout = (c, x, y, tx, ty, label, o = {}) => {       // leader line from a point to a mono label
    c.save(); c.strokeStyle = o.col || P.ash; c.lineWidth = 1; c.globalAlpha = o.alpha ?? 1;
    line(c, x, y, tx, ty); line(c, tx, ty, tx + (tx >= x ? 30 : -30), ty);
    c.fillStyle = o.col || P.ash; c.beginPath(); c.arc(x, y, 3, 0, TAU); c.fill(); c.restore();
    TR.text(c, label, tx + (tx >= x ? 38 : -38), ty + 7, o.px || 20, { face: 'mono', col: o.col || P.ash, align: tx >= x ? 'left' : 'right', alpha: o.alpha ?? 1 });
  };
  TR.stamp = (c, s, x, y, px, k, o = {}) => {              // a rubber stamp that slams in (k 0..1 since the hit)
    if (k <= 0) return;
    const sc = 1 + 1.6 * Math.pow(1 - Z.clamp(k * 6), 3), col = o.col || P.signal;
    c.save(); c.translate(x, y); c.rotate(o.rot ?? -0.12); c.scale(sc, sc); c.globalAlpha = Z.clamp(k * 6) * (o.alpha ?? 0.9);
    const w = TR.measure(c, s, px, { weight: 900, width: 110 }) + px * 0.6;
    c.strokeStyle = col; c.lineWidth = px * 0.08; c.strokeRect(-w / 2, -px * 0.75, w, px * 1.25);
    TR.text(c, s, 0, px * 0.33, px, { weight: 900, width: 110, col, align: 'center' });
    c.globalCompositeOperation = 'destination-out';                        // ink texture: dry gaps in the stamp
    for (let i = 0; i < 90; i++) { c.globalAlpha = 0.5 * Z.rnd(i, 7); c.fillRect(-w / 2 + w * Z.rnd(i, 1), -px * 0.75 + px * 1.25 * Z.rnd(i, 2), 2 + 6 * Z.rnd(i, 3), 2 + 3 * Z.rnd(i, 4)); }
    c.restore();
  };
  TR.hatch = (c, pts, o = {}) => {                         // engraving: parallel hairlines clipped to a shape, tone = spacing
    const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]), x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    const a = o.angle ?? 0.6, d = o.d || 7, R = Math.hypot(x1 - x0, y1 - y0), cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, ca = Math.cos(a), sa = Math.sin(a);
    c.save(); c.beginPath(); pts.forEach((p, i) => (i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]))); c.closePath(); c.clip();
    c.strokeStyle = o.col || P.bone; c.lineWidth = o.w || 1; c.globalAlpha = o.alpha ?? 0.8;
    for (let s = -R; s <= R; s += d) line(c, cx - ca * R - sa * s, cy - sa * R + ca * s, cx + ca * R - sa * s, cy + sa * R + ca * s);
    c.restore();
  };
  // topographic contour lines of an fbm field (marching squares); o: { seed, levels, scale, t (drift), col }
  TR.contours = (c, x, y, w, h, o = {}) => {
    const N = o.cell || 24, cols = Math.ceil(w / N) + 1, rows = Math.ceil(h / N) + 1, sc = o.scale || 0.004, seed = o.seed || 3, dr = o.t || 0;
    const f = (gx, gy) => { const X = (x + gx * N) * sc + dr * 0.05, Y = (y + gy * N) * sc; return Z.fbm1(X + Z.fbm1(Y, seed + 1, 2) * 1.5, seed, 3) + 0.6 * Z.fbm1(Y * 1.3 + X * 0.4, seed + 9, 3); };
    const v = []; for (let j = 0; j < rows; j++) { v.push([]); for (let i = 0; i < cols; i++) v[j].push(f(i, j)); }
    c.save(); c.strokeStyle = o.col || P.bone; c.lineWidth = 1;
    const L = o.levels || 14;
    for (let l = 0; l < L; l++) {
      const iso = -0.9 + 1.8 * (l + 0.5) / L; c.globalAlpha = (o.alpha ?? 0.6) * (l % 5 === 0 ? 1 : 0.55); c.beginPath();
      for (let j = 0; j < rows - 1; j++) for (let i = 0; i < cols - 1; i++) {
        const a = v[j][i], b = v[j][i + 1], d = v[j + 1][i + 1], e = v[j + 1][i], pts = [];
        const ed = (p, q, x0, y0, x1, y1) => { if ((p < iso) !== (q < iso)) { const k = (iso - p) / (q - p); pts.push([x + (x0 + (x1 - x0) * k) * N, y + (y0 + (y1 - y0) * k) * N]); } };
        ed(a, b, i, j, i + 1, j); ed(b, d, i + 1, j, i + 1, j + 1); ed(d, e, i + 1, j + 1, i, j + 1); ed(e, a, i, j + 1, i, j);
        for (let q = 0; q + 1 < pts.length; q += 2) { c.moveTo(pts[q][0], pts[q][1]); c.lineTo(pts[q + 1][0], pts[q + 1][1]); }
      }
      c.stroke();
    }
    c.restore();
    return f;
  };

  // ---------------------------------------------------------------- the running number (staged in-world, raised by the hooks)
  TR.NUM = { keys: [[0, 0.02]], label: 'p', digits: 2 };
  TR.value = t => {
    let v = TR.NUM.keys[0][1], prev = v, t0 = -1e9;
    for (const [tk, x] of TR.NUM.keys) if (t >= tk) { prev = v; v = x; t0 = tk; }
    return Z.lerp(prev, v, Z.ease.outExpo(Z.clamp((t - t0) / 0.6)));      // rolls to the new value fast, then holds
  };
  TR.fmt = v => (typeof v === 'number' && isFinite(v) ? v.toFixed(TR.NUM.digits) : String(v));
  TR.readout = (c, x, y, px, t, o = {}) => {                              // a small in-world cameo of the number
    TR.text(c, (o.label ?? TR.NUM.label) + ' =', x, y, px * 0.5, { face: 'mono', col: o.col || P.ash });
    TR.text(c, TR.fmt(TR.value(t)), x, y + px * 0.95, px, { face: 'mono', weight: 600, col: o.hot || P.signal });
  };

  // ---------------------------------------------------------------- camera: an eased move + snaps that land on downbeats
  // cam.reframe (default 1): every half bar (on beats 1 and 3) the camera SNAPS to a new framing (outExpo over 0.35 s): the sub-cuts and
  // reframings inside a plate. 0 = only the eased move. Hairlines on black need it: a slow drift barely changes a frame.
  TR.cam = (c, S, cam = {}) => {
    const k = (Z.ease[cam.ease || 'outCubic'] || Z.ease.outCubic)(S.p), a = cam.from || {}, b = cam.to || a;
    const snap = (cam.snap ?? 0.03) * Math.exp(-14 * Math.max(0, S.clock.since(S.t))) * (S.clock.inBar(S.t) === 0 ? 1 : 0.35);
    const R = cam.reframe ?? 1, half = n => Math.floor(n / 2), bar = half(S.clock.beat(S.t)) - half(S.clock.beat(S.shot.t0)), seed = S.shot.t0 * 100 | 0;
    const off = n => (n <= 0 ? [0, 0, 0] : [Z.rnds(seed, n, 1) * 150, Z.rnds(seed, n, 2) * 90, Z.rnds(seed, n, 3) * 0.12]);
    const q = Z.ease.outExpo(Z.clamp((S.t - S.clock.at(half(S.clock.beat(S.t)) * 2)) / 0.35)), o0 = off(bar - 1), o1 = off(bar);
    const rf = [0, 1, 2].map(i => R * Z.lerp(o0[i], o1[i], q));
    const z = Z.lerp(a.zoom ?? 1, b.zoom ?? 1, k) * (1 + snap) * (1 + rf[2]);
    const fk = cam.follow ? cam.followK ?? 0.45 : 0, fx = cam.follow ? cam.follow[0] - 960 : 0, fy = cam.follow ? cam.follow[1] - 540 : 0;   // track the action
    c.translate(960, 540); c.rotate(Z.lerp(a.rot || 0, b.rot || 0, k)); c.scale(z, z);
    c.translate(-960 - Z.lerp(Z.lerp(a.x || 0, b.x || 0, k), fx, fk) - rf[0], -540 - Z.lerp(Z.lerp(a.y || 0, b.y || 0, k), fy, fk) - rf[1]);
  };
  // the engine's post: glow only on the signal colour (bright orange), crisp bone type, fine grain
  TR.post = { boil: 0, bloom: 0.35, bloomThreshold: 0.86, grain: 0.05, vignette: 0.22, lutMix: 0, ca: 0 };
})();
