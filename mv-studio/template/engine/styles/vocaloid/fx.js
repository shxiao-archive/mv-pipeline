/* vocaloid preset — its light devices: rim light, crepuscular rays, embers, fireflies, falling feathers, glass cracks
 * (Z.draw helpers), registered as illust fx types and a char option, plus the preset's ember / dawn ramps.
 *   illust fx: { type: 'embers' | 'fireflies' | 'feathers' | 'rays' | 'cracks', ...opts }   solid args: embers, fireflies
 *   illust char: rim: { color, off }
 */
(() => {
  'use strict';
  const Z = window.Z, D = Z.draw, E = Z.ease;
  const W = 1920, H = 1080;

  // rim light: draw a tinted copy offset behind
  D.rim = (ctx, img, x, y, h, color, off = [6, -4], opt = {}) => {
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.filter = 'blur(3px)';
    D.silhouette(ctx, img, x + off[0], y + off[1], h, color, opt);
    ctx.restore();
  };

  // crepuscular rays from (x,y)
  D.rays = (ctx, x, y, n, len, color, a, t, seed = 3) => {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < n; i++) {
      const ang = (i / n) * Z.TAU + Z.rnds(i, seed) * 0.2 + t * 0.02;
      const wdt = 0.02 + 0.05 * Z.rnd(i, seed + 1);
      const al = a * (0.3 + 0.7 * Z.rnd(i, seed + 2)) * (0.6 + 0.4 * Math.sin(t * 0.8 + i));
      const g = ctx.createRadialGradient(x, y, 0, x, y, len);
      g.addColorStop(0, Z.rgba(color, al)); g.addColorStop(1, Z.rgba(color, 0));
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(x, y);
      ctx.arc(x, y, len, ang - wdt, ang + wdt); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  };

  // embers rising: n particles, each with a lifetime loop; area = [x0,y0,x1,y1]
  D.embers = (ctx, t, o = {}) => {
    const n = o.n ?? 80, seed = o.seed ?? 11, [x0, y0, x1, y1] = o.area || [0, 0, W, H];
    const col = o.color || '#FFA552', rise = o.rise ?? 120, size = o.size ?? 3;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < n; i++) {
      const life = 3 + 4 * Z.rnd(i, seed), ph = Z.rnd(i, seed + 1) * life;
      const k = Z.fract((t + ph) / life);
      const x = Z.lerp(x0, x1, Z.rnd(i, seed + 2)) + Math.sin(t * (0.6 + Z.rnd(i, seed + 3)) + i) * 30 * k + (o.wind || 0) * k * 200;
      const y = Z.lerp(y1, y0, Z.rnd(i, seed + 4)) - k * rise * life;
      const flick = 0.55 + 0.45 * Math.sin(t * 13 + i * 3.1);
      const a = Math.sin(k * Math.PI) * flick * (o.alpha ?? 1);
      const r = size * (0.5 + Z.rnd(i, seed + 5)) * (1 - k * 0.5);
      if (a <= 0.01) continue;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r * 4);
      g.addColorStop(0, Z.rgba('#FFF1D0', a)); g.addColorStop(0.3, Z.rgba(col, a * 0.8)); g.addColorStop(1, Z.rgba(col, 0));
      ctx.fillStyle = g; ctx.fillRect(x - r * 4, y - r * 4, r * 8, r * 8);
    }
    ctx.restore();
  };
  // fireflies: slow wander, blinking
  D.fireflies = (ctx, t, o = {}) => {
    const n = o.n ?? 40, seed = o.seed ?? 21, [x0, y0, x1, y1] = o.area || [0, H * 0.3, W, H];
    const col = o.color || '#DDFF7A';
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < n; i++) {
      const bx = Z.lerp(x0, x1, Z.rnd(i, seed)), by = Z.lerp(y0, y1, Z.rnd(i, seed + 1));
      const x = bx + Z.fbm1(t * 0.25 + i, seed) * 160, y = by + Z.fbm1(t * 0.22 + i * 1.7, seed + 5) * 90;
      const blink = Math.pow(Z.clamp(Math.sin(t * (0.9 + Z.rnd(i, seed + 2)) + i * 2.3)), 3) * (o.alpha ?? 1);
      if (blink < 0.02) continue;
      const r = (o.size ?? 3) * (0.7 + Z.rnd(i, seed + 3) * 0.8);
      const g = ctx.createRadialGradient(x, y, 0, x, y, r * 7);
      g.addColorStop(0, Z.rgba('#F6FFE0', blink)); g.addColorStop(0.2, Z.rgba(col, blink * 0.7)); g.addColorStop(1, Z.rgba(col, 0));
      ctx.fillStyle = g; ctx.fillRect(x - r * 7, y - r * 7, r * 14, r * 14);
    }
    ctx.restore();
  };

  // falling feathers (simple drawn shapes)
  D.feathers = (ctx, t, o = {}) => {
    const n = o.n ?? 14, seed = o.seed ?? 51;
    ctx.save();
    for (let i = 0; i < n; i++) {
      const life = 6 + 4 * Z.rnd(i, seed), k = Z.fract((t + Z.rnd(i, seed + 1) * life) / life);
      const x = Z.rnd(i, seed + 2) * W + Math.sin(k * 7 + i) * 120, y = -80 + k * (H + 160);
      const rot = Math.sin(k * 9 + i) * 0.9, s = (0.6 + Z.rnd(i, seed + 3) * 0.8) * (o.size ?? 1);
      ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(s, s);
      ctx.fillStyle = o.color || 'rgba(244,239,230,0.92)'; ctx.strokeStyle = o.line || 'rgba(20,11,30,0.9)'; ctx.lineWidth = 2.2;
      ctx.beginPath(); ctx.moveTo(0, -46); ctx.bezierCurveTo(16, -30, 18, 10, 2, 44); ctx.bezierCurveTo(-14, 16, -16, -24, 0, -46); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, -40); ctx.quadraticCurveTo(3, 0, 1, 50); ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
  };

  // ---------------------------------------------------------------- glass cracks (voronoi-ish network grown from impact points)
  // returns a cached list of polylines for (seed, cx, cy); draw with D.cracks(ctx, lines, progress, style)
  const crackCache = new Map();
  // glass crack web from (cx,cy): radial cracks plus ring connectors, as polylines (cached)
  D.crackNet = (seed, cx, cy, n = 22, reach = 1100) => {
    const key = seed + '|' + cx + '|' + cy + '|' + n;
    if (crackCache.has(key)) return crackCache.get(key);
    const R = Z.rng(seed), lines = [];
    for (let i = 0; i < n; i++) {                                        // radial cracks
      const a0 = (i / n) * Z.TAU + R.range(-0.12, 0.12);
      let x = cx, y = cy, a = a0; const pts = [[x, y]]; let L = 0; const maxL = reach * R.range(0.45, 1);
      while (L < maxL) { const st = R.range(30, 90); a += R.range(-0.28, 0.28); x += Math.cos(a) * st; y += Math.sin(a) * st; L += st; pts.push([x, y, L / maxL]); }
      lines.push({ pts, w: R.range(1.2, 3.6), d0: 0 });
    }
    for (let ring = 1; ring <= 4; ring++) {                              // concentric connectors
      const rr = ring * reach * R.range(0.12, 0.2);
      for (let i = 0; i < n; i++) {
        if (R() < 0.35) continue;
        const a0 = (i / n) * Z.TAU, a1 = ((i + 1) / n) * Z.TAU; const pts = [];
        for (let k = 0; k <= 4; k++) { const a = Z.lerp(a0, a1, k / 4); const r = rr * R.range(0.9, 1.1); pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r, 0]); }
        lines.push({ pts, w: R.range(0.8, 2), d0: ring * 0.18 });
      }
    }
    crackCache.set(key, lines); return lines;
  };
  // draw a crack web (D.crackNet) grown to prog 0..1, a glow pass and a core pass
  D.cracks = (ctx, lines, prog, o = {}) => {
    ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (const pass of [{ c: o.glow || '#FFA552', w: 5, a: 0.55, comp: 'lighter', blur: 'blur(4px)' }, { c: o.core || '#FFF3D6', w: 1, a: 1, comp: 'source-over', blur: 'none' }]) {
      ctx.globalCompositeOperation = pass.comp; ctx.filter = pass.blur; ctx.strokeStyle = Z.rgba(pass.c, pass.a * (o.alpha ?? 1));
      for (const ln of lines) {
        const local = Z.clamp((prog - ln.d0) / (1 - ln.d0 + 1e-6));
        if (local <= 0) continue;
        const n = ln.pts.length, upto = local * (n - 1);
        ctx.lineWidth = ln.w * pass.w * (o.width ?? 1);
        ctx.beginPath(); ctx.moveTo(ln.pts[0][0], ln.pts[0][1]);
        for (let i = 1; i < n; i++) {
          if (i > upto + 1) break;
          const f = Math.min(1, upto - (i - 1));
          const [xa, ya] = ln.pts[i - 1], [xb, yb] = ln.pts[i];
          ctx.lineTo(Z.lerp(xa, xb, f), Z.lerp(ya, yb, f));
        }
        ctx.stroke();
      }
    }
    ctx.restore();
  };


  // ---------------------------------------------------------------- illust registrations (core/scenes.js)
  Object.assign(Z.FX, {
    embers: (ctx, S, f) => D.embers(ctx, S.t, f),
    fireflies: (ctx, S, f) => D.fireflies(ctx, S.t, f),
    feathers: (ctx, S, f) => D.feathers(ctx, S.t, f),
    rays: (ctx, S, f) => D.rays(ctx, f.x, f.y, f.n || 18, f.len || 1400, f.color || '#FFA552', f.a ?? 0.18, S.t, f.seed || 3),
    cracks: (ctx, S, f) => {
      const net = D.crackNet(f.seed || 1, f.x ?? W / 2, f.y ?? H * 0.3, f.n || 22, f.reach || 1100);
      const pr = f.prog != null ? f.prog : Z.clamp((S.lt - (f.at || 0)) / (f.dur || 1.2));
      D.cracks(ctx, net, E.outCubic(pr), f);
    },
  });
  Z.CHAR_FX.rim = (ctx, c, img, x, y, h, opt) =>
    D.rim(ctx, img, x, y, h, c.rim.color || '#FFA552', c.rim.off || [7, -3], Object.assign({}, opt, { key: 'rim' + c.img + c.rim.color }));

  Z.RAMPS = Object.assign(Z.RAMPS || {}, {
    ember: [[0, '#07040a'], [0.35, '#2a0c14'], [0.6, '#8e1f22'], [0.8, '#f06a2a'], [1, '#ffe2a8']],                      // darkness + fire
    dawn: [[0, '#120d24'], [0.3, '#3a2d63'], [0.55, '#9a6aa0'], [0.75, '#f3a6a0'], [0.9, '#ffd9b0'], [1, '#fffaf0']],     // first light
  });
})();
