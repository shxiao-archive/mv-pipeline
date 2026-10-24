/* styles/stage — puppet.js: the troupe. An ORIGINAL default puppet — a gumdrop-shaped felt puppet (narrow crown, wide
 * seated base, stub legs, noodle arms) — painted in watercolour + ink, plus beat-synced dance moves and mood changes.
 * Give each film its own design: colours, the top (sprout / ears / antenna / none), hats, and a cast of differently
 * coloured troupe members. Never draw an existing mascot with it.
 *
 *   ST.puppet(x, y, u, o)     (x, y) = the ground point between the feet; u = unit (body ~8.6u wide, ~9u tall).
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
 *   ST.mood(t, [[t0, 'normal'], [t1, 'scared', 'sweat'], ...])   faces never snap: a blink closes the old face, the
 *                             body squashes and rebounds (the "take"), the emote springs in, the new eyes open. Spread the
 *                             result into ST.puppet.
 *
 * mv-studio (MIT). The puppet design, its rig and its moves are this kit's own.
 */
(() => {
  'use strict';
  const Z = window.Z, ST = (Z.ST = Z.ST || {}), TAU = Math.PI * 2;
  const P = () => ST.PAL;

  // the gumdrop: half-width along the height, widest a little below the middle, a flattened seat
  const body = u => {
    const right = [], N = 12;
    for (let i = 0; i <= N; i++) {
      const v = i / N, w = 4.3 * u * Math.pow(Math.sin(Math.PI * (0.08 + 0.84 * v)), 0.55) * (0.6 + 0.4 * v);
      right.push([w, -9 * u + v * 8.6 * u]);
    }
    const seat = [[2.2 * u, -0.25 * u], [0, -0.1 * u], [-2.2 * u, -0.25 * u]];
    return right.concat(seat, right.slice().reverse().map(([x, y]) => [-x, y]));
  };
  const halfW = (u, y) => { const v = Z.clamp((y + 9 * u) / (8.6 * u)); return 4.3 * u * Math.pow(Math.sin(Math.PI * (0.08 + 0.84 * v)), 0.55) * (0.6 + 0.4 * v); };

  ST.puppet = (x, y, u, o = {}) => {
    const c = ST.ctx, pal = P(), ink = pal.ink;
    const dy = (o.dy || 0) * u, sq = (o.sq || 0) + (o.take || 0), sw = Z.clamp(u / 13, 0.45, 2.4), J = u * 0.05;
    const col = o.col || pal.teal, dk = o.dk || ST.mix(col, ink, 0.32), lt = o.lt || ST.mix(col, '#FFFFFF', 0.4);
    if (!o.noShadow) {                                                         // the shadow stays on the floor and thins as it rises
      const air = Z.clamp(-(o.dy || 0) / 6);
      ST.paint(ST.ell(x, y + u * 0.15, u * (4.4 - 1.6 * air), u * (0.7 - 0.25 * air), 18), { fill: ink, fillOp: 0.28 * (1 - 0.55 * air), bleed: 0.2, tex: 0.2, border: 0, ink: null });
    }
    c.save(); c.translate(x, y + dy); if (o.rot) c.rotate(o.rot);
    c.scale((o.flip ? -1 : 1) * (o.sx ?? 1) * (1 + sq * 0.55), (o.sy ?? 1) * (1 - sq));
    // stub legs: short rounded columns under the seat
    for (const [side, ph] of [[-1, 0], [1, 0.5]]) {
      const lift = o.walk != null ? Math.max(0, Math.sin((o.walk + ph) * TAU)) * 0.9 * u : 0, lx = side * 1.5 * u;
      ST.paint(ST.rr(lx - 0.8 * u, -0.9 * u - lift, 1.6 * u, 1.05 * u, 0.5 * u, J * 0.4), { wash: dk, ink, sw: sw * 0.8 });
    }
    c.save(); c.translate(0, -0.55 * u);                                       // the body sits on its legs
    // noodle arms with round hands, hung from the body's sides
    const arm = (side, a, hook) => {
      const sy = -4.2 * u, sx = side * (halfW(u, sy) - 0.2 * u);
      c.save(); c.translate(sx, sy); c.rotate(side < 0 ? a : -a);
      const L = 2.9 * u, sag = 0.35 * u * Math.cos((o.armWob || 0) + side);
      ST.ink([[0, 0], [side * L * 0.45, sag], [side * L, 0]], sw * 2.2, dk, { curv: 1 });
      ST.paint(ST.ell(side * L, 0, 0.55 * u, 0.55 * u, 12, J * 0.4), { wash: lt, ink, sw: sw * 0.7 });
      if (hook) { c.setTransform(c.getTransform().translate(side * L, 0).scale(side, 1)); hook(u, sw); }   // hand space, mirrored on the left
      c.restore();
    };
    for (const side of [-1, 1]) arm(side, (side < 0 ? o.aL : o.aR) ?? 0.2, side < 0 ? o.armL : o.armR);
    // the top: drawn behind the crown so the body's outline sits over its root
    const top = o.top ?? 'sprout', crown = -9 * u;
    if (top === 'sprout') {                                                    // one curled leaf on a short stalk
      ST.ink([[0, crown + 0.3 * u], [-0.2 * u, crown - 0.8 * u], [0.3 * u, crown - 1.5 * u]], sw * 1.1, ink, { curv: 1 });
      ST.paint([[0.3 * u, crown - 1.5 * u], [1.4 * u, crown - 2.6 * u], [2.6 * u, crown - 2.2 * u], [2.2 * u, crown - 1.2 * u], [1.0 * u, crown - 1.1 * u]], { wash: pal.sap, ink, sw: sw * 0.7, curv: 1 });
      ST.ink([[0.6 * u, crown - 1.45 * u], [2.0 * u, crown - 1.9 * u]], sw * 0.5, ST.mix(pal.sap, ink, 0.4));
    } else if (top === 'ears') {                                               // two rounded felt ears
      for (const s of [-1, 1]) ST.paint(ST.ell(s * 1.7 * u, crown + 0.2 * u, 0.95 * u, 1.5 * u, 16, J * 0.3, s * 0.35), { wash: col, ink, sw: sw * 0.85 });
    } else if (top === 'antenna') {                                            // a coiled wire with a bead
      ST.ink(Array.from({ length: 8 }, (_, i) => [Math.sin(i * 1.4) * 0.35 * u, crown + 0.3 * u - i * 0.28 * u]), sw * 0.9, ink, { curv: 1 });
      ST.paint(ST.ell(0, crown - 2.0 * u, 0.5 * u, 0.5 * u, 12), { wash: pal.ochre, ink, sw: sw * 0.7 });
    }
    // the body: flat felt colour, a lit patch high on the left, a shade pooled in the seat, ink last
    const B = body(u);
    ST.paint(B, { wash: col, ink: null, curv: 1 });
    ST.paint(ST.ell(-1.4 * u, -6.6 * u, 1.9 * u, 1.5 * u, 16, J * 1.5, 0.3), { fill: lt, fillOp: 0.5, bleed: 0.18, tex: 0.6, border: 0.4, ink: null });
    ST.paint(ST.ell(0.3 * u, -1.6 * u, 3.9 * u, 1.3 * u, 18, J), { fill: dk, fillOp: 0.42, bleed: 0.1, tex: 0.6, border: 0.3, ink: null });
    ST.paint(B, { ink, sw, curv: 1 });
    if (o.blush) for (const bx of [-2.3, 2.3]) ST.paint(ST.ell(bx * u, -4.9 * u, 0.7 * u, 0.36 * u, 12), { fill: pal.rose, fillOp: 0.55, bleed: 0.2, ink: null });
    eyes(u, o, sw); mouth(u, o.mouth, sw); hat(u, o.hat, sw);
    if (o.draw) o.draw(u, sw);
    c.restore(); c.restore();
    if (o.emote) ST.emote(o.emote, x + (o.flip ? -1 : 1) * 4.6 * u, y + dy - 10.5 * u, u * 0.9, o.emoteK ?? 1);
  };

  function eyes(u, o, sw) {
    const pal = P(), ink = pal.ink, e = o.eyes || 'normal', sqz = Z.clamp(o.squint || 0), lx = (o.lookX || 0) * 0.3 * u, ly = (o.lookY || 0) * 0.28 * u;
    for (const s of [-1, 1]) {
      const ex = s * 1.35 * u, ey = -6.0 * u, kind = e === 'wink' && s > 0 ? 'happy' : e;
      if (kind === 'closed' || sqz > 0.85) ST.ink([[ex - 0.45 * u, ey + 0.05 * u], [ex, ey + 0.2 * u], [ex + 0.45 * u, ey + 0.05 * u]], sw * 1.1, ink, { curv: 1 });
      else if (kind === 'happy') ST.ink([[ex - 0.5 * u, ey + 0.2 * u], [ex - 0.1 * u, ey - 0.35 * u], [ex + 0.5 * u, ey + 0.2 * u]], sw * 1.15, ink, { curv: 1 });
      else if (kind === 'star') ST.paint(ST.star(ex, ey, 0.7 * u, 0.48, 5, -Math.PI / 2 + s * 0.2), { wash: pal.ochre, ink, sw: sw * 0.6 });
      else if (kind === 'heart') ST.paint(ST.heart(ex, ey, 0.65 * u), { wash: pal.rose, ink, sw: sw * 0.6 });
      else if (kind === 'x') for (const d of [-1, 1]) ST.ink([[ex - 0.4 * u, ey - d * 0.4 * u], [ex + 0.4 * u, ey + d * 0.4 * u]], sw * 0.95, ink);
      else if (kind === 'swirl') ST.ink(Array.from({ length: 16 }, (_, i) => { const a = -i * 0.75 * s, r = 0.05 * u * i; return [ex + Math.cos(a) * r, ey + Math.sin(a) * r]; }), sw * 0.75, ink, { curv: 1 });
      else if (kind === 'sleepy') { ST.paint(ST.ell(ex, ey + 0.15 * u, 0.42 * u, 0.22 * u, 12), { wash: ink, ink: null }); ST.ink([[ex - 0.5 * u, ey - 0.05 * u], [ex + 0.5 * u, ey - 0.05 * u]], sw * 0.9, ink); }
      else {
        const small = kind === 'dot' || kind === 'scared', rx = (small ? 0.28 : 0.42) * u, ry = (small ? 0.32 : 0.58) * u * (1 - sqz);
        ST.paint(ST.ell(ex + lx, ey + ly, rx, ry, 14), { wash: ink, ink: null });
        if (!small) ST.paint(ST.ell(ex + lx + 0.12 * u, ey + ly - 0.22 * u, 0.13 * u, 0.13 * u, 8), { wash: pal.cream, ink: null });
        if (kind === 'scared') ST.ink([[ex - 0.45 * u, ey - 0.95 * u], [ex + 0.45 * u, ey - 0.8 * u - s * 0.25 * u]], sw * 0.85, ink);
        if (kind === 'angry') ST.ink([[ex - s * 0.6 * u, ey - 1.05 * u], [ex + s * 0.5 * u, ey - 0.7 * u]], sw * 1.1, ink);
      }
    }
  }
  function mouth(u, m = 'smile', sw) {
    const pal = P(), ink = pal.ink, y = -4.5 * u, inside = '#5C2633';
    if (m === 'smile') ST.ink([[-0.65 * u, y], [-0.2 * u, y + 0.38 * u], [0.3 * u, y + 0.36 * u], [0.65 * u, y - 0.05 * u]], sw, ink, { curv: 1 });
    else if (m === 'grin') { ST.paint([[-0.85 * u, y - 0.1 * u], [0.85 * u, y - 0.1 * u], [0.3 * u, y + 0.65 * u], [-0.3 * u, y + 0.65 * u]], { wash: inside, ink, sw: sw * 0.8, curv: 1 }); ST.paint(ST.ell(0, y + 0.45 * u, 0.3 * u, 0.14 * u, 10), { wash: pal.rose, ink: null }); }
    else if (m === 'o') ST.paint(ST.ell(0, y + 0.15 * u, 0.3 * u, 0.34 * u, 12), { wash: inside, ink, sw: sw * 0.7 });
    else if (m === 'O') ST.paint(ST.ell(0, y + 0.3 * u, 0.55 * u, 0.72 * u, 16), { wash: inside, ink, sw: sw * 0.8 });
    else if (m === 'flat') ST.ink([[-0.5 * u, y + 0.15 * u], [0.5 * u, y + 0.1 * u]], sw, ink);
    else if (m === 'wobble') ST.ink(Array.from({ length: 8 }, (_, i) => [(-0.7 + i * 0.2) * u, y + 0.15 * u + Math.sin(i * 2.2) * 0.14 * u]), sw * 0.9, ink, { curv: 1 });
    else if (m === 'cat') ST.ink([[-0.65 * u, y + 0.05 * u], [-0.32 * u, y + 0.32 * u], [0, y + 0.05 * u], [0.32 * u, y + 0.32 * u], [0.65 * u, y + 0.05 * u]], sw, ink, { curv: 1 });
  }
  function hat(u, h, sw) {
    if (!h) return;
    const pal = P(), ink = pal.ink, top = -8.8 * u;
    if (h === 'party') { ST.paint([[-1.2 * u, top + 0.5 * u], [1.3 * u, top + 0.4 * u], [-0.3 * u, top - 3.0 * u]], { wash: pal.teal, hatch: { d: u * 0.6, a: 0.6, c: pal.cream, w: sw * 1.8, op: 0.85 }, ink, sw: sw * 0.8 }); ST.paint(ST.star(-0.3 * u, top - 3.1 * u, 0.5 * u, 0.5, 5), { wash: pal.ochre, ink, sw: sw * 0.6 }); }
    else if (h === 'crown') ST.paint([[-1.7 * u, top + 0.6 * u], [1.7 * u, top + 0.6 * u], [1.6 * u, top - 1.2 * u], [0.8 * u, top - 0.3 * u], [0, top - 1.5 * u], [-0.8 * u, top - 0.3 * u], [-1.6 * u, top - 1.2 * u]], { wash: pal.gold, fill: pal.ochre, fillOp: 0.45, tex: 0.5, ink, sw: sw * 0.8 });
    else if (h === 'top') { ST.paint(ST.rr(-1.3 * u, top - 2.4 * u, 2.6 * u, 2.6 * u, 0.25 * u, u * 0.03), { wash: pal.night, ink, sw: sw * 0.6 }); ST.paint(ST.rr(-2.2 * u, top + 0.05 * u, 4.4 * u, 0.55 * u, 0.25 * u), { wash: pal.night, ink, sw: sw * 0.6 }); ST.paint(ST.rect(-1.3 * u, top - 0.65 * u, 2.6 * u, 0.4 * u), { wash: pal.rose, ink: null }); }
    else if (h === 'halo') ST.ink(ST.ell(0, top - 1.0 * u, 1.9 * u, 0.45 * u, 22), sw * 1.3, pal.gold, { closed: true });
    else if (h === 'bow') { for (const s of [-1, 1]) ST.paint(ST.ell(s * 1.0 * u, top + 0.3 * u, 1.0 * u, 0.62 * u, 14, 0, s * 0.3), { wash: pal.rose, ink, sw: sw * 0.7 }); ST.paint(ST.ell(0, top + 0.3 * u, 0.38 * u, 0.42 * u, 10), { wash: pal.crimson, ink, sw: sw * 0.6 }); }
    else if (h === 'flower') { const fx = 1.9 * u, fy = top + 0.9 * u; for (let i = 0; i < 6; i++) { const a = i / 6 * TAU + 0.3; ST.paint(ST.ell(fx + Math.cos(a) * 0.55 * u, fy + Math.sin(a) * 0.55 * u, 0.42 * u, 0.3 * u, 10, 0, a), { wash: pal.cream, ink, sw: sw * 0.5 }); } ST.paint(ST.ell(fx, fy, 0.32 * u, 0.32 * u, 8), { wash: pal.ochre, ink: null }); }
  }

  ST.emote = (kind, x, y, s, k = 1) => {
    if (k <= 0.01) return;
    const c = ST.ctx, pal = P(), ink = pal.ink, sw = Z.clamp(s / 14, 0.5, 2), q = Z.ease.outBack(Z.clamp(k), 2.2);
    c.save(); c.translate(x, y); c.scale(q, q);
    if (kind === 'sweat') ST.paint([[0, -1.5 * s], [0.8 * s, 0.3 * s], [0.4 * s, 0.95 * s], [-0.4 * s, 0.95 * s], [-0.8 * s, 0.3 * s]], { wash: pal.sky, ink, sw, curv: 1 });
    else if (kind === 'heart') ST.paint(ST.heart(0, 0, 1.3 * s), { wash: pal.rose, ink, sw });
    else if (kind === 'spark') [[-1.1, 0.3, 0.75], [0.2, -0.9, 0.95], [1.2, 0.5, 0.55]].forEach(([px, py, r]) => ST.paint(ST.star(px * s, py * s, r * s, 0.3, 4, 0.2), { wash: pal.ochre, ink, sw: sw * 0.7 }));
    else if (kind === 'anger') for (let a = 0; a < 4; a++) { c.save(); c.rotate(a * Math.PI / 2 + 0.4); ST.ink([[0.25 * s, 0.85 * s], [0.3 * s, 0.3 * s], [0.85 * s, 0.25 * s]], sw * 1.2, pal.crimson); c.restore(); }
    else if (kind === 'music') { ST.paint(ST.ell(-0.55 * s, 0.7 * s, 0.5 * s, 0.38 * s, 10, 0, -0.3), { wash: ink, ink: null }); ST.ink([[-0.1 * s, 0.6 * s], [-0.1 * s, -1.3 * s], [0.8 * s, -0.8 * s]], sw * 1.1, ink); }
    else if (kind === 'zzz') ['z', 'z', 'Z'].forEach((z, i) => ST.letter(z, i * 0.85 * s, -i * 0.85 * s, (0.85 + i * 0.32) * s, pal.indigo, { ink: false }));
    else ST.letter(kind, 0, 0, 2.1 * s, kind === '?' ? pal.indigo : pal.crimson, { rot: 0.08 });
    c.restore();
  };

  // ---------------------------------------------------------------- beat-synced dance moves (pure functions of t)
  ST.move = (style, t, seed = 0) => {
    const C = Z.clock, b = C.beat(t), p = C.phase(t), land = C.pulse(t, 6), arc = 4 * p * (1 - p);   // arc: 0 on the beat, 1 between
    const odd = ((b + seed) % 2 + 2) % 2 === 1;
    if (style === 'mix') { const set = ['bounce', 'sway', 'hop', 'wave', 'roof', 'stomp', 'shimmy', 'spin']; style = set[Math.floor(Z.rnd(Math.floor(C.bar(t) / 2), seed, 55) * set.length)]; }   // a new move every 2 bars
    switch (style) {
      case 'bounce': return { dy: -0.6 * arc, sq: 0.16 * land - 0.05 * arc, aL: 0.3 + 0.6 * arc, aR: 0.3 + 0.6 * arc };
      case 'hop': return odd ? { dy: -2.0 * arc, sq: -0.12 * arc + 0.16 * land, aL: 1.1 * arc, aR: 1.1 * arc } : { sq: 0.2 * land, aL: -0.25, aR: -0.25 };
      case 'sway': { const lean = Math.sin(Math.PI * (b + p)); return { rot: 0.12 * lean, dy: -0.25 * arc, aL: 0.2 + 0.7 * Math.max(0, lean), aR: 0.2 + 0.7 * Math.max(0, -lean) }; }
      case 'spin': {                                                    // a turn on each odd beat, the new facing held on the next
        const k = Z.ease.inOutSine(Z.clamp(p / 0.4)), facing = (Math.floor(b / 2) % 2) ? -1 : 1;
        const q = facing * Math.cos(Math.PI * k); return { sx: odd ? (q < 0 ? -1 : 1) * Math.max(0.2, Math.abs(q)) : -facing, dy: -0.45 * arc, aL: 0.9, aR: 0.9 };
      }
      case 'wave': return { aR: 1.4 + 0.5 * Math.sin(p * TAU * 2), aL: -0.15, dy: -0.2 * arc, rot: -0.04 };
      case 'roof': return { aL: 1.7 + 0.35 * arc, aR: 1.7 + 0.35 * arc, dy: -0.8 * arc, sq: 0.14 * land };
      case 'stomp': return { sq: 0.26 * land, rot: (odd ? 1 : -1) * 0.07 * land, aL: odd ? 1.1 : -0.35, aR: odd ? -0.35 : 1.1 };
      case 'shimmy': return { rot: 0.09 * Math.sin(p * TAU * 2), sx: 1 + 0.05 * Math.sin(p * TAU * 4), aL: 0.55, aR: 0.55 };
      case 'walk': return { walk: (b + p) / 2, dy: -0.18 * Math.abs(Math.sin(TAU * p)) };
      case 'bow': return { rot: 0.42, aL: -0.85, aR: -0.85, eyes: 'happy' };
      default: return { sq: 0.025 * Math.sin(t * 2.1 + seed), aL: 0.18, aR: 0.18 };           // idle: breathing
    }
  };
  ST.dancer = (x, y, u, style, t, o = {}) => ST.puppet(x, y, u, Object.assign({}, ST.move(style, t, o.seed || 0), o));

  // ---------------------------------------------------------------- mood changes: blink, take, emote, new face
  ST.mood = (t, keys) => {
    let i = -1;
    for (let k = 0; k < keys.length; k++) if (t >= keys[k][0]) i = k;
    if (i < 0) return { eyes: keys[0][1] };
    const [t0, eyes, emote] = keys[i], dt = t - t0;
    const out = { eyes, emote, emoteK: emote ? Z.clamp((dt - 0.12) / 0.18) * (1 - Z.smooth(1.3, 1.7, dt)) : 0 };
    if (i > 0 && dt < 0.36) {
      out.squint = Z.clamp(1 - Math.abs(dt - 0.07) / 0.09);                   // the blink, centred just after the change
      out.take = dt < 0.18 ? 0.16 * Math.sin(Math.PI * dt / 0.18) : -0.06 * Math.sin(Math.PI * (dt - 0.18) / 0.18);   // squash, then rebound
      if (dt < 0.07) out.eyes = keys[i - 1][1];
    }
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
