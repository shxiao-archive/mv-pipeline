/* engine/styles/papercraft/papercraft_doll.js — MODEL SHEET of PC.doll (styles/papercraft): poses, expressions, cycles, actions,
 * emotes, detail 0 / silhouette, a lineup. Copy it for your own cast: one sheet per character (references/10 §2.4).
 *   node tools/stills.mjs --url "engine/index.html?tl=styles/papercraft/papercraft_doll.js" --times 0.5,1.5,2.5,3.5 --out render/sheets/doll
 */
(() => {
  'use strict';
  const Z = window.Z, PC = Z.PC, P = PC.PAL, B = Z.rig.biped;
  const HERO = { hairStyle: 'mop', hair: '#4A3428', outfit: P.blue, hat: 'cap', hatCol: P.red, scarf: P.red, seed: 3 };
  const FRIEND = { hairStyle: 'braid', hair: P.gold, outfit: P.pink, seed: 5 };
  const ELDER = { hairStyle: 'bob', hair: P.white, outfit: P.purple, hat: 'crown', seed: 7 };
  const doll = (o, s = 0.62) => (g, t, box) => { PC.doll(g, box.cx, box.ground, s, Object.assign({ t }, HERO, o)); };
  Z.setup = async () => {
    await Promise.all(PC.fontsToLoad.map(f => document.fonts.load(f, 'Aa0')));
    const poses = B.NAMES.map(n => ({ label: n, draw: doll({ pose: n }) }));
    const exprs = Object.keys(B.EXPRS).map(e => ({ label: e, draw: (g, t, box) => PC.doll(g, box.cx, box.ground + 120, 1.15, Object.assign({ t: 0.5 }, HERO, { expr: e })) }));
    const cyc = [];
    for (const p of ['walk', 'run']) for (let i = 0; i < 8; i++) cyc.push({ label: `${p} ${i}/8`, draw: doll({ pose: p, phase: i / 8 }) });
    const acts = [];
    for (const p of ['jump', 'fall', 'getUp', 'punch', 'throw', 'give']) for (const k of [0, 0.25, 0.5, 0.75, 1]) acts.push({ label: `${p} ${k}`, draw: doll({ pose: p, act: k }, 0.5) });
    const misc = [
      ...['!', '?', 'heart', 'spark', 'sweat', 'music'].map(e => ({ label: `emote ${e}`, draw: doll({ pose: 'shock', emote: e }) })),
      { label: 'face -1', draw: doll({ pose: 'point', face: -1 }) },
      { label: 'detail 0', draw: doll({ pose: 'walk', phase: 0.25, detail: 0 }) },
      { label: 'silhouette', draw: doll({ pose: 'cheer', silhouette: P.ink }) },
      { label: 'blend wave>cheer .5', draw: doll({ pose: { from: 'wave', to: 'cheer', k: 0.5 } }) },
      { label: 'ik F to [40,-170]', draw: doll({ pose: 'idle', ik: { F: [40, -170] } }) },
      { label: 'hold a sword', draw: doll({ pose: 'hold', hold: g => PC.cut(g, PC.poly([[-5, 0], [5, 0], [4, 110], [0, 126], [-4, 110]], { seed: 2 }), P.stone, { stroke: P.ink, lw: 3, rim: P.white }) }) },
      { label: 'lineup', draw: (g, t, box) => [HERO, FRIEND, ELDER].forEach((c, i) => PC.doll(g, box.x + 60 + i * 95, box.ground, 0.42, Object.assign({ t }, c))) },
    ];
    const S = (id, t0, title, cols, cells) => ({ id, t0, t1: t0 + 1, scene: 'sheet', lyric: 'none', hud: false, post: Z.rig.SHEET_POST, args: { title, cols, cells } });
    Z.SHOTS = [S('poses', 0, 'PC.doll — poses (s 0.62)', 9, poses), S('exprs', 1, 'PC.doll — expressions', 7, exprs),
      S('cycles', 2, 'PC.doll — walk / run at 8 phases', 8, cyc), S('acts', 3, 'PC.doll — actions over act', 6, acts), S('misc', 4, 'PC.doll — emotes, variants, IK, props, lineup', 5, misc)];
    window.__zankoMeta.duration = 5;
  };
})();
