/* mv-studio engine — mg.js: a motion-graphics kit any style can restyle (Z.MG), plus the impact ladder and a
 * pixel-art buffer. Pure functions of song time; colours, widths and counts are arguments, never a look of their own.
 *
 *   MG.rings(ctx, t, x, y, o)        rings that leave the centre on each beat and fade (o: color, width, r0, speed, life,
 *                                    beats: [t...] (default: the song's beats), every (every n-th beat), alpha)
 *   MG.arcs(ctx, t, x, y, o)         broken arcs that step round on each beat (o: color, width, r, n (arcs), gap, step (rad per
 *                                    beat), ease (s of the step))
 *   MG.cross(ctx, t, x, y, o)        a crossbuck / X mark that snaps open on a beat (o: color, width, size, at (t), dur)
 *   MG.stripes(ctx, t, x, y, w, h, o) hazard stripes moving along a band (o: a, b colours, width, angle, speed px/s)
 *   MG.speed(ctx, t, o)              speed lines: radial round (o.cx, o.cy) or parallel at o.angle (o: n, color, width,
 *                                    inner (free radius), len, seed, alpha); re-rolled o.fps times a second (default 12)
 *   MG.block(ctx, t, o)              colour-block punctuation frames: o.hits [[t, color], ...] each flashes a full frame
 *                                    (or o.rect) for o.frames (default 2) frames, then cuts away
 *   MG.brackets(ctx, x, y, w, h, k, o)   corner brackets that open round a box (k 0..1) and break (o.break 0..1)
 *   Z.impact(t, hits, level)         { dx, dy, flash }: the impact ladder S / M / L / MAX = shake 8 / 14 / 22 / 32 px with a
 *                                    flash 0.12 / 0.22 / 0.38 / 0.7, decaying over ~6 frames from the last hit in hits
 *                                    (level per hit: [[t, 'L'], ...] or a single level for plain times); MAX once a film
 *   MG.pixel(ctx, draw, o)           draw(c, w, h) into a low-res buffer (o.scale 4: 1920/4 px wide), optionally
 *                                    quantised to o.palette ['#hex', ...] with 4x4 ordered dither (o.dither 0..1), then
 *                                    blown up with hard pixels
 */
(() => {
  'use strict';
  const Z = window.Z, MG = (Z.MG = Z.MG || {}), W = 1920, H = 1080, TAU = Math.PI * 2;
  const FPS = () => (window.__ZANKO_RENDER__ || {}).fps || (window.__zankoMeta || {}).fps || 30;   // the render's frame rate
  const beatsOf = o => o.beats || (Z.audio && Z.audio.beats) || [];
  const lastIdx = (arr, t) => { let lo = 0, hi = arr.length - 1, k = -1; while (lo <= hi) { const m = (lo + hi) >> 1; if (arr[m] <= t) { k = m; lo = m + 1; } else hi = m - 1; } return k; };

  MG.rings = (ctx, t, x, y, o = {}) => {
    const b = beatsOf(o), every = o.every || 1, life = o.life ?? 1.2, speed = o.speed ?? 520, k = lastIdx(b, t);
    ctx.save(); ctx.strokeStyle = o.color || '#fff'; ctx.lineWidth = o.width ?? 4;
    for (let i = k; i >= 0 && t - b[i] < life; i--) {
      if (i % every) continue;
      const age = t - b[i], r = (o.r0 ?? 40) + speed * age * (1 - 0.35 * age / life);
      ctx.globalAlpha = (o.alpha ?? 0.9) * (1 - age / life) ** 1.5;
      ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke();
    }
    ctx.restore();
  };

  MG.arcs = (ctx, t, x, y, o = {}) => {
    const b = beatsOf(o), k = lastIdx(b, t), n = o.n ?? 3, gap = o.gap ?? 0.5, step = o.step ?? Math.PI / 4, ease = o.ease ?? 0.12;
    const into = k >= 0 ? Z.ease.outCubic(Z.clamp((t - b[k]) / ease)) : 0, rot = (Math.max(0, k) + into) * step;
    ctx.save(); ctx.strokeStyle = o.color || '#fff'; ctx.lineWidth = o.width ?? 6; ctx.lineCap = o.cap || 'butt';
    for (let i = 0; i < n; i++) { const a = rot + i * TAU / n; ctx.beginPath(); ctx.arc(x, y, o.r ?? 220, a, a + TAU / n - gap); ctx.stroke(); }
    ctx.restore();
  };

  MG.cross = (ctx, t, x, y, o = {}) => {
    const at = o.at ?? 0, k = Z.ease.outBack(Z.clamp((t - at) / (o.dur ?? 0.12)), 2);
    if (k <= 0) return;
    const s = (o.size ?? 120) * k;
    ctx.save(); ctx.translate(x, y); ctx.rotate(o.rot ?? 0); ctx.strokeStyle = o.color || '#fff'; ctx.lineWidth = o.width ?? 18; ctx.lineCap = 'square';
    ctx.beginPath(); ctx.moveTo(-s, -s); ctx.lineTo(s, s); ctx.moveTo(s, -s); ctx.lineTo(-s, s); ctx.stroke();
    ctx.restore();
  };

  MG.stripes = (ctx, t, x, y, w, h, o = {}) => {
    const sw = o.width ?? 40, ang = o.angle ?? -Math.PI / 4, off = ((t * (o.speed ?? 120)) % (2 * sw) + 2 * sw) % (2 * sw);
    ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
    ctx.fillStyle = o.a || '#111'; ctx.fillRect(x, y, w, h);
    ctx.translate(x + w / 2, y + h / 2); ctx.rotate(ang); ctx.fillStyle = o.b || '#F2C230';
    const R = Math.hypot(w, h) / 2 + 2 * sw;
    for (let s = -R - off; s < R; s += 2 * sw) ctx.fillRect(s, -R, sw, 2 * R);
    ctx.restore();
  };

  MG.speed = (ctx, t, o = {}) => {
    const f = Math.floor(t * (o.fps ?? 12)), n = o.n ?? 48, seed = o.seed ?? 1;
    ctx.save(); ctx.strokeStyle = o.color || '#fff'; ctx.globalAlpha = o.alpha ?? 0.8; ctx.lineCap = 'round';
    for (let i = 0; i < n; i++) {
      const r = q => Z.rnd(f, i, seed * 31 + q), len = (o.len ?? 260) * (0.4 + r(1) * 0.9);
      ctx.lineWidth = (o.width ?? 3) * (0.4 + r(2));
      ctx.beginPath();
      if (o.angle != null) {                                            // parallel lines across the frame
        const ca = Math.cos(o.angle), sa = Math.sin(o.angle), along = (r(3) * 2 - 1) * W, across = (r(4) * 2 - 1) * H * 0.7;
        const px = W / 2 + along * ca - across * sa, py = H / 2 + along * sa + across * ca;
        ctx.moveTo(px, py); ctx.lineTo(px + ca * len, py + sa * len);
      } else {                                                          // radial, leaving a free centre
        const a = r(3) * TAU, r0 = (o.inner ?? 360) + r(4) * 200, cx = o.cx ?? W / 2, cy = o.cy ?? H / 2;
        ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0); ctx.lineTo(cx + Math.cos(a) * (r0 + len), cy + Math.sin(a) * (r0 + len));
      }
      ctx.stroke();
    }
    ctx.restore();
  };

  MG.block = (ctx, t, o = {}) => {
    const fps = FPS(), dur = (o.frames ?? 2) / fps;
    for (const [at, color] of o.hits || []) {
      if (t < at || t >= at + dur) continue;
      const [x, y, w, h] = o.rect || [0, 0, W, H];
      ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = color || '#fff'; ctx.fillRect(x, y, w, h); ctx.restore();
    }
  };

  MG.brackets = (ctx, x, y, w, h, k, o = {}) => {
    if (k <= 0) return;
    const arm = (o.arm ?? 0.22) * Math.min(w, h), pad = (o.pad ?? 24) * (1 - k) * 3, brk = Z.clamp(o.break || 0);
    ctx.save(); ctx.strokeStyle = o.color || '#fff'; ctx.lineWidth = o.width ?? 6; ctx.lineCap = 'square'; ctx.globalAlpha = Z.clamp(k * 1.5);
    for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      const cx = x + w / 2 + sx * (w / 2 + pad), cy = y + h / 2 + sy * (h / 2 + pad), fall = brk * 140 * (1 + Z.rnd(sx, sy, 9));
      ctx.save(); ctx.translate(sx * brk * 40, fall); ctx.rotate(brk * sx * sy * 0.6);
      ctx.beginPath(); ctx.moveTo(cx - sx * arm * k, cy); ctx.lineTo(cx, cy); ctx.lineTo(cx, cy - sy * arm * k); ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
  };

  // ---------------------------------------------------------------- the impact ladder
  const LADDER = { S: [8, 0.12], M: [14, 0.22], L: [22, 0.38], MAX: [32, 0.7] };
  Z.impact = (t, hits = [], level = 'M') => {
    let at = -Infinity, lv = level;
    for (const h of hits) { const [ht, hl] = Array.isArray(h) ? h : [h, level]; if (ht <= t && ht > at) { at = ht; lv = hl; } }
    const age = t - at, [px, fl] = LADDER[lv] || LADDER.M, fps = FPS();
    if (!(age >= 0) || age > 8 / fps) return { dx: 0, dy: 0, flash: 0 };
    const decay = Math.exp(-age * fps / 2.2), f = Math.floor(age * fps);
    return { dx: Z.rnds(f, 71, at * 13 | 0) * px * decay, dy: Z.rnds(f, 73, at * 13 | 0) * px * decay, flash: age * fps < 1 ? fl : fl * decay * 0.4 };
  };

  // ---------------------------------------------------------------- pixel-art buffer
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => v / 16 - 0.5);
  let pixC = null;
  MG.pixel = (ctx, draw, o = {}) => {
    const s = Math.max(1, o.scale ?? 4), w = Math.ceil(W / s), h = Math.ceil(H / s);
    if (!pixC) pixC = Z.canvas(w, h);
    if (pixC.width !== w || pixC.height !== h) { pixC.width = w; pixC.height = h; }
    const c = pixC.getContext('2d');
    c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, w, h); c.save(); c.scale(1 / s, 1 / s); draw(c, W, H); c.restore();
    if (o.palette && o.palette.length) {
      const pal = o.palette.map(Z.hex), id = c.getImageData(0, 0, w, h), d = id.data, amt = (o.dither ?? 0.6) * 64;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4, th = BAYER[(y & 3) * 4 + (x & 3)] * amt;
        let best = 0, bd = Infinity;
        for (let p = 0; p < pal.length; p++) { const q = pal[p], dr = d[i] + th - q[0], dg = d[i + 1] + th - q[1], db = d[i + 2] + th - q[2], e = dr * dr + dg * dg + db * db; if (e < bd) { bd = e; best = p; } }
        d[i] = pal[best][0]; d[i + 1] = pal[best][1]; d[i + 2] = pal[best][2];
      }
      c.putImageData(id, 0, 0);
    }
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.imageSmoothingEnabled = false; ctx.drawImage(pixC, 0, 0, w * s, h * s); ctx.restore();
  };
})();
