/* mv-studio engine — core/rig.js: character rigs, stateless particles and model sheets (method: references/10 §2, §5,
 * §8). Everything is a pure function of its arguments (and of t): frames render out of order.
 *
 * Joint tables (angles in degrees; a pose is a table, an action is keyframed tables, a cycle is a function of phase):
 *   Z.rig.mix(A, B, k)                 blend two joint tables (numbers / arrays lerp, other values switch at k 0.5)
 *   Z.rig.keyed(k, [[k0, A], [k1, B], ...], ease)   an action over act 0..1: smoothstep between keys
 *   Z.rig.cycle(dist, stride)          phase of a walk / run from the distance travelled (feet never slide)
 *   Z.rig.ik2(S, W, l1, l2, bend)      two-bone IK -> [elbow, wrist] points (bend +1 / -1 picks the elbow side)
 *   Z.rig.squash(sq)                   area-preserving [sx, sy] (sq > 0 stretches)
 *   Z.rig.trail(fn, t, n, lag)         time-lagged samples of a moving root, relative to it now (scarf, hair, tail, cape)
 *   Z.rig.blink(t, seed, period)       0..1 eyelid closure (~every 3.7 s, seeded so a cast does not blink together)
 *   Z.rig.take(t, [[t0, expr, emote?], ...])   expression changes that never snap: { expr, blink, sq, emote, emoteK }
 *
 * The biped (an original generic skeleton; style packs paint parts on it, e.g. PC.doll, ST.person):
 *   Z.rig.biped.SPEC                   bone lengths at s = 1 (chibi, ~260 px tall); Z.rig.biped.spec({...}) overrides
 *   Z.rig.biped.STRIDE / stride(pose, spec)   px per walk / run cycle: phase = Z.rig.cycle(distance, stride / s)
 *   Z.rig.biped.POSES / EXPRS          ~30 poses (cycles, actions with act, dance moves with beat) / 18 expressions
 *   Z.rig.biped.solve(o)               o: { pose ('name' | { from, to, k }), t, phase, act, beat, joints, jointsAdd,
 *                                      ik: { F, B } (targets: [x, y] | 'head' 'chin' 'mouth' 'hip' 'chest'), squash,
 *                                      spec } -> skeleton { P pelvis, N neck, H head centre, hA, tA, legs {F, B},
 *                                      arms {F, B}, J (resolved joints), spec }; local coords: feet at y = 0, facing +x
 *   Z.rig.biped.anchors(sk)            { head, mouth, eyes, neck, chest, hip, handF, handB, footF, footB, knee }
 *   Z.rig.biped.drawSkeleton(g, sk, o) debug stick figure (model sheets)
 *   Z.rig.face(g, o)                   one face construction for a whole cast: eyes / brows / mouth / blush / sweat
 *
 * Particles (analytic: any frame can be drawn alone):
 *   Z.burst(g, t, o, draw)             a one-off burst; o: { at, seed, n, x, y, angle, spread, speed, speedVar, gravity,
 *                                      drag, life, lifeVar, spin } ; draw(g, p) with p { x, y, age, k 0..1, rot, i, r }
 *   Z.stream(g, t, o, draw)            continuous emission; o: { t0, t1, rate, life, seed, gravity, drag,
 *                                      emit(tBorn, i, r) -> { x, y, vx, vy } }
 *   Z.field(g, t, o, draw)             looping falling things (snow, petals, fireflies); o: { n, seed, x, y, w, h, vx, vy,
 *                                      sway, swayF }
 *
 * Model sheets (references/10 §8): a timeline in engine/sheets/<name>.js whose shot uses the 'sheet' scene:
 *   { scene: 'sheet', args: { cols, title, cells: [{ label, draw(g, t, box) }] } }   box = { x, y, w, h, cx, ground }
 *   node tools/stills.mjs --url "engine/index.html?tl=sheets/<name>.js" --times 0.5,1.7 --out render/sheets/<name>
 *
 * mv-studio (MIT). Written for this engine; the rig method (joint tables, keyed actions, phase from distance, two-bone
 * IK, ground contact, time-lagged trails) follows dalabengba-mv's rigs (ISC, licenses/LICENSE-dalabengba-mv.txt).
 */
(() => {
  'use strict';
  const Z = window.Z, R = (Z.rig = {}), D = Math.PI / 180, TAU = Math.PI * 2, clamp = Z.clamp;
  const sstep = k => k * k * (3 - 2 * k);
  const rot = (v, a) => { const c = Math.cos(a), s = Math.sin(a); return [v[0] * c - v[1] * s, v[0] * s + v[1] * c]; };
  const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
  R.rot = rot; R.add = add;

  // ---------------------------------------------------------------- joint tables
  R.mix = (A, B, k) => {
    if (k <= 0) return A;
    if (k >= 1) return B;
    const out = {};
    for (const key of new Set([...Object.keys(A), ...Object.keys(B)])) {
      const a = A[key], b = B[key];
      if (a === undefined) { out[key] = k < 0.5 ? a : b; continue; }
      if (b === undefined) { out[key] = k < 0.5 ? a : b; continue; }
      if (typeof a === 'number' && typeof b === 'number') out[key] = a + (b - a) * k;
      else if (Array.isArray(a) && Array.isArray(b) && typeof a[0] === 'number' && typeof b[0] === 'number') out[key] = a.map((v, i) => v + ((b[i] ?? v) - v) * k);
      else out[key] = k < 0.5 ? a : b;
    }
    return out;
  };
  R.keyed = (k, keys, ease = sstep) => {
    k = clamp(k);
    let i = 0;
    while (i < keys.length - 2 && k > keys[i + 1][0]) i++;
    const [k0, A] = keys[i], [k1, B] = keys[i + 1];
    return R.mix(A, B, ease(clamp((k - k0) / (k1 - k0 || 1))));
  };
  R.cycle = (dist, stride) => dist / stride;
  R.squash = sq => [1 / Math.sqrt(Math.max(0.2, 1 + sq)), 1 + sq];
  R.trail = (fn, t, n = 12, lag = 0.035) => { const r = fn(t); return Array.from({ length: n }, (_, k) => sub(fn(t - k * lag), r)); };
  R.blink = (t, seed = 0, period = 3.7, dur = 0.14) => {
    const u = t + seed * 1.37, n = Math.floor(u / period), loc = u - n * period - Z.rnd(seed, n, 51) * period * 0.5;
    if (loc < 0 || loc > dur) return 0;
    return 1 - Math.abs((loc / dur) * 2 - 1);
  };
  R.take = (t, keys) => {
    let cur = keys[0] || [0, 'normal'], next = null;
    for (let i = 0; i < keys.length; i++) if (keys[i][0] <= t) { cur = keys[i]; next = keys[i + 1] || null; }
    const out = { expr: cur[1], blink: 0, sq: 0, emote: null, emoteK: 0 };
    const sinceIn = t - cur[0], toNext = next ? next[0] - t : Infinity;
    if (toNext < 0.07) out.blink = 1 - toNext / 0.07;                      // eyes squeeze shut just before the change
    if (sinceIn >= 0 && sinceIn < 0.1) out.blink = Math.max(out.blink, 1 - sinceIn / 0.1);
    if (sinceIn >= 0 && sinceIn < 0.3 && keys.indexOf(cur) > 0) {          // the take: squash, then a little stretch
      const k = sinceIn / 0.3; out.sq = k < 0.45 ? -0.14 * Math.sin(Math.PI * k / 0.45) : 0.06 * Math.sin(Math.PI * (k - 0.45) / 0.55);
    }
    if (cur[2]) { out.emote = cur[2]; out.emoteK = clamp(Z.ease.outBack(clamp(sinceIn / 0.25))) * (1 - clamp((sinceIn - 1.2) / 0.3)); }
    return out;
  };

  // ---------------------------------------------------------------- the biped
  const B = (R.biped = {});
  B.SPEC = { th: 25, sh: 25, ank: 8, foot: 18, heel: 7, torso: 92, neck: 50, headR: 50, ua: 33, fa: 31, hand: 8.5,
    shoF: [0, -84], shoB: [8, -84], hipF: [-6, 0], hipB: [6, 0], kneeR: 7.5 };
  B.spec = (o = {}) => Object.assign({}, B.SPEC, o);
  const hipH = sp => sp.th + sp.sh + sp.ank;
  const BASE = { x: 0, y: 0, lift: 0, lean: 0, nod: 0, yaw: 1, sq: 0, rot: 0, aF: [-8, 16, 0], aB: [9, 14, 0], lF: [3, 2, 0], lB: [-3, 2, 0],
    hF: 'fist', hB: 'fist', ikF: null, ikB: null, bendF: -1, bendB: -1, ground: 1, seat: 0, breathe: 1, expr: null, look: [0, 0] };
  B.BASE = BASE;
  const cyc = (c, period) => TAU * (c.phase ?? c.t / period);
  const bt = c => c.beat ?? c.t * 2;                                       // beat position for dance moves (pass beat: S.clock.pos(t))
  const pulse = (b, k = 6) => Math.exp(-k * (b - Math.floor(b)));
  const legWalk = (s, cs, sw, lf) => [sw * s, 5 + lf * Math.pow(Math.max(0, cs), 1.6), 14 * s];

  const KEY = (k, keys) => R.keyed(k, keys.map(([kk, J]) => [kk, Object.assign({}, BASE, J)]));   // a joint a key leaves out is the base pose's
  B.POSES = {
    // stand and travel
    idle: c => { const b = Math.sin(TAU * c.t / 3.4); return { aF: [-8 + 1.5 * b, 16, 0], aB: [9 - 1.5 * b, 14, 0], nod: 1.2 * b, expr: 'normal' }; },
    walk: c => { const a = cyc(c, 0.8), s = Math.sin(a), cs = Math.cos(a);
      return { lean: 4, nod: -1.5 + 2 * Math.cos(2 * a), lF: legWalk(s, cs, 26, 46), lB: legWalk(-s, -cs, 26, 46), aF: [-26 * s - 4, 18 + 10 * Math.max(0, -s), 0], aB: [26 * s + 6, 18 + 10 * Math.max(0, s), 0] }; },
    run: c => { const a = cyc(c, 0.5), s = Math.sin(a), cs = Math.cos(a), leg = (ss, cc) => [44 * ss + 4, 22 + 88 * Math.pow(Math.max(0, cc), 1.2), 20 * ss];
      return { lean: 14, nod: -5 + 3 * Math.cos(2 * a), lF: leg(s, cs), lB: leg(-s, -cs), aF: [-42 * s + 8, 88, 0], aB: [42 * s + 8, 88, 0], lift: -16 * s * s, expr: 'determined' }; },
    sneak: c => { const a = cyc(c, 1.2), s = Math.sin(a), cs = Math.cos(a);
      return { lean: 18, nod: 8, lF: [30 * s + 20, 40 + 40 * Math.max(0, cs), 10], lB: [-30 * s + 20, 40 + 40 * Math.max(0, -cs), 10], aF: [60, 80, 0], aB: [50, 90, 0], hF: 'open', hB: 'open', expr: 'smug' }; },
    hop: c => { const b = bt(c), k = Math.sin(Math.PI * (b - Math.floor(b)));
      return { lift: -34 * k, lF: [6, 6 + 30 * (1 - k), 10 * k], lB: [-4, 8 + 30 * (1 - k), 10 * k], aF: [30 + 60 * k, 30, 0], aB: [20 + 60 * k, 30, 0], expr: 'happy' }; },
    // one-off actions (act 0..1)
    jump: c => KEY(c.act, [
      [0, { lF: [3, 2, 0], lB: [-3, 2, 0], aF: [-8, 16, 0], aB: [9, 14, 0] }],
      [0.25, { lean: 18, nod: 6, lF: [55, 95, 30], lB: [45, 95, 30], aF: [-55, 20, 0], aB: [-50, 20, 0], sq: -0.1, expr: 'determined' }],
      [0.4, { lean: -4, lift: -20, lF: [-4, 4, -20], lB: [-8, 6, -20], aF: [165, 10, 0], aB: [160, 10, 0], sq: 0.12, expr: 'grin' }],
      [0.65, { lean: 0, lift: -130, lF: [60, 90, 10], lB: [40, 100, 10], aF: [150, 30, 0], aB: [140, 30, 0], expr: 'grin' }],
      [0.85, { lift: -30, lF: [12, 14, 0], lB: [4, 18, 0], aF: [70, 20, 0], aB: [60, 20, 0], expr: 'grin' }],
      [1, { lean: 10, lF: [40, 70, 20], lB: [30, 70, 20], aF: [30, 20, 0], aB: [20, 20, 0], sq: -0.12, expr: 'grin' }]]),
    fall: c => KEY(c.act, [
      [0, { expr: 'normal' }],
      [0.2, { lean: 25, nod: -15, lF: [-30, 10, 0], lB: [20, 40, 0], aF: [120, 20, 0], aB: [140, 30, 0], hF: 'open', hB: 'open', expr: 'shock' }],
      [0.55, { rot: 55, lean: 20, lF: [-40, 20, 0], lB: [-10, 60, 0], aF: [150, 10, 0], aB: [160, 10, 0], hF: 'open', hB: 'open', expr: 'shock' }],
      [1, { rot: 86, lean: 0, nod: -20, lF: [-10, 10, 20], lB: [-20, 30, 20], aF: [170, 10, 0], aB: [175, 5, 0], hF: 'open', hB: 'open', expr: 'dizzy' }]]),
    getUp: c => KEY(c.act, [
      [0, { rot: 86, nod: -20, lF: [-10, 10, 20], lB: [-20, 30, 20], aF: [170, 10, 0], aB: [175, 5, 0], expr: 'dizzy' }],
      [0.4, { rot: 20, lean: 40, lF: [80, 130, 0], lB: [10, 120, 40], aF: [60, 10, 0], aB: [50, 10, 0], hF: 'open', hB: 'open', expr: 'hurt' }],
      [0.75, { lean: 20, lF: [40, 60, 10], lB: [10, 40, 0], aF: [20, 30, 0], aB: [10, 30, 0], expr: 'relieved' }],
      [1, { expr: 'relieved' }]]),
    give: c => KEY(c.act, [[0, { aF: [40, 100, 0], nod: 6, expr: 'shy' }], [0.5, { lean: 10, aF: [88, 8, 0], hF: 'open', expr: 'happy' }], [1, { lean: 4, aF: [80, 10, 0], hF: 'open', expr: 'happy' }]]),
    punch: c => KEY(c.act, [[0, { aF: [30, 120, 0], aB: [40, 110, 0], expr: 'determined' }], [0.35, { lean: -6, aF: [-30, 120, 0], lF: [20, 20, 0], lB: [-20, 10, 0], expr: 'determined' }],
      [0.5, { lean: 16, x: 10, aF: [92, 0, 0], lF: [35, 15, 0], lB: [-30, 10, 0], expr: 'shout' }], [1, { lean: 6, aF: [70, 40, 0], expr: 'smug' }]]),
    throw: c => KEY(c.act, [[0, { aF: [-10, 20, 0], expr: 'determined' }], [0.4, { lean: -14, aF: [-150, 40, 0], hF: 'fist', lF: [15, 10, 0], lB: [-25, 10, 0], expr: 'determined' }],
      [0.55, { lean: 18, aF: [120, 0, 0], hF: 'open', lF: [35, 15, 0], lB: [-30, 15, 0], expr: 'shout' }], [1, { lean: 10, aF: [60, 10, 0], hF: 'open', expr: 'grin' }]]),
    // acting
    think: () => ({ nod: 10, yaw: 0.85, ikF: 'chin', hF: 'point', ikB: 'hip', bendB: 1, expr: 'think' }),
    scratchHead: c => ({ nod: 9, ikF: 'head', hF: 'open', wiggle: Math.sin(TAU * c.t * 3.2), aB: [10, 14, 0], expr: 'shy' }),
    shrug: () => ({ nod: -6, aF: [20, 95, 0], aB: [15, 95, 0], hF: 'open', hB: 'open', lF: [-4, 2, 0], lB: [6, 2, 0], expr: 'smug' }),
    point: () => ({ lean: -2, aF: [92, 0, 0], hF: 'point', aB: [6, 20, 0], expr: 'determined' }),
    pointUp: () => ({ nod: -10, aF: [142, -8, 0], hF: 'point', aB: [6, 20, 0], expr: 'happy' }),
    wave: c => ({ aF: [118, -12 + 28 * Math.sin(TAU * c.t * 2.5), 0], hF: 'open', aB: [6, 16, 0], expr: 'happy' }),
    cheer: c => { const b = bt(c), k = pulse(b); return { lift: -10 * k, nod: -10, aF: [124, -24 + 12 * k, 0], aB: [150, 10 + 15 * k, 0], hF: 'open', hB: 'open', expr: 'grin' }; },
    bow: () => ({ x: -8, lean: 45, nod: 20, aF: [-12, 10, 0], aB: [-14, 10, 0], hF: 'open', hB: 'open', expr: 'relieved' }),
    proud: () => ({ lean: -5, nod: -10, ikF: 'hip', ikB: 'hip', bendF: 1, bendB: 1, lF: [-8, 0, 0], lB: [10, 0, 0], expr: 'smug' }),
    present: () => ({ lean: -6, nod: -8, aF: [70, 12, 0], aB: [-55, 15, 0], hF: 'open', hB: 'open', lF: [-9, 0, 0], lB: [14, 0, 0], expr: 'grin' }),
    hold: () => ({ aF: [70, 70, 0], aB: [10, 16, 0], expr: 'normal' }),
    carry: () => ({ lean: -4, aF: [75, 25, 0], aB: [75, 25, 0], hF: 'open', hB: 'open', expr: 'determined' }),
    reach: () => ({ lean: 14, aF: [105, 0, 0], hF: 'open', aB: [-20, 20, 0], lF: [-10, 0, 0], lB: [25, 10, 0], expr: 'worried' }),
    shout: c => ({ x: 0.7 * Math.sin(c.t * 61), lean: 9, nod: -8, aF: [-38, 30, 0], aB: [-24, 30, 0], lF: [-14, 6, 0], lB: [18, 8, 0], expr: 'shout' }),
    shock: () => ({ lean: -10, nod: -6, aF: [115, 125, 0], aB: [110, 130, 0], hF: 'open', hB: 'open', lF: [-10, 4, 0], lB: [12, 4, 0], expr: 'shock' }),
    sad: () => ({ lean: 6, nod: 18, aF: [-2, 4, 0], aB: [3, 4, 0], breathe: 0.4, expr: 'sad' }),
    angry: c => ({ lean: 6, nod: 4, x: 0.5 * Math.sin(c.t * 50), aF: [-22, 50, 0], aB: [-18, 50, 0], lF: [-12, 4, 0], lB: [14, 4, 0], expr: 'angry' }),
    sit: () => ({ seat: 1, lF: [88, 88, 0], lB: [84, 92, 0], aF: [30, 40, 0], aB: [24, 40, 0], expr: 'normal' }),
    sitFloor: () => ({ seat: 1, lean: -8, lF: [88, 8, -20], lB: [80, 14, -20], aF: [-30, 10, 0], aB: [-36, 10, 0], hF: 'open', hB: 'open', expr: 'normal' }),
    kneel: () => ({ lean: 4, lF: [80, 85, 0], lB: [-5, 95, 50], aF: [10, 30, 0], aB: [5, 30, 0], expr: 'relieved' }),
    // dance moves (beat-synced: pass beat = Z.clock.at(t) or leave the default 2 beats / s)
    bounce: c => { const b = bt(c), k = pulse(b, 5); return { lF: [20 * k, 40 * k, 0], lB: [16 * k, 40 * k, 0], lean: 6 * k, aF: [30, 60 + 20 * k, 0], aB: [24, 60 + 20 * k, 0], expr: 'happy' }; },
    sway: c => { const s = Math.sin(Math.PI * bt(c)); return { x: 10 * s, lean: 8 * s, aF: [40 + 30 * s, 40, 0], aB: [40 - 30 * s, 40, 0], hF: 'open', hB: 'open', expr: 'happy' }; },
    armsUp: c => { const k = pulse(bt(c)), s = Math.sin(Math.PI * bt(c)); return { lean: 4 * s, aF: [126 + 6 * s, -20, 0], aB: [150 - 8 * s, 15, 0], hF: 'open', hB: 'open', lift: -8 * k, expr: 'grin' }; },
    step: c => { const b = bt(c), s = Math.sin(Math.PI * b); return { x: 14 * s, lF: [18 * Math.max(0, s), 30 * Math.max(0, s), 0], lB: [-18 * Math.max(0, -s), 30 * Math.max(0, -s), 0], aF: [-30 * s + 10, 40, 0], aB: [30 * s + 10, 40, 0], expr: 'happy' }; },
  };
  B.handBehindHead = (sk, side = 'F') => {                              // draw a raised arm behind the head only where its hand would cover it
    const h = sk.arms[side].hand; return h[1] < sk.N[1] - 6 && Math.hypot(h[0] - sk.H[0], h[1] - sk.H[1]) < sk.spec.headR * 0.95;
  };
  B.STRIDE = { walk: 62, run: 150 };   // px per cycle at s = 1: walk measured (tools/rig_selftest.mjs); run nominal (it includes the flight phase)
  B.stride = (pose = 'walk', spec = B.SPEC) => B.STRIDE[pose] * hipH(spec) / hipH(B.SPEC);
  B.ACT_DEFAULT = { jump: 0.65, fall: 1, getUp: 0, give: 1, punch: 0.5, throw: 0.55 };
  B.NAMES = Object.keys(B.POSES);
  B.pose = (p, c) => {
    if (p && typeof p === 'object') return R.mix(B.pose(p.from, c), B.pose(p.to, c), clamp(p.k ?? 0));
    const fn = B.POSES[p] || B.POSES.idle;
    const J = fn(Object.assign({}, c, { act: clamp(c.act ?? B.ACT_DEFAULT[p] ?? 0.5) })), out = Object.assign({}, BASE);
    for (const k in J) if (J[k] !== undefined) out[k] = J[k];
    return out;
  };
  B.EXPRS = {
    normal: { eyes: 'open', brows: 'neutral', mouth: 'smile' }, happy: { eyes: 'happy', brows: 'up', mouth: 'smile' },
    grin: { eyes: 'happy', brows: 'up', mouth: 'grin' }, smug: { eyes: 'half', brows: 'smug', mouth: 'smirk' },
    determined: { eyes: 'open', brows: 'angry', mouth: 'flat' }, shout: { eyes: 'tight', brows: 'angry', mouth: 'shout' },
    shock: { eyes: 'wide', brows: 'high', mouth: 'O' }, worried: { eyes: 'open', brows: 'worried', mouth: 'wavy', sweat: 1 },
    hurt: { eyes: 'tight', brows: 'worried', mouth: 'teeth' }, dizzy: { eyes: 'spiral', brows: 'worried', mouth: 'wavy' },
    shy: { eyes: 'happy', brows: 'worried', mouth: 'small', blush: 1 }, relieved: { eyes: 'closed', brows: 'neutral', mouth: 'smile' },
    sad: { eyes: 'sad', brows: 'worried', mouth: 'sad' }, angry: { eyes: 'open', brows: 'angry', mouth: 'teeth' },
    sleepy: { eyes: 'half', brows: 'neutral', mouth: 'o' }, love: { eyes: 'heart', brows: 'up', mouth: 'grin', blush: 1 },
    starry: { eyes: 'star', brows: 'up', mouth: 'O' }, think: { eyes: 'look', brows: 'smug', mouth: 'flat', look: [0.6, -0.6] },
    ko: { eyes: 'x', brows: 'none', mouth: 'wavy' },
  };

  const legFK = (P, hj, L, sp) => {
    const hp = add(P, hj), ta = -L[0] * D, K = add(hp, rot([0, sp.th], ta)), sa = ta + L[1] * D, A = add(K, rot([0, sp.sh], sa)), fa = -(L[2] || 0) * D;
    return { hip: hp, knee: K, ankle: A, heel: add(A, rot([-sp.heel, sp.ank], fa)), toe: add(A, rot([sp.foot, sp.ank], fa)), ta, sa, fa };
  };
  const armFK = (S, tA, a, sp) => {
    const ua = tA - a[0] * D, E = add(S, rot([0, sp.ua], ua)), fa = ua - a[1] * D, W = add(E, rot([0, sp.fa], fa)), ha = fa - (a[2] || 0) * D;
    return { sho: S, elb: E, wri: W, hand: add(W, rot([0, sp.hand], ha)), ha };
  };
  R.ik2 = (S, W, l1, l2, bend = 1) => {
    const dx = W[0] - S[0], dy = W[1] - S[1], d = clamp(Math.hypot(dx, dy), Math.abs(l1 - l2) + 0.5, l1 + l2 - 0.5);
    const base = Math.atan2(dx, dy), A = Math.acos(clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1)), a1 = base + bend * A;
    const E = [S[0] + l1 * Math.sin(a1), S[1] + l1 * Math.cos(a1)], a2 = Math.atan2(W[0] - E[0], W[1] - E[1]);
    return [E, [E[0] + l2 * Math.sin(a2), E[1] + l2 * Math.cos(a2)]];
  };
  const addJ = (J, d) => { const o = Object.assign({}, J); for (const k in d) { const v = d[k]; o[k] = Array.isArray(v) && Array.isArray(J[k]) ? J[k].map((x, i) => x + (v[i] || 0)) : typeof v === 'number' && typeof J[k] === 'number' ? J[k] + v : v; } return o; };
  B.solve = (o = {}) => {
    const sp = o.spec || B.SPEC, t = o.t || 0;
    const c = { t, phase: o.phase, act: o.act, beat: o.beat };
    let J = B.pose(o.pose || 'idle', c);
    if (o.joints) J = Object.assign({}, J, o.joints);
    if (o.jointsAdd) J = addJ(J, o.jointsAdd);
    const br = (J.breathe ?? 1) * Math.sin(TAU * t / 3.4), [sx, sy0] = R.squash((J.sq || 0) + (o.squash || 0)), sy = sy0 * (1 + 0.012 * br);
    const legsAt = P => ({ F: legFK(P, sp.hipF, J.lF, sp), B: legFK(P, sp.hipB, J.lB, sp) });
    let P = [J.x, (J.seat >= 0.5 ? 0 : -hipH(sp)) + J.y], legs = legsAt(P);
    if (J.ground >= 0.5 && J.seat < 0.5) {
      let low = -Infinity;
      for (const L of [legs.F, legs.B]) low = Math.max(low, L.heel[1], L.toe[1], L.knee[1] + sp.kneeR);
      P = [P[0], P[1] - low];
    }
    P = [P[0], P[1] + (J.lift || 0)]; legs = legsAt(P);
    const tA = J.lean * D, T = (u, v) => add(P, rot([u * sx, v * sy], tA)), N = T(0, -sp.torso), hA = tA + J.nod * D, H = add(N, rot([0, -sp.neck], hA));
    const target = (k, wig = 0) => {
      const hr = sp.headR;
      if (Array.isArray(k)) return k;
      if (k === 'head') return add(H, rot([-hr * 0.35 + 6 * wig, -hr * 0.95], hA));
      if (k === 'chin') return add(H, rot([hr * 0.55, hr * 0.85], hA));
      if (k === 'mouth') return add(H, rot([hr * 0.75, hr * 0.45], hA));
      if (k === 'hip') return T(sp.shoF[0] + 22, -34);
      if (k === 'chest') return T(14, -64);
      return null;
    };
    const arm = (S, a, ik, bend) => {
      const W = ik ? target(ik, J.wiggle || 0) : null;
      if (!W) return armFK(S, tA, a, sp);
      const [E, Wc] = R.ik2(S, W, sp.ua, sp.fa, bend), fa = Math.atan2(-(Wc[0] - E[0]), Wc[1] - E[1]);
      return { sho: S, elb: E, wri: Wc, hand: add(Wc, rot([0, sp.hand], fa)), ha: fa };
    };
    const ikF = (o.ik && o.ik.F) || J.ikF, ikB = (o.ik && o.ik.B) || J.ikB;
    let sk = { P, N, H, hA, tA, sx, sy, legs, arms: { F: arm(T(...sp.shoF), J.aF, ikF, J.bendF), B: arm(T(...sp.shoB), J.aB, ikB, J.bendB) }, J, spec: sp };
    if (J.rot) {                                                          // whole-body rotation (falls), about the pelvis, then back on the ground
      const a = J.rot * D, pv = P, f = q => add(pv, rot(sub(q, pv), a));
      const mapObj = ob => { const r = {}; for (const k in ob) r[k] = Array.isArray(ob[k]) && ob[k].length === 2 && typeof ob[k][0] === 'number' ? f(ob[k]) : ob[k]; return r; };
      sk = Object.assign({}, sk, { N: f(N), H: f(H), hA: hA + a, tA: tA + a, legs: { F: mapObj(legs.F), B: mapObj(legs.B) }, arms: { F: mapObj(sk.arms.F), B: mapObj(sk.arms.B) } });
      if (J.ground >= 0.5) {
        const pts = [sk.H[1] + sp.headR * 0.9, sk.legs.F.heel[1], sk.legs.F.toe[1], sk.legs.B.heel[1], sk.legs.B.toe[1], sk.arms.F.hand[1], sk.arms.B.hand[1]];
        const dy = -Math.max(...pts) + (J.lift || 0) * 0;
        const sh = q => [q[0], q[1] + dy], shObj = ob => { const r = {}; for (const k in ob) r[k] = Array.isArray(ob[k]) && ob[k].length === 2 && typeof ob[k][0] === 'number' ? sh(ob[k]) : ob[k]; return r; };
        sk = Object.assign({}, sk, { P: sh(P), N: sh(sk.N), H: sh(sk.H), legs: { F: shObj(sk.legs.F), B: shObj(sk.legs.B) }, arms: { F: shObj(sk.arms.F), B: shObj(sk.arms.B) } });
      }
    }
    sk.T = (u, v) => add(sk.P, rot([u * sx, v * sy], sk.tA));
    return sk;
  };
  B.anchors = sk => {
    const hr = sk.spec.headR, yaw = sk.J.yaw ?? 1;
    return { head: sk.H, mouth: add(sk.H, rot([hr * 0.3 * yaw, hr * 0.45], sk.hA)), eyes: add(sk.H, rot([hr * 0.28 * yaw, hr * 0.02], sk.hA)), neck: sk.N,
      chest: sk.T(10, -62), hip: sk.P, handF: sk.arms.F.hand, handB: sk.arms.B.hand, footF: sk.legs.F.ankle, footB: sk.legs.B.ankle, knee: sk.legs.F.knee };
  };
  B.drawSkeleton = (g, sk, o = {}) => {
    g.save(); g.lineCap = 'round'; g.lineJoin = 'round';
    const seg = (pts, col, w) => { g.strokeStyle = col; g.lineWidth = w; g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (const p of pts.slice(1)) g.lineTo(p[0], p[1]); g.stroke(); };
    const far = o.far || '#9A8F84', near = o.color || '#2C2233', w = o.lw || 5;
    for (const [L, col] of [[sk.legs.B, far], [sk.legs.F, near]]) seg([L.hip, L.knee, L.ankle, L.toe], col, w);
    seg([sk.arms.B.sho, sk.arms.B.elb, sk.arms.B.wri, sk.arms.B.hand], far, w);
    seg([sk.P, sk.N], near, w * 1.6);
    seg([sk.N, sk.H], near, w);
    g.strokeStyle = near; g.lineWidth = w; g.beginPath(); g.arc(sk.H[0], sk.H[1], sk.spec.headR * 0.8, 0, TAU); g.stroke();
    seg([sk.arms.F.sho, sk.arms.F.elb, sk.arms.F.wri, sk.arms.F.hand], o.accent || '#D8473D', w);
    g.restore();
  };

  // ---------------------------------------------------------------- the face kit (one construction for a whole cast)
  R.face = (g, o = {}) => {
    const r = o.r || 50, x = o.x || 0, y = o.y || 0, dir = clamp(o.dir ?? 0.6, -1, 1), ink = o.ink || '#2C2233', white = o.white || '#FFFDF7', lw = o.lw || Math.max(1.5, r * 0.07);
    const ex = dir * r * 0.26, sep = r * 0.33 * (1 - 0.22 * Math.abs(dir)), ey = y + r * 0.04, ew = r * 0.17, eh = r * 0.25;
    const look = o.look || [0, 0], bl = clamp(o.blink || 0);
    const eyes = bl > 0.5 && ['open', 'wide', 'look', 'sad', 'half', 'dot'].includes(o.eyes || 'open') ? 'closed' : o.eyes || 'open';
    g.save(); g.lineCap = 'round'; g.lineJoin = 'round'; g.strokeStyle = ink; g.fillStyle = ink; g.lineWidth = lw;
    const P = [[x + ex - sep, ey], [x + ex + sep, ey]];
    const arcE = (cx, cy, up) => { g.beginPath(); g.arc(cx, cy + (up ? eh * 0.35 : -eh * 0.35), ew * 1.1, up ? Math.PI * 1.15 : Math.PI * 0.15, up ? Math.PI * 1.85 : Math.PI * 0.85); g.stroke(); };
    const star = (cx, cy, s) => { g.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? s * 0.45 : s; g.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); } g.closePath(); g.fill(); };
    const heart = (cx, cy, s) => { g.beginPath(); g.moveTo(cx, cy + s * 0.9); g.bezierCurveTo(cx - s * 1.4, cy - s * 0.1, cx - s * 0.6, cy - s * 1.1, cx, cy - s * 0.35); g.bezierCurveTo(cx + s * 0.6, cy - s * 1.1, cx + s * 1.4, cy - s * 0.1, cx, cy + s * 0.9); g.fill(); };
    P.forEach(([cx, cy], i) => {
      const e = eyes === 'wink' ? (i === 0 ? 'closed' : 'open') : eyes;
      if (e === 'open' || e === 'look' || e === 'wide' || e === 'sad' || e === 'half' || e === 'dot') {
        const k = e === 'wide' ? 1.25 : e === 'dot' ? 0.55 : 1, lx = (e === 'look' ? look[0] : 0) * ew * 0.5, ly = (e === 'look' ? look[1] : 0) * eh * 0.4;
        g.beginPath(); g.ellipse(cx + lx, cy + ly, ew * k, eh * k * (e === 'half' ? 0.6 : 1), 0, 0, TAU); g.fill();
        if (e !== 'dot') { g.fillStyle = white; g.beginPath(); g.arc(cx + lx - ew * 0.35 * k, cy + ly - eh * 0.4 * k, ew * 0.38 * k, 0, TAU); g.fill(); g.fillStyle = ink; }
        if (e === 'half') { g.beginPath(); g.moveTo(cx - ew * 1.4, cy - eh * 0.25); g.lineTo(cx + ew * 1.4, cy - eh * 0.25); g.stroke(); }
        if (e === 'sad') { g.beginPath(); const s = i === 0 ? 1 : -1; g.moveTo(cx - ew * 1.3, cy - eh * (0.9 - 0.5 * s)); g.lineTo(cx + ew * 1.3, cy - eh * (0.9 + 0.5 * s)); g.stroke(); }
      } else if (e === 'happy') arcE(cx, cy, true);
      else if (e === 'closed') { g.beginPath(); g.arc(cx, cy - eh * 0.3, ew * 1.1, Math.PI * 0.15, Math.PI * 0.85); g.stroke(); }
      else if (e === 'tight' || e === 'squint') { const s = i === 0 ? 1 : -1; g.beginPath(); g.moveTo(cx - ew * s, cy - eh * 0.6); g.lineTo(cx + ew * s, cy); g.lineTo(cx - ew * s, cy + eh * 0.6); g.stroke(); }
      else if (e === 'spiral') { g.beginPath(); for (let a = 0; a < TAU * 2.2; a += 0.3) { const rr = ew * 1.2 * a / (TAU * 2.2); g.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); } g.stroke(); }
      else if (e === 'x') { g.beginPath(); g.moveTo(cx - ew, cy - ew); g.lineTo(cx + ew, cy + ew); g.moveTo(cx + ew, cy - ew); g.lineTo(cx - ew, cy + ew); g.stroke(); }
      else if (e === 'star') star(cx, cy, eh * 1.1);
      else if (e === 'heart') heart(cx, cy, eh * 0.9);
    });
    const by = y - r * 0.3, b = o.brows || 'neutral';
    if (b !== 'none') P.forEach(([cx], i) => {
      const s = i === 0 ? -1 : 1, hi = b === 'high' ? -r * 0.12 : b === 'up' ? -r * 0.06 : 0;
      let a0 = 0, a1 = 0;
      if (b === 'angry') { a0 = s * r * 0.04; a1 = -s * r * 0.04; }
      if (b === 'worried') { a0 = -s * r * 0.04; a1 = s * r * 0.05; }
      if (b === 'smug') { a0 = i === 1 ? -r * 0.07 : 0; a1 = a0; }
      g.beginPath(); g.moveTo(cx - ew * 1.2, by + hi + (s < 0 ? a1 : a0)); g.quadraticCurveTo(cx, by + hi - r * 0.04 + (a0 + a1) / 2, cx + ew * 1.2, by + hi + (s < 0 ? a0 : a1)); g.stroke();
    });
    const mx = x + ex * 1.1, my = y + r * 0.42, mw = r * 0.2, m = o.mouth || 'smile', dark = o.mouthCol || '#7A2E3A', tongue = o.tongue || '#F25C6E';
    g.save();
    const openShape = (w, h, flat) => { g.beginPath(); g.moveTo(mx - w, my - h * 0.2); g.quadraticCurveTo(mx, my - h * (flat ? 0.2 : 0.45), mx + w, my - h * 0.2); g.quadraticCurveTo(mx + w * 0.9, my + h, mx, my + h); g.quadraticCurveTo(mx - w * 0.9, my + h, mx - w, my - h * 0.2); g.closePath(); };
    if (m === 'smile') { g.beginPath(); g.moveTo(mx - mw, my - mw * 0.25); g.quadraticCurveTo(mx, my + mw * 0.55, mx + mw, my - mw * 0.25); g.stroke(); }
    else if (m === 'small') { g.beginPath(); g.moveTo(mx - mw * 0.5, my); g.quadraticCurveTo(mx, my + mw * 0.3, mx + mw * 0.5, my); g.stroke(); }
    else if (m === 'flat') { g.beginPath(); g.moveTo(mx - mw * 0.8, my); g.lineTo(mx + mw * 0.8, my); g.stroke(); }
    else if (m === 'smirk') { g.beginPath(); g.moveTo(mx - mw * 0.8, my + mw * 0.1); g.quadraticCurveTo(mx + mw * 0.2, my + mw * 0.3, mx + mw, my - mw * 0.3); g.stroke(); }
    else if (m === 'sad') { g.beginPath(); g.moveTo(mx - mw * 0.8, my + mw * 0.3); g.quadraticCurveTo(mx, my - mw * 0.35, mx + mw * 0.8, my + mw * 0.3); g.stroke(); }
    else if (m === 'wavy') { g.beginPath(); for (let i = 0; i <= 8; i++) g.lineTo(mx - mw + i * mw / 4, my + Math.sin(i * Math.PI / 2) * mw * 0.18); g.stroke(); }
    else if (m === 'o') { g.fillStyle = dark; g.beginPath(); g.ellipse(mx, my + mw * 0.1, mw * 0.32, mw * 0.42, 0, 0, TAU); g.fill(); g.stroke(); }
    else if (m === 'O') { g.fillStyle = dark; g.beginPath(); g.ellipse(mx, my + mw * 0.25, mw * 0.55, mw * 0.75, 0, 0, TAU); g.fill(); g.stroke(); }
    else if (m === 'grin' || m === 'shout') {
      const w = m === 'shout' ? mw * 1.05 : mw, h = m === 'shout' ? mw * 1.4 : mw * 0.9;
      openShape(w, h, m === 'shout'); g.fillStyle = dark; g.fill(); g.save(); g.clip(); g.fillStyle = tongue; g.beginPath(); g.ellipse(mx, my + h * 0.95, w * 0.6, h * 0.45, 0, 0, TAU); g.fill(); g.restore(); openShape(w, h, m === 'shout'); g.stroke();
    } else if (m === 'teeth') { g.fillStyle = white; g.beginPath(); g.rect(mx - mw * 0.8, my - mw * 0.22, mw * 1.6, mw * 0.44); g.fill(); g.stroke(); g.beginPath(); g.moveTo(mx - mw * 0.8, my); g.lineTo(mx + mw * 0.8, my); g.stroke(); }
    else if (m === 'cat') { g.beginPath(); g.moveTo(mx - mw * 0.8, my - mw * 0.1); g.quadraticCurveTo(mx - mw * 0.4, my + mw * 0.45, mx, my); g.quadraticCurveTo(mx + mw * 0.4, my + mw * 0.45, mx + mw * 0.8, my - mw * 0.1); g.stroke(); }
    g.restore();
    if (o.blush) { g.save(); g.globalAlpha = 0.45 * (o.blush === true ? 1 : o.blush); g.fillStyle = o.blushCol || '#F2918C'; for (const [cx] of P) { g.beginPath(); g.ellipse(cx + (cx < x + ex ? -ew * 0.6 : ew * 0.6), y + r * 0.3, ew * 1.2, eh * 0.4, 0, 0, TAU); g.fill(); } g.restore(); }
    if (o.sweat) { g.save(); g.globalAlpha = clamp(o.sweat); g.fillStyle = o.sweatCol || '#8FD0F2'; g.strokeStyle = ink; g.lineWidth = lw * 0.6; const sx = x - dir * r * 0.75 + r * 0.1, sy = y - r * 0.45;
      g.beginPath(); g.moveTo(sx, sy - r * 0.2); g.quadraticCurveTo(sx + r * 0.13, sy, sx, sy + r * 0.08); g.quadraticCurveTo(sx - r * 0.13, sy, sx, sy - r * 0.2); g.fill(); g.stroke(); g.restore(); }
    g.restore();
  };
  R.faceOf = (expr, o = {}) => Object.assign({}, B.EXPRS[expr] || B.EXPRS.normal, o);

  // ---------------------------------------------------------------- stateless particles
  const disp = (v, age, drag, grav) => { const k = drag > 0 ? (1 - Math.exp(-drag * age)) / drag : age; return [v[0] * k, v[1] * k + 0.5 * grav * age * age]; };
  Z.burst = (g, t, o, draw) => {
    const age0 = t - (o.at ?? 0); if (age0 < 0) return;
    const n = o.n ?? 20, seed = o.seed ?? 1, life = o.life ?? 1.2;
    for (let i = 0; i < n; i++) {
      const r = k => Z.rnd(seed, i, k), li = life * (1 - (o.lifeVar ?? 0.3) * r(1)); if (age0 > li) continue;
      const a = (o.angle ?? -Math.PI / 2) + (r(2) - 0.5) * (o.spread ?? Math.PI), sp = (o.speed ?? 600) * (1 - (o.speedVar ?? 0.5) * r(3));
      const d = disp([Math.cos(a) * sp, Math.sin(a) * sp], age0, o.drag ?? 1.5, o.gravity ?? 900);
      draw(g, { x: (o.x ?? 960) + d[0], y: (o.y ?? 540) + d[1], age: age0, k: age0 / li, rot: (r(4) - 0.5) * 2 * (o.spin ?? 4) * age0 + r(5) * TAU, i, r: r(6) });
    }
  };
  Z.stream = (g, t, o, draw) => {
    const rate = o.rate ?? 20, life = o.life ?? 1.5, t0 = o.t0 ?? 0, t1 = o.t1 ?? Infinity, seed = o.seed ?? 1;
    const i0 = Math.max(0, Math.ceil((t - life - t0) * rate)), i1 = Math.floor((Math.min(t, t1) - t0) * rate);
    for (let i = i0; i <= i1; i++) {
      const tb = t0 + i / rate, age = t - tb; if (age < 0 || age > life) continue;
      const e = o.emit(tb, i, Z.rnd(seed, i, 7)), d = disp([e.vx || 0, e.vy || 0], age, o.drag ?? 0, o.gravity ?? 0);
      draw(g, { x: e.x + d[0], y: e.y + d[1], age, k: age / life, i, r: Z.rnd(seed, i, 8), rot: Z.rnd(seed, i, 9) * TAU + age * (e.spin || 0) });
    }
  };
  Z.field = (g, t, o, draw) => {
    const n = o.n ?? 60, seed = o.seed ?? 1, x = o.x ?? 0, y = o.y ?? 0, w = o.w ?? 1920, h = o.h ?? 1080;
    for (let i = 0; i < n; i++) {
      const r = k => Z.rnd(seed, i, k), sw = (o.sway ?? 20) * Math.sin(TAU * (o.swayF ?? 0.5) * t * (0.6 + 0.8 * r(3)) + r(4) * TAU);
      draw(g, { x: x + Z.fract(r(1) + (o.vx ?? 0) * t / w) * w + sw, y: y + Z.fract(r(2) + (o.vy ?? 60) * (0.6 + 0.8 * r(5)) * t / h) * h, i, r: r(6), rot: r(7) * TAU + t * (r(8) - 0.5) * 3 });
    }
  };

  // ---------------------------------------------------------------- model sheets
  Z.sheetGrid = (g, S, cells, o = {}) => {
    const cols = o.cols || 6, rows = Math.ceil(cells.length / cols), top = o.title ? 70 : 20, pad = 20;
    const cw = (1920 - pad * 2) / cols, ch = (1080 - top - pad) / rows;
    g.save(); g.fillStyle = o.bg || '#F3EEE4'; g.fillRect(0, 0, 1920, 1080);
    if (o.title) { g.fillStyle = '#2C2233'; g.font = '600 34px "Inter", "Noto Sans JP", sans-serif'; g.textBaseline = 'middle'; g.fillText(o.title, pad + 6, 38); }
    cells.forEach((c, i) => {
      const x = pad + (i % cols) * cw, y = top + Math.floor(i / cols) * ch, box = { x, y, w: cw, h: ch, cx: x + cw / 2, ground: y + ch - 34 };
      g.save(); g.strokeStyle = 'rgba(44,34,51,0.18)'; g.lineWidth = 1; g.strokeRect(x + 3, y + 3, cw - 6, ch - 6);
      if (o.groundLine !== false) { g.beginPath(); g.moveTo(x + 10, box.ground); g.lineTo(x + cw - 10, box.ground); g.stroke(); }
      g.beginPath(); g.rect(x + 3, y + 3, cw - 6, ch - 6); g.clip();
      try { c.draw(g, S.t, box); } catch (err) {               // a cell that throws mid-draw may leave saves open: reset, then report it
        for (let k = 0; k < 64; k++) g.restore();
        g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = '#D8473D'; g.font = '16px monospace'; g.fillText('ERROR ' + String(err && err.message || err).slice(0, 50), x + 10, y + 24);
      }
      g.restore();
      g.fillStyle = '#2C2233'; g.font = '500 18px "Inter", monospace'; g.textBaseline = 'alphabetic'; g.fillText(c.label || '', x + 10, y + ch - 10);
    });
    g.restore();
  };
  R.SHEET_POST = { boil: 0, bloom: 0, vignette: 0, grain: 0, lutMix: 0, ca: 0, hca: 0, beatCA: 0, beatBloom: 0 };   // post: on sheet shots
  Z.scene('sheet', { draw(ctx, S) { Z.sheetGrid(ctx, S, (S.args && S.args.cells) || [], S.args || {}); } });
})();
