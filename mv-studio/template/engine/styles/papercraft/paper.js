/* styles/papercraft — paper.js: the cut-paper pop-up book. Every object is a piece of cut paper: a flat colour, a
 * slightly wavy hand-cut edge, a soft drop shadow that grows with its height above the page, a lit cut edge on top,
 * and paper fibre over everything. Pure functions; each saves / restores the ctx it is given.
 *
 *   PC.PAL                           paper / ink / royal red-gold / skies / nature / skin / fire / coin ... (one palette)
 *   PC.blob(cx, cy, rx, ry, o)       a hand-cut ellipse (Path2D); o: { seed, amp 0.025, n, rot }
 *   PC.poly(pts, o)                  a hand-cut polygon (Path2D); o: { seed, amp 1.6 px, step 26, round 0..1, closed }
 *   PC.smooth(pts, o) / PC.ribbon(pts, widths)   Catmull-Rom curve; a strip whose width varies (hair, flames, scarves)
 *   PC.cut(g, path, fill, o)         fill as cut paper: o: { shadow (height above the page, px), shadowAlpha, stroke, lw,
 *                                    rim (lit cut edge colour), rimW, alpha }
 *   PC.shade(g, path, col, x0, y0, x1, y1, a0, a1)   a gradient shade inside a path (lit / shaded side)
 *   PC.lin / PC.rad                  gradients;  PC.glow / PC.rays / PC.sparkle   light (screen blend)
 *   PC.line(g, pts, o)               a hand-drawn line (route, speed lines): o: { seed, amp, lw, color, dash, p 0..1 drawn }
 *   PC.cam(x, y, zoom, rot) / PC.applyCam(g, cam, depth)   the multiplane camera: depth 1 = the subject plane, < 1
 *                                    background (moves less), > 1 foreground (moves more)
 *   PC.doll(g, x, y, s, o) -> anchors  a jointed paper doll pinned on the biped skeleton (core/rig.js; ORIGINAL generic
 *                                    design: make your cast with its options). (x, y) = between the feet; s = 1 is ~260 px.
 *                                    o: pose (Z.rig.biped.NAMES or { from, to, k }), act, phase, beat, t, expr
 *                                    (Z.rig.biped.EXPRS), eyes / mouth / brows overrides, ik { F, B }, joints, jointsAdd,
 *                                    face +-1, emote ('!' '?' heart spark sweat music) + emoteK, blink, sq / take,
 *                                    look: skin hair hairStyle (mop bob spiky braid) outfit outfitDark trim legs shoes
 *                                    hat (crown cap hood) hatCol scarf vel seed; hold(g, s) at the near hand; detail 0;
 *                                    silhouette (colour); pins false; rigOnly (anchors only). Old: walk, jump, armF, armB, lean
 *   PC.burst(g, t, t0, x, y, o)      paper confetti / coins / petals burst from (x, y) at t0, pure function of t
 *   PC.texture()                     the paper fibre tile; multiplied over every papercraft shot (scenes.js install)
 *
 * mv-studio (MIT). Paper primitives adapted from dalabengba-mv's src/core/paper.js and texture.js (ISC; see
 * licenses/LICENSE-dalabengba-mv.txt); the doll, camera wrapper and burst were written for this engine.
 */
(() => {
  'use strict';
  const Z = window.Z, PC = (Z.PC = Z.PC || {}), TAU = Math.PI * 2;
  const clamp = Z.clamp, lerp = Z.lerp, hash2 = (a, b) => Z.rnd(Math.round(a * 1000), Math.round(b * 1000));
  const hex = h => Z.hex(h);
  PC.rgba = (h, a = 1) => Z.rgba(h, a);
  PC.mix = (a, b, k) => '#' + Z.mix3(hex(a), hex(b), clamp(k)).map(v => Math.round(v).toString(16).padStart(2, '0')).join('');

  PC.PAL = {
    paper: '#F6EDDA', paper2: '#EADCBF', kraft: '#D5BC8E', kraftDark: '#B39565', ink: '#2C2233', inkSoft: '#56495E', shadow: '#2B1A24', white: '#FFFDF7',
    red: '#D8473D', redDark: '#9F2C2C', gold: '#F2B634', goldDark: '#C98A1B', goldLight: '#FFE28E',
    skyDay: '#8FD0F2', skyDayLow: '#DDF1F7', skyDusk: '#F4A26F', skyDuskHigh: '#7E5C9F', skyNight: '#28325F', skyNightHigh: '#131937', skyDoom: '#6B2B4A', skyDoomLow: '#E0674A',
    meadow: '#93CF72', grass: '#62AE5E', grassDark: '#3E8A4F', forest: '#2F6B52', leafLight: '#B9E08A',
    earth: '#B57D4C', wood: '#8C5B3C', woodDark: '#5F3C28', sand: '#E6C892', path: '#E9D3A4',
    stone: '#CFC6B6', stoneDark: '#71685D', roof: '#4E6FA8', roofRed: '#C3533F', water: '#58AACB', snow: '#F8FBFF',
    mountain: '#7C8FB8', mountainFar: '#A9B8D6', mountainDark: '#4F5F86',
    skin: '#F8CDA6', skinShade: '#E7A985', blush: '#F2918C', blue: '#3F70B8', blueDark: '#2B4F87', pink: '#F39DB8', purple: '#6C4E9C', teal: '#72D3C3',
    fire: '#FF8B3D', fire2: '#FFD65E', moon: '#FFF5D8', crystal: '#7FE3E0', coin: '#F7C443', coinDark: '#D0922A', heart: '#F25C6E',
  };
  const P = PC.PAL;
  PC.FONTS = { display: '"ZCOOL QingKe HuangYou", "M PLUS Rounded 1c", sans-serif', play: '"ZCOOL KuaiLe", "M PLUS Rounded 1c", sans-serif',
    serif: '"ZCOOL XiaoWei", "Noto Serif SC", serif', latin: '"Fredoka", "ZCOOL KuaiLe", sans-serif' };
  PC.fontsToLoad = ['400 40px "ZCOOL QingKe HuangYou"', '400 40px "ZCOOL KuaiLe"', '400 40px "ZCOOL XiaoWei"', '600 40px "Fredoka"', '800 40px "M PLUS Rounded 1c"'];
  PC.useJapanese = () => { PC.FONTS.display = PC.FONTS.play = '"M PLUS Rounded 1c", "ZCOOL KuaiLe", sans-serif'; PC.FONTS.serif = '"Zen Old Mincho", serif'; };

  // ---------------------------------------------------------------- paths
  const smoothInto = (p, pts, closed, tension = 0.5) => {
    const n = pts.length; if (n < 2) return;
    const get = i => (closed ? pts[(i + n) % n] : pts[Math.max(0, Math.min(n - 1, i))]), s = tension / 3;
    p.moveTo(pts[0][0], pts[0][1]);
    for (let i = 0, last = closed ? n : n - 1; i < last; i++) {
      const p0 = get(i - 1), p1 = get(i), p2 = get(i + 1), p3 = get(i + 2);
      p.bezierCurveTo(p1[0] + (p2[0] - p0[0]) * s, p1[1] + (p2[1] - p0[1]) * s, p2[0] - (p3[0] - p1[0]) * s, p2[1] - (p3[1] - p1[1]) * s, p2[0], p2[1]);
    }
    if (closed) p.closePath();
  };
  PC.smooth = (pts, o = {}) => { const p = new Path2D(); smoothInto(p, pts, o.closed ?? true, o.tension ?? 0.5); return p; };
  const edgeFn = (seed, amp, freq = 3) => {                // a stable wavy radius: the hand-cut edge
    const k = []; for (let i = 0; i < 5; i++) k.push([freq + i * 1.7 + hash2(seed, i) * 1.3, hash2(seed + 11, i) * TAU, 1 / (1 + i * 0.8)]);
    const norm = k.reduce((s, q) => s + q[2], 0);
    return a => 1 + (amp * k.reduce((s, [f, ph, w]) => s + w * Math.sin(a * f + ph), 0)) / norm;
  };
  PC.blob = (cx, cy, rx, ry = rx, o = {}) => {
    const { seed = 1, amp = 0.025, n = 56, rot = 0, freq = 3 } = o, f = edgeFn(seed, amp, freq), cr = Math.cos(rot), sr = Math.sin(rot), pts = [];
    for (let i = 0; i < n; i++) { const a = i / n * TAU, r = f(a), x = Math.cos(a) * rx * r, y = Math.sin(a) * ry * r; pts.push([cx + x * cr - y * sr, cy + x * sr + y * cr]); }
    const p = new Path2D(); smoothInto(p, pts, true); return p;
  };
  PC.poly = (points, o = {}) => {
    const { seed = 1, amp = 1.6, step = 26, round = 0, closed = true } = o, pts = [], n = points.length;
    for (let i = 0; i < (closed ? n : n - 1); i++) {
      const [x1, y1] = points[i], [x2, y2] = points[(i + 1) % n], len = Math.hypot(x2 - x1, y2 - y1), k = Math.max(1, Math.round(len / step));
      const nx = -(y2 - y1) / (len || 1), ny = (x2 - x1) / (len || 1);
      for (let j = 0; j < k; j++) { const t = j / k, d = j === 0 ? 0 : amp * (hash2(seed * 13 + i, j) * 2 - 1); pts.push([lerp(x1, x2, t) + nx * d, lerp(y1, y2, t) + ny * d]); }
    }
    if (!closed) pts.push(points[n - 1]);
    const p = new Path2D();
    if (round > 0) smoothInto(p, pts, closed, round * 0.5);
    else { p.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) p.lineTo(pts[i][0], pts[i][1]); if (closed) p.closePath(); }
    return p;
  };
  PC.ribbon = (points, widths) => {
    const n = points.length, L = [], R = [];
    for (let i = 0; i < n; i++) {
      const a = points[Math.max(0, i - 1)], b = points[Math.min(n - 1, i + 1)], dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy) || 1;
      const w = typeof widths === 'function' ? widths(i / (n - 1)) : Array.isArray(widths) ? widths[i] : widths, nx = -dy / len * w, ny = dx / len * w;
      L.push([points[i][0] + nx, points[i][1] + ny]); R.push([points[i][0] - nx, points[i][1] - ny]);
    }
    return PC.smooth([...L, ...R.reverse()], { closed: true, tension: 0.4 });
  };

  // ---------------------------------------------------------------- cut paper
  const scaleOf = g => { const m = g.getTransform(); return Math.sqrt(Math.abs(m.a * m.d - m.b * m.c)) || 1; };
  PC.cut = (g, path, fill, o = {}) => {
    const { shadow = 0, shadowAlpha = 0.3, stroke = null, lw = 3, rim = null, rimW = 3, alpha = 1 } = o;
    g.save(); if (alpha !== 1) g.globalAlpha *= alpha;
    if (shadow > 0) { const s = scaleOf(g); g.shadowColor = PC.rgba(P.shadow, shadowAlpha); g.shadowBlur = shadow * 1.5 * s; g.shadowOffsetX = shadow * 0.35 * s; g.shadowOffsetY = shadow * 0.85 * s; }
    g.fillStyle = fill; g.fill(path); g.shadowColor = 'transparent';
    if (rim) { g.save(); g.clip(path); g.translate(0, rimW * 0.9); g.lineWidth = rimW * 1.6; g.strokeStyle = rim; g.globalAlpha *= 0.7; g.stroke(path); g.restore(); }
    if (stroke) { g.lineWidth = lw; g.strokeStyle = stroke; g.lineJoin = 'round'; g.lineCap = 'round'; g.stroke(path); }
    g.restore();
  };
  PC.shade = (g, path, color, x0, y0, x1, y1, a0 = 0.35, a1 = 0) => {
    g.save(); g.clip(path); const grd = g.createLinearGradient(x0, y0, x1, y1);
    grd.addColorStop(0, PC.rgba(color, a0)); grd.addColorStop(1, PC.rgba(color, a1)); g.fillStyle = grd; g.fill(path); g.restore();
  };
  const stopsOf = s => (typeof s[0] === 'string' ? s.map((c, i) => [i / (s.length - 1 || 1), c]) : s);
  PC.lin = (g, x0, y0, x1, y1, stops) => { const grd = g.createLinearGradient(x0, y0, x1, y1); for (const [o, c] of stopsOf(stops)) grd.addColorStop(clamp(o), c); return grd; };
  PC.rad = (g, x, y, r0, r1, stops) => { const grd = g.createRadialGradient(x, y, r0, x, y, r1); for (const [o, c] of stopsOf(stops)) grd.addColorStop(clamp(o), c); return grd; };
  PC.glow = (g, x, y, r, color, alpha = 1, mode = 'screen') => {
    if (alpha <= 0 || r <= 0) return;
    g.save(); g.globalCompositeOperation = mode; g.globalAlpha *= clamp(alpha);
    g.fillStyle = PC.rad(g, x, y, 0, r, [[0, PC.rgba(color, 1)], [0.35, PC.rgba(color, 0.45)], [1, PC.rgba(color, 0)]]); g.fillRect(x - r, y - r, r * 2, r * 2); g.restore();
  };
  PC.rays = (g, x, y, r, o = {}) => {
    const { n = 12, width = 0.09, rot = 0, color = P.goldLight, alpha = 0.5, r0 = 0, seed = 3, jitter = 0.35 } = o;
    g.save(); g.globalCompositeOperation = 'screen'; g.globalAlpha *= clamp(alpha); g.fillStyle = PC.rad(g, x, y, r0, r, [[0, PC.rgba(color, 0.9)], [1, PC.rgba(color, 0)]]);
    for (let i = 0; i < n; i++) {
      const a = rot + i / n * TAU + (hash2(seed, i) - 0.5) * jitter * (TAU / n), w = width * (0.6 + hash2(seed + 5, i) * 0.8), rr = r * (0.7 + hash2(seed + 9, i) * 0.3);
      g.beginPath(); g.moveTo(x + Math.cos(a) * r0, y + Math.sin(a) * r0); g.lineTo(x + Math.cos(a - w) * rr, y + Math.sin(a - w) * rr); g.lineTo(x + Math.cos(a + w) * rr, y + Math.sin(a + w) * rr); g.closePath(); g.fill();
    }
    g.restore();
  };
  PC.sparkle = (g, x, y, size, o = {}) => {
    if (size <= 0) return;
    g.save(); g.globalAlpha *= clamp(o.alpha ?? 1); g.translate(x, y); g.rotate(o.rot || 0); g.fillStyle = o.color || P.white; g.beginPath();
    for (let i = 0; i < 4; i++) { const a = i / 4 * TAU, b = a + TAU / 8; g.lineTo(Math.cos(a) * size, Math.sin(a) * size); g.lineTo(Math.cos(b) * size * (o.thin ?? 0.22), Math.sin(b) * size * (o.thin ?? 0.22)); }
    g.closePath(); g.fill(); g.restore();
  };
  PC.line = (g, pts, o = {}) => {
    const { seed = 1, amp = 1.2, lw = 4, color = P.ink, dash = null, p = 1, alpha = 1 } = o;
    if (p <= 0 || pts.length < 2) return;
    const jit = pts.map(([x, y], i) => [x + (hash2(seed, i) - 0.5) * amp * 2, y + (hash2(seed + 3, i) - 0.5) * amp * 2]);
    const k = p < 1 ? Math.max(2, Math.ceil(jit.length * p)) : jit.length;
    g.save(); g.globalAlpha *= alpha; g.lineWidth = lw; g.strokeStyle = color; g.lineCap = 'round'; g.lineJoin = 'round'; if (dash) g.setLineDash(dash);
    g.stroke(PC.smooth(jit.slice(0, k), { closed: false })); g.restore();
  };

  // ---------------------------------------------------------------- the multiplane camera
  PC.cam = (x = 960, y = 540, zoom = 1, rot = 0) => ({ x, y, zoom, rot });
  PC.applyCam = (g, c, depth = 1) => {
    const z = 1 + (c.zoom - 1) * depth;
    g.translate(960, 540); if (c.rot) g.rotate(c.rot * depth); g.scale(z, z); g.translate(-(960 + (c.x - 960) * depth), -(540 + (c.y - 540) * depth));
  };
  PC.lerpCam = (a, b, t) => ({ x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t), zoom: a.zoom * Math.pow(b.zoom / a.zoom, t), rot: lerp(a.rot || 0, b.rot || 0, t) });

  // ---------------------------------------------------------------- a jointed paper doll (generic, original)
  // (x, y) = between the feet; s = 1: about 260 px tall, head ~ 100 px (chibi, ~2.6 heads). Faces right; o.face -1 mirrors.
  // o: { skin, hair, hairStyle 'mop' | 'bob' | 'braid' | 'spiky', outfit, outfitDark, trim, eyes 'dot' | 'happy' | 'closed' | 'wide',
  //      mouth 'smile' | 'o' | 'flat' | 'grin', blush, hat ('crown' | 'cap' | 'hood' | null), scarf (colour or null),
  //      walk (phase), jump 0..1, armF / armB (radians: 0 down, + forward), lean, hold(g, s) (prop in the front hand), shadow 12,
  //      t (song time: blinks, scarf flutter) }
  // the doll: cut-paper parts pinned on the generic biped skeleton (core/rig.js). Old options still work (walk, jump,
  // armF, armB, lean, eyes, mouth); new: pose / act / phase / beat / expr / ik / joints / jointsAdd / emote / rigOnly.
  const capsule = (a, b, w0, w1) => {
    const ang = Math.atan2(b[1] - a[1], b[0] - a[0]), p = new Path2D();
    p.arc(b[0], b[1], w1 / 2, ang - Math.PI / 2, ang + Math.PI / 2);
    p.arc(a[0], a[1], w0 / 2, ang + Math.PI / 2, ang + Math.PI * 1.5);
    p.closePath();
    return p;
  };
  PC.capsule = capsule;
  const EMOTE = {
    '!': (g, k) => { PC.cut(g, PC.blob(0, 0, 26 * k, 30 * k, { seed: 5 }), P.white, { stroke: P.ink, lw: 3 }); g.fillStyle = P.red; g.fillRect(-4 * k, -18 * k, 8 * k, 22 * k); g.beginPath(); g.arc(0, 13 * k, 4.5 * k, 0, TAU); g.fill(); },
    '?': (g, k) => { PC.cut(g, PC.blob(0, 0, 26 * k, 30 * k, { seed: 6 }), P.white, { stroke: P.ink, lw: 3 }); g.fillStyle = P.blue; g.font = `700 ${40 * k}px ${PC.FONTS.latin}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('?', 0, 2 * k); },
    heart: (g, k) => { const h = new Path2D(); h.moveTo(0, 18 * k); h.bezierCurveTo(-30 * k, -2 * k, -14 * k, -26 * k, 0, -10 * k); h.bezierCurveTo(14 * k, -26 * k, 30 * k, -2 * k, 0, 18 * k); PC.cut(g, h, P.heart, { stroke: P.ink, lw: 3, rim: P.pink }); },
    spark: (g, k) => PC.sparkle(g, 0, 0, 30 * k, { color: P.gold }),
    sweat: (g, k) => { const d = new Path2D(); d.moveTo(0, -22 * k); d.quadraticCurveTo(14 * k, 2 * k, 0, 12 * k); d.quadraticCurveTo(-14 * k, 2 * k, 0, -22 * k); PC.cut(g, d, P.skyDay, { stroke: P.ink, lw: 3, rim: P.white }); },
    music: (g, k) => { g.fillStyle = P.ink; g.beginPath(); g.ellipse(-6 * k, 10 * k, 9 * k, 7 * k, -0.4, 0, TAU); g.fill(); g.fillRect(1 * k, -22 * k, 4 * k, 32 * k); g.fillRect(1 * k, -22 * k, 16 * k, 5 * k); },
  };
  PC.doll = (g, x, y, s = 1, o = {}) => {
    const RB = Z.rig.biped, seed = o.seed || 1, t = o.t || 0, face = o.face === -1 ? -1 : 1, D = Math.PI / 180;
    let pose = o.pose, phase = o.phase;
    if (!pose) { if (o.walk != null) { pose = o.run ? 'run' : 'walk'; phase = phase ?? o.walk; } else pose = 'idle'; }
    const add = Object.assign({}, o.jointsAdd || {}), joints = Object.assign({}, o.joints || {});
    if (o.armF != null) joints.aF = [o.armF / D, 12, 0];
    if (o.armB != null) joints.aB = [-o.armB / D, 12, 0];
    if (o.lean) add.lean = (add.lean || 0) + o.lean / D;
    if (o.jump) add.lift = (add.lift || 0) - o.jump * 60;
    const sk = RB.solve({ pose, phase, t, act: o.act, beat: o.beat, joints, jointsAdd: add, ik: o.ik, squash: (o.sq || 0) + (o.take || 0), spec: o.spec });
    const W = p => [x + face * s * p[0], y + s * p[1]];
    const an = RB.anchors(sk), anchors = {};
    for (const k in an) anchors[k] = W(an[k]);
    if (o.rigOnly) return anchors;
    const skin = o.skin || P.skin, hair = o.hair || P.woodDark, out = o.outfit || P.blue, outD = o.outfitDark || PC.mix(out, P.ink, 0.35), trim = o.trim || P.gold;
    const legCol = o.legs || outD, shoe = o.shoes || P.woodDark, far = c => PC.mix(c, P.ink, 0.2);
    const flat = o.detail === 0, sil = o.silhouette, lw = flat ? 0 : 3;
    const piece = (path, fill, op = {}) => sil ? (g.fillStyle = sil, g.fill(path)) : PC.cut(g, path, fill, Object.assign({ stroke: flat ? null : P.ink, lw }, op));
    const pin = p => { if (flat || sil || o.pins === false) return; g.fillStyle = P.goldDark; g.beginPath(); g.arc(p[0], p[1], 2.6, 0, TAU); g.fill(); g.fillStyle = P.goldLight; g.beginPath(); g.arc(p[0] - 0.8, p[1] - 0.8, 1.1, 0, TAU); g.fill(); };
    g.save(); g.translate(x, y); g.scale(s * face, s);
    // shadow on the ground (shrinks while airborne)
    const low = Math.max(sk.legs.F.toe[1], sk.legs.F.heel[1], sk.legs.B.toe[1], sk.legs.B.heel[1]), air = Z.clamp(-low / 140);
    const sh = o.shadow ?? 12;
    if (sh && !sil) { g.fillStyle = PC.rgba(P.shadow, 0.22 * (1 - 0.6 * air)); g.beginPath(); g.ellipse(sk.P[0], 2, 56 * (1 - 0.4 * air), 11 * (1 - 0.4 * air), 0, 0, TAU); g.fill(); }
    const leg = (L, col, sc) => {
      piece(capsule(L.hip, L.knee, 22, 20), col); piece(capsule(L.knee, L.ankle, 20, 17), col);
      piece(capsule([L.heel[0], L.heel[1] - 6], [L.toe[0], L.toe[1] - 6], 15, 16), sc);
      pin(L.knee);
    };
    const hand = (A, kind, col) => {
      const h = A.hand;
      if (kind === 'point') { piece(capsule(h, [h[0] + (h[0] - A.wri[0]) * 1.6, h[1] + (h[1] - A.wri[1]) * 1.6], 7, 6), col); piece(PC.blob(h[0], h[1], 9, 9, { seed: seed + 11 }), col); }
      else if (kind === 'open') piece(PC.blob(h[0], h[1], 10.5, 12, { seed: seed + 12, rot: A.ha }), col);
      else piece(PC.blob(h[0], h[1], 9.5, 9.5, { seed: seed + 10 }), col);
    };
    const arm = (A, sleeve, kind, sk2) => { piece(capsule(A.sho, A.elb, 17, 15), sleeve); piece(capsule(A.elb, A.wri, 15, 13), sleeve); hand(A, kind, sk2); pin(A.elb); };
    // far side first, darker
    arm(sk.arms.B, far(outD), sk.J.hB, far(skin));
    leg(sk.legs.B, far(legCol), far(shoe));
    leg(sk.legs.F, legCol, shoe);
    pin(sk.legs.F.hip);
    if (o.scarf && !sil) {
      // behind the torso: the scarf hangs down the back when still and streams out behind with speed (o.vel px/s, or the walk / run itself)
      const N = sk.N, v = Z.clamp((o.vel ?? (pose === 'run' ? 400 : pose === 'walk' ? 150 : 0)) / 400), len = o.scarfLen || 130;
      const pts = [0, 1, 2, 3, 4].map(i => { const q = i / 4, wv = Math.sin(Z.TAU * (0.6 + 0.8 * v) * t - q * 3 + seed) * (3 + 10 * v) * q;
        return [N[0] - 12 - q * len * (0.25 + 0.75 * v), N[1] + 4 + q * len * (0.85 - 0.7 * v) + wv]; });
      piece(PC.ribbon(pts, q => 13 * (1 - q * 0.4)), o.scarf);
    }
    // torso (lean and squash through the skeleton's torso transform)
    const T = sk.T, poly = pts => PC.poly(pts.map(p => T(p[0], p[1])), { seed: seed + 4, amp: 1.2, round: 0.5 });
    const body = poly([[-36, -92], [36, -92], [47, 8], [-47, 8]]);
    piece(body, out, { shadow: sh * 0.4, rim: PC.mix(out, P.white, 0.35) });
    if (!flat && !sil) { PC.shade(g, body, P.ink, ...T(0, -92), ...T(0, 8), 0, 0.25); g.fillStyle = trim; g.fill(poly([[-44, -30], [44, -30], [45, -21], [-45, -21]])); }
    const ikF = (o.ik && o.ik.F) || sk.J.ikF, armUp = RB.handBehindHead(sk) && !['head', 'chin', 'mouth'].includes(ikF);
    if (armUp) arm(sk.arms.F, outD, sk.J.hF, skin);             // a raised near arm passes behind the big head, not across the face
    // head (nods with the neck)
    const [hx, hy] = sk.H;
    g.save(); g.translate(hx, hy); g.rotate(sk.hA);
    const head = PC.blob(0, 0, 52, 48, { seed: seed + 5, amp: 0.02 });
    piece(head, skin, { shadow: sh * 0.5, rim: PC.mix(skin, P.white, 0.5) });
    const hs = o.hairStyle || 'mop';
    const hairPath = hs === 'bob' ? PC.blob(-4, -22, 58, 38, { seed: seed + 6 }) : hs === 'spiky'
      ? PC.poly([[-56, -6], [-46, -50], [-24, -36], [-8, -62], [12, -38], [36, -56], [48, -22], [56, -6], [0, -28]], { seed: seed + 6, round: 0.2 })
      : PC.blob(-6, -30, 56, 30, { seed: seed + 6, amp: 0.06, freq: 7 });
    piece(hairPath, hair, { rim: PC.mix(hair, P.goldLight, 0.3) });
    if (hs === 'braid') piece(PC.ribbon([[-40, 0], [-58, 40], [-60, 80]], q => 13 - q * 4), hair);
    if (!sil) {
      const ex = RB.EXPRS[o.expr || sk.J.expr || 'normal'] || RB.EXPRS.normal;
      const legacyEyes = { dot: 'open', wide: 'wide', happy: 'happy', closed: 'closed' };
      Z.rig.face(g, { x: 0, y: 4, r: 50, dir: 0.75 * (sk.J.yaw ?? 1), ink: P.ink, white: P.white, lw: flat ? 2.5 : 3.4,
        eyes: flat ? 'dot' : o.eyes ? (legacyEyes[o.eyes] || o.eyes) : ex.eyes, brows: flat ? 'none' : o.brows || ex.brows, mouth: o.mouth || ex.mouth,
        blush: o.blush === false || flat ? 0 : ex.blush ? 1 : 0.8, blushCol: P.blush, sweat: ex.sweat, look: o.look || ex.look,
        blink: Math.max(o.blink || 0, Z.rig.blink(t, seed)), mouthCol: '#7A2E3A', tongue: P.heart });
    }
    if (o.hat === 'crown') piece(PC.poly([[-30, -46], [30, -46], [36, -80], [18, -60], [0, -88], [-18, -60], [-36, -80]], { seed: seed + 8, round: 0.15 }), P.gold, { rim: P.goldLight });
    else if (o.hat === 'cap') piece(PC.poly([[-50, -32], [40, -50], [70, -32], [10, -22]], { seed: seed + 8, round: 0.6 }), o.hatCol || P.red);
    else if (o.hat === 'hood') piece(PC.blob(-4, -14, 64, 58, { seed: seed + 8 }), o.hatCol || P.forest);
    g.restore();
    // near arm last (in front of the body), with the held prop
    if (!armUp) arm(sk.arms.F, outD, sk.J.hF, skin);
    pin(sk.arms.F.sho);
    if (o.hold) { g.save(); g.translate(sk.arms.F.hand[0], sk.arms.F.hand[1]); g.rotate(sk.arms.F.ha); o.hold(g, s); g.restore(); }
    if (o.emote && EMOTE[o.emote] && (o.emoteK ?? 1) > 0.01) {
      g.save(); g.translate(sk.H[0] + 44, sk.H[1] - 78); g.scale(face, 1); EMOTE[o.emote](g, o.emoteK ?? 1); g.restore();
    }
    g.restore();
    return anchors;
  };

  // ---------------------------------------------------------------- bursts (confetti, coins, petals): pure functions of t
  PC.burst = (g, t, t0, x, y, o = {}) => {
    const age = t - t0, life = o.life ?? 1.6;
    if (age < 0 || age > life) return;
    const n = o.n ?? 24, cols = o.cols || [P.red, P.gold, P.skyDay, P.pink, P.meadow], kind = o.kind || 'confetti';
    for (let i = 0; i < n; i++) {
      const a = (o.dir ?? -Math.PI / 2) + (hash2(o.seed || 1, i) - 0.5) * (o.spread ?? 2.4), v = (o.speed ?? 700) * (0.4 + 0.6 * hash2((o.seed || 1) + 2, i));
      const px = x + Math.cos(a) * v * age, py = y + Math.sin(a) * v * age + 900 * age * age, k = 1 - age / life;
      g.save(); g.translate(px, py); g.rotate(age * (4 + 6 * hash2((o.seed || 1) + 4, i))); g.globalAlpha *= Math.min(1, k * 3);
      if (kind === 'coin') { g.scale(Math.cos(age * 9 + i), 1); PC.cut(g, PC.blob(0, 0, 13, 13, { seed: i }), P.coin, { stroke: P.coinDark, lw: 2.5, rim: P.goldLight }); }
      else { g.fillStyle = cols[i % cols.length]; g.fillRect(-9, -5, 18, 10); }
      g.restore();
    }
  };

  // ---------------------------------------------------------------- paper fibre texture (built once, deterministic)
  let tex = null;
  PC.texture = () => {
    if (tex) return tex;
    const size = 512, c = Z.canvas(size, size), g = c.getContext('2d'), rnd = Z.rng(7);
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, size, size);
    for (let i = 0; i < 70; i++) {
      const x = rnd() * size, y = rnd() * size, r = 30 + rnd() * 110, a = 0.018 + rnd() * 0.03;
      for (let ox = -1; ox <= 1; ox++) for (let oy = -1; oy <= 1; oy++) { const grd = g.createRadialGradient(x + ox * size, y + oy * size, 0, x + ox * size, y + oy * size, r); grd.addColorStop(0, `rgba(120,95,70,${a})`); grd.addColorStop(1, 'rgba(120,95,70,0)'); g.fillStyle = grd; g.fillRect(x + ox * size - r, y + oy * size - r, r * 2, r * 2); }
    }
    g.lineCap = 'round';
    for (let i = 0; i < 900; i++) {
      const x = rnd() * size, y = rnd() * size, len = 4 + rnd() * 18, ang = rnd() * TAU, dark = rnd() < 0.7;
      g.strokeStyle = dark ? `rgba(90,70,55,${0.05 + rnd() * 0.08})` : `rgba(255,255,255,${0.2 + rnd() * 0.3})`; g.lineWidth = 0.6 + rnd() * 0.9;
      for (let ox = -1; ox <= 1; ox++) for (let oy = -1; oy <= 1; oy++) { const bx = x + ox * size, by = y + oy * size; g.beginPath(); g.moveTo(bx, by); g.quadraticCurveTo(bx + Math.cos(ang + 0.6) * len * 0.5, by + Math.sin(ang + 0.6) * len * 0.5, bx + Math.cos(ang) * len, by + Math.sin(ang) * len); g.stroke(); }
    }
    tex = c; return tex;
  };
})();
