/* styles/treatise — gpu.js: the plates that need the GPU tools of core/shade.js and core/stroke.js.
 *
 *   TR.write(c, i, t, x, y, size, o)   lyric line i WRITTEN by the pen in a single-stroke font as it is sung; the spark
 *                       rides the pen head. o: { font 'script' | 'sans' | 'serif' | 'readable' | 'allure', align, color,
 *                       width, maxW 1600 (a longer line is set smaller), spark true, lead }. Returns the pen head [x, y] (null before the line starts)
 *   TR.ENGRAVE          the GLSL of the engraved form (copy it to start a shader plate of your own)
 *
 * 'trEngrave' an engraved 3D form under a raking light, shaded with burin lines that wrap round it (core/shade.js slice):
 *             line WIDTH is the light, so the lit side is nearly bone, the dark side a few hairlines. The form turns, the
 *             light sweeps, the rim catches the signal on downbeats; the line is written under it.
 *             { line, form 'bulb' | 'sphere' | 'torus', turn (rad over the shot), light [a0, a1] (rad), freq 26, cam }
 * 'trField'   tens of thousands of hairlines combed by a field (iron filings round a pole): the pole is the pen that
 *             writes the line, so the field turns towards the words as they are written; it swells with the music.
 *             { line, n 120 (columns of seeds), steps 7, cam, font }
 *
 * mv-studio (MIT). After pdoom-video by Giacomo Magnanini (MIT): engraving hatch, hairline fields, written type.
 */
(() => {
  'use strict';
  const Z = window.Z, TR = (Z.TR = Z.TR || {}), E = Z.ease, W = 1920, H = 1080;
  const P = TR.PAL, lin = h => Z.hex(h).map(x => x / 255);
  const init = async () => { await Promise.all(TR.fontsToLoad.map(f => document.fonts.load(f, 'Aa0'))); await Z.stroke.load(['script', 'sans', 'serif', 'readable', 'allure']); };

  const layouts = new Map();
  const layoutOf = (i, font, size, o = {}) => {                           // cached; a long line is set smaller to fit maxW (1600)
    const L = Z.line(i), key = i + '|' + font + '|' + size + '|' + (o.align || 'center') + '|' + (o.maxW ?? 1600);
    let st = layouts.get(key);
    if (!st || st.text !== L.text) {
      st = Z.stroke.layout(L.text, font, size, { align: o.align || 'center' });
      const maxW = o.maxW ?? 1600; if (st.width > maxW) st = Z.stroke.layout(L.text, font, size * maxW / st.width, { align: o.align || 'center' });
      layouts.set(key, st);
    }
    return st;
  };
  TR.write = (c, i, t, x, y, size, o = {}) => {
    const L = Z.line(i), font = o.font || 'script';
    if (t < L.t - (o.lead ?? 0.1)) return null;
    const st = layoutOf(i, font, size, o);
    const len = Z.stroke.lenAt(st, i, t, o), head = Z.stroke.draw(c, st, x, y, { len, color: o.color || P.bone, width: o.width ?? Math.max(1.5, size / 26) });
    if (o.spark !== false && len < st.len - 0.5) TR.spark(c, head[0], head[1], t, { scale: o.sparkScale ?? 0.55 });
    return head;
  };

  // ---------------------------------------------------------------- trEngrave
  TR.ENGRAVE = `
  uniform float uTurn, uLight, uForm, uPulse, uFreq, uReveal;
  uniform vec3 uInk, uInk2, uBone, uGraph, uSig;
  vec3 obj(vec3 p){ p.xz = rot2(uTurn)*p.xz; p.xy = rot2(.3)*p.xy; return p; }   // world -> the form's own space
  float map(vec3 p){
    vec3 q = obj(p); float d;
    if (uForm < .5) d = sdSphere(q, 1.);
    else if (uForm < 1.5) d = sdTorus(q, vec2(.95, .36));
    else {                                                                   // the bulb: three bodies melted, a stem
      d = sdSphere(q - vec3(0., .12, 0.), .74 + .03*uPulse);
      d = smin(d, sdSphere(q - vec3(.7, -.38, .22), .44), .32);
      d = smin(d, sdSphere(q - vec3(-.62, -.44, -.26), .5), .32);
      d = smin(d, sdCapsule(q, vec3(0., .6, 0.), vec3(.08, 1.38, .1), .1), .18);
    }
    return min(d, p.y + 1.25);                                               // the floor
  }
  #include <raymarch>
  vec4 frag(vec2 p){
    vec3 ro = vec3(0., .45, 4.4), rd = camRay(p, ro, vec3(0., -.15, 0.), .78);
    vec3 L = normalize(vec3(cos(uLight), .85, sin(uLight)));
    float t = march(ro, rd, 12.);
    if (t < 0.) return vec4(0.);
    vec3 x = ro + rd*t, n = normal(x);
    float light = lambert(n, L)*softShadow(x + n*.004, L, 12.)*ao(x, n);
    if (x.y < -1.24){                                                        // the floor: ruled lines across, the shadow as gaps
      float fall = exp(-.07*dot(x.xz, x.xz));
      float ln = hatch(x.z*6., .05 + .55*light*fall);
      return vec4(mix(uInk, uGraph, ln), smoothstep(10., 5., t)*fall);
    }
    vec3 q = obj(x);
    float lt = .07 + .93*light;                                              // a hairline survives in the dark
    float ln = slice(q, vec3(0., 1., .35), uFreq, lt);                       // burin lines wrapping the form
    ln = max(ln, hatch(dot(q, vec3(.83, .1, .55))*uFreq*1.4, sat(light*1.6 - .9))*.8);   // a second set on the brightest side
    float edge = rim(n, rd, 6.);
    vec3 col = mix(uInk2, uBone, ln);
    col = mix(col, uSig, edge*uPulse*ln*.9);                                 // the rim's lines catch the signal on downbeats
    float shown = smoothstep(uReveal - .06, uReveal, (x.y + 1.3)/2.8);       // the plate engraved from the top down
    return vec4(col, shown);
  }`;
  Z.scene('trEngrave', {
    init,
    draw(c, S) {
      const a = S.args, k = Z.clamp(S.lt / S.dur), form = { sphere: 0, torus: 1, bulb: 2 }[a.form || 'bulb'] ?? 2, li = a.light || [-2.4, -0.6];
      c.fillStyle = P.ink; c.fillRect(0, 0, W, H);
      c.save(); TR.cam(c, S, a.cam || { from: { zoom: 1.0 }, to: { zoom: 1.08 }, ease: 'inOutSine' });
      TR.grid(c, 160, 90, 1600, 900, 40, { major: 5, a: 0.12 });
      Z.shade(c, TR.ENGRAVE, {
        uT: S.t, uTurn: (a.turn ?? 0.9) * (k - 0.5), uLight: Z.lerp(li[0], li[1], E.inOutSine(k)), uForm: form, uFreq: a.freq ?? 26,
        uPulse: S.clock.pulse(S.t, 6) * (a.pulse ?? 1), uReveal: 1 - E.outCubic(Z.clamp(S.lt / Math.min(1.6, S.dur * 0.5))),
        uInk: lin(P.ink), uInk2: lin(P.ink2), uBone: lin(P.bone), uGraph: lin(P.graphite), uSig: lin(P.signal),
      }, { rect: [260, 60, 1400, 840] });
      TR.cropMarks(c, 160, 90, 1600, 900, { k: 1 });
      TR.readout(c, 1560, 140, 30, S.t);
      c.restore();
      if (a.line != null && S.t >= Z.line(a.line).t - 0.3) {                // screen space: the camera never crops the line
        const g = c.createLinearGradient(0, 880, 0, 1080), k = E.outCubic(Z.inv(Z.line(a.line).t - 0.3, Z.line(a.line).t, S.t));
        g.addColorStop(0, Z.rgba(P.ink, 0)); g.addColorStop(0.35, Z.rgba(P.ink, 0.88 * k)); g.addColorStop(1, Z.rgba(P.ink, 0.88 * k));
        c.fillStyle = g; c.fillRect(0, 880, W, 200);                         // the caption band: the floor's rules stop under the words
        TR.write(c, a.line, S.t, 960, 990, 64, { font: a.font || 'script' });
      }
    },
  });

  // ---------------------------------------------------------------- trField
  const batch = Z.lineBatch(140000);
  Z.scene('trField', {
    init,
    draw(c, S) {
      const a = S.args, t = S.t, nx = a.n ?? 120, ny = Math.round(nx * 9 / 16), steps = a.steps ?? 7, swell = 0.6 + 1.4 * (S.env.rms ? S.env.rms(t) : 0.3);
      c.fillStyle = P.ink; c.fillRect(0, 0, W, H);
      c.save(); TR.cam(c, S, a.cam || { from: { zoom: 1.04, rot: -0.02 }, to: { zoom: 1.12, rot: 0.02 }, ease: 'inOutSine' });
      // the pole: the pen head (where the line is being written), else a slow drift
      const L0 = a.line != null ? Z.line(a.line) : null;
      let pole = [960 + 420 * Math.cos(t * 0.4), 520 + 160 * Math.sin(t * 0.55)];
      if (L0 && a.line != null) {
        const st = layoutOf(a.line, a.font || 'script', 84), len = Z.stroke.lenAt(st, a.line, t);
        if (len > 0) { const h = Z.stroke.at(st, len); pole = [960 + h[0], 620 + h[1]]; }
      }
      const field = (x, y) => {                                                    // a dipole at the pole + a slow swirl
        const dx = x - pole[0], dy = y - pole[1], r2 = dx * dx + dy * dy + 900, k = 9e4 / r2;
        const sx = Math.sin(y * 0.004 + t * 0.3) + 0.6 * Math.sin((x + y) * 0.0023 - t * 0.21), sy = Math.cos(x * 0.0035 - t * 0.25);
        let vx = sx + k * (-dy / Math.sqrt(r2)) * 2.2 + k * dx / Math.sqrt(r2), vy = sy + k * (dx / Math.sqrt(r2)) * 2.2 + k * dy / Math.sqrt(r2);
        const m = Math.hypot(vx, vy) || 1; return [vx / m, vy / m];
      };
      const gx = (W + 240) / nx, gy = (H + 200) / ny, seg = 7 * swell;
      for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
        let x = -120 + (i + 0.5 + 0.8 * (Z.rnd(i, j, 1) - 0.5)) * gx, y = -100 + (j + 0.5 + 0.8 * (Z.rnd(i, j, 2) - 0.5)) * gy;
        const near = Math.hypot(x - pole[0], y - pole[1]), alpha = 0.22 + 0.5 * Math.exp(-near / 260), col = Z.rnd(i, j, 3) < 0.015 ? P.signal : P.bone;
        for (let s = 0; s < steps; s++) { const [vx, vy] = field(x, y), x2 = x + vx * seg, y2 = y + vy * seg; batch.seg(x, y, x2, y2, 0.8, col, alpha); x = x2; y = y2; }
      }
      batch.draw(c, { blend: 'add' });
      if (a.line != null) TR.write(c, a.line, t, 960, 620, 84, { font: a.font || 'script', width: 3.2 });
      TR.cropMarks(c, 120, 80, 1680, 920, { k: 1 });
      c.restore();
    },
  });
})();
