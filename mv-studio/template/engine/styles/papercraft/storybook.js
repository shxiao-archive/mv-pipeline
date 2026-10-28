/* styles/papercraft — storybook.js: a cut-paper collage picture book, read aloud. Each shot is one spread of the open
 * book; the picture is printed across both pages, the lyric line is set on the page as the story's text (inked in as
 * sung), and the camera holds while the cast crosses the spread. Lyric text never appears in code.
 *
 * 'pcStory'  { land: 'meadow' | 'dusk' | 'snow' | 'blank' | a palette object like PC.story.LANDS.meadow,
 *              line (index, or [indices]: the latest started), textAt 'L' | 'R' (the text's page; sun and clouds go to
 *              the other), cast(S) -> [{ who, x, y, s, face, walk 0..1, phase (walk cycles), nod, front, look }],
 *              back(g, S), front(g, S) (your own pieces behind / in front of the cast) }
 *
 *   PC.story.puppet(g, who, x, y, s, o)   a paper puppet cut from a generated reference sheet (tools/cut_puppet.py ->
 *                                         assets/cast/rig.json + pieces): legs swing at the hip, the head nods on the
 *                                         neck, extras (a tail, a cape end) swing behind the body. A role with no rig
 *                                         entry falls back to a flat PC.doll (o.look: its options) so a new project
 *                                         renders before the cast is cut. s = 1: the role's `tall` px.
 *   PC.story.looks[who] = look            draw that role as the jointed PC.doll instead (its rigged walk: knees, arms,
 *                                         planted feet; look: the doll's options, ears / tail too). s 0.42 ~ 260 px.
 *   PC.story.cut(g, path, col, o)         a collage piece: painted tissue fill, a torn white edge (o.edge px), a shadow
 *   PC.story.land(g, B, o)                the land of one spread: a clean sky, a sun, puffy clouds, two soft ranges,
 *                                         rolling hills, round trees (pines on snow), a path, tissue flowers; B.ink: the text colour (a dark land wants a light one)
 *
 * Paper fibre and the vignette come from PC.install's frame pass (the scene name starts with pc); nothing here adds
 * mottling: the pages stay clean. Landscape (1920x1080) only.
 * mv-studio (MIT). The land's layering follows dalabengba-mv's journey (ISC, licenses/LICENSE-dalabengba-mv.txt).
 */
(() => {
  'use strict';
  const Z = window.Z, PC = (Z.PC = Z.PC || {}), TAU = Math.PI * 2, clamp = Z.clamp;
  const SB = (PC.story = {});
  const PAGE = { x: 46, y: 34, w: 1828, h: 1004 }, GUT = 960, GY = 812;   // the open spread, the gutter, the ground line
  SB.PAGE = PAGE; SB.GY = GY;

  // ---------------------------------------------------------------- material
  const hex = c => { const n = parseInt(c.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
  const shift = (c, k) => { const [r, g, b] = hex(c); const f = v => Math.round(clamp(k > 0 ? v + (255 - v) * k : v * (1 + k), 0, 255)); return `rgb(${f(r)},${f(g)},${f(b)})`; };
  const tiles = new Map();
  SB.tissue = col => {                                           // painted tissue of one colour (built once per colour)
    if (tiles.has(col)) return tiles.get(col);
    const size = 384, c = Z.canvas(size, size), g = c.getContext('2d'), rnd = Z.rng(hex(col).reduce((a, v) => a * 31 + v, 7));
    g.fillStyle = col; g.fillRect(0, 0, size, size);
    g.lineCap = 'round';
    for (let i = 0; i < 70; i++) {                               // broad brush streaks, lighter and darker, mostly level
      const x = rnd() * size, y = rnd() * size, len = 90 + rnd() * 200, ang = (rnd() - 0.5) * 0.5, w = 8 + rnd() * 22;
      g.strokeStyle = shift(col, rnd() < 0.5 ? 0.10 + rnd() * 0.08 : -0.06 - rnd() * 0.06); g.globalAlpha = 0.16 + rnd() * 0.18; g.lineWidth = w;
      for (let ox = -1; ox <= 1; ox++) for (let oy = -1; oy <= 1; oy++) {
        const bx = x + ox * size, by = y + oy * size;
        g.beginPath(); g.moveTo(bx, by); g.quadraticCurveTo(bx + Math.cos(ang) * len * 0.5, by + Math.sin(ang) * len * 0.5 + (rnd() - 0.5) * 10, bx + Math.cos(ang) * len, by + Math.sin(ang) * len); g.stroke();
      }
    }
    g.globalAlpha = 1;
    const img = g.getImageData(0, 0, size, size), d = img.data;   // fine pigment grain
    for (let i = 0; i < d.length; i += 4) { const n = (rnd() - 0.5) * 10; d[i] += n; d[i + 1] += n; d[i + 2] += n; }
    g.putImageData(img, 0, 0);
    tiles.set(col, c);
    return c;
  };
  SB.cut = (g, path, col, o = {}) => {
    const { edge = 0, shadow = 6, alpha = 1, edgeCol = '#FFFBF1' } = o;
    g.save();
    g.globalAlpha *= alpha;
    if (shadow > 0) { g.shadowColor = 'rgba(70,50,40,0.16)'; g.shadowBlur = shadow * 1.6; g.shadowOffsetX = shadow * 0.3; g.shadowOffsetY = shadow * 0.6; }
    if (edge > 0) { g.save(); g.translate(-edge * 0.3, -edge); g.fillStyle = edgeCol; g.fill(path); g.restore(); g.shadowColor = 'transparent'; }
    g.fillStyle = g.createPattern(SB.tissue(col), 'repeat'); g.fill(path);
    g.restore();
  };

  // ---------------------------------------------------------------- the paper puppets
  let RIG = null;
  SB.looks = {};                                                 // who -> PC.doll look: that role is drawn as the jointed doll
  const IMG = (who, part) => Z.imgSync(`assets/cast/${who}_${part}.png`);
  const darkLegs = new Map();
  const backLeg = who => {                                       // the far leg: the same piece, in shade
    if (darkLegs.has(who)) return darkLegs.get(who);
    const im = IMG(who, 'leg'), c = Z.canvas(im.width, im.height), g = c.getContext('2d');
    g.drawImage(im, 0, 0); g.globalCompositeOperation = 'source-atop'; g.fillStyle = 'rgba(40,30,40,0.28)'; g.fillRect(0, 0, im.width, im.height);
    darkLegs.set(who, c); return c;
  };
  const place = (g, im, r) => g.drawImage(im, r.x, r.y, r.w, r.h);
  SB.puppet = (g, who, x, y, s, o = {}) => {
    const R = RIG && RIG[who], { face = 1, phase = 0, walk = 0, nod = 0, t = 0 } = o, look = SB.looks[who];
    if (!R || look) {                                            // the jointed doll, ~ the same height; its feet plant by x
      const sd = s * 2.4, step = walk ? face * x / (Z.rig.biped.STRIDE.walk * sd) : undefined;
      return PC.doll(g, x, y, sd, Object.assign({ face, t, walk: step, detail: 0, jointsAdd: { nod: nod * 180 / Math.PI }, joints: o.front ? { yaw: 0 } : undefined }, look, o.look));
    }
    s *= R.scale ?? 1;
    g.save();
    g.translate(x, y);
    g.shadowColor = 'rgba(60,40,40,0.22)'; g.shadowBlur = 10; g.shadowOffsetX = 3 * face; g.shadowOffsetY = 5;
    if (o.front) { g.scale(s, s); g.drawImage(IMG(who, 'front'), -R.front.w / 2, -R.front.h, R.front.w, R.front.h); g.restore(); return; }
    g.scale(-face * s, s);                                       // the sheets face left
    const a = walk * 0.42 * Math.sin(phase * TAU), L = -R.hip[1];
    g.translate(0, L * (1 - Math.cos(a)) - walk * 4 * Math.abs(Math.cos(phase * TAU)));   // the planted foot stays down
    const leg = (im, ang) => { g.save(); g.translate(R.hip[0], R.hip[1]); g.rotate(ang); g.translate(-R.hip[0], -R.hip[1]); place(g, im, R.leg); g.restore(); };
    leg(backLeg(who), a);
    leg(IMG(who, 'leg'), -a);
    g.shadowColor = 'transparent';
    g.translate(R.hip[0], R.hip[1]); g.rotate(walk * 0.025 * Math.sin(phase * TAU * 2)); g.translate(-R.hip[0], -R.hip[1]);
    g.save();                                                    // the head turns on the neck, under the collar
    const [nx, ny] = R.neck;
    g.translate(nx, ny); g.rotate(-nod + walk * 0.035 * Math.sin(phase * TAU * 2 + 0.6)); g.translate(-nx, -ny);
    place(g, IMG(who, 'head'), R.head);
    g.restore();
    for (const e of R.extras || []) {                            // a tail, a cape end: hanging back, swinging with the walk
      const k = e.len / e.w;
      g.save(); g.translate(e.at[0], e.at[1]); g.rotate(e.angle + e.sway * Math.sin(t * 2.2) + walk * 0.14 * Math.sin(phase * TAU));
      g.scale(k, k); g.drawImage(IMG(who, e.name), -e.base[0], -e.base[1], e.w, e.h); g.restore();
    }
    place(g, IMG(who, 'body'), R.body);
    g.restore();
  };

  // ---------------------------------------------------------------- the land of one spread
  const LANDS = {
    meadow: { sky: ['#CFE6F1', '#F6F1E2'], sun: '#FFE08A', far: '#AEB9D8', far2: '#C9D0E6', hill: ['#A8D57F', '#86C467'], ground: '#8CC86C', path: '#EAD3A2', tree: '#5FAE57', treeHi: '#A4D67C', trunk: '#8C5B3C', flowers: ['#F2918C', '#FFF4D8', '#F2B634'], grass: true },
    dusk: { sky: ['#F2B8A2', '#FBE4C6'], sun: '#FFC77E', far: '#9C8BB5', far2: '#C4ADC8', hill: ['#C9AE70', '#AE925E'], ground: '#B99D63', path: '#EDCF9C', tree: '#7C8F50', treeHi: '#A9B66C', trunk: '#6E4A33', flowers: ['#F2918C', '#FFF4D8'], grass: true },
    snow: { sky: ['#C8D6EA', '#F3F5FA'], sun: '#FFF6DE', far: '#98A9CB', far2: '#B9C5DE', hill: ['#EDF2F9', '#DCE6F2'], ground: '#F2F6FB', path: '#D6E0EE', tree: '#3E7A63', treeHi: '#5E9A7E', trunk: '#6B4A36', pine: true, flowers: [] },
    blank: { sky: ['#F4EEDF', '#F7F2E6'], far: '#DCD4C4', far2: '#E6DFD0', hill: ['#E2D9C6', '#D8CDB6'], ground: '#D5C7AA', path: '#EADFC6', tree: null, flowers: [], clouds: 0.6 },
  };
  SB.LANDS = LANDS;
  const ridge = (x0, x1, y, amp, seed, waves = 3) => {        // a rolling hill line, closed down to the page bottom
    const pts = [];
    for (let i = 0; i <= 24; i++) { const k = i / 24, x = x0 + (x1 - x0) * k; pts.push([x, y - amp * (0.5 + 0.5 * Math.sin(k * waves * TAU * 0.5 + seed)) - amp * 0.25 * Math.sin(k * 7.3 + seed * 2)]); }
    pts.push([x1, PAGE.y + PAGE.h + 40], [x0, PAGE.y + PAGE.h + 40]);
    return PC.poly(pts, { seed, amp: 1.8, step: 18, round: 0.9 });
  };
  const peaks = (x0, x1, y, h, n, seed) => {                    // a soft far range: rounded peaks of varied height
    const pts = [[x0, y]];
    for (let i = 0; i < n; i++) { const xa = x0 + (x1 - x0) * (i + 0.5) / n + (Z.rnd(seed, i) - 0.5) * 160, hh = h * (0.4 + 0.6 * Z.rnd(seed, i, 2)), sp = 150 + 90 * Z.rnd(seed, i, 3); pts.push([xa - sp, y - hh * 0.25], [xa - sp * 0.2, y - hh * 0.96], [xa + sp * 0.15, y - hh], [xa + sp, y - hh * 0.3]); }
    pts.push([x1, y], [x1, y + 60], [x0, y + 60]);
    return PC.poly(pts, { seed, amp: 2, step: 20, round: 0.8 });
  };
  const tree = (g, B, x, y, r, seed) => {
    if (B.pine) {
      SB.cut(g, PC.poly([[x - 9, y], [x - 9, y - r * 0.5], [x + 9, y - r * 0.5], [x + 9, y]], { seed }), B.trunk, { shadow: 3 });
      for (let k = 0; k < 3; k++) { const yy = y - r * (0.35 + k * 0.55), w = r * (1 - k * 0.22); SB.cut(g, PC.poly([[x - w, yy], [x, yy - r * 0.95], [x + w, yy]], { seed: seed + k, amp: 2, round: 0.25 }), k % 2 ? B.treeHi : B.tree, { shadow: 4, edge: 3 }); }
      return;
    }
    SB.cut(g, PC.poly([[x - 10, y + 4], [x - 7, y - r * 0.9], [x + 7, y - r * 0.9], [x + 11, y + 4]], { seed, amp: 1.2 }), B.trunk, { shadow: 3 });
    const top = PC.blob(x, y - r * 1.55, r, r * 0.95, { seed, amp: 0.05 });
    SB.cut(g, top, B.tree, { shadow: 8, edge: 4 });
    g.save(); g.clip(top); SB.cut(g, PC.blob(x - r * 0.28, y - r * 1.8, r * 0.62, r * 0.55, { seed: seed + 3, amp: 0.06 }), B.treeHi, { shadow: 0 }); g.restore();
  };
  SB.land = (g, B, o = {}) => {
    const { t = 0, textAt = 'L' } = o, P0 = PAGE, mx = x => (textAt === 'R' ? 1920 - x : x);   // the sun and clouds keep off the text
    g.fillStyle = PC.lin(g, 0, P0.y, 0, GY - 120, B.sky); g.fillRect(P0.x, P0.y, P0.w, P0.h);
    if (B.sun) SB.cut(g, PC.blob(mx(1520), 210, 62, 62, { seed: 9, amp: 0.03 }), B.sun, { shadow: 0 });
    for (const [cx, cy, w, sd, sp] of [[1180, 140, 130, 1, 6], [1660, 320, 90, 2, 4], [560, 380, 80, 3, 8]]) {   // clouds drift a little
      const x = mx(cx) + Math.sin(t * 0.05 * sp) * 40, p = new Path2D();
      p.addPath(PC.blob(x, cy, w, w * 0.32, { seed: sd })); p.addPath(PC.blob(x - w * 0.35, cy - w * 0.18, w * 0.42, w * 0.34, { seed: sd + 5 })); p.addPath(PC.blob(x + w * 0.25, cy - w * 0.2, w * 0.5, w * 0.4, { seed: sd + 7 }));
      SB.cut(g, p, '#FFFDF7', { shadow: 3, alpha: B.clouds ?? 1 });
    }
    SB.cut(g, peaks(P0.x - 40, P0.x + P0.w + 40, 560, 230, 6, 21), B.far2, { shadow: 0, edge: 3 });
    SB.cut(g, peaks(P0.x - 40, P0.x + P0.w + 40, 620, 170, 8, 33), B.far, { shadow: 2, edge: 3 });
    SB.cut(g, ridge(P0.x - 40, P0.x + P0.w + 40, 650, 70, 4, 2.2), B.hill[0], { shadow: 4, edge: 5 });
    if (B.tree) for (const [x, r, sd] of [[260, 48, 1], [520, 34, 2], [1180, 40, 3], [1420, 56, 4], [1700, 36, 5]]) tree(g, B, x, 668 + r * 0.2, r, sd);
    SB.cut(g, ridge(P0.x - 40, P0.x + P0.w + 40, 742, 46, 9, 1.6), B.hill[1], { shadow: 7 });
    SB.cut(g, PC.poly([[P0.x - 40, GY - 22], [P0.x + P0.w + 40, GY - 30], [P0.x + P0.w + 40, P0.y + P0.h + 40], [P0.x - 40, P0.y + P0.h + 40]], { seed: 13, amp: 2.5, step: 30 }), B.ground, { shadow: 8 });
    SB.cut(g, PC.poly([[P0.x - 40, GY - 6], [P0.x + P0.w + 40, GY - 12], [P0.x + P0.w + 40, GY + 30], [P0.x - 40, GY + 38]], { seed: 14, amp: 2.2, step: 24 }), B.path, { shadow: 3 });
    for (let i = 0; i < 9 && B.flowers.length; i++) {           // small clusters of tissue flowers in the grass
      const cx = P0.x + 80 + (i + Z.rnd(31, i) * 0.6) * P0.w / 9.3, cy = GY + 90 + Z.rnd(32, i) * 90;
      for (let k = 0; k < 4; k++) SB.cut(g, PC.blob(cx + (Z.rnd(33, i, k) - 0.5) * 70, cy + (Z.rnd(34, i, k) - 0.5) * 30, 7, 6, { seed: i * 7 + k }), B.flowers[(i + k) % B.flowers.length], { shadow: 2 });
    }
  };
  const foreground = (g, B, t) => {                             // a strip of grass at the page foot, swaying
    if (!B.grass) return;
    const col = shift(B.hill[1], -0.10), y0 = PAGE.y + PAGE.h + 6;
    for (let i = 0; i < 16; i++) {
      const x = PAGE.x + 40 + i * 118 + Z.rnd(41, i) * 50, sway = Math.sin(t * 1.4 + i * 0.9) * 6, p = new Path2D();
      for (let k = -1; k <= 1; k++) { const h = (44 + Z.rnd(42, i, k) * 40) * (k ? 0.8 : 1); p.addPath(PC.poly([[x + k * 16 - 11, y0], [x + k * 26 + sway, y0 - h], [x + k * 16 + 11, y0]], { seed: i * 3 + k, amp: 1, round: 0.4 })); }
      SB.cut(g, p, col, { shadow: 3 });
    }
  };

  // ---------------------------------------------------------------- the book around the picture
  const book = g => {
    g.fillStyle = PC.lin(g, 0, 0, 0, 1080, ['#6E4A33', '#5B3B28']); g.fillRect(0, 0, 1920, 1080);   // the desk
    const P0 = PAGE;
    SB.cut(g, PC.poly([[P0.x - 22, P0.y - 14], [P0.x + P0.w + 22, P0.y - 14], [P0.x + P0.w + 22, P0.y + P0.h + 22], [P0.x - 22, P0.y + P0.h + 22]], { seed: 2, amp: 0.6 }), '#9C3B33', { shadow: 14 });   // the cloth cover
    for (let k = 4; k >= 1; k--) { g.fillStyle = k % 2 ? '#EFE5D0' : '#E4D8BF'; g.fillRect(P0.x - k * 2.5, P0.y + k * 1.5, P0.w + k * 5, P0.h + k * 2.5); }   // the page stack
  };
  const gutter = g => {                                          // the pages curve down into the spine; printed ink follows
    const P0 = PAGE;
    g.save(); g.globalCompositeOperation = 'multiply';
    g.fillStyle = PC.lin(g, GUT - 70, 0, GUT + 70, 0, [[0, 'rgba(255,255,255,1)'], [0.35, 'rgba(236,228,216,1)'], [0.5, 'rgba(178,160,142,1)'], [0.65, 'rgba(236,228,216,1)'], [1, 'rgba(255,255,255,1)']]);
    g.fillRect(GUT - 70, P0.y, 140, P0.h);
    g.fillStyle = PC.lin(g, P0.x, 0, P0.x + P0.w, 0, [[0, 'rgba(225,215,200,1)'], [0.06, 'rgba(255,255,255,1)'], [0.94, 'rgba(255,255,255,1)'], [1, 'rgba(225,215,200,1)']]);
    g.fillRect(P0.x, P0.y, P0.w, P0.h);
    g.restore();
  };

  // ---------------------------------------------------------------- the story's text, set on the page
  // the row of each character: rows of even width (no row left holding a stray character), a spaced line broken at its
  // spaces (its phrase breaks), never a row starting with small kana or punctuation
  const NO_START = new Set('、。，．,.!?！？ーぁぃぅぇぉっゃゅょゎァィゥェォッャュョヮ」』）)');
  SB.rows = (chars, widths, maxW) => {
    const tot = widths.reduce((a, b) => a + b, 0), lim = Math.min(maxW, tot / Math.ceil(tot / maxW) * 1.12), spaced = chars.includes(' ');
    const wordW = k => { let w = 0; while (k < chars.length && chars[k] !== ' ') w += widths[k++]; return w; };
    let r = 0, x = 0;
    return chars.map((ch, k) => {
      if (x > 0 && (ch === ' ' ? x + wordW(k + 1) > lim : !NO_START.has(ch) && x + widths[k] > (spaced ? maxW : lim))) { r++; x = 0; }
      if (x > 0 || ch !== ' ') x += widths[k];                  // a space that starts a row takes no room
      return r;
    });
  };
  const text = (g, S, i, at, ink = '#3B302B') => {
    if (i == null || i < 0) return;
    const L = Z.line(i); if (!L.text) return;
    const n = Z.charsAt(i, S.t), size = 62, x0 = at === 'R' ? GUT + 130 : PAGE.x + 130, maxW = 680;
    g.save();
    g.font = `600 ${size}px "Klee One", "Noto Serif JP", serif`; g.textBaseline = 'alphabetic'; g.fillStyle = ink;
    const chars = [...L.text], W = chars.map(ch => g.measureText(ch).width + 2), row = SB.rows(chars, W, maxW);
    let x = x0;
    chars.forEach((ch, k) => {
      if (k && row[k] !== row[k - 1]) x = x0;
      if (x === x0 && ch === ' ') return;
      const a = clamp(n - k);                                   // each character inks in as it is sung
      if (a > 0) { g.globalAlpha = a; g.fillText(ch, x, PAGE.y + 170 + row[k] * size * 1.6); }
      x += W[k];
    });
    g.restore();
  };

  // ---------------------------------------------------------------- the spread
  Z.scene('pcStory', {
    async init() {
      if (!RIG) {                                                // the cut cast, if there is one yet (tools/cut_puppet.py)
        RIG = await fetch(Z.ROOT + 'assets/cast/rig.json').then(r => (r.ok ? r.json() : {})).catch(() => ({}));
        await Z.preload(Object.entries(RIG).flatMap(([w, R]) => ['head', 'body', 'leg', 'front', ...(R.extras || []).map(e => e.name)].map(p => `assets/cast/${w}_${p}.png`)));
      }
      await Promise.all(['600 50px "Klee One"', '400 50px "Klee One"'].map(f => document.fonts.load(f, 'あ字')));
    },
    draw(g, S) {
      const a = S.args, B = typeof a.land === 'object' ? a.land : LANDS[a.land || 'meadow'];
      book(g);
      g.save();
      g.beginPath(); g.rect(PAGE.x, PAGE.y, PAGE.w, PAGE.h); g.clip();
      SB.land(g, B, { t: S.t, textAt: a.textAt });
      if (a.back) a.back(g, S);
      const cast = (typeof a.cast === 'function' ? a.cast(S) : a.cast || []).slice().sort((p, q) => (p.y ?? GY) - (q.y ?? GY));
      for (const m of cast) SB.puppet(g, m.who, m.x, m.y ?? GY + 14, m.s ?? 0.7, Object.assign({ t: S.t }, m));
      if (a.front) a.front(g, S);
      foreground(g, B, S.t);
      text(g, S, Array.isArray(a.line) ? a.line.filter(i => Z.line(i).t - 0.35 <= S.t).pop() : a.line, a.textAt || 'L', B.ink);
      gutter(g);
      g.restore();
    },
  });
})();
