/* styles/interface — kit.js: the v4 tools of world-execute-me on this engine (plates, type, masks).
 *
 *   IF.plates(img, { n 3, inks: ['#hex', ...] })   a flat-ink silhouette (cut-paper art, keyed) separated ONCE into its ink
 *                       plates: the n inks (found by k-means, or given), lightest first. Plates are CUMULATIVE in print
 *                       order: plate 0 = the whole figure, plate 1 = every ink darker than ink 0, ... A lower plate runs
 *                       under the upper ones, so registered plates never seam and a shifted plate shows the ink below.
 *                       The inks must differ in brightness (a plate is a brightness band of the art).
 *   IF.inks(ink, img, rect, { roles: ['text', 'me', 'panel'], offset: [[dx, dy], ...], reveal: [k | { k, dir }, ...],
 *                       alpha, flip, keyline: { color, width }, n, inks })
 *                       the figure printed from its plates, each in a palette ROLE (the art's own colours are never
 *                       shown), with its own misregistration offset and wipe-in (dir 'down' | 'up' | 'left' | 'right')
 *   IF.inkClip(ink, img, rect, plate, fn)   draw fn clipped to one plate (a glyph field inside the dark ink only)
 *   IF.part(img, [u, v], { plate, grow })  ONE connected patch of one plate around a seed point (u, v 0..1 of the
 *                       image): her open hand, the cat's ear. Parts are cut out of the art, never hand-drawn polygons.
 *   IF.partClip(ink, img, rect, [u, v], fn, opts)   draw fn clipped to that patch
 *   IF.limp(ink, str, cx, y, { size, n 48, squash(u) 0..1, shift(u) [dx, dy], font, weight, color, alpha })
 *                       type in n vertical strips, each pressed towards the baseline and moved: a word that sags
 *   IF.masked(ink, content, mask)   content() seen only through what mask() draws (type as windows onto a picture)
 *
 * Read the pixels once per image (first use); nothing reads pixels while the film renders after that.
 * Ported and adapted from world-execute-me-lyric-mv (src/engine/art.js, type.js, draw.js; MIT, (c) 2026 Nyankomint).
 */
(() => {
  'use strict';
  const Z = window.Z, IF = (Z.IF = Z.IF || {});
  const lum = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const mk = (w, h) => Z.canvas(Math.max(2, Math.round(w)), Math.max(2, Math.round(h)));
  const scratch = [mk(8, 8), mk(8, 8), mk(8, 8)];
  const fit = (c, w, h) => { w = Math.max(2, Math.round(w)); h = Math.max(2, Math.round(h)); if (c.width !== w || c.height !== h) { c.width = w; c.height = h; } return c; };
  let nKey = 0; const keyOf = img => img.src || img.__key || (img.__key = 'img' + nKey++);   // identity of a bitmap without a src

  // ---------------------------------------------------------------- separation
  const SEP = new Map(), MAXSIDE = 1600;
  IF.plates = (img, { n = 3, inks = null } = {}) => {
    const key = keyOf(img) + '|' + (inks ? inks.join(',') : n);
    if (SEP.has(key)) return SEP.get(key);
    const k = Math.min(1, MAXSIDE / Math.max(img.width, img.height)), W = Math.round(img.width * k), H = Math.round(img.height * k), N = W * H;
    const src = mk(W, H), sg = src.getContext('2d', { willReadFrequently: true });
    sg.drawImage(img, 0, 0, W, H);
    const px = sg.getImageData(0, 0, W, H).data, A = new Float32Array(N), L = new Float32Array(N);
    for (let i = 0; i < N; i++) { const a = px[i * 4 + 3]; A[i] = a < 16 ? 0 : a >= 250 ? 1 : a / 255; L[i] = lum(px[i * 4], px[i * 4 + 1], px[i * 4 + 2]) / 255; }
    // the inks: given, or k-means (by brightness) of the solid pixels
    let cent;
    if (inks) cent = inks.map(h => { const [r, g, b] = Z.hex(h); return lum(r, g, b) / 255; });
    else {
      const sol = []; for (let i = 0; i < N; i += 2) if (A[i] === 1) sol.push(L[i]);
      sol.sort((a, b) => a - b);
      const lo = sol[Math.floor(sol.length * 0.02)] ?? 0, hi = sol[Math.floor(sol.length * 0.98)] ?? 1;   // seeds spread over the RANGE:
      cent = Array.from({ length: n }, (_, j) => lo + ((hi - lo) * j) / Math.max(1, n - 1));             // a big area must not take two inks
      for (let it = 0; it < 12; it++) {
        const s = new Float64Array(n), c = new Float64Array(n);
        for (const v of sol) { let b = 0; for (let j = 1; j < n; j++) if (Math.abs(v - cent[j]) < Math.abs(v - cent[b])) b = j; s[b] += v; c[b]++; }
        for (let j = 0; j < n; j++) if (c[j]) cent[j] = s[j] / c[j];
      }
    }
    cent = [...cent].sort((a, b) => b - a);                                   // lightest first = print order
    // cumulative plate j (j >= 1): darker than the threshold between ink j-1 and ink j, with a soft edge
    const masks = [], label = new Uint8Array(N);
    for (let j = 0; j < cent.length; j++) {
      const c = mk(W, H), g = c.getContext('2d'), im = g.createImageData(W, H), d = im.data;
      const th = j ? (cent[j - 1] + cent[j]) / 2 : 0, e = j ? Math.max(0.01, (cent[j - 1] - cent[j]) * 0.18) : 0;
      for (let i = 0; i < N; i++) {
        const cov = j ? A[i] * Z.clamp((th + e - L[i]) / (2 * e)) : A[i];
        d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = 255; d[i * 4 + 3] = Math.round(cov * 255);
        if (cov > 0.5) label[i] = j + 1;
      }
      g.putImageData(im, 0, 0); masks.push(c);
    }
    const sep = { W, H, masks, label, lum: cent, parts: new Map() };
    SEP.set(key, sep);
    return sep;
  };

  // ---------------------------------------------------------------- drawing the plates
  const wipe = (rv, r) => {
    const k = rv == null ? 1 : Z.clamp(rv.k ?? rv), dir = (rv && rv.dir) || 'down';
    return k >= 1 ? r : dir === 'down' ? { ...r, h: r.h * k } : dir === 'up' ? { ...r, y: r.y + r.h * (1 - k), h: r.h * k } : dir === 'right' ? { ...r, w: r.w * k } : { ...r, x: r.x + r.w * (1 - k), w: r.w * k };
  };
  const onto = (g, r, flip, dx = 0, dy = 0) => { g.translate(r.x + dx, r.y + dy); if (flip) { g.translate(r.w, 0); g.scale(-1, 1); } };
  const tint = (mask, col, minus) => {                                    // mask (minus the next plate) in one colour, scratch canvas
    const t = fit(scratch[0], mask.width, mask.height), tg = t.getContext('2d');
    tg.globalCompositeOperation = 'copy'; tg.drawImage(mask, 0, 0);
    if (minus) { tg.globalCompositeOperation = 'destination-out'; tg.drawImage(minus, 0, 0); }
    tg.globalCompositeOperation = 'source-in'; tg.fillStyle = col; tg.fillRect(0, 0, t.width, t.height);
    return t;
  };
  IF.inks = (ink, img, rect, o = {}) => {
    if (!img || !((o.alpha ?? 1) > 0.003)) return;
    const sep = IF.plates(img, o), g = ink.g, roles = o.roles || ['text', 'me', 'panel'], a0 = g.globalAlpha;
    const r = Array.isArray(rect) ? { x: rect[0], y: rect[1], w: rect[2], h: rect[3] } : rect;
    if (o.keyline) {                                                       // a keyline round the whole figure (black ink on a dark ground)
      const kw = o.keyline.width ?? 3, t = tint(sep.masks[0], ink.col(o.keyline.color || 'line'));
      g.save(); onto(g, r, o.flip); g.globalAlpha = a0 * (o.alpha ?? 1);
      for (const [dx, dy] of [[-kw, 0], [kw, 0], [0, -kw], [0, kw], [-kw * 0.7, -kw * 0.7], [kw * 0.7, kw * 0.7], [-kw * 0.7, kw * 0.7], [kw * 0.7, -kw * 0.7]]) g.drawImage(t, dx, dy, r.w, r.h);
      g.restore();
    }
    // a translucent figure is assembled whole first: plates laid translucent one on another would not add up
    const group = (o.alpha ?? 1) < 0.999, G = group ? fit(scratch[2], 1920, 1080) : null, gg = G && G.getContext('2d');
    if (gg) { gg.setTransform(1, 0, 0, 1, 0, 0); gg.clearRect(0, 0, G.width, G.height); gg.setTransform(g.getTransform()); }
    const tg = gg || g;
    sep.masks.forEach((m, j) => {
      const role = roles[j]; if (!role) return;
      const rv = o.reveal && o.reveal[j], kk = rv == null ? 1 : rv.k ?? rv; if (kk <= 0) return;
      const off = (o.offset && o.offset[j]) || [0, 0], next = roles[j + 1] ? null : sep.masks[j + 1];   // no role above: cut it out (paper shows)
      const t = tint(m, ink.col(role), next), full = { x: 0, y: 0, w: t.width, h: t.height }, w = wipe(rv, full);
      tg.save(); onto(tg, r, o.flip, off[0], off[1]);
      tg.drawImage(t, w.x, w.y, w.w, w.h, (w.x / t.width) * r.w, (w.y / t.height) * r.h, (w.w / t.width) * r.w, (w.h / t.height) * r.h);
      tg.restore();
    });
    if (gg) { g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = a0 * o.alpha; g.drawImage(G, 0, 0); g.restore(); }
  };
  const clipTo = (ink, mask, r, flip, fn) => {                            // fn() drawn, then cut to the mask (in rect r)
    const g = ink.g, C = fit(scratch[1], 1920, 1080), cg = C.getContext('2d'), m = g.getTransform();
    cg.setTransform(1, 0, 0, 1, 0, 0); cg.globalCompositeOperation = 'source-over'; cg.globalAlpha = 1; cg.clearRect(0, 0, C.width, C.height);
    cg.setTransform(m);
    ink.g = cg; try { fn(); } finally { ink.g = g; }
    cg.globalCompositeOperation = 'destination-in'; cg.save(); onto(cg, r, flip); cg.drawImage(mask, 0, 0, r.w, r.h); cg.restore();
    g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.drawImage(C, 0, 0); g.restore();
  };
  const rectOf = rect => (Array.isArray(rect) ? { x: rect[0], y: rect[1], w: rect[2], h: rect[3] } : rect);
  IF.inkClip = (ink, img, rect, plate, fn, o = {}) => { if (img) clipTo(ink, IF.plates(img, o).masks[plate], rectOf(rect), o.flip, fn); };

  // ---------------------------------------------------------------- parts: one connected patch of one plate
  IF.part = (img, [u, v], { plate = 0, grow = 2, n = 3, inks = null } = {}) => {
    const sep = IF.plates(img, { n, inks }), key = `${u},${v}|${plate}|${grow}`;
    if (sep.parts.has(key)) return sep.parts.get(key);
    const { W, H, label } = sep, want = plate + 1, cover = new Uint8Array(W * H);
    const sx = Z.clamp(Math.round(u * W), 0, W - 1), sy = Z.clamp(Math.round(v * H), 0, H - 1);
    let start = -1;                                                        // the seed may sit on a line of another ink: nearest cell of the wanted one
    for (let rad = 0; rad < 48 && start < 0; rad++) for (let dy = -rad; dy <= rad && start < 0; dy++) for (let dx = -rad; dx <= rad; dx++) {
      const x = sx + dx, y = sy + dy;
      if (x >= 0 && y >= 0 && x < W && y < H && label[y * W + x] === want) { start = y * W + x; break; }
    }
    if (start >= 0) {
      const st = [start]; cover[start] = 1;
      while (st.length) {
        const i = st.pop(), x = i % W;
        for (const j of [i - W, i + W, x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1]) if (j >= 0 && j < cover.length && !cover[j] && label[j] === want) { cover[j] = 1; st.push(j); }
      }
    }
    const c = mk(W, H), g = c.getContext('2d'), im = g.createImageData(W, H), d = im.data;
    for (let i = 0; i < W * H; i++) { d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = 255; d[i * 4 + 3] = cover[i] * 255; }
    g.putImageData(im, 0, 0);
    if (grow > 0) { g.filter = `blur(${grow}px)`; g.drawImage(c, 0, 0); g.filter = 'none'; }   // widen and soften the cut a little
    sep.parts.set(key, c);
    return c;
  };
  IF.partClip = (ink, img, rect, uv, fn, o = {}) => { if (img) clipTo(ink, IF.part(img, uv, o), rectOf(rect), o.flip, fn); };

  // ---------------------------------------------------------------- type
  IF.limp = (ink, str, cx, y, { size = 200, font = 'serif', weight = 400, color = 'me', alpha = 1, n = 48, squash = null, shift = null } = {}) => {
    const o = { size, weight, font }, w = ink.measure(str, o), x0 = cx - w / 2, g = ink.g, sw = w / n;
    if (!(alpha > 0.003)) return w;
    for (let i = 0; i < n; i++) {
      const u = (i + 0.5) / n, k = 1 - Z.clamp(squash ? squash(u) : 0, 0, 0.98), [dx, dy] = shift ? shift(u) : [0, 0];
      g.save();
      g.translate(dx, y + dy); g.scale(1, k); g.translate(0, -y);          // pressed towards its own baseline
      g.beginPath(); g.rect(x0 + i * sw - 0.4, y - size * 1.1, sw + 0.8, size * 1.5); g.clip();
      ink.text(str, x0, y, Object.assign({}, o, { color, alpha }));
      g.restore();
    }
    return w;
  };
  const MASK = [mk(8, 8), mk(8, 8)];                                     // its own canvases: content() may use inks / inkClip
  IF.masked = (ink, content, mask) => {
    const g = ink.g, m = g.getTransform(), [A, B] = MASK.map(c => fit(c, 1920, 1080));
    for (const c of [A, B]) { const x = c.getContext('2d'); x.setTransform(1, 0, 0, 1, 0, 0); x.globalCompositeOperation = 'source-over'; x.globalAlpha = 1; x.clearRect(0, 0, c.width, c.height); x.setTransform(m); }
    try { ink.g = A.getContext('2d'); content(); ink.g = B.getContext('2d'); mask(); } finally { ink.g = g; }
    const ag = A.getContext('2d'); ag.setTransform(1, 0, 0, 1, 0, 0); ag.globalCompositeOperation = 'destination-in'; ag.drawImage(B, 0, 0);
    g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.drawImage(A, 0, 0); g.restore();
  };
})();
