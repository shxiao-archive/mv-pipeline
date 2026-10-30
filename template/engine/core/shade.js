/* mv-studio engine — shade.js: scenes that draw with their OWN GLSL, and a GPU hairline batch.
 *
 * Canvas2D stays the scene layer; these draw with WebGL2 on a canvas of their own and land on the ctx you pass, under its
 * current transform (a camera move applies to them as to any drawing), its globalAlpha and its composite operation.
 * Without a GPU Chrome runs WebGL2 on SwiftShader (CPU): correct, slower. Keep a shader to the rect it covers (`rect`).
 *
 *   Z.shade(ctx, frag, uniforms, o)   run a fragment shader. `frag` defines   vec4 frag(vec2 p)   (p = the point of the
 *                     scene in ctx coordinates, px, y down; return straight-alpha rgba 0..1). Given for free: uRes (canvas
 *                     px), uT (song time, from uniforms.uT), uPx (scene units per screen px: hairlines stay 1 px under a
 *                     zoom) and Z.GLSL (below). `#include <raymarch>` after your `float map(vec3 p)` adds march / normal /
 *                     softShadow / ao. uniforms: { name: number | [x, y(, z, w)] | float array | canvas / image (sampler2D) }
 *                     o: { rect [x, y, w, h] (scene coords: only that part is shaded), ss 1 | 4 (rotated-grid supersampling) }
 *   Z.glScene(name, { frag, uniforms(S) -> {...}, ss, rect, before(ctx, S), after(ctx, S), preload, init })
 *                     a scene that is one shader (+ Canvas2D before / after it: ground, type, the spark)
 *   Z.lineBatch(capacity)   GPU capsule segments: tens of thousands of anti-aliased hairlines per frame
 *       .seg(ax, ay, bx, by, width, color, alpha)   .poly(pts, width, color, alpha, close)   color '#hex' | [r, g, b] 0..1
 *       .draw(ctx, { blend 'normal' | 'add', screenWidth })   draws and empties the batch. Widths are scene px (scaled by the
 *       ctx transform) unless screenWidth; a line thinner than 1 screen px fades instead of thinning (hairlines stay smooth)
 *
 * Z.GLSL (in every shader):
 *   sat  rot2  h21 h31 vnoise snoise fbm      the usual (snoise: Ashima simplex 2D, MIT)
 *   sdCircle sdBox sdSegment                  2D distances      sdSphere sdBox3 sdTorus sdCapsule smin   3D distances
 *   lineAA(d, halfw)                          a line |d| < halfw (units of d) with a one-screen-pixel edge
 *   ENGRAVING (after pdoom-video's hatch / engrave, MIT):
 *   hatch(u, dark)  hatchD(u, dark, du)       parallel lines at integer u whose WIDTH grows with dark (0..1): tone as line width
 *   engrave(uv, dark, freq, angle)            a hairline that thickens + a cross-hatch that enters in deep shadow
 *   slice(p, axis, freq, dark)                3D: the form cut by parallel planes: lines that wrap round it (a burin's cut)
 *   slice2(p, n, freq, dark)                  slice + a second set across it in the shadows (the darker side of a form)
 *   stipple(px, dark, cell)                   dots whose size follows dark
 *   lambert(n, l)  rim(n, v, k)  camRay(p, ro, ta, fovY)   lighting and a camera ray for screen point p (px)
 *
 * mv-studio (MIT). Idioms after pdoom-video by Giacomo Magnanini (MIT): engraving hatch, capsule line batch.
 */
(() => {
  'use strict';
  const Z = window.Z;

  Z.GLSL = `
  #define PI 3.14159265359
  #define TAU 6.28318530718
  float sat(float x){ return clamp(x, 0., 1.); }
  mat2 rot2(float a){ float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }
  float h21(vec2 p){ p = fract(p*vec2(123.34, 456.21)); p += dot(p, p+45.32); return fract(p.x*p.y); }
  float h31(vec3 p){ p = fract(p*vec3(.1031, .1030, .0973)); p += dot(p, p.yxz+33.33); return fract((p.x+p.y)*p.z); }
  float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p), u = f*f*(3.-2.*f);
    return mix(mix(h21(i), h21(i+vec2(1,0)), u.x), mix(h21(i+vec2(0,1)), h21(i+vec2(1,1)), u.x), u.y); }
  vec3 _perm(vec3 x){ return mod(((x*34.)+1.)*x, 289.); }
  float snoise(vec2 v){
    const vec4 C = vec4(.211324865405187, .366025403784439, -.577350269189626, .024390243902439);
    vec2 i = floor(v + dot(v, C.yy)), x0 = v - i + dot(i, C.xx);
    vec2 i1 = x0.x > x0.y ? vec2(1., 0.) : vec2(0., 1.);
    vec4 x12 = x0.xyxy + C.xxzz; x12.xy -= i1; i = mod(i, 289.);
    vec3 p = _perm(_perm(i.y + vec3(0., i1.y, 1.)) + i.x + vec3(0., i1.x, 1.));
    vec3 m = max(.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.); m = m*m; m = m*m;
    vec3 x = 2.*fract(p*C.www) - 1., h = abs(x) - .5, ox = floor(x + .5), a0 = x - ox;
    m *= 1.79284291400159 - .85373472095314*(a0*a0 + h*h);
    vec3 g; g.x = a0.x*x0.x + h.x*x0.y; g.yz = a0.yz*x12.xz + h.yz*x12.yw;
    return 130.*dot(m, g);
  }
  float fbm(vec2 p){ float s = 0., a = .5; for (int i = 0; i < 5; i++){ s += a*snoise(p); p = rot2(.5)*p*2.03; a *= .5; } return s; }
  float sdCircle(vec2 p, float r){ return length(p) - r; }
  float sdBox(vec2 p, vec2 b){ vec2 d = abs(p) - b; return length(max(d, 0.)) + min(max(d.x, d.y), 0.); }
  float sdSegment(vec2 p, vec2 a, vec2 b){ vec2 pa = p-a, ba = b-a; return length(pa - ba*sat(dot(pa, ba)/dot(ba, ba))); }
  float sdSphere(vec3 p, float r){ return length(p) - r; }
  float sdBox3(vec3 p, vec3 b){ vec3 d = abs(p) - b; return length(max(d, 0.)) + min(max(d.x, max(d.y, d.z)), 0.); }
  float sdTorus(vec3 p, vec2 t){ return length(vec2(length(p.xz) - t.x, p.y)) - t.y; }
  float sdCapsule(vec3 p, vec3 a, vec3 b, float r){ vec3 pa = p-a, ba = b-a; return length(pa - ba*sat(dot(pa, ba)/dot(ba, ba))) - r; }
  float smin(float a, float b, float k){ float h = sat(.5 + .5*(b-a)/k); return mix(b, a, h) - k*h*(1.-h); }
  float lineAA(float d, float hw){ float aa = max(fwidth(d), 1e-5); return 1. - smoothstep(hw - aa*.5, hw + aa*.5, abs(d)); }
  float hatchD(float u, float dark, float du){
    float f = abs(fract(u) - .5), hw = .5*sat(dark), aa = max(du, 1e-4);   // f: 0 on a line .. .5 between lines
    return 1. - smoothstep(hw - aa, hw + aa, .5 - f);
  }
  float hatch(float u, float dark){ return hatchD(u, dark, fwidth(u)); }
  float engrave(vec2 uv, float dark, float freq, float angle){
    float a = hatch((rot2(angle)*uv*freq).y, dark*1.1);
    float b = hatch((rot2(angle + 1.1)*uv*freq).y, sat(dark*2. - 1.1));
    return max(a, b);
  }
  float slice(vec3 p, vec3 axis, float freq, float dark){ return hatch(dot(p, normalize(axis))*freq, dark); }
  float slice2(vec3 p, vec3 n, float freq, float dark){
    vec3 a = normalize(cross(n, vec3(0., 1., .3))), b = normalize(cross(n, a));   // two sets across the surface
    return max(hatch(dot(p, a)*freq, dark*1.05), hatch(dot(p, b)*freq, sat(dark*1.9 - 1.)));
  }
  float stipple(vec2 px, float dark, float cell){
    vec2 c = floor(px/cell), f = px/cell - c - .5 - (vec2(h21(c), h21(c+7.)) - .5)*.5;
    return lineAA(length(f), .55*sqrt(sat(dark)));
  }
  float lambert(vec3 n, vec3 l){ return max(dot(n, normalize(l)), 0.); }
  float rim(vec3 n, vec3 v, float k){ return pow(1. - max(dot(n, -v), 0.), k); }
  vec3 camRay(vec2 p, vec3 ro, vec3 ta, float fovY){
    vec3 f = normalize(ta - ro), r = normalize(cross(f, vec3(0., 1., 0.))), u = cross(r, f);
    vec2 q = (p - uRes*.5)/(uRes.y*.5)*vec2(1., -1.);                       // y up, aspect kept
    return normalize(f + tan(fovY*.5)*(q.x*r + q.y*u));
  }
  `;

  const RAYMARCH = `
  float march(vec3 ro, vec3 rd, float tmax){
    float t = 0.;
    for (int i = 0; i < 96; i++){ float d = map(ro + rd*t); if (d < .0008*t + .0005) return t; t += d*.9; if (t > tmax) break; }
    return -1.;
  }
  vec3 normal(vec3 p){ vec2 e = vec2(.0012, -.0012);
    return normalize(e.xyy*map(p + e.xyy) + e.yyx*map(p + e.yyx) + e.yxy*map(p + e.yxy) + e.xxx*map(p + e.xxx)); }
  float softShadow(vec3 ro, vec3 rd, float k){
    float r = 1., t = .02;
    for (int i = 0; i < 40; i++){ float h = map(ro + rd*t); r = min(r, k*h/t); t += clamp(h, .02, .3); if (r < .001 || t > 8.) break; }
    return sat(r);
  }
  float ao(vec3 p, vec3 n){ float o = 0., s = 1.; for (int i = 1; i <= 5; i++){ float h = .03*float(i); o += (h - map(p + n*h))*s; s *= .7; } return sat(1. - 2.5*o); }
  `;

  const VS = `#version 300 es
  in vec2 q; void main(){ gl_Position = vec4(q, 0., 1.); }`;
  const FS = (src, ss) => `#version 300 es
  precision highp float;
  uniform vec2 uRes; uniform float uT, uPx; uniform vec3 uM0, uM1;      // screen px -> scene: p = (uM0.x*x + uM0.y*y + uM0.z, ...)
  out vec4 o;
  ${Z.GLSL}
  ${src.replace(/#include\s*<raymarch>/, RAYMARCH)}
  void main(){
    vec2 s = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);                // screen px, y down
    vec4 c = vec4(0.);
    ${ss === 4 ? `for (int k = 0; k < 4; k++){
      vec2 d = (k == 0 ? vec2(.125, .375) : k == 1 ? vec2(-.375, .125) : k == 2 ? vec2(-.125, -.375) : vec2(.375, -.125));
      vec2 x = s + d; c += frag(vec2(dot(uM0, vec3(x, 1.)), dot(uM1, vec3(x, 1.))));
    } c *= .25;` : `c = frag(vec2(dot(uM0, vec3(s, 1.)), dot(uM1, vec3(s, 1.))));`}
    c = clamp(c, 0., 1.);
    o = vec4(c.rgb*c.a, c.a);                                               // premultiplied for the canvas
  }`;

  let gl = null, cv = null, quad = null;
  const progs = new Map(), texOf = new WeakMap();
  function boot() {
    cv = Z.canvas(Z.W || 1920, Z.H || 1080);
    gl = cv.getContext('webgl2', { premultipliedAlpha: true, alpha: true, antialias: false, preserveDrawingBuffer: true });
    if (!gl) throw new Error('Z.shade: WebGL2 unavailable');
    quad = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  }
  function compile(vs, fs) {
    const mk = (type, src) => {
      const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error('Z.shade: ' + gl.getShaderInfoLog(s) + '\n' + src.split('\n').map((l, i) => (i + 1) + ': ' + l).join('\n'));
      return s;
    };
    const p = gl.createProgram(); gl.attachShader(p, mk(gl.VERTEX_SHADER, vs)); gl.attachShader(p, mk(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error('Z.shade: ' + gl.getProgramInfoLog(p));
    const u = {};
    for (let i = 0, n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS); i < n; i++) { const a = gl.getActiveUniform(p, i); u[a.name.replace(/\[0\]$/, '')] = { loc: gl.getUniformLocation(p, a.name), type: a.type, size: a.size }; }
    return { p, u };
  }
  const size = ctx => { if (!gl) boot(); const w = ctx.canvas.width, h = ctx.canvas.height; if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; } gl.viewport(0, 0, w, h); return [w, h]; };
  // the screen box (px) of a scene rect under the ctx transform
  const boxOf = (m, r, w, h) => {
    if (!r) return [0, 0, w, h];
    const pts = [[r[0], r[1]], [r[0] + r[2], r[1]], [r[0], r[1] + r[3]], [r[0] + r[2], r[1] + r[3]]].map(([x, y]) => [m.a * x + m.c * y + m.e, m.b * x + m.d * y + m.f]);
    const x0 = Math.max(0, Math.floor(Math.min(...pts.map(p => p[0])))), y0 = Math.max(0, Math.floor(Math.min(...pts.map(p => p[1]))));
    const x1 = Math.min(w, Math.ceil(Math.max(...pts.map(p => p[0])))), y1 = Math.min(h, Math.ceil(Math.max(...pts.map(p => p[1]))));
    return [x0, y0, Math.max(0, x1 - x0), Math.max(0, y1 - y0)];
  };
  const isImage = v => v && typeof v === 'object' && ('naturalWidth' in v || 'getContext' in v || 'close' in v);
  function texture(unit, src) {
    let t = texOf.get(src);
    const fresh = !t;
    if (fresh) { t = gl.createTexture(); texOf.set(src, t); }
    gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t);
    if (fresh || 'getContext' in src) {                                     // a canvas may change between frames: upload again
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    }
  }
  function setU(pr, name, v, unit) {
    const u = pr.u[name]; if (!u) return unit;
    if (isImage(v)) { texture(unit, v); gl.uniform1i(u.loc, unit); return unit + 1; }
    if (typeof v === 'number') gl.uniform1f(u.loc, v);
    else if (u.size > 1) gl.uniform1fv(u.loc, v instanceof Float32Array ? v : new Float32Array(v));
    else if (v.length === 2) gl.uniform2fv(u.loc, v); else if (v.length === 3) gl.uniform3fv(u.loc, v); else gl.uniform4fv(u.loc, v);
    return unit;
  }
  // gl canvas -> ctx at screen box b (identity transform: the transform is already in the shader / the vertices)
  const land = (ctx, b) => { ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(cv, b[0], b[1], b[2], b[3], b[0], b[1], b[2], b[3]); ctx.restore(); };

  Z.shade = (ctx, frag, uniforms = {}, o = {}) => {
    const [w, h] = size(ctx), m = ctx.getTransform(), b = boxOf(m, o.rect, w, h);
    if (b[2] < 1 || b[3] < 1) return;
    const ss = o.ss === 4 ? 4 : 1, key = ss + '|' + frag;
    let pr = progs.get(key); if (!pr) { pr = compile(VS, FS(frag, ss)); progs.set(key, pr); }
    const iv = m.inverse();
    gl.useProgram(pr.p);
    gl.disable(gl.BLEND); gl.enable(gl.SCISSOR_TEST); gl.scissor(b[0], h - b[1] - b[3], b[2], b[3]);
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.bindBuffer(gl.ARRAY_BUFFER, quad); const qa = gl.getAttribLocation(pr.p, 'q'); gl.enableVertexAttribArray(qa); gl.vertexAttribPointer(qa, 2, gl.FLOAT, false, 0, 0);
    let unit = 0;
    unit = setU(pr, 'uRes', [w, h], unit); unit = setU(pr, 'uPx', 1 / Math.sqrt(Math.abs(m.a * m.d - m.b * m.c)) || 1, unit);
    unit = setU(pr, 'uM0', [iv.a, iv.c, iv.e], unit); unit = setU(pr, 'uM1', [iv.b, iv.d, iv.f], unit);
    if (!('uT' in uniforms)) setU(pr, 'uT', 0, unit);
    for (const [k, v] of Object.entries(uniforms)) unit = setU(pr, k, v, unit);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.disable(gl.SCISSOR_TEST);
    land(ctx, b);
  };

  Z.glScene = (name, def) => Z.scene(name, {
    preload: def.preload, init: def.init,
    async draw(ctx, S) {
      if (def.before) { const r = def.before(ctx, S); if (r && r.then) await r; }
      Z.shade(ctx, def.frag, Object.assign({ uT: S.t }, def.uniforms ? def.uniforms(S) : {}), { ss: def.ss, rect: typeof def.rect === 'function' ? def.rect(S) : def.rect });
      if (def.after) { const r = def.after(ctx, S); if (r && r.then) await r; }
    },
  });

  // ---------------------------------------------------------------- the line batch
  const LVS = `#version 300 es
  in vec2 q; in vec4 iAB; in float iW; in vec4 iC;
  uniform vec2 uRes; uniform vec3 uM0, uM1; uniform float uWs;
  out vec2 vL; out float vLen, vHw; out vec4 vC;
  void main(){
    vec2 a = vec2(dot(uM0, vec3(iAB.xy, 1.)), dot(uM1, vec3(iAB.xy, 1.))), b = vec2(dot(uM0, vec3(iAB.zw, 1.)), dot(uM1, vec3(iAB.zw, 1.)));
    float w = iW*uWs, hw = max(w*.5, .5) + 1.;                              // +1 px for the anti-aliased edge
    vec2 d = b - a; float len = length(d); vec2 dir = len > 1e-4 ? d/len : vec2(1., 0.), nr = vec2(-dir.y, dir.x);
    float along = mix(-hw, len + hw, q.x);
    vec2 p = a + dir*along + nr*q.y*hw;
    gl_Position = vec4(p.x/uRes.x*2. - 1., 1. - p.y/uRes.y*2., 0., 1.);
    vL = vec2(along, q.y*hw); vLen = len; vHw = max(w*.5, .5);
    vC = iC*vec4(1., 1., 1., min(1., w));                                   // under 1 px: fainter, not thinner
  }`;
  const LFS = `#version 300 es
  precision highp float;
  in vec2 vL; in float vLen, vHw; in vec4 vC; out vec4 o;
  void main(){
    float x = clamp(vL.x, 0., vLen), d = length(vec2(vL.x - x, vL.y)) - vHw;   // capsule distance, px
    float a = clamp(.5 - d, 0., 1.)*vC.a; if (a <= 0.) discard;
    o = vec4(vC.rgb*a, a);
  }`;
  let lprog = null, lvao = null, lcorner = null, linst = null;
  const colCache = new Map();
  const rgb01 = c => { if (Array.isArray(c)) return c; let v = colCache.get(c); if (!v) { v = Z.hex(c).map(x => x / 255); colCache.set(c, v); } return v; };
  class LineBatch {
    constructor(cap = 65536) { this.cap = cap; this.d = new Float32Array(cap * 9); this.n = 0; }
    seg(ax, ay, bx, by, w = 1, col = '#ffffff', a = 1) {
      if (this.n >= this.cap) return this;                                  // full: further segments are dropped (raise the capacity)
      const c = rgb01(col), d = this.d, i = this.n++ * 9;
      d[i] = ax; d[i + 1] = ay; d[i + 2] = bx; d[i + 3] = by; d[i + 4] = w; d[i + 5] = c[0]; d[i + 6] = c[1]; d[i + 7] = c[2]; d[i + 8] = a;
      return this;
    }
    poly(pts, w = 1, col = '#ffffff', a = 1, close = false) {
      for (let k = 1; k < pts.length; k++) this.seg(pts[k - 1][0], pts[k - 1][1], pts[k][0], pts[k][1], w, col, a);
      if (close && pts.length > 2) this.seg(pts[pts.length - 1][0], pts[pts.length - 1][1], pts[0][0], pts[0][1], w, col, a);
      return this;
    }
    clear() { this.n = 0; return this; }
    draw(ctx, { blend = 'normal', screenWidth = false } = {}) {
      if (!this.n) return;
      const [w, h] = size(ctx), m = ctx.getTransform();
      if (!lprog) {
        lprog = compile(LVS, LFS); lvao = gl.createVertexArray(); gl.bindVertexArray(lvao);
        lcorner = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, lcorner); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, -1, 1, -1, 0, 1, 1, 1]), gl.STATIC_DRAW);
        const qa = gl.getAttribLocation(lprog.p, 'q'); gl.enableVertexAttribArray(qa); gl.vertexAttribPointer(qa, 2, gl.FLOAT, false, 0, 0);
        linst = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, linst);
        for (const [name, n, off] of [['iAB', 4, 0], ['iW', 1, 4], ['iC', 4, 5]]) {
          const loc = gl.getAttribLocation(lprog.p, name); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, n, gl.FLOAT, false, 36, off * 4); gl.vertexAttribDivisor(loc, 1);
        }
        gl.bindVertexArray(null);
      }
      gl.useProgram(lprog.p); gl.bindVertexArray(lvao);
      gl.bindBuffer(gl.ARRAY_BUFFER, linst); gl.bufferData(gl.ARRAY_BUFFER, this.d.subarray(0, this.n * 9), gl.STREAM_DRAW);
      gl.uniform2fv(lprog.u.uRes.loc, [w, h]); gl.uniform3fv(lprog.u.uM0.loc, [m.a, m.c, m.e]); gl.uniform3fv(lprog.u.uM1.loc, [m.b, m.d, m.f]);
      gl.uniform1f(lprog.u.uWs.loc, screenWidth ? 1 : Math.sqrt(Math.abs(m.a * m.d - m.b * m.c)));
      gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
      gl.enable(gl.BLEND); if (blend === 'add') gl.blendFunc(gl.ONE, gl.ONE); else gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, this.n);
      gl.disable(gl.BLEND); gl.bindVertexArray(null);
      ctx.save(); if (blend === 'add') ctx.globalCompositeOperation = 'lighter'; land(ctx, [0, 0, w, h]); ctx.restore();
      this.n = 0;
    }
  }
  Z.lineBatch = cap => new LineBatch(cap);
})();
