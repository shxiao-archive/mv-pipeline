/* styles/stage — paint.js: watercolour + ink painting on Canvas2D for a picture-book STAGE film. Deterministic: every
 * wobble is seeded by the boil frame (ST.BOIL per second, so linework boils like hand-drawn animation) and a per-shape
 * counter, never by Math.random.
 *
 *   const ST = Z.ST;
 *   ST.begin(ctx, t)            call first in every scene draw: sets the canvas, the boil frame and the shape counter
 *   ST.paper(tint)              the paper ground (cached); the tooth + vignette are multiplied over stage shots (stage.js)
 *   ST.paint(pts, o)            ONE painted shape from [[x, y], ...]:
 *       wash, washOp            flat colour (0..1): characters, anything that must read solidly
 *       fill, fillOp, bleed, tex, border   watercolour: glazes with soft wandering edges (bleed .05-.3), pigment
 *                               settling in the paper tooth (tex 0..1), a darker dried edge (border 0..1)
 *       hatch: { d, a, c, w, op }   dry-brush hatching (spacing, angle, colour, width, opacity), clipped to the shape
 *       ink, sw                 outline colour (default ST.PAL.ink) and weight (~.4-2); ink: null = no outline
 *       curv                    smooth the outline through the points;  still: true = no boil (big backgrounds)
 *       seed                    fixed wobble seed (default: the shape counter)
 *   ST.ink(pts, sw, col, o)     a brush line along a path whose width follows the pen pressure (o.closed, o.curv, o.op)
 *   ST.rect(x,y,w,h,j) ST.ell(cx,cy,rx,ry,n,j,rot) ST.rr(x,y,w,h,r,j) ST.star(cx,cy,r,inner,n,rot) ST.heart(cx,cy,r)
 *   ST.letter(txt, x, y, size, col, o)   hand lettering with an offset ink shadow; o: { pop 0..1, rot, alpha, ink: false,
 *                               stroke, font, weight, align }
 *   ST.sfx(txt, x, y, size, col, age, o) a sound effect that springs in, jiggles and fades (o.life 1.2 s)
 *   ST.PAL, ST.mix(a, b, k), ST.jit(a), ST.cam(cx, cy, zoom, rot) / ST.camEnd(), ST.shake(t, amount)
 *
 * mv-studio (MIT). Written for this engine: the wet-edge glazes, the pressure brush, the paper and the lettering are
 * this kit's own design (the picture-book watercolour look is a long tradition, not any one film's).
 */
(() => {
  'use strict';
  const Z = window.Z, ST = (Z.ST = Z.ST || {});
  const W = 1920, H = 1080, TAU = Math.PI * 2;
  ST.BOIL = 12;
  // an original picture-book palette: warm cotton paper, plum ink, mid-saturation pigments
  ST.PAL = {
    paper: '#F4EADB', ink: '#33263B', cream: '#FCF3E3', wall: '#F1DEC4',
    rose: '#D9708A', ochre: '#DDA045', sap: '#7AA65E', teal: '#3E9488', sky: '#9CC9E0', indigo: '#33407F',
    violet: '#8461A8', night: '#232A55', crimson: '#BE3A45', crimsonDk: '#7D2533', gold: '#DDB04A',
    wood: '#B98454', woodDk: '#7E5434', mint: '#B0DAC3', peach: '#F0BC96',
  };
  ST.FONTS = { sfx: '"Reggae One", "Dela Gothic One", sans-serif', sing: '"M PLUS Rounded 1c", "Noto Sans JP", sans-serif' };

  let c = null, boil = 0, n = 0;
  ST.begin = (ctx, t) => { c = ctx; boil = Math.floor(t * ST.BOIL + 1e-6); n = 0; ST.t = t; ST.ctx = ctx; return ctx; };
  const R = (still, seed, k) => Z.rnds(still ? 0 : boil, seed, k);                 // -1..1, re-rolled per boil frame
  ST.jit = a => R(false, 4049, ++n) * a;

  const rgb = h => Z.hex(h);
  ST.mix = (a, b, k) => '#' + Z.mix3(rgb(a), rgb(b), Z.clamp(k)).map(v => Math.round(v).toString(16).padStart(2, '0')).join('');

  // ---------------------------------------------------------------- shapes (j = hand jitter in px, re-drawn per boil frame)
  const jit = (p, j) => (j ? p.map(q => [q[0] + ST.jit(j), q[1] + ST.jit(j)]) : p);
  ST.rect = (x, y, w, h, j = 0) => {
    const p = [];
    for (const [ax, ay, bx, by] of [[x, y, x + w, y], [x + w, y, x + w, y + h], [x + w, y + h, x, y + h], [x, y + h, x, y]])
      for (let i = 0; i < 3; i++) p.push([ax + (bx - ax) * i / 3, ay + (by - ay) * i / 3]);
    return jit(p, j);
  };
  ST.ell = (cx, cy, rx, ry, k = 28, j = 0, rot = 0) => {
    const cr = Math.cos(rot), sr = Math.sin(rot), p = [];
    for (let i = 0; i < k; i++) { const a = i / k * TAU, ex = Math.cos(a) * rx, ey = Math.sin(a) * ry; p.push([cx + ex * cr - ey * sr, cy + ex * sr + ey * cr]); }
    return jit(p, j);
  };
  ST.rr = (x, y, w, h, r, j = 0) => {
    r = Math.min(r, w / 2, h / 2);
    const p = [], C = [[x + w - r, y + r, -0.25], [x + w - r, y + h - r, 0], [x + r, y + h - r, 0.25], [x + r, y + r, 0.5]];
    for (const [cx, cy, q] of C) for (let i = 0; i <= 4; i++) { const a = (q + i / 16) * TAU; p.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); }
    return jit(p, j);
  };
  ST.star = (cx, cy, r, inner = 0.42, k = 5, rot = -Math.PI / 2) => {
    const p = [];
    for (let i = 0; i < 2 * k; i++) { const a = rot + i / (2 * k) * TAU, q = i & 1 ? r * inner : r; p.push([cx + Math.cos(a) * q, cy + Math.sin(a) * q]); }
    return p;
  };
  // the classic parametric heart curve (x = 16 sin^3 t, y = 13 cos t - 5 cos 2t - 2 cos 3t - cos 4t), scaled to r
  ST.heart = (cx, cy, r) => {
    const p = [];
    for (let i = 0; i < 36; i++) { const a = i / 36 * TAU, s = Math.sin(a); p.push([cx + 16 * s * s * s * r / 17, cy - (13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a)) * r / 17]); }
    return p;
  };

  // ---------------------------------------------------------------- outlines: straight, or a closed Catmull-Rom spline
  const trace = (pts, curv) => {
    c.beginPath();
    const L = pts.length;
    if (!curv || L < 3) { c.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < L; i++) c.lineTo(pts[i][0], pts[i][1]); c.closePath(); return; }
    const P = i => pts[(i + L) % L];
    c.moveTo(P(0)[0], P(0)[1]);
    for (let i = 0; i < L; i++) {
      const a = P(i - 1), b = P(i), d = P(i + 1), e = P(i + 2);
      c.bezierCurveTo(b[0] + (d[0] - a[0]) / 6, b[1] + (d[1] - a[1]) / 6, d[0] - (e[0] - b[0]) / 6, d[1] - (e[1] - b[1]) / 6, d[0], d[1]);
    }
    c.closePath();
  };
  const bounds = pts => {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const [x, y] of pts) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    return [x0, y0, x1, y1];
  };
  // a glaze edge: every vertex pushed along its outward normal by smooth noise (the paint wandered while wet)
  const wander = (pts, amt, still, seed, salt) => {
    const L = pts.length, [x0, y0, x1, y1] = bounds(pts), size = Math.max(8, Math.hypot(x1 - x0, y1 - y0)), out = [];
    for (let i = 0; i < L; i++) {
      const a = pts[(i - 1 + L) % L], b = pts[i], d = pts[(i + 1) % L], nx = d[1] - a[1], ny = a[0] - d[0], len = Math.hypot(nx, ny) || 1;
      const k = Z.noise1(i * 0.55 + salt * 3.1 + seed * 0.37, still ? 0 : boil) * amt * size * 0.18;
      out.push([b[0] + nx / len * k, b[1] + ny / len * k]);
    }
    return out;
  };

  // pigment tooth: a small tile of soft speckle, multiplied inside a glaze (cached once)
  let toothC = null;
  const tooth = () => {
    if (toothC) return c.createPattern(toothC, 'repeat');
    const T = (toothC = Z.canvas(256, 256)), g = T.getContext('2d'), id = g.createImageData(256, 256), d = id.data;
    for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) {
      const v = Z.rnd(x, y, 91) * 0.5 + Z.rnd(x >> 2, y >> 2, 92) * 0.5, k = (y * 256 + x) * 4, a = v > 0.62 ? (v - 0.62) * 2.2 : 0;
      d[k] = d[k + 1] = d[k + 2] = 0; d[k + 3] = Math.round(255 * Math.min(1, a));
    }
    g.putImageData(id, 0, 0);
    return c.createPattern(T, 'repeat');
  };

  // ---------------------------------------------------------------- one painted shape
  ST.paint = (pts, o = {}) => {
    if (!pts || pts.length < 2) return;
    const seed = o.seed ?? ++n, still = !!o.still;
    c.save();
    if (o.wash) { c.globalAlpha = o.washOp ?? 1; c.fillStyle = o.wash; trace(pts, o.curv); c.fill(); }
    if (o.fill) {
      const op = o.fillOp ?? 0.65, bleed = o.bleed ?? 0.1, glazes = o.layers ?? 4, dark = ST.mix(o.fill, ST.PAL.ink, 0.28);
      c.fillStyle = o.fill;
      for (let l = 0; l < glazes; l++) { c.globalAlpha = op / glazes * 1.5; trace(wander(pts, bleed * (0.6 + 0.4 * l / glazes), still, seed, l + 1), true); c.fill(); }
      const edge = o.border ?? 0.35;
      if (edge > 0) {                                                    // pigment dries darker where the wet edge stopped
        const rim = wander(pts, bleed * 0.5, still, seed, 17);
        c.globalAlpha = op * edge * 0.5; c.strokeStyle = dark; c.lineJoin = 'round';
        c.lineWidth = 1.6; trace(rim, true); c.stroke();
        c.globalAlpha = op * edge * 0.18; c.lineWidth = 5; trace(rim, true); c.stroke();
      }
      const tex = o.tex ?? 0.4;
      if (tex > 0) {
        c.save(); trace(pts, o.curv); c.clip();
        c.globalAlpha = op * tex * 0.5; c.globalCompositeOperation = 'multiply';
        const dx = Z.rnd(seed, 3) * 256, dy = Z.rnd(seed, 4) * 256;
        c.translate(-dx, -dy); c.fillStyle = tooth(); const [x0, y0, x1, y1] = bounds(pts); c.fillRect(x0 + dx - 4, y0 + dy - 4, x1 - x0 + 8, y1 - y0 + 8);
        c.restore();
      }
    }
    if (o.hatch) {
      const h = o.hatch, [x0, y0, x1, y1] = bounds(pts), d = h.d || 24, a = h.a ?? 0.6, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, r = Math.hypot(x1 - x0, y1 - y0) / 2 + d;
      c.save(); trace(pts, o.curv); c.clip(); c.translate(cx, cy); c.rotate(a);
      c.strokeStyle = h.c || ST.PAL.ink; c.lineWidth = h.w || 1.2; c.globalAlpha = h.op ?? 0.5; c.lineCap = 'round';
      for (let s = -r, i = 0; s <= r; s += d, i++) {                     // each stroke bows a little and skips at its ends
        const bow = R(still, seed, 700 + i) * d * 0.3, e0 = Math.abs(R(still, seed, 800 + i)) * r * 0.15;
        c.beginPath(); c.moveTo(-r + e0, s); c.quadraticCurveTo(0, s + bow, r - e0, s - bow * 0.4); c.stroke();
      }
      c.restore();
    }
    c.restore();
    if (o.ink !== null) ST.ink(pts, o.sw ?? 1, o.ink || ST.PAL.ink, { closed: true, curv: o.curv ?? pts.length >= 12, still, seed });
  };

  // ---------------------------------------------------------------- brush line: a ribbon whose width follows pen pressure
  const spline = (p, closed, per) => {                                   // Catmull-Rom samples along the points
    const L = p.length, out = [], segs = closed ? L : L - 1, at = i => (closed ? p[(i + L) % L] : p[Math.max(0, Math.min(L - 1, i))]);
    for (let i = 0; i < segs; i++) {
      const a = at(i - 1), b = at(i), d = at(i + 1), e = at(i + 2);
      for (let k = 0; k < per; k++) {
        const t = k / per, t2 = t * t, t3 = t2 * t;
        out.push([0, 1].map(j => 0.5 * (2 * b[j] + (d[j] - a[j]) * t + (2 * a[j] - 5 * b[j] + 4 * d[j] - e[j]) * t2 + (3 * b[j] - a[j] - 3 * d[j] + e[j]) * t3)));
      }
    }
    if (!closed) out.push(p[L - 1]);
    return out;
  };
  ST.ink = (pts, sw = 1, col = ST.PAL.ink, o = {}) => {
    if (!pts || pts.length < 2 || sw <= 0) return;
    const closed = !!o.closed, seed = o.seed ?? ++n, still = !!o.still, w0 = sw * 3;
    let len = 0;
    for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    const per = Math.max(1, Math.min(12, Math.round(len / pts.length / Math.max(3, w0))));
    const p = o.curv ? spline(pts, closed, per) : spline(pts, closed, 1), m = p.length;
    if (m < 2) return;
    const shake = sw * 0.4, side = [[], []];
    for (let i = 0; i < m; i++) {
      const a = p[closed ? (i - 1 + m) % m : Math.max(0, i - 1)], b = p[closed ? (i + 1) % m : Math.min(m - 1, i + 1)];
      const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1, s = i / (m - 1);
      const press = closed ? 1 : Math.pow(Math.sin(Math.PI * Math.min(1, 0.06 + s * 0.94)), 0.45);      // light at both ends
      const w = w0 / 2 * press * (0.98 + 0.2 * Z.noise1(s * 3 + seed * 0.71, still ? 0 : boil));
      const q = [p[i][0] + R(still, seed, 2000 + i) * shake, p[i][1] + R(still, seed, 2600 + i) * shake];
      side[0].push([q[0] - dy / l * w, q[1] + dx / l * w]); side[1].push([q[0] + dy / l * w, q[1] - dx / l * w]);
    }
    c.save(); c.globalAlpha = o.op ?? 0.95; c.fillStyle = col; c.beginPath();
    if (closed) {
      for (const s of side) { s.forEach((q, i) => (i ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1]))); c.closePath(); }
      c.fill('evenodd');
    } else {
      side[0].forEach((q, i) => (i ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1])));
      for (let i = m - 1; i >= 0; i--) c.lineTo(side[1][i][0], side[1][i][1]);
      c.closePath(); c.fill();
    }
    c.restore();
  };

  // ---------------------------------------------------------------- camera (one level; pair with camEnd)
  ST.cam = (cx = W / 2, cy = H / 2, zoom = 1, rot = 0) => { c.save(); c.translate(W / 2, H / 2); c.rotate(rot); c.scale(zoom, zoom); c.translate(-cx, -cy); };
  ST.camEnd = () => c.restore();
  ST.shake = (t, amt) => [Z.noise1(t * 30, 3) * amt, Z.noise1(t * 30, 11) * amt];

  // ---------------------------------------------------------------- lettering (Latin sound effects; never lyric text)
  const spring = k => (k >= 1 ? 1 : 1 - Math.cos(k * Math.PI * 2.5) * Math.exp(-k * 5.5));   // springs past 1, settles
  ST.letter = (txt, x, y, size, col, o = {}) => {
    const k = o.pop != null ? spring(Z.clamp(o.pop)) : 1;
    if (k <= 0.01) return;
    c.save(); c.globalAlpha = o.alpha ?? 1; c.setTransform(c.getTransform().translate(x, y).rotate((o.rot || 0) * 180 / Math.PI).scale(k));
    c.font = `${o.weight || 400} ${size}px ${o.font || ST.FONTS.sfx}`; c.textAlign = o.align || 'center'; c.textBaseline = 'middle';
    if (o.ink !== false) {                                              // a shadow cut from the ink colour, down and right
      c.save(); c.globalAlpha *= 0.9; c.fillStyle = ST.PAL.ink; c.fillText(txt, size * 0.07, size * 0.08); c.restore();
    }
    if (o.stroke) Object.assign(c, { lineJoin: 'round', lineWidth: size * 0.1, strokeStyle: o.stroke }).strokeText(txt, 0, 0);
    c.fillStyle = col; c.fillText(txt, 0, 0);
    c.restore();
  };
  ST.sfx = (txt, x, y, size, col, age, o = {}) => {
    const life = o.life ?? 1.2;
    if (age < 0 || age > life) return;
    const jiggle = Math.sin(age * 17) * 0.04 * Math.exp(-age * 3);
    ST.letter(txt, x, y, size, col, Object.assign({ pop: age * 3.2, rot: (o.rot ?? -0.07) + jiggle, alpha: 1 - Z.smooth(life * 0.78, life, age) }, o));
  };

  // ---------------------------------------------------------------- paper (made once): cotton mottling + a few fibres
  const vnoise = (x, y, s) => {                                         // 2D value noise in 0..1, smooth between lattice points
    const i = Math.floor(x), j = Math.floor(y), u = x - i, v = y - j, f = q => q * q * (3 - 2 * q);
    return Z.lerp(Z.lerp(Z.rnd(i, j, s), Z.rnd(i + 1, j, s), f(u)), Z.lerp(Z.rnd(i, j + 1, s), Z.rnd(i + 1, j + 1, s), f(u)), f(v));
  };
  let paperC = null;
  ST.paper = (col) => {
    if (!paperC) {
      paperC = Z.canvas(W, H); const g = paperC.getContext('2d');
      g.fillStyle = ST.PAL.paper; g.fillRect(0, 0, W, H);
      const lo = Z.canvas(96, 54), lg = lo.getContext('2d'), id = lg.createImageData(96, 54), d = id.data;   // soft mottling, upscaled
      for (let y = 0; y < 54; y++) for (let x = 0; x < 96; x++) {
        const v = 0.55 * vnoise(x * 0.21, y * 0.21, 1) + 0.45 * vnoise(x * 0.07, y * 0.07, 2), k = (y * 96 + x) * 4;
        d[k] = 150; d[k + 1] = 118; d[k + 2] = 84; d[k + 3] = Math.round(255 * Math.max(0, v - 0.45) * 0.3);
      }
      lg.putImageData(id, 0, 0);
      g.imageSmoothingEnabled = true; g.drawImage(lo, 0, 0, W, H);
      g.lineCap = 'round';
      for (let i = 0; i < 520; i++) {
        const x = Z.rnd(i, 31) * W, y = Z.rnd(i, 32) * H, l = 10 + Z.rnd(i, 33) * 30, a = Z.rnd(i, 34) * Math.PI, b = (Z.rnd(i, 35) - 0.5) * 0.9;
        g.strokeStyle = `rgba(122,98,72,${0.05 + Z.rnd(i, 36) * 0.07})`; g.lineWidth = 0.7 + Z.rnd(i, 37) * 0.6;
        g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + Math.cos(a + b) * l * 0.6, y + Math.sin(a + b) * l * 0.6, x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
      }
    }
    c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = 1; c.drawImage(paperC, 0, 0);
    if (col) { c.globalCompositeOperation = 'multiply'; c.fillStyle = col; c.fillRect(0, 0, W, H); }
    c.restore();
  };
})();
