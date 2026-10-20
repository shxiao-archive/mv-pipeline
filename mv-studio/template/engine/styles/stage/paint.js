/* styles/stage — paint.js: watercolour + ink painting on Canvas2D for a picture-book STAGE film. Deterministic: every
 * wobble is seeded by the boil frame (12 per second, so linework "boils" like hand-drawn animation) and a per-shape
 * counter, never by Math.random.
 *
 *   const ST = Z.ST;
 *   ST.begin(ctx, t)            call first in every scene draw: sets the canvas, the boil frame and the shape counter
 *   ST.paper()                  the paper ground (cached); the grain + vignette are multiplied over stage shots (stage.js)
 *   ST.paint(pts, o)            ONE painted shape from [[x, y], ...]:
 *       wash, washOp            flat colour (0..1): characters, anything that must read solidly
 *       fill, fillOp, bleed, tex, border   watercolour: layered, bleeding edges (bleed .05-.3), pigment granulation (tex
 *                               0..1), pooled darker edge (border 0..1). Backgrounds, glows, shading, pools of light
 *       hatch: { d, a, c, w, op }   dry hatching (spacing, angle, colour, width, opacity), clipped to the shape
 *       ink, sw                 outline colour (default ST.PAL.ink) and weight (~.4-2); ink: null = no outline
 *       curv                    smooth the outline through the points;  still: true = no boil (big backgrounds)
 *       seed                    fixed wobble seed (default: the shape counter)
 *   ST.ink(pts, sw, col, o)     a tapered brush stroke along a path (o.closed, o.curv)
 *   ST.rect(x,y,w,h,j) ST.ell(cx,cy,rx,ry,n,j,rot) ST.rr(x,y,w,h,r,j) ST.star(cx,cy,r,inner,n,rot) ST.heart(cx,cy,r)
 *   ST.letter(txt, x, y, size, col, o)   comic lettering with an ink drop shadow; o: { pop 0..1 (overshoot), rot, alpha,
 *                               ink: false, stroke, font, weight, align }
 *   ST.sfx(txt, x, y, size, col, age, o) a sound effect that pops in, wobbles and fades (o.life 1.2 s)
 *   ST.PAL, ST.mix(a, b, k), ST.jit(a), ST.cam(cx, cy, zoom, rot) / ST.camEnd(), ST.shake(t, amount)
 *
 * mv-studio (MIT). Look after PDoomVideo's p5.brush watercolour (no licence published: no code taken; written for this
 * engine).
 */
(() => {
  'use strict';
  const Z = window.Z, ST = (Z.ST = Z.ST || {});
  const W = 1920, H = 1080, TAU = Math.PI * 2;
  ST.BOIL = 12;
  ST.PAL = {
    paper: '#F2E9D8', ink: '#2A2333', cream: '#FFF4E0', wall: '#F5E2C6',
    rose: '#E07A8F', ochre: '#E6A93A', sap: '#6FA05A', teal: '#3B9A97', sky: '#90C4E4', indigo: '#2E3B78',
    violet: '#7A5BA6', night: '#1E2450', crimson: '#B5303E', crimsonDk: '#771C2A', gold: '#E6B23C',
    wood: '#B57A4A', woodDk: '#7A4A2C', mint: '#A8D8C0', peach: '#F2B48C',
  };
  ST.FONTS = { sfx: '"Reggae One", "Dela Gothic One", sans-serif', sing: '"M PLUS Rounded 1c", "Noto Sans JP", sans-serif' };

  let c = null, boil = 0, n = 0;
  ST.begin = (ctx, t) => { c = ctx; boil = Math.floor(t * ST.BOIL + 1e-6); n = 0; ST.t = t; ST.ctx = ctx; return ctx; };
  const R = (still, seed, k) => Z.rnds(still ? 0 : boil, seed, k);
  ST.jit = a => R(false, 7777, ++n) * a;

  const rgb = h => Z.hex(h);
  ST.mix = (a, b, k) => '#' + Z.mix3(rgb(a), rgb(b), Z.clamp(k)).map(v => Math.round(v).toString(16).padStart(2, '0')).join('');

  // ---------------------------------------------------------------- geometry (j = hand jitter in px, re-drawn per boil frame)
  ST.rect = (x, y, w, h, j = 0) => [[x, y], [x + w / 2, y], [x + w, y], [x + w, y + h / 2], [x + w, y + h], [x + w / 2, y + h], [x, y + h], [x, y + h / 2]]
    .map(p => [p[0] + ST.jit(j), p[1] + ST.jit(j)]);
  ST.ell = (cx, cy, rx, ry, k = 28, j = 0, rot = 0) => Array.from({ length: k }, (_, i) => { const a = rot + i / k * TAU; return [cx + Math.cos(a) * rx + ST.jit(j), cy + Math.sin(a) * ry + ST.jit(j)]; });
  ST.rr = (x, y, w, h, r, j = 0) => {
    const p = [], corner = (cx, cy, a0) => { for (let i = 0; i <= 5; i++) { const a = a0 + i / 5 * Math.PI / 2; p.push([cx + Math.cos(a) * r + ST.jit(j), cy + Math.sin(a) * r + ST.jit(j)]); } };
    corner(x + w - r, y + r, -Math.PI / 2); corner(x + w - r, y + h - r, 0); corner(x + r, y + h - r, Math.PI / 2); corner(x + r, y + r, Math.PI);
    return p;
  };
  ST.star = (cx, cy, r, inner = 0.42, k = 5, rot = -Math.PI / 2) => Array.from({ length: k * 2 }, (_, i) => { const a = rot + i * Math.PI / k, q = i % 2 ? r * inner : r; return [cx + Math.cos(a) * q, cy + Math.sin(a) * q]; });
  ST.heart = (cx, cy, r) => Array.from({ length: 32 }, (_, i) => { const a = i / 32 * TAU, x = 16 * Math.pow(Math.sin(a), 3), y = 13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a); return [cx + x * r / 17, cy - y * r / 17]; });

  // ---------------------------------------------------------------- paths
  const path = (pts, curv) => {
    c.beginPath();
    if (!curv || pts.length < 3) { pts.forEach((p, i) => (i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]))); c.closePath(); return; }
    const m = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], L = pts.length, s = m(pts[L - 1], pts[0]);
    c.moveTo(s[0], s[1]);
    for (let i = 0; i < L; i++) { const p = pts[i], q = m(p, pts[(i + 1) % L]); c.quadraticCurveTo(p[0], p[1], q[0], q[1]); }
    c.closePath();
  };
  // midpoint displacement: the bleeding, uneven edge of a watercolour wash
  const deform = (pts, depth, amp, still, seed, salt) => {
    let p = pts;
    for (let d = 0; d < depth; d++, amp *= 0.6) {
      const q = [];
      for (let i = 0; i < p.length; i++) {
        const a = p[i], b = p[(i + 1) % p.length], dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy) || 1, g = R(still, seed, salt + d * 997 + i) * amp * len;
        q.push(a, [(a[0] + b[0]) / 2 - dy / len * g, (a[1] + b[1]) / 2 + dx / len * g]);
      }
      p = q;
    }
    return p;
  };
  const bbox = pts => { let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (const [x, y] of pts) { if (x < x0) x0 = x; if (y < y0) y0 = y; if (x > x1) x1 = x; if (y > y1) y1 = y; } return [x0, y0, x1, y1]; };

  // ---------------------------------------------------------------- one painted shape
  ST.paint = (pts, o = {}) => {
    if (!pts || pts.length < 2) return;
    const seed = o.seed ?? ++n, still = !!o.still;
    c.save();
    if (o.wash) { c.globalAlpha = o.washOp ?? 1; c.fillStyle = o.wash; path(pts, o.curv); c.fill(); }
    if (o.fill) {
      const op = o.fillOp ?? 0.65, bleed = o.bleed ?? 0.1, L = o.layers ?? 5, base = deform(pts, 2, bleed * 0.5, still, seed, 0);
      c.fillStyle = o.fill;
      for (let l = 0; l < L; l++) { c.globalAlpha = op * 1.7 / L; path(deform(base, 2, bleed, still, seed, 100 + l * 131), true); c.fill(); }   // soft, rounded bleeds
      const dark = ST.mix(o.fill, ST.PAL.ink, 0.3);
      if ((o.border ?? 0.35) > 0) { c.globalAlpha = op * (o.border ?? 0.35) * 0.55; c.strokeStyle = dark; c.lineWidth = 2.4; c.lineJoin = 'round'; path(base, o.curv); c.stroke(); }
      const tex = o.tex ?? 0.4;
      if (tex > 0) {                                           // granulation: pigment settling in the paper's tooth
        const [x0, y0, x1, y1] = bbox(base), k = Math.min(220, ((x1 - x0) * (y1 - y0)) / 3000 * tex | 0);
        c.save(); path(base, o.curv); c.clip(); c.fillStyle = dark;
        for (let i = 0; i < k; i++) { c.globalAlpha = op * tex * 0.22 * (0.4 + 0.6 * Z.rnd(seed, i, 5)); const r = 1 + 3.5 * Z.rnd(seed, i, 3); c.fillRect(x0 + (x1 - x0) * Z.rnd(seed, i, 1), y0 + (y1 - y0) * Z.rnd(seed, i, 2), r, r * 0.8); }
        c.restore();
      }
    }
    if (o.hatch) {
      const h = o.hatch, [x0, y0, x1, y1] = bbox(pts), d = h.d || 24, a = h.a ?? 0.6, ca = Math.cos(a), sa = Math.sin(a), rad = Math.hypot(x1 - x0, y1 - y0) / 2, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
      c.save(); path(pts, o.curv); c.clip(); c.strokeStyle = h.c || ST.PAL.ink; c.lineWidth = h.w || 1.2; c.globalAlpha = h.op ?? 0.5; c.lineCap = 'round';
      for (let s = -rad, i = 0; s <= rad; s += d, i++) { const e = R(still, seed, 900 + i) * d * 0.25; c.beginPath(); c.moveTo(cx + ca * -rad - sa * (s + e), cy + sa * -rad + ca * (s + e)); c.lineTo(cx + ca * rad - sa * (s - e), cy + sa * rad + ca * (s - e)); c.stroke(); }
      c.restore();
    }
    c.restore();
    if (o.ink !== null) ST.ink(pts, o.sw ?? 1, o.ink || ST.PAL.ink, { closed: true, curv: o.curv ?? pts.length >= 12, still, seed });   // ellipses and blobs get a smooth line
  };

  // ---------------------------------------------------------------- brush stroke: a filled ribbon whose width breathes
  const chaikin = (p, closed) => {
    const q = [], L = p.length, end = closed ? L : L - 1;
    if (!closed) q.push(p[0]);
    for (let i = 0; i < end; i++) { const a = p[i], b = p[(i + 1) % L]; q.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25], [a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]); }
    if (!closed) q.push(p[L - 1]);
    return q;
  };
  const resample = (p, closed, step) => {
    const q = [p[0]], pts = closed ? p.concat([p[0]]) : p;
    let carry = 0;
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i], len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      for (let s = step - carry; s < len; s += step) q.push([a[0] + (b[0] - a[0]) * s / len, a[1] + (b[1] - a[1]) * s / len]);
      carry = (carry + len) % step;
    }
    if (!closed) q.push(pts[pts.length - 1]);
    return q;
  };
  ST.ink = (pts, sw = 1, col = ST.PAL.ink, o = {}) => {
    if (!pts || pts.length < 2 || sw <= 0) return;
    const closed = !!o.closed, seed = o.seed ?? ++n, still = !!o.still, w0 = sw * 3.2;
    let p = o.curv ? chaikin(chaikin(pts, closed), closed) : pts;
    p = resample(p, closed, Math.max(4, w0 * 1.3));
    const m = p.length;
    if (m < 2) return;
    const jx = sw * 0.45, P = p.map((q, i) => [q[0] + R(still, seed, 3000 + i) * jx, q[1] + R(still, seed, 5000 + i) * jx]);
    const left = [], right = [];
    for (let i = 0; i < m; i++) {
      const a = P[closed ? (i - 1 + m) % m : Math.max(0, i - 1)], b = P[closed ? (i + 1) % m : Math.min(m - 1, i + 1)];
      const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy) || 1, s = i / (m - 1);
      const taper = closed ? 1 : Math.min(1, 0.25 + s * 5) * Math.min(1, 0.2 + (1 - s) * 4);
      const w = w0 * taper * (0.8 + 0.3 * Z.noise1(i * 0.35 + seed, boil)) / 2;
      left.push([P[i][0] - dy / len * w, P[i][1] + dx / len * w]); right.push([P[i][0] + dy / len * w, P[i][1] - dx / len * w]);
    }
    c.save(); c.globalAlpha = o.op ?? 0.95; c.fillStyle = col; c.beginPath();
    if (closed) { left.forEach((q, i) => (i ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1]))); c.closePath(); right.forEach((q, i) => (i ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1]))); c.closePath(); c.fill('evenodd'); }
    else { left.forEach((q, i) => (i ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1]))); for (let i = m - 1; i >= 0; i--) c.lineTo(right[i][0], right[i][1]); c.closePath(); c.fill(); }
    c.restore();
  };

  // ---------------------------------------------------------------- camera (one level; pair with camEnd)
  ST.cam = (cx = W / 2, cy = H / 2, zoom = 1, rot = 0) => { c.save(); c.translate(W / 2, H / 2); c.rotate(rot); c.scale(zoom, zoom); c.translate(-cx, -cy); };
  ST.camEnd = () => c.restore();
  ST.shake = (t, amt) => { const f = Math.floor(t * 24); return [Z.rnds(f, 17) * amt, Z.rnds(f, 23) * amt]; };

  // ---------------------------------------------------------------- lettering (Latin sound effects; never lyric text)
  ST.letter = (txt, x, y, size, col, o = {}) => {
    const k = o.pop != null ? Z.ease.outBack(Z.clamp(o.pop), 1.9) : 1;
    if (k <= 0.01) return;
    c.save(); c.translate(x, y); c.rotate(o.rot || 0); c.scale(k, k); c.globalAlpha = o.alpha ?? 1;
    c.font = `${o.weight || 400} ${size}px ${o.font || ST.FONTS.sfx}`; c.textAlign = o.align || 'center'; c.textBaseline = 'middle';
    if (o.stroke) { c.lineJoin = 'round'; c.lineWidth = size * 0.12; c.strokeStyle = o.stroke; c.strokeText(txt, 0, 0); }
    if (o.ink !== false) { c.fillStyle = ST.PAL.ink; c.fillText(txt, size * 0.045, size * 0.055); }
    c.fillStyle = col; c.fillText(txt, 0, 0);
    c.restore();
  };
  ST.sfx = (txt, x, y, size, col, age, o = {}) => {
    const life = o.life ?? 1.2;
    if (age < 0 || age > life) return;
    ST.letter(txt, x, y, size, col, Object.assign({ pop: age * 5, rot: (o.rot ?? -0.08) + Math.sin(age * 20) * 0.03 * (1 - age / life), alpha: 1 - Z.smooth(life - 0.25, life, age) }, o));
  };

  // ---------------------------------------------------------------- paper (made once)
  let paperC = null;
  ST.paper = (col) => {
    if (!paperC) {
      paperC = Z.canvas(W, H); const g = paperC.getContext('2d');
      g.fillStyle = ST.PAL.paper; g.fillRect(0, 0, W, H);
      for (let i = 0; i < 70; i++) { const x = Z.rnd(i, 1) * W, y = Z.rnd(i, 2) * H, r = 120 + Z.rnd(i, 3) * 380, gr = g.createRadialGradient(x, y, 0, x, y, r), a = 0.045 * Z.rnd(i, 4); gr.addColorStop(0, `rgba(160,125,80,${a})`); gr.addColorStop(1, 'rgba(160,125,80,0)'); g.fillStyle = gr; g.fillRect(x - r, y - r, 2 * r, 2 * r); }
      g.lineWidth = 1;
      for (let i = 0; i < 1400; i++) { const x = Z.rnd(i, 5) * W, y = Z.rnd(i, 6) * H, l = 6 + Z.rnd(i, 7) * 26, a = Z.rnd(i, 8) * TAU; g.strokeStyle = `rgba(110,88,60,${0.035 + Z.rnd(i, 9) * 0.06})`; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + Math.cos(a + 0.6) * l * 0.5, y + Math.sin(a + 0.6) * l * 0.5, x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke(); }
    }
    c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = 1; c.drawImage(paperC, 0, 0);
    if (col) { c.globalCompositeOperation = 'multiply'; c.fillStyle = col; c.fillRect(0, 0, W, H); }
    c.restore();
  };
})();
