/* mv-studio engine — the shared scenes (solid, jz, illust). A style's scenes live in its pack (engine/styles/<preset>/), a film's
 * own in engine/scenes/<film>.js; both register with Z.scene too. */
(() => {
  'use strict';
  const Z = window.Z, D = Z.draw, E = Z.ease;
  const W = 1920, H = 1080;
  const ease = n => (typeof n === 'function' ? n : E[n] || E.inOutSine);

  // ------------------------------------------------------------------ solid / gradient
  Z.scene('solid', {
    draw(ctx, S) {
      const a = S.args;
      if (a.grad) D.vgrad(ctx, a.grad); else D.fill(ctx, a.color || '#000');
      for (const type of ['embers', 'fireflies']) if (a[type]) fx(ctx, S, Object.assign({}, a[type], { type }));   // a style pack's Z.FX types
    },
  });

  // ------------------------------------------------------------------ JIZURA full frame (its own backgrounds + lyric)
  Z.scene('jz', {
    draw(ctx, S) { JZ.drawPlan(S.args.plan || 'main', ctx, S.t, 'normal'); },
  });

  // ------------------------------------------------------------------ illustrated shot: background + characters + fx
  // args: {
  //   bg, bgFrom, bgTo, bgEase, beatZoom, shake,
  //   tint: [{ color, a, comp }] | grad: stops (overlay), night: 0..1 (darken toward blue),
  //   chars: [{ img, x, y, h, x2, y2, h2, ease, anchor, flip, sway, breathe, wave, rim, sil, alpha,
  //             in: { dur, dx, dy, ds, alpha:true, ease }, out: { at, dur, dx, dy, alpha:true }, q (koma fps) }],
  //   fx: [{ type: 'rain'|'dust'|'glow'|'light'|'grad'|'fill'|'custom' or a type a style pack adds to Z.FX, ...opts }],
  //   GROUNDING (mv-studio): a char / layer / 'light' fx with `pin: [u, v]` (a point of the bg image, 0..1, read with
  //   tools/art_grid.py) stands ON that point of the painting and moves and scales with the bg camera; `pin2` + `ease`
  //   moves it along the painted surface. A char with `ground: true | { a, w }` gets a contact shadow at its feet;
  //   `water: { sink, reflect, bob }` sinks it into the waterline at its pin and hangs a rippled reflection below.
  //   vignette: 0..1, letter: ...
  // }
  const animAssets = A => (A && A.states ? Object.values(A.states) : []).filter(x => typeof x === 'string');
  const assetsOf = a => [a.bg, ...(a.chars || []).flatMap(c => [c.img, ...animAssets(c.anim)]), ...(a.layers || []).map(l => l.img)].filter(Boolean);
  Z.scene('illust', {
    preload: a => assetsOf(a),
    draw(ctx, S) {
      const a = S.args, t = S.t, lt = S.lt, p = S.p;
      // ---------------- background with camera move
      if (a.bg) {
        const img = Z.imgSync(a.bg);
        const k = ease(a.bgEase)(p);
        const v = D.viewLerp(a.bgFrom || { zoom: 1.06 }, a.bgTo || a.bgFrom || { zoom: 1.12 }, k);
        if (a.beatZoom) v.zoom *= 1 + a.beatZoom * S.clock.pulse(t, 8);
        if (a.shake) { const [sx, sy] = D.shake(t, a.shake); v.x += sx / 400; v.y += sy / 300; }
        D.cover(ctx, img, v);
        S.bgImg = img; S.bgView = v;                           // for pinned chars / layers / lights
      } else if (a.grad) D.vgrad(ctx, a.grad);
      else D.fill(ctx, a.color || '#140B1E');
      // background tints
      for (const tn of a.tint || []) D.fill(ctx, tn.color, tn.a ?? 0.5, tn.comp || 'multiply');
      if (a.overlayGrad) D.vgrad(ctx, a.overlayGrad, a.overlayA ?? 1, a.overlayComp || 'source-over');
      // extra image layers (parallax cut-outs)
      for (const L of a.layers || []) {
        const img = Z.imgSync(L.img); const k = ease(L.ease)(p);
        let x = Z.lerp(L.x, L.x2 ?? L.x, k), y = Z.lerp(L.y, L.y2 ?? L.y, k), h = Z.lerp(L.h, L.h2 ?? L.h, k);
        if (L.pin) { const q = pinPt(S, L, k); x = q[0]; y = q[1]; h *= q[2]; }
        D.sprite(ctx, img, x, y, h, { anchor: L.anchor || [0.5, 0.5], alpha: L.alpha ?? 1, rot: L.rot || 0, t });
      }
      // fx behind characters
      for (const f of a.fxBack || []) fx(ctx, S, f);
      // ---------------- characters
      for (const c of a.chars || []) drawChar(ctx, S, c);
      // fx in front
      for (const f of a.fx || []) fx(ctx, S, f);
      if (a.vignette) {
        const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 1.0);
        g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(8,4,14,${a.vignette})`);
        ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      }
    },
  });

  // a pinned point: [x, y, scale] of bg image point pin (-> pin2 over the shot) under the current bg camera
  function pinPt(S, c, k) {
    const u = Z.lerp(c.pin[0], (c.pin2 || c.pin)[0], k), v = Z.lerp(c.pin[1], (c.pin2 || c.pin)[1], k);
    // a scene that drew its plate without setting S.bgImg / S.bgView: the pin is a point of the screen (it used to be NaN)
    if (!S.bgImg) return [u * Z.W, v * Z.H, 1];
    const [x, y] = D.coverPt(S.bgImg, S.bgView, u, v);
    return [x, y, S.bgView.zoom ?? 1];
  }
  Z.pinPt = pinPt;

  //   chars[].anim (mv-studio): no partial face replacement (blink, mouth and expression patches were removed:
  //   the patched faces read as a different picture in every test film). Another expression is a whole picture of
  //   its own, swapped in whole. Optional:
  //     states: { smile: 'smile.png', ... }, state: [[t, 'smile'], [t2, 'base']]   swap the whole picture at t
  //     seed                            phase of the tilt sway (cast members get different seeds)
  //     tilt:{ pivot: [u, v] (the neck), deg 2.5 (sway amplitude), rate 0.3 Hz, keys: [[t, deg], ...] (acted tilts) }
  //     hair: [{ region: [u0, v0, u1, v1], root: 'top' | 'left' | 'right', amp 6 (px per 1000 px of height), freq 0.6 }]
  //   (tilt / hair replace the strip `wave`; measure pivot and regions on the picture with tools/art_grid.py)
  const keysAt = (keys, t) => { let v = keys[0][1]; for (let i = 0; i < keys.length; i++) { const [t0, v0] = keys[i], nx = keys[i + 1]; if (t >= t0) v = nx ? Z.lerp(v0, nx[1], Z.ease.inOutSine(Z.clamp((t - t0) / Math.max(0.05, Math.min(0.5, nx[0] - t0))))) : v0; } return v; };
  function animOf(S, c, t, img) {
    const A = c.anim;
    let state = 'base';
    if (A.state) for (const [tk, st] of A.state) if (t >= tk) state = st || 'base';
    const stImg = state !== 'base' && A.states && A.states[state] ? Z.imgSync(A.states[state]) : null;
    const baseImg = stImg || img;
    let field = null;
    if (A.tilt || A.hair) {
      const T = A.tilt, hairs = A.hair || [];
      const deg = T ? (T.keys ? keysAt(T.keys, t) : 0) + (T.deg ?? 2.5) * Math.sin(Z.TAU * (T.rate ?? 0.3) * t + (A.seed || 0)) : 0, th = deg * Math.PI / 180;
      const [pu, pv] = T ? T.pivot || [0.5, 0.3] : [0.5, 0.3], ih = c.h;
      field = (u, v) => {
        let dx = 0, dy = 0;
        if (th) {                                                 // the head turns about the neck; the neck blends
          const k = Z.smooth(pv + 0.03, pv - 0.06, v);
          if (k > 0) { const ax = (u - pu) * ih * (baseImg.width / baseImg.height), ay = (v - pv) * ih, a = th * k;
            dx += ax * Math.cos(a) - ay * Math.sin(a) - ax; dy += ax * Math.sin(a) + ay * Math.cos(a) - ay; }
        }
        for (const hr of hairs) {
          const [u0, v0, u1, v1] = hr.region, e = 0.04;
          const inR = Z.smooth(u0 - e, u0 + e, u) * (1 - Z.smooth(u1 - e, u1 + e, u)) * Z.smooth(v0 - e, v0 + e, v) * (1 - Z.smooth(v1 - e, v1 + e, v));
          if (inR <= 0) continue;
          const q = hr.root === 'left' ? (u - u0) / (u1 - u0) : hr.root === 'right' ? (u1 - u) / (u1 - u0) : (v - v0) / (v1 - v0);
          dx += inR * Z.clamp(q) ** 1.5 * (hr.amp ?? 6) * ih / 1000 * Math.sin(Z.TAU * (hr.freq ?? 0.6) * t - v * 4 + (hr.phase || 0));
        }
        return [dx, dy];
      };
    }
    return { img: baseImg, field };
  }
  function drawChar(ctx, S, c) {
    let img = Z.imgSync(c.img); if (!img) return;
    if (c.front && S.fg) ctx = S.fg;                       // in front of the lyric layer (text passes behind her)
    const t = c.q ? Z.quant(S.t, c.q) : S.t, lt = t - S.shot.t0, p = Z.clamp(lt / S.dur);
    const k = ease(c.ease || 'inOutSine')(p);
    let x = Z.lerp(c.x, c.x2 ?? c.x, k), y = Z.lerp(c.y, c.y2 ?? c.y, k), h = Z.lerp(c.h, c.h2 ?? c.h, k), alpha = c.alpha ?? 1, rot = c.rot || 0;
    if (c.in) {
      const d = Z.clamp((lt - (c.in.at || 0)) / (c.in.dur || 0.5)), e = ease(c.in.ease || 'outExpo')(d);
      x += (c.in.dx || 0) * (1 - e); y += (c.in.dy || 0) * (1 - e); h *= 1 + (c.in.ds || 0) * (1 - e); rot += (c.in.rot || 0) * (1 - e);
      if (c.in.alpha !== false) alpha *= d > 0 ? Math.min(1, e * 1.4) : 0;
    }
    if (c.out) {
      const d = Z.clamp((lt - c.out.at) / (c.out.dur || 0.4)), e = ease(c.out.ease || 'inExpo')(d);
      x += (c.out.dx || 0) * e; y += (c.out.dy || 0) * e; h *= 1 + (c.out.ds || 0) * e;
      if (c.out.alpha !== false) alpha *= 1 - e;
    }
    if (c.pin) { const q = pinPt(S, c, k); x = q[0] + (x - c.x || 0); y = q[1] + (y - c.y || 0); h *= q[2]; }
    if (alpha <= 0.001) return;
    if (c.water) {                                             // afloat: sunk into the waterline at its pin, reflected below
      D.onWater(ctx, img, x, y, h, S.t, Object.assign({ alpha, seed: c.phase || 0, tint: c.tint }, c.water)); return;
    }
    if (c.ground) { const g = c.ground === true ? {} : c.ground; D.contactShadow(ctx, x, y, h * (g.w ?? 0.55), { a: (g.a ?? 0.45) * alpha, squash: g.squash }); }
    if (c.beatBump) h *= 1 + c.beatBump * S.clock.pulse(S.t, 10);
    if (Z.onSprite) Z.onSprite(c.img, h);                    // the base picture (a states swap is not a new sprite): check_shots
    const anim = c.anim ? animOf(S, c, t, img) : null;
    if (anim) img = anim.img;
    const opt = { tint: c.tint, anchor: c.anchor || [0.5, 1], rot, flip: c.flip, sway: c.sway ?? 0.012, breathe: c.breathe ?? 1, t, alpha, phase: c.phase || 0,
      wave: c.wave === false ? null : Object.assign({ amp: 10, from: 0.3, q: 12 }, c.wave || {}), field: anim && anim.field };
    if (c.shadow) { ctx.save(); ctx.globalAlpha = c.shadow.a ?? 0.5; D.silhouette(ctx, img, x + (c.shadow.dx || 30), y + (c.shadow.dy || 0), h, c.shadow.color || '#140B1E', Object.assign({}, opt, { key: 'sh' + c.img })); ctx.restore(); }
    for (const k in Z.CHAR_FX) if (c[k]) Z.CHAR_FX[k](ctx, c, img, x, y, h, opt);   // char options a style pack adds (vocaloid: rim)
    if (c.sil) D.silhouette(ctx, img, x, y, h, c.sil, Object.assign({}, opt, { key: 'sil' + c.img + c.sil }));
    else D.sprite(ctx, img, x, y, h, opt);
    if (c.glowAt) D.glow(ctx, x + c.glowAt[0] * h, y - c.glowAt[1] * h, c.glowAt[2] * h, c.glowColor || '#FFA552', c.glowA ?? 0.9);
  }

  function fx(ctx, S, f) {
    const t = S.t;
    switch (f.type) {
      case 'rain': D.rain(ctx, t, f); break;
      case 'dust': D.dust(ctx, t, f); break;
      case 'light': {                                          // a light source: soft stacked halos, no rim (pin it to the painting)
        let x = f.x, y = f.y, s = 1;
        if (f.pin && S.bgImg) { [x, y] = D.coverPt(S.bgImg, S.bgView, f.pin[0], f.pin[1]); s = S.bgView.zoom ?? 1; }
        D.softLight(ctx, x, y, (f.core || 40) * s, f.color || '#FFD9A0', { a: (f.a ?? 1) * (1 + (f.beat || 0) * S.clock.pulse(t, 8)), spread: f.spread, flicker: f.flicker, t }); break;
      }
      case 'glow': D.glow(ctx, f.x, f.y, f.r, f.color || '#FFA552', (f.a ?? 0.8) * (1 + (f.beat || 0) * S.clock.pulse(t, 8))); break;
      case 'grad': D.vgrad(ctx, f.stops, f.a ?? 1, f.comp || 'source-over'); break;
      case 'fill': D.fill(ctx, f.color, f.a ?? 0.5, f.comp || 'source-over'); break;
      case 'custom': f.fn(ctx, S); break;
      default: if (Z.FX[f.type]) Z.FX[f.type](ctx, S, f);
    }
  }
  // fx types and char options a style pack registers: Z.FX[type] = (ctx, S, f) => …, Z.CHAR_FX[option] = (ctx, c, img, x, y, h, opt) => …
  Z.FX = {}; Z.CHAR_FX = {};
  Z.fx = fx;
  Z.drawChar = drawChar;
})();
