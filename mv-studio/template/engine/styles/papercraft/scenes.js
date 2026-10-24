/* styles/papercraft — scenes.js: a pop-up paper storybook told as a retro RPG. Lyric lines are the dialogue: every
 * scene with `line` shows it in the RPG dialogue box, typed as sung (PC.dialog). Lyric text never appears in code.
 *
 * 'pcBook'   the storybook on a desk: { mode 'open' | 'close', title (default Z.TITLE), pop (scene inside: 'castle' |
 *            'hills') } — the cover opens, the pop-up rises; 'close' plays it backwards (the film's bookends)
 * 'pcWorld'  a multiplane paper landscape (cam.follow: the index of the cast member the camera tracks, cam.lead px ahead):
 *            { biome 'meadow' | 'village' | 'snow' | 'night' | 'cave' | 'dusk', cast: [doll
 *            opts + { x, s, walkTo: [[t, x], ...] }], line, speaker, hud: { coins: [[t, n], ...], lv: [t, ...], hp },
 *            mini: { route, from, to } (a corner mini-map), cam: { from: PC.cam(...), to: PC.cam(...) }, burst: [{ at, x, y, kind }] }
 * 'pcMap'    the parchment map: { route [[u, v], ...], from, to (route progress over the shot), marks, line, speaker }
 * 'pcBattle' a paper-theatre battle screen: { line, hero (doll opts), foe ({ col, eyes }), names: [left, right] (your own
 *            words), items (menu: your own words), hits: [t, ...] (damage on these times; default every beat) }
 * transitions: 'pageTurn' (a page folds over: dir 'left' | 'right'), 'shapeReveal' (shape 'circle' | 'star' | 'heart' |
 *            'keyhole': the next shot opens through a paper-edged hole)
 * PC.install(): the paper fibre and a warm vignette multiplied over every pc* shot; PC.post: the engine's post for paper.
 *
 * mv-studio (MIT). After dalabengba-mv (ISC): its pop-up book, multiplane camera, paper RPG and transitions, written
 * for this engine; its characters and story belong to its song and are not used.
 */
(() => {
  'use strict';
  const Z = window.Z, PC = (Z.PC = Z.PC || {}), W = 1920, H = 1080, TAU = Math.PI * 2;
  const P = PC.PAL, E = Z.ease, clamp = Z.clamp, lerp = Z.lerp;
  const fonts = { async init() { await Promise.all(PC.fontsToLoad.map(f => document.fonts.load(f, 'Aa0字あ'))); } };
  const at = (v, t, dur = 0.6, ease = E.inOutSine) => { if (!Array.isArray(v) || !Array.isArray(v[0])) return v; let cur = v[0][1], prev = cur, t0 = -1e9; for (const [tk, x] of v) if (t >= tk) { prev = cur; cur = x; t0 = tk; } return typeof cur === 'number' ? lerp(prev, cur, ease(clamp((t - t0) / dur))) : cur; };
  const walkAt = (m, t) => at(m.walkTo, t, m.walkDur ?? 1.2, m.walkEase === 'linear' ? E.linear : E.inOutSine);   // long tracks walk at a steady pace

  // ---------------------------------------------------------------- pop-up pieces (shared by the book and the world)
  const castle = (g, x, y, s, seed = 1) => {
    g.save(); g.translate(x, y); g.scale(s, s);
    const wall = PC.poly([[-170, 0], [170, 0], [170, -120], [-170, -120]], { seed });
    PC.cut(g, wall, P.stone, { shadow: 14, stroke: P.ink, lw: 4, rim: P.white }); PC.shade(g, wall, P.stoneDark, 0, -120, 0, 0, 0, 0.35);
    for (const [tx, h, col] of [[-150, 210, P.roof], [0, 280, P.roofRed], [150, 210, P.roof]]) {
      const tw = PC.poly([[tx - 40, 0], [tx + 40, 0], [tx + 40, -h], [tx - 40, -h]], { seed: seed + tx });
      PC.cut(g, tw, P.stone, { shadow: 10, stroke: P.ink, lw: 4, rim: P.white });
      PC.cut(g, PC.poly([[tx - 54, -h], [tx + 54, -h], [tx, -h - 90]], { seed: seed + tx + 1 }), col, { shadow: 8, stroke: P.ink, lw: 4, rim: PC.mix(col, P.white, 0.4) });
      PC.cut(g, PC.poly([[tx, -h - 90], [tx + 34, -h - 78], [tx, -h - 66]], { seed: seed + tx + 2 }), P.red, { stroke: P.ink, lw: 2.5 });
    }
    PC.cut(g, PC.blob(0, -40, 34, 44, { seed: seed + 9 }), P.woodDark, { stroke: P.ink, lw: 3 });
    g.restore();
  };
  const tree = (g, x, y, s, seed, col = P.grass) => { g.save(); g.translate(x, y); g.scale(s, s); PC.cut(g, PC.poly([[-8, 0], [8, 0], [6, -50], [-6, -50]], { seed }), P.wood, { stroke: P.ink, lw: 3 }); PC.cut(g, PC.blob(0, -95, 60, 62, { seed: seed + 1, amp: 0.06, freq: 5 }), col, { shadow: 10, stroke: P.ink, lw: 3.5, rim: PC.mix(col, P.leafLight, 0.6) }); g.restore(); };
  const house = (g, x, y, s, seed, col = P.roofRed) => { g.save(); g.translate(x, y); g.scale(s, s); const b = PC.poly([[-60, 0], [60, 0], [60, -80], [-60, -80]], { seed }); PC.cut(g, b, P.sand, { shadow: 10, stroke: P.ink, lw: 3.5, rim: P.white }); PC.cut(g, PC.poly([[-78, -80], [78, -80], [0, -150]], { seed: seed + 1 }), col, { shadow: 8, stroke: P.ink, lw: 3.5 }); PC.cut(g, PC.poly([[-14, 0], [14, 0], [14, -44], [-14, -44]], { seed: seed + 2 }), P.woodDark, { stroke: P.ink, lw: 2.5 }); g.restore(); };
  const hills = (g, y, amp, col, seed, x0 = -1200, x1 = 3200) => {
    const pts = [[x0, H + 600]]; for (let x = x0; x <= x1; x += 160) pts.push([x, y - amp * (0.5 + 0.5 * Z.noise1(x / 420, seed))]); pts.push([x1, H + 600]);
    const p = PC.smooth(pts, { closed: true, tension: 0.5 }); PC.cut(g, p, col, { shadow: 12, stroke: PC.mix(col, P.ink, 0.45), lw: 3, rim: PC.mix(col, P.white, 0.3) }); return p;
  };

  // ---------------------------------------------------------------- pcBook: the bookends
  Z.scene('pcBook', Object.assign({}, fonts, {
    draw(g, S) {
      const a = S.args, close = a.mode === 'close', q = close ? 1 - clamp(S.lt / Math.max(0.5, S.dur - 0.3)) : clamp((S.lt - 0.3) / Math.min(2.2, S.dur * 0.7));
      const open = E.inOutCubic(clamp(q * 1.6)), rise = E.outBack(clamp((q - 0.45) / 0.55), 1.4);
      g.fillStyle = PC.lin(g, 0, 0, 0, H, [P.woodDark, P.wood]); g.fillRect(0, 0, W, H);
      g.save(); PC.applyCam(g, PC.lerpCam(PC.cam(lerp(1260, 960, open), 560, 1.0), PC.cam(960, 600, 1.6), E.inOutSine(close ? q : clamp(S.lt / S.dur))), 1);   // centred on the closed book, then pushing into the pop-up
      const bx = 360, by = 230, bw = 1200, bh = 700, sx = 960;
      // the spread (inside)
      g.save(); if (open < 0.5) { g.beginPath(); g.rect(sx, 0, W, H); g.clip(); }       // closed: only the right half (under the cover) exists
      PC.cut(g, PC.poly([[bx, by], [bx + bw, by], [bx + bw, by + bh], [bx, by + bh]], { seed: 3, amp: 1 }), P.redDark, { shadow: 30, stroke: P.ink, lw: 4 });
      PC.cut(g, PC.poly([[bx + 20, by + 16], [bx + bw - 20, by + 16], [bx + bw - 20, by + bh - 16], [bx + 20, by + bh - 16]], { seed: 4 }), P.paper, { rim: P.white });
      g.save(); g.fillStyle = PC.lin(g, sx - 40, 0, sx + 40, 0, [PC.rgba(P.shadow, 0), PC.rgba(P.shadow, 0.25), PC.rgba(P.shadow, 0)]); g.fillRect(sx - 40, by + 16, 80, bh - 32); g.restore();
      // the pop-up: pieces fold up from the gutter
      if (rise > 0.01) {
        g.save(); g.translate(0, by + bh - 70); g.scale(1, rise); g.translate(0, -(by + bh - 70));
        hills(g, by + bh - 150, 70, P.meadow, 4, bx + 40, bx + bw - 40);
        if ((a.pop || 'castle') === 'castle') castle(g, sx, by + bh - 150, 1.05, 7); else tree(g, sx, by + bh - 160, 1.6, 8);
        tree(g, bx + 200, by + bh - 120, 0.9, 11); tree(g, bx + bw - 200, by + bh - 120, 0.8, 13, P.forest);
        g.restore();
      }
      g.restore();
      // the cover: hinged at the spine, swings over to the left
      const cw = bw / 2, ang = open * Math.PI;
      if (ang < Math.PI - 0.02) {
        const k = Math.cos(ang), front = k > 0;
        g.save(); g.translate(sx, 0); g.scale(k, 1);
        const cv = PC.poly([[0, by - 6], [cw + 10, by - 6], [cw + 10, by + bh + 6], [0, by + bh + 6]], { seed: 21, amp: 1 });
        PC.cut(g, cv, front ? P.red : P.paper2, { shadow: 20, stroke: P.ink, lw: 4, rim: front ? PC.mix(P.red, P.white, 0.35) : P.white });
        if (front) {
          g.strokeStyle = P.gold; g.lineWidth = 5; g.strokeRect(40, by + 40, cw - 70, bh - 80);
          const title = a.title ?? Z.TITLE ?? '';
          g.save(); g.translate(cw / 2 + 5, by + bh / 2); const fs = Math.min(120, (cw - 120) / Math.max(1, [...title].length) * 1.4);
          PC.text(g, title, 0, 0, fs, { family: 'display', fill: P.gold, align: 'center', stroke: P.redDark, strokeW: 10 }); g.restore();
        }
        g.restore();
      }
      g.restore();
    },
  }));

  // ---------------------------------------------------------------- pcWorld: multiplane paper landscape
  const BIOMES = {
    meadow: { sky: [P.skyDay, P.skyDayLow], far: P.mountainFar, mid: P.meadow, ground: P.grass, tree: P.grass },
    village: { sky: [P.skyDusk, P.goldLight], far: P.mountainFar, mid: P.meadow, ground: P.path, tree: P.grassDark, houses: true },
    dusk: { sky: [P.skyDuskHigh, P.skyDusk], far: P.mountain, mid: P.grassDark, ground: P.forest, tree: P.forest },
    snow: { sky: [P.mountainFar, P.snow], far: P.mountain, mid: P.snow, ground: P.snow, tree: P.forest, snowfall: true },
    night: { sky: [P.skyNightHigh, P.skyNight], far: P.mountainDark, mid: P.forest, ground: P.grassDark, tree: P.forest, moon: true },
    cave: { sky: [P.purple, P.skyNightHigh], far: P.purple, mid: P.mountainDark, ground: P.stoneDark, tree: null, crystals: true },
  };
  Z.scene('pcWorld', Object.assign({}, fonts, {
    draw(g, S) {
      const a = S.args, B = BIOMES[a.biome || 'meadow'] || BIOMES.meadow, k = E.inOutSine(S.p);
      const cast = typeof a.cast === 'function' ? a.cast(S) : a.cast || [];
      const C = a.cam ? PC.lerpCam(a.cam.from || PC.cam(), a.cam.to || a.cam.from || PC.cam(), k) : PC.lerpCam(PC.cam(860, 540, 1.0), PC.cam(1080, 520, 1.12), k);
      const fm = a.cam && a.cam.follow != null ? cast[a.cam.follow] : null;      // track an actor: x follows it, a little ahead
      if (fm) C.x = (fm.walkTo ? walkAt(fm, S.t) : fm.x) + (a.cam.lead ?? 160);
      C.zoom *= 1 + (a.cam && a.cam.step != null ? a.cam.step : 0.02) * S.clock.pulse(S.t, 8); C.y -= 8 * S.clock.pulse(S.t, 8);   // a step on every beat
      const fibre = g.createPattern(PC.texture(), 'repeat');
      // each layer is a sheet of paper: its fibre is printed on it and travels with it (not fixed to the screen)
      const layer = (depth, fn, paper = true) => { g.save(); PC.applyCam(g, C, depth); fn(); if (paper) { g.globalCompositeOperation = 'multiply'; g.globalAlpha = 0.9; g.fillStyle = fibre; g.fillRect(-1600, -600, 5200, 2400); } g.restore(); };
      g.fillStyle = PC.lin(g, 0, 0, 0, H, B.sky); g.fillRect(0, 0, W, H);
      layer(0.15, () => {
        if (B.moon) { PC.glow(g, 1450, 220, 260, P.moon, 0.6); PC.cut(g, PC.blob(1450, 220, 90, 90, { seed: 3 }), P.moon, { shadow: 6, rim: P.white }); }
        else if (!B.crystals) for (let i = 0; i < 4; i++) { const cx = ((i * 640 + S.t * 18) % 2600) - 300; PC.cut(g, PC.blob(cx, 150 + 60 * Z.rnd(i, 3), 120, 44, { seed: 30 + i, amp: 0.08, freq: 5 }), P.white, { shadow: 6, alpha: 0.9 }); }
      });
      layer(0.35, () => hills(g, 470, 240, B.far, 3));
      layer(0.65, () => { hills(g, 600, 110, B.mid, 5); if (B.tree) for (let i = 0; i < 8; i++) tree(g, -400 + i * 420 + 120 * Z.rnd(i, 7), 590 + 30 * Z.rnd(i, 8), 0.7, 40 + i, B.tree); });
      layer(1, () => {
        const GY = 740;                                     // the ground line: actors stand here, the dialogue box sits below
        PC.cut(g, PC.poly([[-1200, GY], [3200, GY - 10], [3200, 1600], [-1200, 1600]], { seed: 9, amp: 3, step: 60 }), B.ground, { shadow: 12, stroke: PC.mix(B.ground, P.ink, 0.4), lw: 3 });
        if (B.houses) for (let i = 0; i < 4; i++) house(g, -200 + i * 700, GY, 1, 60 + i, [P.roofRed, P.roof][i % 2]);
        for (let i = 0; i < 40; i++) {                     // pop-up clutter along the ground line: tufts and flowers
          const x = -1100 + i * 110 + 50 * Z.rnd(i, 21), y = GY + 6 + 40 * Z.rnd(i, 22);
          if (i % 3 === 0 && !B.crystals) { PC.cut(g, PC.poly([[x - 4, y], [x + 4, y], [x + 2, y - 34], [x - 2, y - 34]], { seed: 200 + i }), P.grassDark, {}); PC.cut(g, PC.blob(x, y - 40, 12, 12, { seed: 300 + i, amp: 0.1, freq: 5 }), [P.pink, P.gold, P.white, P.red][i % 4], { stroke: P.ink, lw: 2.5 }); }
          else PC.cut(g, PC.poly([[x - 22, y], [x - 12, y - 26 - 10 * Z.rnd(i, 23)], [x - 2, y - 6], [x + 8, y - 30], [x + 22, y]], { seed: 400 + i, round: 0.3 }), PC.mix(B.ground, P.ink, 0.25), { stroke: PC.mix(B.ground, P.ink, 0.5), lw: 2 });
        }
        if (B.crystals) for (let i = 0; i < 9; i++) { const x = -300 + i * 330, h = 80 + 90 * Z.rnd(i, 4); PC.cut(g, PC.poly([[x - 26, GY], [x + 26, GY], [x + 8, GY - h], [x - 6, GY - h * 0.85]], { seed: 70 + i }), P.crystal, { shadow: 8, stroke: P.ink, lw: 3, rim: P.white }); PC.glow(g, x, GY - h * 0.6, 110, P.crystal, 0.35 + 0.15 * Math.sin(S.t * 2 + i)); }
        for (const m of cast) {
          // walk or run by speed; the cycle's phase comes from the distance travelled, so the feet do not slide
          const x = m.walkTo ? walkAt(m, S.t) : m.x, v = m.walkTo ? (walkAt(m, S.t + 0.05) - x) / 0.05 : 0, sc = m.s ?? 1.1;
          const moving = Math.abs(v) > 10, gait = Math.abs(v) / sc > 200 ? 'run' : 'walk';
          PC.doll(g, x, m.y ?? GY + 10, sc, Object.assign({ t: S.t, beat: S.clock.pos(S.t), vel: Math.abs(v), face: v < -10 ? -1 : 1,
            pose: moving ? gait : undefined, phase: moving ? Math.abs(x) / (Z.rig.biped.stride(gait) * sc) : undefined,
            jump: m.hop ? Math.max(0, Math.sin(Math.PI * S.clock.phase(S.t))) * S.clock.pulse(S.t, 2) * 0.6 : 0 }, m));
        }
        for (const b of a.burst || []) PC.burst(g, S.t, b.at, b.x, b.y, b);
      });
      layer(1.4, () => { for (let i = 0; i < 10; i++) { const x = -600 + i * 380; PC.cut(g, PC.poly([[x - 50, 1100], [x - 20, 990 - 40 * Z.rnd(i, 2)], [x + 10, 1100], [x + 40, 1010], [x + 70, 1100]], { seed: 80 + i, round: 0.3 }), PC.mix(B.ground, P.ink, 0.2), { shadow: 6 }); } });
      if (B.snowfall) for (let i = 0; i < 70; i++) { const x = (Z.rnd(i, 1) * W + Math.sin(S.t + i) * 30) % W, y = (Z.rnd(i, 2) * H + S.t * (60 + 40 * Z.rnd(i, 3))) % H; g.fillStyle = PC.rgba(P.white, 0.85); g.beginPath(); g.arc(x, y, 3 + 3 * Z.rnd(i, 4), 0, TAU); g.fill(); }
      // HUD (screen space)
      if (a.hud) {
        const h = a.hud;
        if (h.coins) { let n = 0, t0 = -9; for (const [tk, v] of h.coins) if (S.t >= tk) { n = v; t0 = tk; } PC.coins(g, 120, 90, n, S.t - t0); }
        if (h.hp != null) PC.bar(g, 1500, 70, 300, at(h.hp, S.t, 0.4), { label: 'HP' });
        for (const t0 of h.lv || []) PC.lvUp(g, 960, 330, S.t - t0);
      }
      if (a.mini) { const R = { x: 1560, y: 120, w: 300, h: 200 }; PC.map(g, R, a.mini.route, lerp(a.mini.from ?? 0, a.mini.to ?? 1, S.p), { marks: a.mini.marks, iconScale: 2.4 }); }
      PC.dialog(g, S, a.line, { speaker: a.speaker, portrait: a.portrait });
    },
  }));

  // ---------------------------------------------------------------- pcMap
  Z.scene('pcMap', Object.assign({}, fonts, {
    draw(g, S) {
      const a = S.args, unfold = E.outBack(clamp(S.lt / 0.5), 1.3), p = lerp(a.from ?? 0, a.to ?? 1, E.inOutSine(clamp((S.lt - 0.3) / Math.max(0.5, S.dur - 0.6))));
      g.fillStyle = PC.lin(g, 0, 0, 0, H, [P.woodDark, P.wood]); g.fillRect(0, 0, W, H);
      const route = a.route || [[0.1, 0.75], [0.25, 0.6], [0.42, 0.68], [0.55, 0.45], [0.7, 0.5], [0.85, 0.3]];
      const MR = { x: 200, y: 110, w: 1520, h: 760 }, hk = Math.min(route.length - 1, Math.max(0, Math.ceil(route.length * p) - 1)), hd = route[hk];
      const fx = MR.x + hd[0] * MR.w, fy = MR.y + hd[1] * MR.h, zk = E.inOutSine(clamp(S.lt / Math.max(0.5, S.dur)));
      g.save(); PC.applyCam(g, PC.cam(lerp(960, fx, 0.55 * zk), lerp(540, fy, 0.45 * zk), lerp(1.0, 1.45, zk)), 1);   // the camera follows the route's head
      g.translate(0, 540); g.scale(1, Math.max(0.02, unfold)); g.translate(0, -540);
      g.save(); g.globalCompositeOperation = 'multiply'; g.fillStyle = g.createPattern(PC.texture(), 'repeat'); g.fillRect(0, 0, W, H); g.restore();   // the desk's fibre, moving with the camera
      PC.map(g, MR, route, p, { marks: a.marks || [{ at: [0.1, 0.75], icon: 'castle' }, { at: [0.3, 0.4], icon: 'tree' }, { at: [0.48, 0.78], icon: 'house' }, { at: [0.62, 0.3], icon: 'peak' }, { at: [0.86, 0.3], icon: 'cave' }] });
      g.save(); g.globalCompositeOperation = 'multiply'; g.fillStyle = g.createPattern(PC.texture(), 'repeat'); g.translate(37, 11); g.fillRect(MR.x - 37, MR.y - 11, MR.w, MR.h); g.restore();   // the map's own fibre
      g.restore();
      PC.dialog(g, S, a.line, { speaker: a.speaker });
    },
  }));

  // ---------------------------------------------------------------- pcBattle: a paper-theatre battle screen
  Z.scene('pcBattle', Object.assign({}, fonts, {
    draw(g, S) {
      const a = S.args, C = S.clock, beat = C.beat(S.t);
      g.fillStyle = PC.lin(g, 0, 0, 0, H, [P.skyNightHigh, P.purple]); g.fillRect(0, 0, W, H);
      g.save(); PC.applyCam(g, PC.cam(960 + 70 * Math.sin(S.t * 1.3), 540 - 26 * C.pulse(S.t, 8), 1.04 + 0.05 * C.pulse(S.t, 7) + 0.03 * Math.sin(S.t * 0.9)), 1);   // never still: sway + a bump on every beat
      PC.rays(g, 960, 560, 900, { n: 16, rot: S.t * 0.15, color: P.gold, alpha: 0.25 });
      PC.cut(g, PC.poly([[120, 720], [1800, 720], [1920, 1100], [0, 1100]], { seed: 5 }), P.wood, { shadow: 14, stroke: P.ink, lw: 4, rim: P.sand });
      for (const side of [-1, 1]) PC.cut(g, PC.poly(side < 0 ? [[-40, -40], [230, -40], [170, 400], [210, 1100], [-40, 1100]] : [[1960, -40], [1690, -40], [1750, 400], [1710, 1100], [1960, 1100]], { seed: 6 + side, round: 0.2 }), P.red, { shadow: 16, stroke: P.ink, lw: 4, rim: PC.mix(P.red, P.white, 0.3) });
      PC.cut(g, PC.poly([[-40, -40], [1960, -40], [1960, 90], [-40, 90]], { seed: 9 }), P.redDark, { shadow: 12, stroke: P.ink, lw: 4 });
      const hit = (a.hits || null), last = hit ? hit.filter(x => x <= S.t).pop() : C.at(beat), age = S.t - (last ?? -9);
      const recoil = Math.exp(-age * 8) * (beat % 2 ? 1 : -1);
      PC.doll(g, 560 - 30 * Math.max(0, recoil), 760, 1.25, Object.assign({ t: S.t, armF: 1.3 + 0.6 * Math.max(0, -recoil), eyes: recoil < -0.3 ? 'wide' : 'dot', mouth: recoil < -0.3 ? 'grin' : 'smile' }, a.hero || {}));
      const foe = a.foe || {}, fx = 1360 + 30 * Math.max(0, -recoil), sq = 1 + 0.12 * Math.sin(S.t * 6);
      g.save(); g.translate(fx, 760); g.scale(1 / sq, sq);
      const body = PC.blob(0, -110, 150, 120, { seed: 77, amp: 0.05, freq: 4 });
      PC.cut(g, body, foe.col || P.purple, { shadow: 18, stroke: P.ink, lw: 4, rim: PC.mix(foe.col || P.purple, P.white, 0.4) });
      for (const ex of [-50, 50]) { PC.cut(g, PC.blob(ex, -140, 26, 30, { seed: 80 + ex }), P.white, { stroke: P.ink, lw: 3 }); g.fillStyle = P.ink; g.beginPath(); g.arc(ex - 6, -136, 11, 0, TAU); g.fill(); }
      g.restore();
      if (recoil > 0.2) PC.damage(g, fx, 520, 7 + (beat * 37) % 93, age); else if (recoil < -0.2) PC.damage(g, 560, 480, 1 + (beat * 13) % 9, age);
      g.restore();
      const names = a.names || ['HERO', 'FOE'];
      [[150, names[0], 0.2 + 0.8 * (1 - (beat % 9) / 12)], [1170, names[1], Z.clamp(1 - beat / 64)]].forEach(([x, nm, hp]) => {
        PC.panel(g, { x, y: 120, w: 600, h: 110 }, { seed: x, cornerSize: 18 }); PC.nameTab(g, nm, x + 30, 122, { size: 30 });
        PC.bar(g, x + 120, 162, 440, hp, { label: 'HP' });
      });
      PC.menu(g, { x: 1530, y: 420, w: 330, h: 320 }, a.items || ['FIGHT', 'MAGIC', 'ITEM', 'RUN'], ((beat % 4) + 4) % 4, S.t);
      PC.dialog(g, S, a.line, { speaker: a.speaker, rect: { x: 335, y: 820, w: 1250, h: 190 }, size: 54 });   // centred: the 9:16 crop keeps it
    },
  }));

  // ---------------------------------------------------------------- transitions
  Z.transition('pageTurn', (g, A, B, k, o) => {
    const q = E.inOutSine(k), right = o.dir !== 'right', xf = right ? lerp(W + 40, -40, q) : lerp(-40, W + 40, q);
    g.save(); g.beginPath(); right ? g.rect(0, 0, xf, H) : g.rect(xf, 0, W - xf, H); g.clip(); g.drawImage(A, 0, 0); g.restore();
    g.save(); g.beginPath(); right ? g.rect(xf, 0, W - xf, H) : g.rect(0, 0, xf, H); g.clip(); g.drawImage(B, 0, 0); g.restore();
    const fw = Math.min(W - xf, xf, 420) * (right ? 1 : 1), dir = right ? -1 : 1;   // the lifted page, its back showing
    if (q > 0 && q < 1) {
      const fl = new Path2D(); fl.moveTo(xf, -20); fl.lineTo(xf + dir * fw * 0.8, -20); fl.quadraticCurveTo(xf + dir * fw, H / 2, xf + dir * fw * 0.8, H + 20); fl.lineTo(xf, H + 20); fl.closePath();
      g.save(); g.shadowColor = PC.rgba(P.shadow, 0.35); g.shadowBlur = 30; g.shadowOffsetX = dir * 12; g.fillStyle = P.paper2; g.fill(fl); g.restore();
      PC.shade(g, fl, P.kraftDark, xf, 0, xf + dir * fw, 0, 0.35, 0.02);
      g.save(); g.strokeStyle = PC.rgba(P.ink, 0.6); g.lineWidth = 3; g.stroke(fl); g.restore();
    }
  });
  const shapePath = (shape, cx, cy, r) => {
    if (shape === 'star') return PC.poly(Array.from({ length: 10 }, (_, i) => { const a = -Math.PI / 2 + i * Math.PI / 5, q = i % 2 ? r * 0.45 : r; return [cx + Math.cos(a) * q, cy + Math.sin(a) * q]; }), { seed: 5, amp: r * 0.004 });
    if (shape === 'heart') return PC.smooth(Array.from({ length: 40 }, (_, i) => { const a = i / 40 * TAU; return [cx + 16 * Math.pow(Math.sin(a), 3) * r / 17, cy - (13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a)) * r / 17]; }));
    if (shape === 'keyhole') { const p = new Path2D(); p.addPath(PC.blob(cx, cy - r * 0.3, r * 0.42, r * 0.42, { seed: 6 })); p.addPath(PC.poly([[cx - r * 0.18, cy - r * 0.2], [cx + r * 0.18, cy - r * 0.2], [cx + r * 0.32, cy + r * 0.7], [cx - r * 0.32, cy + r * 0.7]], { seed: 7 })); return p; }
    return PC.blob(cx, cy, r, r, { seed: 8, amp: 0.01 });
  };
  Z.transition('shapeReveal', (g, A, B, k, o) => {
    g.drawImage(A, 0, 0);
    const r = E.inOutCubic(k) * Math.hypot(W, H) * (o.shape === 'keyhole' ? 1.4 : 0.9), path = shapePath(o.shape || 'circle', o.cx ?? W / 2, o.cy ?? H / 2, Math.max(1, r));
    g.save(); g.clip(path); g.drawImage(B, 0, 0); g.restore();
    if (k > 0 && k < 1) { g.save(); g.lineWidth = 8; g.strokeStyle = P.paper; g.stroke(path); g.lineWidth = 3; g.strokeStyle = P.ink; g.stroke(path); g.restore(); }
  });

  // ---------------------------------------------------------------- finish
  PC.isPaper = shot => !!shot && /^pc[A-Z]/.test(shot.scene);
  PC.install = () => {
    if (PC.installed) return;
    const prev = Z.layerFX;
    Z.layerFX = (L, t) => {
      if (prev) prev(L, t);
      if (!PC.isPaper(L.shot)) return;
      const g = L.scene; g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'multiply'; g.fillStyle = g.createPattern(PC.texture(), 'repeat'); g.fillRect(0, 0, W, H);
      g.translate(W / 2, H / 2); g.scale(1.35, 1); const v = g.createRadialGradient(0, -40, H * 0.3, 0, 0, H * 0.82); v.addColorStop(0, 'rgba(255,255,255,0)'); v.addColorStop(0.7, 'rgba(205,190,170,.25)'); v.addColorStop(1, 'rgba(96,80,64,.42)'); g.fillStyle = v; g.fillRect(-W, -H, 2 * W, 2 * H); g.restore();
    };
    PC.installed = true;
  };
  PC.post = { boil: 0, bloom: 0.12, bloomThreshold: 0.85, grain: 0.03, vignette: 0, lutMix: 0, ca: 0 };
})();
