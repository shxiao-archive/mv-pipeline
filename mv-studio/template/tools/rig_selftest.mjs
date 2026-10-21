#!/usr/bin/env node
/* Self-test of engine/core/rig.js (no browser): ground contact, IK reach, blending, determinism, and the walk / run
 * stride (the distance a planted foot travels per cycle, so  phase = distance / stride  keeps feet from sliding).
 *   node tools/rig_selftest.mjs        exit 1 on a failed check; prints the measured strides
 * mv-studio (MIT).
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { ROOT } from './kit_env.mjs';

const win = {};
const ctx = vm.createContext({ window: win, Math, console });
for (const f of ['engine/core/util.js', 'engine/core/rig.js']) vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
const Z = win.Z, B = Z.rig.biped;
let bad = 0;
const check = (ok, msg) => { if (!ok) { bad++; console.log('FAIL ' + msg); } };

// ground contact: every grounded standing pose has its lowest foot point on y = 0
for (const name of B.NAMES) {
  for (const t of [0, 0.37, 1.1]) {
    const sk = B.solve({ pose: name, t, act: 0.5 });
    if (!sk.J.ground || sk.J.seat || sk.J.lift || sk.J.rot) continue;
    const low = Math.max(...[sk.legs.F, sk.legs.B].flatMap(L => [L.heel[1], L.toe[1], L.knee[1] + sk.spec.kneeR]));
    check(Math.abs(low) < 1e-6, `${name} t=${t}: lowest foot at ${low.toFixed(3)}, not on the ground`);
  }
}
// IK reaches a reachable target
for (const tg of [[20, -150], [-10, -110], [30, -190]]) {
  const sk = B.solve({ pose: 'idle', ik: { F: tg } });
  const w = sk.arms.F.wri, d = Math.hypot(w[0] - tg[0], w[1] - tg[1]), reach = Math.hypot(tg[0] - sk.arms.F.sho[0], tg[1] - sk.arms.F.sho[1]);
  if (reach < sk.spec.ua + sk.spec.fa - 1) check(d < 0.5, `ik target ${tg}: wrist ${d.toFixed(2)} px away`);
}
// blending: endpoints are the poses themselves; determinism
const a = B.pose('wave', { t: 0.3 }), b = B.pose('cheer', { t: 0.3 });
check(JSON.stringify(Z.rig.mix(a, b, 0)) === JSON.stringify(a) && JSON.stringify(Z.rig.mix(a, b, 1)) === JSON.stringify(b), 'mix endpoints');
check(JSON.stringify(B.solve({ pose: 'run', t: 0.71 })) === JSON.stringify(B.solve({ pose: 'run', t: 0.71 })), 'solve is deterministic');
const pts = []; Z.burst(null, 0.5, { at: 0, n: 5, seed: 3 }, (g, p) => pts.push(p.x.toFixed(4)));
const pts2 = []; Z.burst(null, 0.5, { at: 0, n: 5, seed: 3 }, (g, p) => pts2.push(p.x.toFixed(4)));
check(pts.length === 5 && pts.join() === pts2.join(), 'burst is deterministic');
// stride: how far the planted (lowest) foot moves back over one cycle
const stride = pose => {
  let travel = 0, prev = null;
  for (let i = 0; i <= 400; i++) {
    const sk = B.solve({ pose, phase: i / 400 }), feet = [sk.legs.F, sk.legs.B].map(L => [Math.min(L.heel[0], L.toe[0]), Math.max(L.heel[1], L.toe[1])]);
    const k = feet[0][1] >= feet[1][1] ? 0 : 1;
    if (prev && prev.k === k) travel += prev.x - feet[k][0];
    prev = { k, x: feet[k][0] };
  }
  return travel;
};
const sw = stride('walk'), sr = stride('run');
console.log(`stride (s = 1): walk ${sw.toFixed(1)} px / cycle, run on the ground ${sr.toFixed(1)} px / cycle  (Z.rig.biped.STRIDE: ${JSON.stringify(B.STRIDE)})`);
check(Math.abs(sw - B.STRIDE.walk) < 3, 'Z.rig.biped.STRIDE.walk matches the measured stride (a run is off the ground half the time: its stride is nominal)');
console.log(bad ? `${bad} check(s) failed` : 'rig self-test: ok');
process.exit(bad ? 1 : 0);
