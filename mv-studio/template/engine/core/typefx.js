/* mv-studio engine — typefx.js: reusable kinetic-type moves (Z.TFX). Text always comes from the caller (a lyric
 * via Z.line(i).text, or the film's own copy); these functions never hold words. Times are song seconds.
 *
 *   TFX.pop(ctx, text, x, y, o)       each glyph pops in on its own time: o.at (start), o.stagger (s per glyph, or o.times
 *                                     [t per glyph], e.g. from Z.charsAt timing), o.size, o.font, o.color, o.from (scale, 0.3),
 *                                     o.dur (0.16 s), o.align ('center' | 'left'), o.vertical (縦書き, top to bottom)
 *   TFX.slam(ctx, text, x, y, o)      a slam: scale o.from (3) -> 1 in o.frames (2) frames, then a shake of o.shake px (6)
 *                                     decaying over 6 frames; returns the flash amount (0..1) for the caller's post / MG.block
 *   TFX.scramble(ctx, text, x, y, o)  decodes from shuffling glyphs (o.pool: the characters to shuffle through; default
 *                                     latin + digits + kana) into the text over o.dur (0.4 s) from o.at, left to right
 *   TFX.ghosts(ctx, items, t, o)      earlier lines lingering behind the current one: items [{ text, x, y, at }] (newest
 *                                     last); each older item drawn at o.alphas ([0.24, 0.16, 0.1]) and offset o.drift px
 *   TFX.chaos(ctx, text, t, o)        a new layout every beat for a sprint: bar | tape | vertical | overflow | echo | tilt |
 *                                     outline | scatter | corner (o.layouts limits the set; o.seed); a 3-frame overshoot in
 *   TFX.font(size, o)                 the font string the kit uses (o.weight, o.font)
 */
(() => {
  'use strict';
  const Z = window.Z, TFX = (Z.TFX = Z.TFX || {}), W = 1920, H = 1080;
  const FPS = () => (window.__ZANKO_RENDER__ || {}).fps || (window.__zankoMeta || {}).fps || 30;
  TFX.font = (size, o = {}) => `${o.weight || 800} ${size}px ${o.font || '"Noto Sans JP", sans-serif'}`;
  const spring = (k, over = 0.18) => (k >= 1 ? 1 : 1 + over * Math.sin(k * Math.PI) - (1 - Z.ease.outCubic(k)));   // rises past 1 and settles

  TFX.pop = (ctx, text, x, y, o = {}) => {
    const g = [...(text || '')], size = o.size ?? 72, dur = o.dur ?? 0.16, from = o.from ?? 0.3, t = o.t ?? Z.ST?.t ?? 0;
    if (!g.length) return;
    ctx.save(); ctx.font = TFX.font(size, o); ctx.fillStyle = o.color || '#fff'; ctx.textBaseline = 'middle'; ctx.textAlign = 'center';
    const adv = g.map(ch => (o.vertical ? size * 1.05 : ctx.measureText(ch).width)), total = adv.reduce((a, b) => a + b, 0);
    let pos = o.align === 'left' ? 0 : -total / 2;
    g.forEach((ch, i) => {
      const t0 = o.times ? o.times[i] : (o.at ?? 0) + i * (o.stagger ?? 0.05), k = Z.clamp((t - t0) / dur);
      const c = pos + adv[i] / 2; pos += adv[i];
      if (k <= 0) return;
      const s = from + (1 - from) * spring(k);
      ctx.save(); ctx.translate(o.vertical ? x : x + c, o.vertical ? y + c : y); ctx.scale(s, s); ctx.globalAlpha = Z.clamp(k * 2.5); ctx.fillText(ch, 0, 0); ctx.restore();
    });
    ctx.restore();
  };

  TFX.slam = (ctx, text, x, y, o = {}) => {
    const t = o.t ?? Z.ST?.t ?? 0, at = o.at ?? 0, fps = FPS(), age = (t - at) * fps;
    if (age < 0 || !text) return 0;
    const fr = o.frames ?? 2, s = age < fr ? Z.lerp(o.from ?? 3, 1, Z.ease.inQuad(age / fr)) : 1, sh = age >= fr && age < fr + 6 ? (o.shake ?? 6) * (1 - (age - fr) / 6) : 0;
    ctx.save(); ctx.translate(x + Z.rnds(Math.floor(age), 5) * sh, y + Z.rnds(Math.floor(age), 7) * sh); ctx.scale(s, s);
    ctx.font = TFX.font(o.size ?? 160, o); ctx.fillStyle = o.color || '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.globalAlpha = Z.clamp(age / Math.max(0.5, fr * 0.5)); ctx.fillText(text, 0, 0); ctx.restore();
    return age >= fr - 0.5 && age < fr + 0.5 ? (o.flash ?? 0.5) : 0;                // one frame of flash on impact
  };

  const POOL = 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789アイウエオカキクケコサシスセソタチツテトナニヌネノ#%&*+=/<>';
  TFX.scramble = (ctx, text, x, y, o = {}) => {
    const g = [...(text || '')], t = o.t ?? Z.ST?.t ?? 0, at = o.at ?? 0, dur = o.dur ?? 0.4, pool = [...(o.pool || POOL)];
    if (!g.length || t < at) return;
    const k = Z.clamp((t - at) / dur), f = Math.floor(t * (o.fps ?? 24));
    const shown = g.map((ch, i) => (i / g.length < k || ch === ' ' ? ch : pool[Math.floor(Z.rnd(f, i, o.seed ?? 3) * pool.length)])).join('');
    ctx.save(); ctx.font = TFX.font(o.size ?? 64, o); ctx.fillStyle = o.color || '#fff'; ctx.textAlign = o.align || 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(shown, x, y); ctx.restore();
  };

  TFX.ghosts = (ctx, items, t, o = {}) => {
    const alphas = o.alphas || [0.24, 0.16, 0.1], drift = o.drift ?? 18, live = items.filter(it => it.at <= t);
    ctx.save(); ctx.font = TFX.font(o.size ?? 64, o); ctx.fillStyle = o.color || '#fff'; ctx.textAlign = o.align || 'center'; ctx.textBaseline = 'middle';
    for (let j = 1; j <= alphas.length; j++) {
      const it = live[live.length - 1 - j];
      if (!it) break;
      ctx.globalAlpha = alphas[j - 1]; ctx.fillText(it.text, it.x + drift * j, it.y - drift * 0.5 * j);
    }
    ctx.restore();
  };

  const LAYOUTS = ['bar', 'tape', 'vertical', 'overflow', 'echo', 'tilt', 'outline', 'scatter', 'corner'];
  TFX.chaos = (ctx, text, t, o = {}) => {
    if (!text) return;
    const C = Z.clock, b = C ? C.beat(t) : Math.floor(t * 2), set = o.layouts || LAYOUTS, kind = set[Math.floor(Z.rnd(b, o.seed ?? 11) * set.length)];
    const fps = FPS(), since = C ? (t - C.at(b)) * fps : 3, over = since < 3 ? 1 + 0.12 * Math.sin(since / 3 * Math.PI) : 1;
    const ink = o.color || '#fff', bg = o.ground || '#000', size = o.size ?? 96;
    ctx.save(); ctx.translate(W / 2, H / 2); ctx.scale(over, over); ctx.translate(-W / 2, -H / 2);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = TFX.font(size, o);
    const w = ctx.measureText(text).width;
    switch (kind) {
      case 'bar': ctx.fillStyle = bg; ctx.fillRect(W / 2 - w / 2 - 40, H / 2 - size * 0.75, w + 80, size * 1.5); ctx.fillStyle = ink; ctx.fillText(text, W / 2, H / 2); break;
      case 'tape': ctx.fillStyle = ink; ctx.fillRect(0, H * 0.62 - size * 0.7, W, size * 1.4); ctx.fillStyle = bg; ctx.fillText(text, W / 2, H * 0.62); break;
      case 'vertical': ctx.fillStyle = ink; [...text].forEach((ch, i) => ctx.fillText(ch, W * 0.72, H * 0.12 + i * size * 1.02)); break;
      case 'overflow': ctx.font = TFX.font(size * 3.2, o); ctx.fillStyle = ink; ctx.fillText(text, W * 0.42, H * 0.55); break;
      case 'echo': ctx.fillStyle = ink; for (let i = 3; i >= 0; i--) { ctx.globalAlpha = i ? 0.18 * (4 - i) : 1; ctx.fillText(text, W / 2, H / 2 + i * size * 0.9); } break;
      case 'tilt': ctx.translate(W * 0.1, H / 2); ctx.rotate(-Math.PI / 2); ctx.fillStyle = ink; ctx.fillText(text, 0, 0); break;
      case 'outline': ctx.font = TFX.font(size * 2.2, o); ctx.lineWidth = 3; ctx.strokeStyle = ink; ctx.strokeText(text, W / 2, H / 2); break;
      case 'scatter': ctx.fillStyle = ink; [...text].forEach((ch, i) => ctx.fillText(ch, W * (0.15 + 0.7 * Z.rnd(b, i, 21)), H * (0.2 + 0.6 * Z.rnd(b, i, 22)))); break;
      default: ctx.textAlign = 'left'; ctx.fillStyle = ink; ctx.font = TFX.font(size * 0.7, o); ctx.fillText(`「${text}」`, W * 0.06, H * 0.88);
    }
    ctx.restore();
  };
})();
