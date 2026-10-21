/* engine/sheets/biped.js — MODEL SHEET of the generic biped skeleton (core/rig.js): every pose as a stick figure, the
 * walk and run at 8 phases. node tools/stills.mjs --url "engine/index.html?tl=sheets/biped.js" --times 0.5,1.7 --out render/sheets/biped
 * A sheet is a timeline: copy this file to make one for each character / set of a film (references/10 §2.4, §8).
 */
(() => {
  'use strict';
  const Z = window.Z, B = Z.rig.biped;
  const fig = (o, s = 0.9) => (g, t, box) => {
    const sk = B.solve(Object.assign({ t }, o));
    g.save(); g.translate(box.cx, box.ground); g.scale(s, s); B.drawSkeleton(g, sk); g.restore();
  };
  Z.setup = async () => {
    const poses = B.NAMES.map(n => ({ label: n, draw: fig({ pose: n }) }));
    const cycles = [];
    for (const p of ['walk', 'run']) for (let i = 0; i < 8; i++) cycles.push({ label: `${p} ${i}/8`, draw: fig({ pose: p, phase: i / 8 }) });
    const acts = [];
    for (const p of ['jump', 'fall', 'getUp', 'punch', 'throw']) for (const k of [0, 0.25, 0.5, 0.75, 1]) acts.push({ label: `${p} ${k}`, draw: fig({ pose: p, act: k }) });
    Z.SHOTS = [
      { id: 'poses', t0: 0, t1: 1, scene: 'sheet', lyric: 'none', hud: false, post: Z.rig.SHEET_POST, args: { title: 'biped — poses', cols: 9, cells: poses } },
      { id: 'cycles', t0: 1, t1: 2, scene: 'sheet', lyric: 'none', hud: false, post: Z.rig.SHEET_POST, args: { title: 'biped — walk / run at 8 phases', cols: 8, cells: cycles } },
      { id: 'acts', t0: 2, t1: 3, scene: 'sheet', lyric: 'none', hud: false, post: Z.rig.SHEET_POST, args: { title: 'biped — actions over act 0..1', cols: 5, cells: acts } },
    ];
    window.__zankoMeta.duration = 3;
  };
})();
