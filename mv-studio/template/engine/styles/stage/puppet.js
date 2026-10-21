/* styles/stage — puppet.js: the troupe. An ORIGINAL default mascot (a round bean puppet with a sprout), painted in
 * watercolour + ink, plus beat-synced dance moves and mood changes. Give each film its own design: colours, the top
 * (sprout / ears / antenna / none), hats, and a cast of differently coloured troupe members.
 *
 *   ST.puppet(x, y, u, o)     (x, y) = the ground point between the feet; u = unit (body ~8.4u wide, ~9u tall).
 *     pose : dy (u, negative = up), sq (squash; negative stretches), rot, flip, sx, sy, aL / aR (arm angles: 0 out,
 *            + up, - down), walk (phase), noShadow
 *     face : eyes  normal | look (+ lookX / lookY -1..1) | happy | closed | wink | star | heart | swirl | x | dot |
 *                  scared | angry | sleepy;  mouth  smile | grin | o | O | flat | wobble | cat;  blush
 *     look : col / dk / lt (body colours), top (sprout | ears | antenna | none), hat (party | crown | top | halo | bow |
 *            flower), emote (sweat | heart | spark | anger | music | ! | ? | zzz) + emoteK 0..1
 *     hooks: draw(u, sw) in body space (body centre (0, -5u)); armL / armR(u, sw) at the hand, for held props
 *   ST.move(style, t, seed)   beat-synced pose offsets: bounce hop sway spin wave roof stomp shimmy walk idle bow mix
 *   ST.dancer(x, y, u, style, t, o)   puppet + move
 *   ST.person(x, y, s, o)     a human on the biped skeleton (core/rig.js): Z.rig.biped poses and expressions, painted
 *                             in watercolour; s = 1 is ~260 px tall (see the function for its options)
 *   ST.mood(t, [[t0, 'normal'], [t1, 'scared', 'sweat'], ...])   never snap faces: eyes squeeze shut, the body does a
 *                             squash "take", the emote pops, the new eyes open. Spread the result into ST.puppet.
 *
 * mv-studio (MIT). Character rig idea after PDoomVideo (no code taken); the design is original to this skill.
 */
(() => {
  'use strict';
  const Z = window.Z, ST = (Z.ST = Z.ST || {}), TAU = Math.PI * 2;
  const P = () => ST.PAL;

  const blob = (u, n = 30) => Array.from({ length: n }, (_, i) => {
    const a = i / n * TAU, cs = Math.cos(a), sn = Math.sin(a), e = 2 / 2.5;
    const x = 4.2 * u * Math.sign(cs) * Math.pow(Math.abs(cs), e) * (sn > 0 ? 1.08 : 0.96), y = -5 * u + 3.6 * u * Math.sign(sn) * Math.pow(Math.abs(sn), e);
    return [x, y];
  });

  ST.puppet = (x, y, u, o = {}) => {
    const c = ST.ctx, pal = P(), ink = pal.ink;
    const dy = (o.dy || 0) * u, sq = (o.sq || 0) + (o.take || 0), sw = Z.clamp(u / 14, 0.45, 2.4), J = u * 0.06;
    const col = o.col || pal.teal, dk = o.dk || ST.mix(col, ink, 0.35), lt = o.lt || ST.mix(col, '#FFFFFF', 0.45);
    if (!o.noShadow) { const f = 1 - Math.min(0.5, Math.abs(o.dy || 0) * 0.06); ST.paint(ST.ell(x, y + u * 0.1, u * 4.6 * f, u * 0.8 * f, 18), { fill: ink, fillOp: 0.3, bleed: 0.25, tex: 0.2, border: 0.1, ink: null }); }
    c.save(); c.translate(x, y + dy); if (o.rot) c.rotate(o.rot);
    c.scale((o.flip ? -1 : 1) * (o.sx ?? 1) * (1 + sq * 0.6), (o.sy ?? 1) * (1 - sq));
    // feet
    [-1.7, 1.7].forEach((fx, i) => {
      let lift = 0;
      if (o.walk != null) { const ph = Math.sin((o.walk + (i ? 0.5 : 0)) * TAU); if (ph > 0) lift = ph * 0.8; }
      ST.paint(ST.ell(fx * u, -0.55 * u - lift * u, 1.25 * u, 0.62 * u, 14, J * 0.5), { wash: dk, ink, sw: sw * 0.8 });
    });
    // arms: a noodle stroke with a mitten
    const arm = (side, a, hook) => {
      c.save(); c.translate(side * 3.7 * u, -4.4 * u); c.rotate(side < 0 ? a : -a);
      const L = 2.7 * u, bend = Math.sin((o.armWob || 0) + side) * 0.25 * u;
      ST.ink([[0, 0], [side * L * 0.5, -bend], [side * L, 0]], sw * 2.4, dk, { curv: 1 });
      ST.paint(ST.ell(side * L, 0, 0.62 * u, 0.58 * u, 12, J * 0.4), { wash: col, ink, sw: sw * 0.7 });
      if (hook) { c.translate(side * L, 0); if (side < 0) c.scale(-1, 1); hook(u, sw); }
      c.restore();
    };
    arm(-1, o.aL ?? 0.25, o.armL); arm(1, o.aR ?? 0.25, o.armR);
    // top (behind the body outline): the design's signature silhouette
    const top = o.top ?? 'sprout';
    if (top === 'sprout') {
      ST.ink([[0, -8.4 * u], [0.25 * u, -9.4 * u], [0.1 * u, -10.2 * u]], sw * 1.2, pal.ink, { curv: 1 });
      ST.paint([[0.1 * u, -10.1 * u], [1.6 * u, -11 * u], [2.4 * u, -10.2 * u], [1.2 * u, -9.6 * u]], { wash: pal.sap, ink, sw: sw * 0.7, curv: 1 });
      ST.paint([[0.1 * u, -10.1 * u], [-1.3 * u, -10.7 * u], [-1.9 * u, -9.9 * u], [-0.8 * u, -9.6 * u]], { wash: ST.mix(pal.sap, '#FFFFFF', 0.25), ink, sw: sw * 0.7, curv: 1 });
    } else if (top === 'ears') {
      for (const s of [-1, 1]) ST.paint([[s * 1.6 * u, -8.2 * u], [s * 3.2 * u, -10.4 * u], [s * 3.6 * u, -7.4 * u]], { wash: col, ink, sw: sw * 0.9, curv: 0.6 });
    } else if (top === 'antenna') {
      ST.ink([[0, -8.5 * u], [0.4 * u, -10.2 * u]], sw * 1.1, ink); ST.paint(ST.ell(0.45 * u, -10.6 * u, 0.6 * u, 0.6 * u, 12), { wash: pal.ochre, ink, sw: sw * 0.7 });
    }
    // body: flat base, a light pool up top, a darker settle along the bottom, ink last
    const body = blob(u);
    ST.paint(body, { wash: col, ink: null, curv: 1 });
    ST.paint(ST.ell(-1.2 * u, -6.9 * u, 2.4 * u, 1.2 * u, 16, J * 2, -0.15), { fill: lt, fillOp: 0.55, bleed: 0.2, tex: 0.7, border: 0.6, ink: null });
    ST.paint(ST.ell(0, -2.6 * u, 3.6 * u, 1.1 * u, 16, J), { fill: dk, fillOp: 0.45, bleed: 0.1, tex: 0.6, border: 0.4, ink: null });
    ST.paint(body, { ink, sw, curv: 1 });
    if (o.blush) for (const bx of [-2.5, 2.5]) ST.paint(ST.ell(bx * u, -4.6 * u, u * 0.75, u * 0.38, 12), { fill: pal.rose, fillOp: 0.6, bleed: 0.2, ink: null });
    eyes(u, o, sw); mouth(u, o.mouth, sw); hat(u, o.hat, sw);
    if (o.draw) o.draw(u, sw);
    c.restore();
    if (o.emote) ST.emote(o.emote, x + (o.flip ? -1 : 1) * 4.8 * u, y + dy - 9.4 * u, u * 0.9, o.emoteK ?? 1);
  };

  function eyes(u, o, sw) {
    const pal = P(), ink = pal.ink, e = o.eyes || 'normal', sqz = Z.clamp(o.squint || 0), lx = (o.lookX || 0) * 0.35 * u, ly = (o.lookY || 0) * 0.3 * u;
    for (const s of [-1, 1]) {
      const ex = s * 1.45 * u, ey = -5.7 * u, h = 0.75 * u * (1 - sqz);
      const kind = e === 'wink' && s > 0 ? 'happy' : e;
      if (kind === 'closed' || h < 0.12 * u) ST.ink([[ex - 0.5 * u, ey], [ex + 0.5 * u, ey + 0.05 * u]], sw * 1.2, ink);
      else if (kind === 'happy') ST.ink([[ex - 0.55 * u, ey + 0.15 * u], [ex, ey - 0.45 * u], [ex + 0.55 * u, ey + 0.15 * u]], sw * 1.2, ink, { curv: 1 });
      else if (kind === 'star') ST.paint(ST.star(ex, ey, 0.75 * u, 0.45, 5), { wash: pal.ochre, ink, sw: sw * 0.6 });
      else if (kind === 'heart') ST.paint(ST.heart(ex, ey, 0.7 * u), { wash: pal.rose, ink, sw: sw * 0.6 });
      else if (kind === 'x') { ST.ink([[ex - 0.45 * u, ey - 0.45 * u], [ex + 0.45 * u, ey + 0.45 * u]], sw, ink); ST.ink([[ex + 0.45 * u, ey - 0.45 * u], [ex - 0.45 * u, ey + 0.45 * u]], sw, ink); }
      else if (kind === 'swirl') ST.ink(Array.from({ length: 14 }, (_, i) => { const a = i * 0.9 * s, r = 0.06 * u * i; return [ex + Math.cos(a) * r, ey + Math.sin(a) * r]; }), sw * 0.8, ink, { curv: 1 });
      else if (kind === 'sleepy') ST.paint([[ex - 0.5 * u, ey], [ex + 0.5 * u, ey], [ex + 0.4 * u, ey + 0.35 * u], [ex - 0.4 * u, ey + 0.35 * u]], { wash: ink, ink: null, curv: 1 });
      else {
        const small = kind === 'dot' || kind === 'scared', rx = (small ? 0.32 : 0.45) * u, ry = (small ? 0.36 : 0.62) * u * (1 - sqz);
        ST.paint(ST.ell(ex + lx, ey + ly, rx, ry, 14), { wash: ink, ink: null });
        if (!small) ST.paint(ST.ell(ex + lx - 0.15 * u, ey + ly - 0.25 * u, 0.15 * u, 0.15 * u, 8), { wash: pal.cream, ink: null });
        if (kind === 'scared') ST.ink([[ex - 0.5 * u, ey - 1.0 * u + s * 0.2 * u], [ex + 0.5 * u, ey - 1.0 * u - s * 0.2 * u]], sw * 0.9, ink);
        if (kind === 'angry') ST.ink([[ex - 0.6 * u, ey - 1.1 * u - s * 0.3 * u], [ex + 0.6 * u, ey - 0.8 * u + s * 0.3 * u]], sw * 1.1, ink);
      }
    }
  }
  function mouth(u, m = 'smile', sw) {
    const pal = P(), ink = pal.ink, y = -4.3 * u;
    if (m === 'smile') ST.ink([[-0.7 * u, y - 0.1 * u], [0, y + 0.4 * u], [0.7 * u, y - 0.1 * u]], sw, ink, { curv: 1 });
    else if (m === 'grin') ST.paint([[-0.9 * u, y - 0.15 * u], [0.9 * u, y - 0.15 * u], [0.5 * u, y + 0.6 * u], [-0.5 * u, y + 0.6 * u]], { wash: '#5A2430', ink, sw: sw * 0.8, curv: 0.5 });
    else if (m === 'o') ST.paint(ST.ell(0, y + 0.1 * u, 0.32 * u, 0.36 * u, 12), { wash: '#5A2430', ink, sw: sw * 0.7 });
    else if (m === 'O') ST.paint(ST.ell(0, y + 0.25 * u, 0.6 * u, 0.75 * u, 16), { wash: '#5A2430', ink, sw: sw * 0.8 });
    else if (m === 'flat') ST.ink([[-0.55 * u, y + 0.1 * u], [0.55 * u, y + 0.1 * u]], sw, ink);
    else if (m === 'wobble') ST.ink(Array.from({ length: 7 }, (_, i) => [(-0.75 + i * 0.25) * u, y + 0.1 * u + (i % 2 ? -0.16 : 0.16) * u]), sw * 0.9, ink, { curv: 1 });
    else if (m === 'cat') ST.ink([[-0.7 * u, y], [-0.35 * u, y + 0.35 * u], [0, y], [0.35 * u, y + 0.35 * u], [0.7 * u, y]], sw, ink, { curv: 1 });
  }
  function hat(u, h, sw) {
    if (!h) return;
    const pal = P(), ink = pal.ink, top = -8.3 * u;
    if (h === 'party') { ST.paint([[-1.4 * u, top + 0.3 * u], [1.4 * u, top + 0.3 * u], [0.2 * u, top - 3.2 * u]], { wash: pal.rose, hatch: { d: u * 0.7, a: -0.5, c: pal.cream, w: sw * 2, op: 0.9 }, ink, sw: sw * 0.8 }); ST.paint(ST.ell(0.2 * u, top - 3.3 * u, 0.4 * u, 0.4 * u, 10), { wash: pal.ochre, ink, sw: sw * 0.6 }); }
    else if (h === 'crown') ST.paint([[-1.8 * u, top + 0.4 * u], [1.8 * u, top + 0.4 * u], [1.9 * u, top - 1.6 * u], [0.9 * u, top - 0.6 * u], [0, top - 1.9 * u], [-0.9 * u, top - 0.6 * u], [-1.9 * u, top - 1.6 * u]], { wash: pal.gold, fill: pal.ochre, fillOp: 0.5, tex: 0.6, ink, sw: sw * 0.8 });
    else if (h === 'top') { ST.paint(ST.rect(-1.5 * u, top - 2.6 * u, 3 * u, 2.7 * u, u * 0.04), { wash: pal.ink, ink: null }); ST.paint(ST.rect(-2.4 * u, top - 0.1 * u, 4.8 * u, 0.5 * u, u * 0.03), { wash: pal.ink, ink: null }); ST.paint(ST.rect(-1.5 * u, top - 0.8 * u, 3 * u, 0.45 * u), { wash: pal.crimson, ink: null }); }
    else if (h === 'halo') ST.ink(ST.ell(0, top - 1.2 * u, 2 * u, 0.5 * u, 20), sw * 1.4, pal.gold, { closed: true });
    else if (h === 'bow') { for (const s of [-1, 1]) ST.paint([[0, top + 0.2 * u], [s * 1.8 * u, top - 0.8 * u], [s * 1.8 * u, top + 1.0 * u]], { wash: pal.rose, ink, sw: sw * 0.7, curv: 0.6 }); ST.paint(ST.ell(0, top + 0.1 * u, 0.45 * u, 0.45 * u, 10), { wash: pal.crimson, ink, sw: sw * 0.6 }); }
    else if (h === 'flower') { for (let i = 0; i < 5; i++) { const a = i / 5 * TAU; ST.paint(ST.ell(2 * u + Math.cos(a) * 0.6 * u, top + 0.6 * u + Math.sin(a) * 0.6 * u, 0.5 * u, 0.5 * u, 10), { wash: pal.cream, ink, sw: sw * 0.5 }); } ST.paint(ST.ell(2 * u, top + 0.6 * u, 0.35 * u, 0.35 * u, 8), { wash: pal.ochre, ink: null }); }
  }

  ST.emote = (kind, x, y, s, k = 1) => {
    if (k <= 0.01) return;
    const c = ST.ctx, pal = P(), ink = pal.ink, sw = Z.clamp(s / 14, 0.5, 2), q = Z.ease.outBack(Z.clamp(k), 2);
    c.save(); c.translate(x, y); c.scale(q, q);
    if (kind === 'sweat') ST.paint([[0, -1.6 * s], [0.9 * s, 0.2 * s], [0, 1 * s], [-0.9 * s, 0.2 * s]], { wash: pal.sky, ink, sw, curv: 1 });
    else if (kind === 'heart') ST.paint(ST.heart(0, 0, 1.4 * s), { wash: pal.rose, ink, sw });
    else if (kind === 'spark') for (let i = 0; i < 3; i++) ST.paint(ST.star((i - 1) * 1.3 * s, (i % 2 ? -0.8 : 0.4) * s, (i % 2 ? 0.6 : 0.9) * s, 0.35, 4), { wash: pal.ochre, ink, sw: sw * 0.7 });
    else if (kind === 'anger') for (const a of [0, 1, 2, 3]) { c.save(); c.rotate(a * Math.PI / 2); ST.ink([[0.3 * s, 0.9 * s], [0.4 * s, 0.4 * s], [0.9 * s, 0.3 * s]], sw * 1.3, pal.crimson, { curv: 1 }); c.restore(); }
    else if (kind === 'music') { ST.paint(ST.ell(-0.5 * s, 0.6 * s, 0.55 * s, 0.42 * s, 10), { wash: ink, ink: null }); ST.ink([[0, 0.5 * s], [0, -1.4 * s], [0.9 * s, -1.0 * s]], sw * 1.2, ink); }
    else if (kind === 'zzz') ['z', 'z', 'Z'].forEach((z, i) => ST.letter(z, i * 0.8 * s, -i * 0.9 * s, (0.9 + i * 0.3) * s, pal.indigo, { ink: false }));
    else ST.letter(kind, 0, 0, 2.2 * s, kind === '?' ? pal.indigo : pal.crimson, { rot: -0.1 });
    c.restore();
  };

  // ---------------------------------------------------------------- beat-synced dance moves (pure functions of t)
  ST.move = (style, t, seed = 0) => {
    const C = Z.clock, b = C.beat(t), p = C.phase(t), hit = C.pulse(t, 7), up = Math.sin(Math.PI * p);
    const alt = ((b + seed) % 2 + 2) % 2 ? 1 : -1;
    if (style === 'mix') style = ['bounce', 'hop', 'sway', 'roof', 'wave', 'shimmy', 'spin', 'stomp'][((Math.floor((C.bar(t) + seed) / 2) % 8) + 8) % 8];   // a new move every 2 bars
    switch (style) {
      case 'bounce': return { dy: -0.7 * up, sq: 0.14 * hit - 0.06 * up, aL: 0.4 + 0.5 * up, aR: 0.4 + 0.5 * up };
      case 'hop': return b % 2 ? { dy: -2.2 * up, sq: -0.1 * up + 0.15 * hit, aL: 1.2 * up, aR: 1.2 * up } : { sq: 0.18 * hit, aL: -0.3, aR: -0.3 };
      case 'sway': return { rot: 0.14 * Math.sin(Math.PI * (b + p)), dy: -0.3 * up, aL: 0.3 + 0.6 * (alt > 0 ? up : 0), aR: 0.3 + 0.6 * (alt < 0 ? up : 0) };
      case 'spin': {                                                    // a quick turn on every odd beat, holding the new facing
        const face = n => ((Math.floor((n + 1) / 2) % 2) ? -1 : 1), q = Math.cos(Math.PI * Z.ease.inOutSine(Z.clamp(p / 0.35)));
        const sx = b % 2 ? face(b - 1) * Math.sign(q || 1) * Math.max(0.25, Math.abs(q)) : face(b);
        return { sx, dy: -0.5 * up, aL: 0.8, aR: 0.8 };
      }
      case 'wave': return { aR: 1.3 + 0.45 * Math.sin(p * Math.PI * 4), aL: -0.2, dy: -0.25 * up, rot: -0.05 };
      case 'roof': return { aL: 1.6 + 0.4 * up, aR: 1.6 + 0.4 * up, dy: -0.9 * up, sq: 0.12 * hit };
      case 'stomp': return { sq: 0.24 * hit, rot: alt * 0.08 * hit, aL: alt > 0 ? 1.0 : -0.4, aR: alt < 0 ? 1.0 : -0.4 };
      case 'shimmy': return { rot: 0.1 * Math.sin(p * Math.PI * 4), sx: 1 + 0.06 * Math.sin(p * Math.PI * 8), aL: 0.6, aR: 0.6 };
      case 'walk': return { walk: (b + p) / 2, dy: -0.2 * Math.abs(Math.sin(Math.PI * 2 * p)) };
      case 'bow': return { rot: 0.45, aL: -0.9, aR: -0.9, eyes: 'happy' };
      default: return { sq: 0.03 * Math.sin(t * 2.4 + seed), aL: 0.2, aR: 0.2 };              // idle: breathing
    }
  };
  ST.dancer = (x, y, u, style, t, o = {}) => ST.puppet(x, y, u, Object.assign({}, ST.move(style, t, o.seed || 0), o));

  // ---------------------------------------------------------------- mood changes: blink, take, emote, new face
  ST.mood = (t, keys) => {
    let i = -1;
    for (let k = 0; k < keys.length; k++) if (t >= keys[k][0]) i = k;
    if (i < 0) return { eyes: keys[0][1] };
    const [t0, eyes, emote] = keys[i], dt = t - t0;
    const out = { eyes, emote, emoteK: emote ? Z.clamp((dt - 0.1) / 0.2) * (1 - Z.smooth(1.2, 1.6, dt)) : 0 };
    if (i > 0 && dt < 0.22) { out.squint = 1 - Math.abs(dt - 0.08) / 0.14; out.take = 0.14 * Math.sin(Z.clamp(dt / 0.22) * Math.PI); if (dt < 0.08) out.eyes = keys[i - 1][1]; }
    return out;
  };

  // ---------------------------------------------------------------- a human for the troupe, on the biped skeleton
  // ST.person(x, y, s, o) -> anchors: (x, y) between the feet, s = 1 is ~260 px. The same options as PC.doll for the rig
  // (pose / act / phase / beat / expr / ik / joints / jointsAdd / face / emote + emoteK / blink / take / hold / rigOnly),
  // painted in watercolour + boiling ink: skin, hair, hairStyle (scribble | bun | short), coat, coatDk, pants, shoes,
  // glasses, bowtie. An ORIGINAL generic design: give each film its own human.
  const capPts = (a, b, w0, w1, n = 5) => {
    const ang = Math.atan2(b[1] - a[1], b[0] - a[0]), pts = [];
    for (let i = 0; i <= n; i++) { const q = -Math.PI / 2 + Math.PI * i / n; pts.push([b[0] + Math.cos(ang + q) * w1 / 2, b[1] + Math.sin(ang + q) * w1 / 2]); }
    for (let i = 0; i <= n; i++) { const q = Math.PI / 2 + Math.PI * i / n; pts.push([a[0] + Math.cos(ang + q) * w0 / 2, a[1] + Math.sin(ang + q) * w0 / 2]); }
    return pts;
  };
  ST.capPts = capPts;
  ST.person = (x, y, s = 1, o = {}) => {
    const c = ST.ctx, pal = P(), ink = pal.ink, RB = Z.rig.biped, t = o.t ?? ST.t ?? 0, seed = o.seed || 2, face = o.flip || o.face === -1 ? -1 : 1;
    const sk = RB.solve({ pose: o.pose || (o.walk != null ? 'walk' : 'idle'), phase: o.phase ?? o.walk, t, act: o.act, beat: o.beat, joints: o.joints, jointsAdd: o.jointsAdd, ik: o.ik, squash: (o.sq || 0) + (o.take || 0), spec: o.spec });
    const an = RB.anchors(sk), anchors = {};
    for (const k in an) anchors[k] = [x + face * s * an[k][0], y + s * an[k][1]];
    if (o.rigOnly) return anchors;
    const skin = o.skin || pal.peach, hair = o.hair || pal.woodDk, coat = o.coat || pal.cream, coatDk = o.coatDk || ST.mix(coat, ink, 0.25), pants = o.pants || pal.indigo, shoes = o.shoes || pal.woodDk;
    const far = col => ST.mix(col, ink, 0.18), sw = Z.clamp(s * 1.1, 0.5, 2.2), J = 0.6;
    c.save(); c.translate(x, y); c.scale(s * face, s);
    if (!o.noShadow) { const low = Math.max(sk.legs.F.toe[1], sk.legs.B.toe[1]), air = Z.clamp(-low / 140); ST.paint(ST.ell(sk.P[0], 2, 50 * (1 - 0.4 * air), 9, 16), { fill: ink, fillOp: 0.3 * (1 - 0.5 * air), bleed: 0.25, tex: 0.2, border: 0.2, ink: null }); }
    const leg = (L, pc, sc) => {
      ST.paint(capPts(L.hip, L.knee, 20, 18), { wash: pc, ink, sw: sw * 0.8 });
      ST.paint(capPts(L.knee, L.ankle, 18, 15), { wash: pc, ink, sw: sw * 0.8 });
      ST.paint(capPts([L.heel[0], L.heel[1] - 5], [L.toe[0] + 3, L.toe[1] - 5], 14, 15), { wash: sc, ink, sw: sw * 0.8 });
    };
    const hand = (A, kind, col) => {
      const h = A.hand;
      if (kind === 'point') ST.ink([h, [h[0] + (h[0] - A.wri[0]) * 1.8, h[1] + (h[1] - A.wri[1]) * 1.8]], sw * 2.2, col);
      ST.paint(ST.ell(h[0], h[1], kind === 'open' ? 10 : 8.5, kind === 'open' ? 11 : 8.5, 12, J * 0.5), { wash: col, ink, sw: sw * 0.7 });
    };
    const arm = (A, sleeve, kind, sc) => { ST.paint(capPts(A.sho, A.elb, 16, 14), { wash: sleeve, ink, sw: sw * 0.8 }); ST.paint(capPts(A.elb, A.wri, 14, 12), { wash: sleeve, ink, sw: sw * 0.8 }); hand(A, kind, sc); };
    arm(sk.arms.B, far(coatDk), sk.J.hB, far(skin));
    leg(sk.legs.B, far(pants), far(shoes));
    leg(sk.legs.F, pants, shoes);
    // the coat: a flat wash, a light pool, a settle of shade along the hem, ink last (as the troupe is painted)
    const T = sk.T, body = [[-30, -92], [30, -92], [40, -30], [48, 22], [-48, 22], [-38, -30]].map(p => T(p[0], p[1]));
    ST.paint(body, { wash: coat, ink: null, curv: 0.5 });
    ST.paint([[-26, -86], [18, -86], [10, -50], [-22, -50]].map(p => T(p[0], p[1])), { fill: ST.mix(coat, '#FFFFFF', 0.4), fillOp: 0.5, bleed: 0.2, tex: 0.6, border: 0.5, ink: null, curv: 1 });
    ST.paint([[-46, 6], [46, 6], [48, 22], [-48, 22]].map(p => T(p[0], p[1])), { fill: coatDk, fillOp: 0.45, bleed: 0.1, tex: 0.6, border: 0.4, ink: null });
    ST.paint(body, { ink, sw, curv: 0.5 });
    ST.ink([T(2, -88), T(4, -20), T(6, 20)], sw * 0.8, coatDk);                         // the coat's front edge
    if (o.bowtie) { const b = T(8, -88); ST.paint([[b[0] - 12, b[1] - 7], [b[0], b[1]], [b[0] - 12, b[1] + 7]], { wash: o.bowtie, ink, sw: sw * 0.6 }); ST.paint([[b[0] + 12, b[1] - 7], [b[0], b[1]], [b[0] + 12, b[1] + 7]], { wash: o.bowtie, ink, sw: sw * 0.6 }); }
    const ikF = (o.ik && o.ik.F) || sk.J.ikF, armUp = RB.handBehindHead(sk) && !['head', 'chin', 'mouth'].includes(ikF);
    if (armUp) arm(sk.arms.F, coatDk, sk.J.hF, skin);
    // head
    c.save(); c.translate(sk.H[0], sk.H[1]); c.rotate(sk.hA);
    const hs = o.hairStyle || 'scribble';
    if (hs === 'bun') ST.paint(ST.ell(-30, -40, 20, 20, 14, J), { wash: hair, ink, sw: sw * 0.8 });
    ST.paint(ST.ell(0, 0, 50, 47, 24, J), { wash: skin, ink, sw });
    ST.paint(ST.ell(16, 22, 30, 12, 14, J), { fill: ST.mix(skin, pal.rose, 0.5), fillOp: 0.35, bleed: 0.3, tex: 0.4, ink: null });
    if (hs === 'scribble') ST.ink(Array.from({ length: 26 }, (_, i) => { const a = Math.PI * (1.02 + i * 0.95 / 25) + Math.sin(i * 2.7) * 0.06, r = 50 + 10 * Math.sin(i * 1.9 + seed); return [Math.cos(a) * r, Math.sin(a) * r - 8]; }), sw * 4, hair, { curv: 1 });
    else ST.paint([[-50, -6], [-44, -36], [-18, -54], [18, -54], [44, -36], [50, -14], [30, -26], [0, -30], [-30, -22]], { wash: hair, ink, sw: sw * 0.8, curv: 1 });
    const ex = RB.EXPRS[o.expr || sk.J.expr || 'normal'] || RB.EXPRS.normal;
    c.save(); c.translate(ST.jit(0.8), ST.jit(0.8));                               // the face boils with the line
    Z.rig.face(c, { x: 0, y: 4, r: 50, dir: 0.7 * (sk.J.yaw ?? 1), ink, white: pal.cream, lw: 3.2, eyes: o.eyes || ex.eyes, brows: o.brows || ex.brows, mouth: o.mouth || ex.mouth,
      blush: o.blush === false ? 0 : ex.blush ? 1 : 0.6, blushCol: pal.rose, sweat: ex.sweat, sweatCol: pal.sky, look: o.look || ex.look, blink: Math.max(o.blink || 0, Z.rig.blink(t, seed)), mouthCol: '#5A2430', tongue: pal.rose });
    c.restore();
    if (o.glasses) for (const gx of [-4, 30]) ST.ink(ST.ell(gx, 4, 15, 13, 18), sw * 0.9, ink, { closed: true });
    c.restore();
    if (!armUp) arm(sk.arms.F, coatDk, sk.J.hF, skin);
    if (o.hold) { c.save(); c.translate(sk.arms.F.hand[0], sk.arms.F.hand[1]); c.rotate(sk.arms.F.ha); o.hold(s, sw); c.restore(); }
    c.restore();
    if (o.emote) ST.emote(o.emote, anchors.head[0] + face * 60 * s, anchors.head[1] - 70 * s, 14 * s, o.emoteK ?? 1);
    return anchors;
  };
})();
