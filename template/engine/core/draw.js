/* mv-studio engine — drawing toolkit shared by all scenes (Canvas2D). Everything is a pure function of its args. */
(() => {
  'use strict';
  const Z = window.Z;
  const W = 1920, H = 1080;
  const D = (Z.draw = {});

  // ---------------------------------------------------------------- framing
  // Draw img to cover the frame. view = { zoom, x, y, rot } where x/y in [-1,1] pan within the spare margin.
  D.cover = (ctx, img, view = {}, alpha = 1) => {
    const zoom = view.zoom ?? 1, rot = view.rot || 0;
    const s = Math.max(W / img.width, H / img.height) * zoom;
    const dw = img.width * s, dh = img.height * s;
    const mx = Math.max(0, (dw - W) / 2), my = Math.max(0, (dh - H) / 2);
    ctx.save();
    ctx.globalAlpha *= alpha;
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    ctx.translate(W / 2 + (view.x || 0) * mx, H / 2 + (view.y || 0) * my);
    if (rot) ctx.rotate(rot);
    ctx.drawImage(img, -dw / 2, -dh / 2, dw, dh);
    ctx.restore();
  };
  // where image point (u, v) (0..1 of the image) lands in the frame under the same cover view: pin props, lamps and
  // characters to the painted ground / track / waterline (read u, v with tools/art_grid.py), so they move with the camera.
  D.coverPt = (img, view = {}, u, v) => {
    const zoom = view.zoom ?? 1, rot = view.rot || 0;
    const s = Math.max(W / img.width, H / img.height) * zoom, dw = img.width * s, dh = img.height * s;
    const mx = Math.max(0, (dw - W) / 2), my = Math.max(0, (dh - H) / 2);
    const lx = (u - 0.5) * dw, ly = (v - 0.5) * dh, c = Math.cos(rot), sn = Math.sin(rot);
    return [W / 2 + (view.x || 0) * mx + lx * c - ly * sn, H / 2 + (view.y || 0) * my + lx * sn + ly * c, s];
  };
  // interpolate two views
  D.viewLerp =(a, b, k) => ({ zoom: Z.lerp(a.zoom ?? 1, b.zoom ?? 1, k), x: Z.lerp(a.x || 0, b.x || 0, k), y: Z.lerp(a.y || 0, b.y || 0, k), rot: Z.lerp(a.rot || 0, b.rot || 0, k) });

  // camera shake (deterministic, on 2s by default)
  D.shake = (t, amp, fps = 24, seed = 1) => { const q = Math.floor(t * fps); return [Z.rnds(q, seed) * amp, Z.rnds(q, seed + 7) * amp]; };

  // ---------------------------------------------------------------- characters
  // sprite: draw a character image anchored at (x,y) (anchor = bottom-centre by default) with height h.
  // opt: { anchor:[ax,ay], rot, alpha, flip, sway (rad), breathe (0..1), wave:{amp,freq,speed,from} (hair wind strip warp), t,
  //       tint:{ color, a } (multiply by the scene's light colour: light match; not with wave) }
  const ids = new WeakMap(); let nextId = 0;
  const imgId = img => { let i = ids.get(img); if (i == null) ids.set(img, (i = ++nextId)); return i; };   // cache keys for derived copies
  // a picture through four corners: `from` in the source, `to` on the canvas, both [tl, tr, br, bl]. True perspective: the
  // grid points go through the homography of the four corners (a screen's middle lands where its diagonals cross), each
  // cell drawn as two affine triangles. Clip to the glass first; see references/05-engine.md.
  const square2quad = q => {   // unit square -> quad (Heckbert): [u, v] -> point
    const [[x0, y0], [x1, y1], [x2, y2], [x3, y3]] = q, dx1 = x1 - x2, dx2 = x3 - x2, dx3 = x0 - x1 + x2 - x3, dy1 = y1 - y2, dy2 = y3 - y2, dy3 = y0 - y1 + y2 - y3;
    const den = dx1 * dy2 - dx2 * dy1, g = den ? (dx3 * dy2 - dx2 * dy3) / den : 0, h = den ? (dx1 * dy3 - dx3 * dy1) / den : 0;
    return (u, v) => { const w = g * u + h * v + 1; return [((x1 - x0 + g * x1) * u + (x3 - x0 + h * x3) * v + x0) / w, ((y1 - y0 + g * y1) * u + (y3 - y0 + h * y3) * v + y0) / w]; };
  };
  const warpTri = (ctx, src, s0, s1, s2, d0, d1, d2) => {
    const den = s0[0] * (s1[1] - s2[1]) + s1[0] * (s2[1] - s0[1]) + s2[0] * (s0[1] - s1[1]); if (!den) return;
    const sol = k => [
      (d0[k] * (s1[1] - s2[1]) + d1[k] * (s2[1] - s0[1]) + d2[k] * (s0[1] - s1[1])) / den,
      (d0[k] * (s2[0] - s1[0]) + d1[k] * (s0[0] - s2[0]) + d2[k] * (s1[0] - s0[0])) / den,
      (d0[k] * (s1[0] * s2[1] - s2[0] * s1[1]) + d1[k] * (s2[0] * s0[1] - s0[0] * s2[1]) + d2[k] * (s0[0] * s1[1] - s1[0] * s0[1])) / den];
    const [a, c, e] = sol(0), [b, d, f] = sol(1), cx = (d0[0] + d1[0] + d2[0]) / 3, cy = (d0[1] + d1[1] + d2[1]) / 3;
    const out = p => { const dx = p[0] - cx, dy = p[1] - cy, l = Math.hypot(dx, dy) || 1; return [p[0] + dx / l * 1.2, p[1] + dy / l * 1.2]; };   // overlap, so no seams
    const [p0, p1, p2] = [out(d0), out(d1), out(d2)];
    ctx.save(); ctx.beginPath(); ctx.moveTo(p0[0], p0[1]); ctx.lineTo(p1[0], p1[1]); ctx.lineTo(p2[0], p2[1]); ctx.closePath(); ctx.clip();
    ctx.transform(a, b, c, d, e, f); ctx.drawImage(src, 0, 0); ctx.restore();
  };
  D.warpQuad = (ctx, src, from, to, N = 8) => {
    const S = square2quad(from), T = square2quad(to);
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
      const u0 = i / N, u1 = (i + 1) / N, v0 = j / N, v1 = (j + 1) / N;
      warpTri(ctx, src, S(u0, v0), S(u1, v0), S(u1, v1), T(u0, v0), T(u1, v0), T(u1, v1));
      warpTri(ctx, src, S(u0, v0), S(u1, v1), S(u0, v1), T(u0, v0), T(u1, v1), T(u0, v1));
    }
  };
  // draw img into the rect (x0, y0, w, h) through a grid warped by field(u, v) -> [dx, dy] (px). Cells that do not move
  // are plain blits; moving cells are two affine-mapped triangles, each grown a little so no seams show.
  D.meshDraw = (ctx, img, x0, y0, w, h, field, mesh = {}) => {
    const C = mesh.cols || 12, R = mesh.rows || 18, iw = img.width, ih = img.height;
    const P = [];
    for (let j = 0; j <= R; j++) for (let i = 0; i <= C; i++) { const u = i / C, v = j / R, d = field(u, v) || [0, 0]; P.push([x0 + u * w + d[0], y0 + v * h + d[1], u * iw, v * ih, Math.abs(d[0]) + Math.abs(d[1])]); }
    const tri = (a, b, c) => {
      const cx = (a[0] + b[0] + c[0]) / 3, cy = (a[1] + b[1] + c[1]) / 3, g = q => { const dx = q[0] - cx, dy = q[1] - cy, l = Math.hypot(dx, dy) || 1; return [q[0] + dx / l * 0.7, q[1] + dy / l * 0.7]; };
      const den = (b[2] - a[2]) * (c[3] - a[3]) - (c[2] - a[2]) * (b[3] - a[3]); if (!den) return;
      const m11 = ((b[0] - a[0]) * (c[3] - a[3]) - (c[0] - a[0]) * (b[3] - a[3])) / den, m21 = ((c[0] - a[0]) * (b[2] - a[2]) - (b[0] - a[0]) * (c[2] - a[2])) / den;
      const m12 = ((b[1] - a[1]) * (c[3] - a[3]) - (c[1] - a[1]) * (b[3] - a[3])) / den, m22 = ((c[1] - a[1]) * (b[2] - a[2]) - (b[1] - a[1]) * (c[2] - a[2])) / den;
      const ga = g(a), gb = g(b), gc = g(c);
      ctx.save(); ctx.beginPath(); ctx.moveTo(ga[0], ga[1]); ctx.lineTo(gb[0], gb[1]); ctx.lineTo(gc[0], gc[1]); ctx.closePath(); ctx.clip();
      ctx.transform(m11, m12, m21, m22, a[0] - m11 * a[2] - m21 * a[3], a[1] - m12 * a[2] - m22 * a[3]);
      const sx = Math.max(0, Math.min(a[2], b[2], c[2]) - 1), sy = Math.max(0, Math.min(a[3], b[3], c[3]) - 1), ex = Math.min(iw, Math.max(a[2], b[2], c[2]) + 1), ey = Math.min(ih, Math.max(a[3], b[3], c[3]) + 1);
      ctx.drawImage(img, sx, sy, ex - sx, ey - sy, sx, sy, ex - sx, ey - sy);
      ctx.restore();
    };
    for (let j = 0; j < R; j++) for (let i = 0; i < C; i++) {
      const a = P[j * (C + 1) + i], b = P[j * (C + 1) + i + 1], c = P[(j + 1) * (C + 1) + i], d = P[(j + 1) * (C + 1) + i + 1];
      if (a[4] + b[4] + c[4] + d[4] < 0.05) { ctx.drawImage(img, a[2], a[3], b[2] - a[2], c[3] - a[3], a[0], a[1], b[0] - a[0] + 0.5, c[1] - a[1] + 0.5); continue; }
      tri(a, b, d); tri(a, d, c);
    }
  };
  D.sprite = (ctx, img, x, y, h, opt = {}) => {
    if (Z.onSprite) Z.onSprite(Z.pathOf && Z.pathOf.get(img), h);   // set only by tools/check_shots.mjs
    const s = h / img.height, w = img.width * s;
    const [ax, ay] = opt.anchor || [0.5, 1];
    const t = opt.t || 0;
    ctx.save();
    ctx.globalAlpha *= opt.alpha ?? 1;
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    ctx.translate(x, y);
    const sway = (opt.sway || 0) * Math.sin(t * 1.3 + (opt.phase || 0));
    ctx.rotate((opt.rot || 0) + sway);
    const br = 1 + (opt.breathe || 0) * 0.012 * Math.sin(t * 2.1 + (opt.phase || 0));
    ctx.scale(opt.flip ? -1 : 1, br);
    const x0 = -w * ax, y0 = -h * ay;
    if (Z.onSpriteBox) Z.onSpriteBox(img, ctx, x0, y0, w, h);         // where it lands on screen: tools/check_shots.mjs
    if (opt.field) {                                         // a mesh warp: field(u, v) -> [dx, dy] px (head tilt, hair sway: chars[].anim)
      D.meshDraw(ctx, img, x0, y0, w, h, opt.field, opt.mesh);
      if (opt.tint) { ctx.globalCompositeOperation = 'multiply'; ctx.globalAlpha *= opt.tint.a ?? 0.5; D.meshDraw(ctx, Z.tinted(img, opt.tint.color, 'tint' + imgId(img)), x0, y0, w, h, opt.field, opt.mesh); }
      ctx.restore();
      return { w, h };
    }
    if (opt.wave && opt.wave.amp) {
      // horizontal strips displaced by a travelling sine, stronger further from `from` (0 = top)
      const N = 90, from = opt.wave.from ?? 0.25, amp = opt.wave.amp, fr = opt.wave.freq ?? 2.2, sp = opt.wave.speed ?? 3.2;
      const tt = opt.wave.q ? Z.quant(t, opt.wave.q) : t;
      for (let i = 0; i < N; i++) {
        const v0 = i / N, v1 = (i + 1) / N;
        const k = Z.clamp((v0 - from) / (1 - from));
        const dx = amp * k * k * Math.sin(v0 * fr * Z.TAU - tt * sp) + amp * 0.35 * k * Math.sin(tt * 1.7 + v0 * 3);
        ctx.drawImage(img, 0, v0 * img.height, img.width, (v1 - v0) * img.height + 1, x0 + dx, y0 + v0 * h, w, (v1 - v0) * h + 1);
      }
    } else ctx.drawImage(img, x0, y0, w, h);
    // light match: a cut-out must take the colour of the scene's light (a white prop at dusk is orange-grey, not white)
    if (opt.tint && !opt.wave) { ctx.globalCompositeOperation = 'multiply'; ctx.globalAlpha *= opt.tint.a ?? 0.5; ctx.drawImage(Z.tinted(img, opt.tint.color, 'tint' + imgId(img)), x0, y0, w, h); }
    ctx.restore();
    return { w, h };
  };

  // silhouette (sprite filled with colour) — for shadow play / rim light
  D.silhouette = (ctx, img, x, y, h, color, opt = {}) => {
    const c = Z.tinted(img, color, opt.key || ('sil' + img.width + 'x' + img.height));
    return D.sprite(ctx, c, x, y, h, opt);
  };

  // ---------------------------------------------------------------- light
  D.glow = (ctx, x, y, r, color, a = 1) => {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, Z.rgba(color, a)); g.addColorStop(0.25, Z.rgba(color, a * 0.45)); g.addColorStop(1, Z.rgba(color, 0));
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = g; ctx.fillRect(x - r, y - r, 2 * r, 2 * r); ctx.restore();
  };
  // a light SOURCE (sun, lamp, neon, flame core): stacked additive halos with no hard rim and a soft white-hot centre.
  // A single bright gradient disc reads as a glass marble; light reads as light when the halo is much wider than the
  // core and nothing has an edge. core = radius of the bright centre; spread = halo radius / core; flicker 0..1.
  D.softLight = (ctx, x, y, core, color, o = {}) => {
    const k = (o.a ?? 1) * (1 - (o.flicker || 0) * 0.5 * (1 + Math.sin((o.t || 0) * 23) * Math.sin((o.t || 0) * 7.3))), spread = o.spread ?? 6;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (const [r, a] of [[core * spread, 0.10], [core * spread * 0.45, 0.18], [core * 1.6, 0.34], [core, 0.55]]) {
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, Z.rgba(color, a * k)); g.addColorStop(0.55, Z.rgba(color, a * k * 0.3)); g.addColorStop(1, Z.rgba(color, 0));
      ctx.fillStyle = g; ctx.fillRect(x - r, y - r, 2 * r, 2 * r);
    }
    const g = ctx.createRadialGradient(x, y, 0, x, y, core * 0.75);
    g.addColorStop(0, `rgba(255,255,246,${0.9 * k})`); g.addColorStop(1, 'rgba(255,255,246,0)');
    ctx.fillStyle = g; ctx.fillRect(x - core, y - core, 2 * core, 2 * core);
    ctx.restore();
  };
  D.disc = (ctx, x, y, r, color, a = 1) => { ctx.save(); ctx.globalAlpha *= a; ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, r, 0, Z.TAU); ctx.fill(); ctx.restore(); };

  // ---------------------------------------------------------------- particles (closed-form, deterministic)
  // rain streaks
  D.rain = (ctx, t, o = {}) => {
    const n = o.n ?? 260, seed = o.seed ?? 31, ang = o.angle ?? 0.18, sp = o.speed ?? 1900, len = o.len ?? 60;
    ctx.save(); ctx.strokeStyle = o.color || 'rgba(200,220,255,0.35)'; ctx.lineWidth = o.width ?? 1.4;
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const x = Z.rnd(i, seed) * (W + 400) - 200, ph = Z.rnd(i, seed + 1);
      const y = Z.fract(ph + t * sp / (H + 200) * (0.8 + 0.4 * Z.rnd(i, seed + 2))) * (H + 200) - 100;
      const dx = Math.sin(ang) * len, dy = Math.cos(ang) * len;
      ctx.moveTo(x + y * Math.tan(ang), y); ctx.lineTo(x + y * Math.tan(ang) + dx, y + dy);
    }
    ctx.stroke(); ctx.restore();
  };
  // dust motes in light
  D.dust = (ctx, t, o = {}) => {
    const n = o.n ?? 70, seed = o.seed ?? 41;
    ctx.save(); ctx.fillStyle = o.color || 'rgba(255,230,190,0.5)';
    for (let i = 0; i < n; i++) {
      const x = Z.fract(Z.rnd(i, seed) + t * 0.004 * (1 + Z.rnd(i, seed + 3))) * W;
      const y = Z.fract(Z.rnd(i, seed + 1) + Math.sin(t * 0.3 + i) * 0.01 - t * 0.003) * H;
      const r = 0.8 + 2.2 * Z.rnd(i, seed + 2);
      ctx.globalAlpha = 0.3 + 0.7 * Math.abs(Math.sin(t * 0.7 + i));
      ctx.beginPath(); ctx.arc(x, y, r, 0, Z.TAU); ctx.fill();
    }
    ctx.restore();
  };

  // ---------------------------------------------------------------- typography
  Z.FONT = {
    mincho: '"Shippori Mincho B1"', minchoHeavy: '"Zen Old Mincho"', tokumin: '"Kaisei Tokumin"', serif: '"Noto Serif JP"',
    gothic: '"Zen Kaku Gothic New"', dela: '"Dela Gothic One"', sans: '"Noto Sans JP"', hand: '"Klee One"', brush: '"Yuji Syuku"', dot: '"DotGothic16"',
    ui: '"Inter", "Noto Sans JP"', mono: '"IBM Plex Mono", "DotGothic16"', sansSC: '"Noto Sans SC"', serifSC: '"Noto Serif SC"',
  };
  D.font = (ctx, size, fam = 'mincho', weight = 700) => { ctx.font = `${weight} ${size}px ${Z.FONT[fam] || fam}, "Noto Serif JP", serif`; };

  const ROT_V = new Set([...'ー―…‥〜～－（）「」『』【】〈〉《》［］｛｝→←—']);
  const PUNCT_V = new Set([...'、。，．']);
  const SMALL_V = new Set([...'ぁぃぅぇぉっゃゅょゎァィゥェォッャュョヮヵヶ']);
  // vertical text column; returns glyph boxes. o: { size, fam, weight, pitch, color, stroke, strokeW, reveal (0..1 chars shown), glow }
  D.vtext = (ctx, text, x, yTop, o = {}) => {
    const size = o.size || 96, pitch = o.pitch || 1.04, chars = [...text];
    D.font(ctx, size, o.fam || 'mincho', o.weight || 700);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const shown = o.reveal == null ? chars.length : o.reveal * chars.length;
    let y = yTop + size / 2;
    chars.forEach((ch, i) => {
      const k = Z.clamp(shown - i);
      if (k > 0) {
        let gx = x, gy = y, rot = 0;
        if (ROT_V.has(ch)) rot = Math.PI / 2; else if (PUNCT_V.has(ch)) { gx += size * 0.55; gy -= size * 0.55; } else if (SMALL_V.has(ch)) { gx += size * 0.1; gy -= size * 0.1; }
        ctx.save(); ctx.translate(gx, gy + (1 - k) * size * 0.25); ctx.rotate(rot); ctx.globalAlpha *= k;
        if (o.glow) { ctx.shadowColor = o.glow; ctx.shadowBlur = o.glowR || 24; }
        if (o.stroke) { ctx.lineWidth = o.strokeW || size * 0.08; ctx.strokeStyle = o.stroke; ctx.lineJoin = 'round'; ctx.strokeText(ch, 0, 0); }
        ctx.fillStyle = o.color || '#F4EFE6'; ctx.fillText(ch, 0, 0);
        ctx.restore();
      }
      y += size * pitch;
    });
    return { x, y0: yTop, y1: y, size };
  };
  // horizontal text with per-char reveal / stagger. o: { size, fam, weight, color, stroke, glow, align, reveal, spacing, jitter }
  D.htext = (ctx, text, x, y, o = {}) => {
    const size = o.size || 96, chars = [...text];
    D.font(ctx, size, o.fam || 'mincho', o.weight || 700);
    ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
    const sp = (o.spacing ?? 0) * size;
    const widths = chars.map(c => ctx.measureText(c).width + sp);
    const total = widths.reduce((a, b) => a + b, 0) - sp;
    let cx = o.align === 'left' ? x : o.align === 'right' ? x - total : x - total / 2;
    const shown = o.reveal == null ? chars.length : o.reveal * chars.length;
    chars.forEach((ch, i) => {
      const k = Z.clamp(shown - i);
      if (k > 0) {
        ctx.save();
        const jx = o.jitter ? Z.rnds(i, o.jitterSeed || 0) * o.jitter : 0, jy = o.jitter ? Z.rnds(i, (o.jitterSeed || 0) + 9) * o.jitter : 0;
        ctx.translate(cx + widths[i] / 2 + jx, y + jy + (1 - k) * size * 0.3); ctx.globalAlpha *= k;
        if (o.scaleIn) ctx.scale(Z.lerp(o.scaleIn, 1, Z.ease.outBack(k)), Z.lerp(o.scaleIn, 1, Z.ease.outBack(k)));
        ctx.textAlign = 'center';
        if (o.glow) { ctx.shadowColor = o.glow; ctx.shadowBlur = o.glowR || 24; }
        if (o.stroke) { ctx.lineWidth = o.strokeW || size * 0.08; ctx.strokeStyle = o.stroke; ctx.lineJoin = 'round'; ctx.strokeText(ch, 0, 0); }
        ctx.fillStyle = o.color || '#F4EFE6'; ctx.fillText(ch, 0, 0);
        ctx.restore();
      }
      cx += widths[i];
    });
    return { x0: cx - total, x1: cx, w: total };
  };

  // halftone dot field (screentone) inside a rect, dot size from a function of position
  D.halftone = (ctx, rect, step, fn, color = '#140B1E') => {
    const [x0, y0, x1, y1] = rect; ctx.save(); ctx.fillStyle = color; ctx.beginPath();
    for (let y = y0; y < y1; y += step) for (let x = x0 + ((Math.round((y - y0) / step) % 2) * step) / 2; x < x1; x += step) {
      const r = fn(x, y) * step * 0.5; if (r > 0.3) { ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, Z.TAU); }
    }
    ctx.fill(); ctx.restore();
  };

  // ---------------------------------------------------------------- grounding: things stand ON something
  // A cut-out placed by eye floats. Read where the surface is in the plate (tools/art_grid.py), map it into the frame
  // with D.coverPt, stand the sprite's anchor on it, and add a contact shadow; objects in water sink and reflect.
  // contactShadow: a soft dark ellipse under the point of contact (the strongest single cue that something touches)
  D.contactShadow = (ctx, cx, y, w, o = {}) => {
    ctx.save(); ctx.translate(cx, y); ctx.scale(1, o.squash ?? 0.12);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, w / 2);
    g.addColorStop(0, Z.rgba(o.color || '#000000', o.a ?? 0.45)); g.addColorStop(1, Z.rgba(o.color || '#000000', 0));
    ctx.fillStyle = g; ctx.fillRect(-w / 2, -w / 2, w, w); ctx.restore();
  };
  // onWater: an object afloat at waterline y: its bottom sinks `sink` of its height below the line, it bobs and rocks,
  // and a darker reflection, sliced into rows that ripple sideways and fade with depth, hangs below. Returns the rect.
  D.onWater = (ctx, img, x, waterY, h, t, o = {}) => {
    const w = img.width * (h / img.height), seed = o.seed || 0, sink = o.sink ?? 0.12;
    const yb = waterY + h * sink + Math.sin(t * 1.7 + seed) * (o.bob ?? 3), rot = Math.sin(t * 1.1 + seed * 3) * (o.rock ?? 0.02);
    ctx.save(); ctx.beginPath(); ctx.rect(x - w * 2, waterY - h * 3, w * 4, h * 3); ctx.clip();      // the sunk part is under water
    D.sprite(ctx, img, x, yb, h, { rot, alpha: o.alpha ?? 1, tint: o.tint }); ctx.restore();
    const refl = o.reflect ?? 0.45, rows = 14, rh = (h * 0.9) / rows;
    for (let r = 0; refl > 0 && r < rows; r++) {
      const dx = Math.sin(t * 3 + r * 0.9 + seed) * (o.ripple ?? 4) * (1 + r * 0.15);
      ctx.save(); ctx.beginPath(); ctx.rect(x - w * 2, waterY + r * rh, w * 4, rh + 0.5); ctx.clip();
      ctx.translate(dx, 2 * waterY); ctx.scale(1, -1);
      ctx.filter = 'brightness(0.65)'; D.sprite(ctx, img, x, yb, h, { rot: -rot, alpha: refl * (o.alpha ?? 1) * (1 - r / rows) });
      ctx.restore();
    }
    return [x - w / 2, yb - h, w, h];
  };
  // things in the world rarely move in straight lines: a point at k (0..1) on a quadratic curve p0 -> p2 bent towards
  // p1, with its tangent angle (bank a bird, a paper plane, a thrown light into the turn)
  D.along = (k, p0, p1, p2) => {
    const u = 1 - k;
    return { x: u * u * p0[0] + 2 * u * k * p1[0] + k * k * p2[0], y: u * u * p0[1] + 2 * u * k * p1[1] + k * k * p2[1],
      angle: Math.atan2(2 * u * (p1[1] - p0[1]) + 2 * k * (p2[1] - p1[1]), 2 * u * (p1[0] - p0[0]) + 2 * k * (p2[0] - p1[0])) };
  };
  // a move with anticipation and follow-through between two times (eased, a little back first, a little overshoot)
  D.travel = (t, t0, t1, p0, p2, o = {}) => {
    const d = t1 - t0, ant = Z.inv(t0, t0 + d * 0.18, t), mv = Z.inv(t0 + d * 0.18, t0 + d * 0.82, t);
    const k = Z.ease.inOutCubic(mv) - Math.sin(ant * Math.PI) * (o.anticipate ?? 0.06) * (1 - mv) + Math.sin(Z.inv(t0 + d * 0.82, t1, t) * Math.PI) * (o.overshoot ?? 0.03);
    const mid = o.via || [(p0[0] + p2[0]) / 2, (p0[1] + p2[1]) / 2 - (o.arc ?? 0)];
    return D.along(k, p0, mid, p2);
  };

  // screen-space overlay helpers
  D.fill =(ctx, color, a = 1, comp = 'source-over') => { ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalCompositeOperation = comp; ctx.globalAlpha = a; ctx.fillStyle = color; ctx.fillRect(0, 0, W, H); ctx.restore(); };
  D.vgrad = (ctx, stops, a = 1, comp = 'source-over', rect = [0, 0, W, H]) => {
    const [x0, y0, x1, y1] = rect; const g = ctx.createLinearGradient(0, y0, 0, y1);
    for (const [k, c] of stops) g.addColorStop(k, c);
    ctx.save(); ctx.globalCompositeOperation = comp; ctx.globalAlpha = a; ctx.fillStyle = g; ctx.fillRect(x0, y0, x1 - x0, y1 - y0); ctx.restore();
  };
})();
