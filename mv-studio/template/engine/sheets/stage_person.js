/* engine/sheets/stage_person.js — MODEL SHEET of ST.person (styles/stage): poses, expressions, a lineup with the troupe.
 *   node tools/stills.mjs --url "engine/index.html?tl=sheets/stage_person.js" --times 0.5,1.5,2.5 --out render/sheets/person
 */
(() => {
  'use strict';
  const Z = window.Z, ST = Z.ST, PAL = ST.PAL, B = Z.rig.biped;
  const ME = { coat: PAL.cream, pants: PAL.indigo, glasses: true, bowtie: PAL.crimson, seed: 4 };
  const one = (o, s = 0.62) => (g, t, box) => { ST.begin(g, t); ST.person(box.cx, box.ground, s, Object.assign({ t }, ME, o)); };
  Z.setup = async () => {
    const poses = B.NAMES.map(n => ({ label: n, draw: one({ pose: n }) }));
    const exprs = Object.keys(B.EXPRS).map(e => ({ label: e, draw: (g, t, box) => { ST.begin(g, 0.5); ST.person(box.cx, box.ground + 110, 1.1, Object.assign({ t: 0.5 }, ME, { expr: e })); } }));
    const misc = [
      { label: 'walk 0', draw: one({ pose: 'walk', phase: 0 }) }, { label: 'walk .25', draw: one({ pose: 'walk', phase: 0.25 }) },
      { label: 'run .5', draw: one({ pose: 'run', phase: 0.5 }) }, { label: 'jump .4', draw: one({ pose: 'jump', act: 0.4 }) },
      { label: 'emote heart', draw: one({ pose: 'cheer', emote: 'heart' }) }, { label: 'hairStyle bun', draw: one({ pose: 'wave', hairStyle: 'bun', coat: PAL.mint, glasses: false }) },
      { label: 'lineup with the troupe', draw: (g, t, box) => { ST.begin(g, t); ST.person(box.x + 70, box.ground, 0.5, Object.assign({ t }, ME)); ST.puppet(box.x + 170, box.ground, 12, { col: PAL.teal, top: 'sprout' }); ST.puppet(box.x + 250, box.ground, 9, { col: PAL.rose, top: 'ears', hat: 'party' }); } },
    ];
    const S = (id, t0, title, cols, cells) => ({ id, t0, t1: t0 + 1, scene: 'sheet', lyric: 'none', hud: false, post: Z.rig.SHEET_POST, args: { title, cols, cells, bg: PAL.paper } });
    Z.SHOTS = [S('poses', 0, 'ST.person — poses', 9, poses), S('exprs', 1, 'ST.person — expressions', 7, exprs), S('misc', 2, 'ST.person — cycles, actions, variants, lineup', 4, misc)];
    window.__zankoMeta.duration = 3;
  };
})();
