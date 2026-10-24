/* styles/magazine — press.js: the PRESS. Two Canvas2D layers become a printed page (GPU, core/shade.js).
 *
 *   proof layer (P): the pictures in normal colour on white (white = bare paper). The press separates it into the
 *                    page's spot inks by optical density, screens every ink at its own angle and misregisters it.
 *   ink layer   (I): type and rules as solid ink, drawn in 'lighter' on black: red = key (MZ.K), green = spot A
 *                    (MZ.A), blue = spot B (MZ.B). ink(MZ.A, 0.5) = half-tone spot A.
 * Inks combine subtractively on a paper texture (mottle, fibre, ink voids, uneven laydown).
 *
 *   const { P, I, F } = MZ.begin()      clear both layers (scene coords 1920x1080) and get the press settings F
 *   ... draw the page into P and I ...
 *   MZ.print(ctx, F, t, back)           print it onto the scene ctx; back = a canvas / image behind the page
 *
 * F (MZ.defaults()):
 *   paper '#efebe2', outside (round a shrunk page), inkK / inkA / inkB (MZ.INKS: riso-like inks)
 *   mode   0 spot (K + A + B separated from the proof) | 1 process CMYK | 2 mono (monoInk 0 K | 1 A | 2 B) |
 *          3 raw (the proof unscreened: a colour photograph glued in) | 4 duotone (K + duoInk 1 A | 2 B; duo ranges)
 *   screen scrType 0 euclidean dot | 1 line | 2 riso grain; cell 7 (px), ang [K, A, B] rad, scrMix 1 (0 = contone), grain 2.2
 *   offK / offA / offB [dx, dy] px     misregistration per plate (snare: MZ.react)
 *   tone [contrast, gamma, lo, hi]     the proof's tone curve before separation; photoAmt, inkAmt
 *   xf [zoom, rot, dx, dy]             the page under the camera (kick punch: MZ.react)
 *   bleed (px: wet ink spreading into the paper), paperAmt
 *   backMode 0 paper | 1 the back seen RAW where the proof is transparent (a hole cut in the page) | 2 the back
 *          printed like a photograph; inkLight 1 = the ink layer as LIGHT (screen) over a dark back: type over a world
 *          the paper has left; lightK / lightA / lightB
 *   neg (negative reprint), ca (chromatic split, px), xerox (copier streaks), vig, grainAmt, gain, flash [r, g, b, a]
 *
 * MZ.react(F, t, amt)  the drums work the press: kick = page punch (zoom), snare = plate slip, hat = grain sparkle
 * MZ.INKS              { black, sumi, red, scarlet, crimson, pink, teal, green, moss, blue, ultramarine, navy, sea,
 *                        orange, yellow, gold, purple, white, paper }
 *
 * mv-studio (MIT). The press after he-drowns-mv-v2's js/print.js (longruizhi2-beep, MIT): density separation into spot
 * inks, screens with a tone LUT, plate offsets, riso paper; rewritten for core/shade.js without its frame feedback.
 */
(() => {
  'use strict';
  const Z = window.Z, MZ = (Z.MZ = Z.MZ || {}), W = 1920, H = 1080;
  const lin = h => Z.hex(h).map(x => x / 255);

  MZ.INKS = {
    black: '#1d1b1c', sumi: '#23201f', red: '#e8352e', scarlet: '#f25a55', crimson: '#c8102e', pink: '#ff48b0',
    teal: '#00838a', green: '#00a95c', moss: '#43794d', blue: '#0078bf', ultramarine: '#2b3aa0', navy: '#1e2a4a',
    sea: '#3a6f8f', orange: '#ff6c2f', yellow: '#ffd200', gold: '#b49b57', purple: '#765ba7', white: '#ffffff', paper: '#efebe2',
  };
  MZ.K = [255, 0, 0]; MZ.A = [0, 255, 0]; MZ.B = [0, 0, 255];
  MZ.ink = (ch, a = 1) => `rgba(${ch[0]},${ch[1]},${ch[2]},${a})`;

  MZ.defaults = () => ({
    paper: MZ.INKS.paper, outside: '#141312', inkK: MZ.INKS.black, inkA: MZ.INKS.red, inkB: MZ.INKS.teal,
    mode: 0, monoInk: 0, duoInk: 2, duo: [0.25, 1, 0, 0.8], cell: 7, scrType: 0, scrMix: 1, grain: 2.2,
    ang: [0.7854, 0.2618, 1.309], offK: [0, 0], offA: [0, 0], offB: [0, 0], tone: [1, 1, 0, 1], photoAmt: 1, inkAmt: 1,
    xf: [1, 0, 0, 0], bleed: 0, paperAmt: 1, backMode: 0, inkLight: 0, lightK: '#f4f1ea', lightA: '#ff3b30', lightB: '#47d6e6',
    neg: 0, ca: 0, xerox: 0, vig: 0.35, grainAmt: 0.035, gain: 1, flash: [1, 1, 1, 0],
  });

  // ---------------------------------------------------------------- the two layers
  let P = null, I = null;
  MZ.layers = () => {
    if (!P) { P = Z.canvas(W, H).getContext('2d'); I = Z.canvas(W, H).getContext('2d'); }
    return { P, I };
  };
  MZ.begin = () => {
    const L = MZ.layers();
    for (const c of [L.P, L.I]) { c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = 1; c.filter = 'none'; c.globalCompositeOperation = 'source-over'; }
    L.P.clearRect(0, 0, W, H);
    L.I.fillStyle = '#000'; L.I.fillRect(0, 0, W, H); L.I.globalCompositeOperation = 'lighter';
    return { P: L.P, I: L.I, F: MZ.defaults() };
  };

  // ---------------------------------------------------------------- GLSL
  const COMMON = `
  float h12(vec2 p){ vec3 p3 = fract(vec3(p.xyx)*.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y)*p3.z); }
  float vn(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f*f*(3. - 2.*f);
    return mix(mix(h12(i), h12(i + vec2(1, 0)), u.x), mix(h12(i + vec2(0, 1)), h12(i + vec2(1, 1)), u.x), u.y); }
  float fb5(vec2 p){ float s = 0., a = .5; for (int i = 0; i < 5; i++){ s += a*vn(p); p = p*2.03 + 17.1; a *= .5; } return s; }
  `;
  // static paper (built once): r = mottle / fibre brightness, g = ink-void mask, b = coarse laydown unevenness
  const PAPER = COMMON + `
  vec4 frag(vec2 px){
    float mott = fb5(px*.0035) - .5, fib = 0.;
    for (int i = 0; i < 3; i++){ vec2 q = px*vec2(.9, .08)*(1. + float(i)*.7) + float(i)*31.; fib += (vn(q*.35) - .5)*(.5/(1. + float(i))); }
    float speck = step(.9985, h12(px*1.37))*.5;
    float bright = 1. - .045*mott - .025*fib - speck*.25 + (h12(px) - .5)*.018;
    float voids = step(.035, h12(px*.71 + 3.1))*(1. - step(.9992, h12(px*.23)));
    return vec4(bright, voids, fb5(px*.012 + 9.), 1.);
  }`;
  const PRESS = COMMON + `
  uniform sampler2D uPhoto, uInk, uPaperTex, uLut, uBack;
  uniform vec3 uPaper, uInkK, uInkA, uInkB, uDK, uDA, uDB, uOutside, uLightK, uLightA, uLightB, uFlashC;
  uniform float uMode, uMonoInk, uDuoInk, uScrType, uCell, uScrMix, uGrain, uPhotoAmt, uInkAmt, uBleed, uPaperAmt;
  uniform float uBackMode, uHasBack, uInkLight, uNeg, uCA, uXerox, uVig, uGrainAmt, uGain, uFlashA;
  uniform vec3 uAng; uniform vec2 uOffK, uOffA, uOffB; uniform vec4 uTone, uXf, uDuo;
  const vec2 R = vec2(${W}., ${H}.);
  vec2 camUv(vec2 p){ vec2 q = p - .5*R; float c = cos(uXf.y), s = sin(uXf.y); q = mat2(c, s, -s, c)*q/uXf.x; q -= uXf.zw*R; return q/R + .5; }
  vec3 back(vec2 uv){ return texture(uBack, clamp(uv, 0., 1.)).rgb; }
  vec3 proof(vec2 uv){
    vec4 tp = texture(uPhoto, clamp(uv, 0., 1.));
    vec3 c = (uBackMode > 1.5 && uHasBack > .5) ? mix(back(uv), tp.rgb, tp.a) : mix(vec3(1.), tp.rgb, tp.a);
    c = clamp((c - uTone.z)/max(uTone.w - uTone.z, 1e-3), 0., 1.);
    c = clamp((c - .5)*uTone.x + .5, 0., 1.);
    c = pow(c, vec3(uTone.y));
    return mix(vec3(1.), c, uPhotoAmt);
  }
  float toArea(float cd, vec3 ink){ float L = clamp(dot(ink, vec3(.299, .587, .114)), .03, .97); return clamp((1. - pow(L, cd))/(1. - L), 0., 1.); }
  vec3 sepSpot(vec3 col){                    // optical density -> key, then the rest split between the two spots
    vec3 d = max(-log(max(col/uPaper, vec3(.002))), 0.);
    float cK = min(min(d.r/uDK.r, d.g/uDK.g), d.b/uDK.b);
    vec3 r = max(d - cK*uDK, 0.);
    float aa = dot(uDA, uDA), ab = dot(uDA, uDB), bb = dot(uDB, uDB), ra = dot(r, uDA), rb = dot(r, uDB);
    float det = aa*bb - ab*ab, cA = (ra*bb - rb*ab)/max(det, 1e-5), cB = (rb*aa - ra*ab)/max(det, 1e-5);
    if (cA < 0.){ cA = 0.; cB = rb/bb; }
    if (cB < 0.){ cB = 0.; cA = ra/aa; }
    return vec3(toArea(cK, uInkK), toArea(max(cA, 0.), uInkA), toArea(max(cB, 0.), uInkB));
  }
  float lum(vec3 c){ return dot(c, vec3(.299, .587, .114)); }
  float screenInk(float cov, vec2 px, float ang, float cell, float salt){
    if (uScrMix <= 0.) return cov;
    float th;
    if (uScrType > 1.5){ vec2 g = px/uGrain; th = mix(h12(floor(g) + salt*13.1), vn(g*1.9 + salt*7.), .3); }
    else {
      float s = sin(ang), c = cos(ang); vec2 q = mat2(c, -s, s, c)*px/cell;
      float sp = uScrType > .5 ? .5 + .5*cos(6.2831853*q.y) : .5 + .25*(cos(6.2831853*q.x) + cos(6.2831853*q.y));
      th = uScrType > .5 ? 1. - acos(2.*sp - 1.)/3.14159265 : texture(uLut, vec2(sp, .5)).r;
    }
    float aa = max(fwidth(th), 1e-3)*.8;
    return cov <= .002 ? 0. : mix(cov, smoothstep(th - aa, th + aa, cov), uScrMix);   // no ink prints no dots
  }
  vec3 press(vec2 p){
    vec2 cu = camUv(p), px = cu*R, uv = cu;
    vec2 oK = uOffK/R, oA = uOffA/R, oB = uOffB/R;
    vec4 pap = texture(uPaperTex, fract(cu));
    vec3 col = uPaper*mix(1., pap.r, uPaperAmt);
    bool outside = cu.x < 0. || cu.y < 0. || cu.x > 1. || cu.y > 1.;
    vec3 cov = vec3(0.);
    if (uMode > .5 && uMode < 1.5){            // process CMYK
      vec3 p0 = proof(uv + oA), p1 = proof(uv + oB), p2 = proof(uv - oK), p3 = proof(uv + oK);
      float k0 = 1. - max(max(p0.r, p0.g), p0.b), C = (1. - p0.r - k0)/max(1. - k0, 1e-3);
      float k1 = 1. - max(max(p1.r, p1.g), p1.b), M = (1. - p1.g - k1)/max(1. - k1, 1e-3);
      float k2 = 1. - max(max(p2.r, p2.g), p2.b), Y = (1. - p2.b - k2)/max(1. - k2, 1e-3);
      float K = 1. - max(max(p3.r, p3.g), p3.b);
      C = screenInk(C, px, .2618, uCell, 1.); M = screenInk(M, px, 1.309, uCell, 2.); Y = screenInk(Y, px, 0., uCell, 3.); K = screenInk(K, px, .7854, uCell, 4.);
      if (!outside){ col *= 1. - C*(1. - vec3(0., .62, .9)); col *= 1. - M*(1. - vec3(.92, .08, .52)); col *= 1. - Y*(1. - vec3(1., .93, 0.)); col *= 1. - K*(1. - uInkK); }
    } else if (uMode > 2.5 && uMode < 3.5){    // raw: the colour proof itself
      if (!outside) col *= proof(uv);
    } else {
      if (uMode < .5) cov = vec3(sepSpot(proof(uv + oK)).x, sepSpot(proof(uv + oA)).y, sepSpot(proof(uv + oB)).z);
      else if (uMode < 2.5){
        float d = 1. - lum(proof(uv + (uMonoInk < .5 ? oK : uMonoInk < 1.5 ? oA : oB)));
        cov = uMonoInk < .5 ? vec3(d, 0., 0.) : uMonoInk < 1.5 ? vec3(0., d, 0.) : vec3(0., 0., d);
      } else {
        float dK = 1. - lum(proof(uv + oK)), dA = 1. - lum(proof(uv + (uDuoInk > 1.5 ? oB : oA)));
        float sp = smoothstep(uDuo.z, uDuo.w, dA);
        cov = vec3(smoothstep(uDuo.x, uDuo.y, dK), uDuoInk < 1.5 ? sp : 0., uDuoInk > 1.5 ? sp : 0.);
      }
      cov.x = screenInk(cov.x, px, uAng.x, uCell, 1.);
      cov.y = screenInk(cov.y, px, uAng.y, uCell*1.02, 2.);
      cov.z = screenInk(cov.z, px, uAng.z, uCell*.98, 3.);
    }
    if (outside) cov = vec3(0.);
    float uneven = mix(.86, 1., pap.b), voidm = mix(1., pap.g, .85);      // riso laydown on the picture inks
    cov *= uneven*voidm;
    col *= 1. - cov.x*(1. - uInkK); col *= 1. - cov.y*(1. - uInkA); col *= 1. - cov.z*(1. - uInkB);
    if (uBackMode > .5 && uBackMode < 1.5 && uHasBack > .5) col = mix(back(uv), col, texture(uPhoto, clamp(uv, 0., 1.)).a);   // the page cut away
    vec3 tk = vec3(texture(uInk, uv + oK).r, texture(uInk, uv + oA).g, texture(uInk, uv + oB).b);
    if (uBleed > 0.){ vec2 e = uBleed/R;
      vec3 b = (texture(uInk, uv + vec2(e.x, 0)).rgb + texture(uInk, uv - vec2(e.x, 0)).rgb + texture(uInk, uv + vec2(0, e.y)).rgb + texture(uInk, uv - vec2(0, e.y)).rgb)*.25;
      tk = max(tk, smoothstep(.15, .9, b)*.85); }
    tk *= uInkAmt;
    if (uInkLight > .5) col = 1. - (1. - col)*(1. - tk.x*uLightK)*(1. - tk.y*uLightA)*(1. - tk.z*uLightB);
    else { tk *= uneven*voidm; col *= 1. - tk.x*(1. - uInkK); col *= 1. - tk.y*(1. - uInkA); col *= 1. - tk.z*(1. - uInkB); }
    if (outside){ vec2 e = max(-cu, cu - 1.); float dd = max(e.x*R.x/R.y, e.y); col = uOutside*(1. - .55*exp(-dd*40.)) + (h12(px*.5) - .5)*.01; }
    return col;
  }
  vec4 frag(vec2 p){
    vec3 c;
    if (uCA > 0.){ vec2 d = (p - .5*R)*uCA/R.x*2.; c = vec3(press(p + d).r, press(p).g, press(p - d).b); } else c = press(p);
    c = mix(c, 1. - c, uNeg);
    vec2 uv = p/R;
    if (uXerox > 0.){
      float row = floor(p.y/3.), n = h12(vec2(row, floor(uT*24.)));
      float streak = step(1. - uXerox*.12, n)*(h12(vec2(row*1.7, uT))*.6 + .2);
      c = mix(c, vec3(dot(c, vec3(.33))), streak*.5)*(1. - streak*.35);
      c *= 1. - uXerox*.05*smoothstep(.2, 0., abs(fract(uv.x*1.3 + uT*.02) - .5));
    }
    vec2 q = uv - .5;
    c *= mix(1., smoothstep(.95, .25, length(q*vec2(1.05, 1.2))), uVig);
    c += (h12(p + fract(uT*43.7)*311.) - .5)*uGrainAmt;
    c = mix(c*uGain, uFlashC, clamp(uFlashA, 0., 1.));
    return vec4(c, 1.);
  }`;

  // tone-response LUT of the euclidean dot: spot value -> area fraction (so a 30 % tint prints 30 % ink)
  let lut = null, paper = null, blank = null;
  const lutCanvas = () => {
    if (lut) return lut;
    const N = 256, bins = new Float64Array(1024);
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
      const s = 0.5 + 0.25 * (Math.cos((2 * Math.PI * (i + 0.5)) / N) + Math.cos((2 * Math.PI * (j + 0.5)) / N));
      bins[Math.min(1023, Math.floor(s * 1024))]++;
    }
    const cdf = new Float64Array(1024); let acc = 0;
    for (let i = 0; i < 1024; i++) { acc += bins[i]; cdf[i] = acc / (N * N); }
    const cv = Z.canvas(256, 1), g = cv.getContext('2d'), im = g.createImageData(256, 1);
    for (let i = 0; i < 256; i++) { const v = Math.round(cdf[Math.min(1023, Math.floor(((i + 0.5) / 256) * 1024))] * 255); im.data.set([v, v, v, 255], i * 4); }
    g.putImageData(im, 0, 0);
    return (lut = cv);
  };
  const paperCanvas = () => {
    if (paper) return paper;
    const g = Z.canvas(W, H).getContext('2d');
    Z.shade(g, PAPER, {});
    return (paper = g.canvas);
  };
  const dens = h => lin(h).map(v => -Math.log(Math.max(v, 0.02)));

  MZ.print = (ctx, F, t, back = null) => {
    const L = MZ.layers();
    if (!blank) blank = Z.canvas(2, 2);
    Z.shade(ctx, PRESS, {
      uT: t, uPhoto: L.P.canvas, uInk: L.I.canvas, uPaperTex: paperCanvas(), uLut: lutCanvas(), uBack: back || blank, uHasBack: back ? 1 : 0,
      uPaper: lin(F.paper), uInkK: lin(F.inkK), uInkA: lin(F.inkA), uInkB: lin(F.inkB), uDK: dens(F.inkK), uDA: dens(F.inkA), uDB: dens(F.inkB),
      uOutside: lin(F.outside), uLightK: lin(F.lightK), uLightA: lin(F.lightA), uLightB: lin(F.lightB),
      uMode: F.mode, uMonoInk: F.monoInk, uDuoInk: F.duoInk, uDuo: F.duo, uScrType: F.scrType, uCell: F.cell, uScrMix: F.scrMix, uGrain: F.grain,
      uAng: F.ang, uOffK: F.offK, uOffA: F.offA, uOffB: F.offB, uTone: F.tone, uXf: F.xf, uPhotoAmt: F.photoAmt, uInkAmt: F.inkAmt,
      uBleed: F.bleed, uPaperAmt: F.paperAmt, uBackMode: F.backMode, uInkLight: F.inkLight,
      uNeg: F.neg, uCA: F.ca, uXerox: F.xerox, uVig: F.vig, uGrainAmt: F.grainAmt, uGain: F.gain, uFlashC: F.flash.slice(0, 3), uFlashA: F.flash[3],
    }, { rect: [0, 0, W, H] });
  };

  // the drums work the press: kick = the page punches towards you, snare = a plate slips, hat = the grain sparkles
  MZ.react = (F, t, amt = 1) => {
    if (!Z.hit) return;
    const k = Z.hit('kick', t, 0.1) * amt, s = Z.hit('snare', t, 0.14) * amt, h = Z.hit('hat', t, 0.06) * amt;
    F.xf[0] *= 1 + 0.025 * k;
    const a = Z.rnds(Math.floor(t * 30), 7) * Math.PI * 2;                 // a new slip direction per frame of the hit
    F.offA = [F.offA[0] + Math.cos(a) * 7 * s, F.offA[1] + Math.sin(a) * 7 * s];
    F.offB = [F.offB[0] - Math.cos(a) * 4 * s, F.offB[1] - Math.sin(a) * 4 * s];
    F.grainAmt += 0.03 * h;
  };
})();
