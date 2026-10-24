/* styles/papercraft — rpg.js: the retro-RPG interface made of paper (the film's "interface language"): cream card
 * panels with an ink line, a dashed stitch and gold corners; a red name tab; the dialogue box that types the lyric as it
 * is sung; HP / EXP bars, LV UP, a coin counter, a battle menu, damage numbers, and the parchment map with a route.
 * Every function is pure (reads its args, incl. song time) and saves / restores the ctx.
 *
 *   PC.text(g, s, x, y, size, o)          o: { family 'display' | 'play' | 'serif' | 'latin', weight, fill, align, stroke }
 *   PC.panel(g, rect, o)                  card panel {x, y, w, h}: o: { fill, stitch, corners, seed, lw }
 *   PC.nameTab(g, text, x, y, o)          red tab with cream text (o: { size, anchor 'left' | 'right' | 'center', color })
 *   PC.dialog(g, S, line, o)              the lyric line typed in a dialogue box as sung (Z.charsAt, never ahead):
 *                                         o: { rect, speaker (name tab text: your own words, never lyric text), portrait
 *                                         (g, x, y, r) => void, pop 0..1, size }
 *   PC.bar(g, x, y, w, v, o)              HP / EXP bar (o: { label, col, h })
 *   PC.lvUp(g, x, y, k, o) / PC.coins(g, x, y, n, k) / PC.damage(g, x, y, n, age)
 *   PC.menu(g, rect, items, sel, t)       battle menu, the cursor on item `sel`
 *   PC.map(g, rect, route, p, o)          parchment map: route [[x, y], ...] (0..1 of the rect), drawn to p, marker at
 *                                         the head; o: { marks: [{ at: [u, v], icon: 'castle' | 'tree' | 'peak' | 'cave' | 'house' }] }
 *
 * mv-studio (MIT). The paper-RPG interface idea (panels, name tabs, stitched card, gold corners) after dalabengba-mv's
 * src/ui/kit.js (ISC); written for this engine with our own copy.
 */
(() => {
  'use strict';
  const Z = window.Z, PC = (Z.PC = Z.PC || {}), TAU = Math.PI * 2;
  const P = PC.PAL, E = Z.ease, clamp = Z.clamp;

  PC.text = (g, s, x, y, size, o = {}) => {
    g.save(); g.font = `${o.weight || 400} ${size}px ${PC.FONTS[o.family || 'play']}`; g.textAlign = o.align || 'left'; g.textBaseline = o.baseline || 'middle';
    if (o.stroke) { g.lineJoin = 'round'; g.lineWidth = o.strokeW || size * 0.16; g.strokeStyle = o.stroke; g.strokeText(s, x, y); }
    g.fillStyle = o.fill || P.ink; g.fillText(s, x, y); const w = g.measureText(s).width; g.restore(); return w;
  };
  PC.measure = (g, s, size, o = {}) => { g.save(); g.font = `${o.weight || 400} ${size}px ${PC.FONTS[o.family || 'play']}`; const w = g.measureText(s).width; g.restore(); return w; };

  const corner = (g, x, y, dir, size) => {                 // a gold paper corner + a rivet
    const sx = dir === 1 || dir === 2 ? -1 : 1, sy = dir >= 2 ? -1 : 1;
    PC.cut(g, PC.poly([[x, y], [x + sx * size, y], [x, y + sy * size]], { seed: 70 + dir, amp: 0.6 }), P.gold, { ui: true, stroke: P.ink, lw: 2.5, rim: P.goldLight });
    g.save(); g.fillStyle = P.goldDark; g.beginPath(); g.arc(x + sx * size * 0.28, y + sy * size * 0.28, 3.2, 0, TAU); g.fill(); g.restore();
  };
  PC.panel = (g, R, o = {}) => {
    const seed = o.seed ?? 3, path = PC.poly([[R.x, R.y], [R.x + R.w, R.y], [R.x + R.w, R.y + R.h], [R.x, R.y + R.h]], { seed, amp: 1.2, step: 14, round: 0.08 });
    g.save(); g.lineJoin = 'round';
    PC.cut(g, path, o.fill || P.paper, { shadow: o.shadow ?? 10, rim: P.white, rimW: 2.5 });
    PC.shade(g, path, P.kraftDark, 0, R.y, 0, R.y + R.h, 0, 0.18);
    if (o.stitch !== false && R.w > 60 && R.h > 60) { g.save(); g.setLineDash([10, 8]); g.strokeStyle = P.kraftDark; g.lineWidth = 2; g.strokeRect(R.x + 12, R.y + 12, R.w - 24, R.h - 24); g.restore(); }
    g.strokeStyle = o.line || P.ink; g.lineWidth = o.lw ?? 4; g.stroke(path);
    if (o.corners !== false) { const cs = o.cornerSize ?? 26; corner(g, R.x, R.y, 0, cs); corner(g, R.x + R.w, R.y, 1, cs); corner(g, R.x + R.w, R.y + R.h, 2, cs); corner(g, R.x, R.y + R.h, 3, cs); }
    g.restore(); return path;
  };
  PC.nameTab = (g, text, x, y, o = {}) => {
    const size = o.size ?? 30, tw = PC.measure(g, text, size), pad = size * 0.55, w = tw + pad * 2, h = size * 1.42, col = o.color || P.red;
    const x0 = o.anchor === 'right' ? x - w : o.anchor === 'center' ? x - w / 2 : x;
    g.save(); g.translate(x0 + w / 2, y); if (o.rot) g.rotate(o.rot);
    const p = PC.poly([[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]], { seed: 31, amp: 0.8, step: 20 });
    g.save(); g.translate(2, 3); g.fillStyle = PC.mix(col, P.ink, 0.5); g.fill(p); g.restore();
    PC.cut(g, p, col, { rim: PC.mix(col, P.white, 0.4), rimW: 2 });
    g.setLineDash([5, 4]); g.strokeStyle = PC.rgba(P.paper, 0.55); g.lineWidth = 1.5; g.strokeRect(-w / 2 + 5, -h / 2 + 5, w - 10, h - 10); g.setLineDash([]);
    PC.text(g, text, 0, 2, size, { fill: P.paper, align: 'center' });
    g.restore(); return { x: x0, y: y - h / 2, w, h };
  };

  // ---------------------------------------------------------------- the dialogue box: the lyric is the dialogue
  PC.dialog = (g, S, line, o = {}) => {
    const L = Z.line(line);
    if (line == null || line < 0 || !L.text) return;
    const R = o.rect || { x: 300, y: 820, w: 1320, h: 196 }, pop = o.pop ?? E.outBack(clamp((S.t - (L.t - 0.35)) / 0.3), 1.8);
    if (pop <= 0.01) return;
    g.save(); g.globalAlpha *= Math.min(1, pop * 3);
    const cx = R.x + R.w / 2, by = R.y + R.h; g.translate(cx, by); g.scale(Z.lerp(0.9, 1, Math.min(1, pop)), Math.min(1.2, pop)); g.translate(-cx, -by);
    PC.panel(g, R, { seed: o.seed ?? 11 });
    let tx = R.x + 60, tw = R.w - 120;
    if (o.portrait) { g.save(); PC.cut(g, PC.blob(R.x + 110, R.y + R.h / 2, 74, 74, { seed: 5 }), P.skyDayLow, { ui: true, stroke: P.ink, lw: 4 }); g.clip(PC.blob(R.x + 110, R.y + R.h / 2, 72, 72, { seed: 5 })); o.portrait(g, R.x + 110, R.y + R.h / 2 + 10, 72); g.restore(); tx = R.x + 220; tw = R.w - 280; }
    if (o.speaker) PC.nameTab(g, o.speaker, R.x + 36, R.y + 2, { size: 32 });
    const chars = [...L.text], n = Z.charsAt(line, S.t, { lead: 0 });
    let size = o.size ?? 60; while (size > 30 && PC.measure(g, L.text, size) > tw * 2) size -= 4;
    // wrap into at most two rows: at spaces for Latin text (a word never splits), per character for CJK
    const rows = [[]]; let w = 0;
    for (const tok of /\s/.test(L.text) ? L.text.split(/(?<=\s)/) : chars) {
      const tc = [...tok], ww = PC.measure(g, tok.trimEnd(), size);
      if (w + ww > tw && rows[rows.length - 1].length) { rows.push([]); w = 0; }
      for (const ch of tc) { rows[rows.length - 1].push(ch); w += PC.measure(g, ch, size); }
    }
    let k = 0; const y0 = R.y + R.h / 2 - (rows.length - 1) * size * 0.6;
    rows.forEach((row, r) => {
      let x = tx;
      for (const ch of row) {
        const a = clamp(n - k), cw = PC.measure(g, ch, size);
        if (a > 0) PC.text(g, ch, x, y0 + r * size * 1.2, size, { family: 'play' });
        x += cw; k++;
      }
    });
    if (n >= chars.length && (S.t * 2.5) % 1 < 0.62) { g.save(); g.fillStyle = P.red; const ax = R.x + R.w - 58, ay = R.y + R.h - 40 + Math.sin(S.t * 8) * 4; g.beginPath(); g.moveTo(ax - 12, ay - 8); g.lineTo(ax + 12, ay - 8); g.lineTo(ax, ay + 8); g.closePath(); g.fill(); g.restore(); }
    g.restore();
  };

  // ---------------------------------------------------------------- HUD pieces
  PC.bar = (g, x, y, w, v, o = {}) => {
    const h = o.h ?? 26, col = o.col || P.heart;
    if (o.label) PC.text(g, o.label, x - 10, y + h / 2, h * 0.95, { family: 'latin', weight: 700, align: 'right' });
    const R = PC.poly([[x, y], [x + w, y], [x + w, y + h], [x, y + h]], { seed: 41, amp: 0.6 });
    PC.cut(g, R, P.paper2, { ui: true, stroke: P.ink, lw: 3 });
    g.save(); g.clip(R); g.fillStyle = col; g.fillRect(x, y, w * clamp(v), h); g.fillStyle = PC.rgba(P.white, 0.35); g.fillRect(x, y + 3, w * clamp(v), h * 0.25); g.restore();
  };
  PC.lvUp = (g, x, y, k, o = {}) => {
    if (k <= 0 || k > 1.6) return;
    const s = E.outBack(clamp(k * 3), 2.2) * (1 - Z.smooth(1.2, 1.6, k));
    g.save(); g.translate(x, y - k * 30); g.scale(s, s);
    PC.rays(g, 0, 0, 170, { n: 14, rot: k * 2, alpha: 0.6 });
    PC.cut(g, PC.poly([[-120, -46], [120, -46], [134, 0], [120, 46], [-120, 46], [-134, 0]], { seed: 51, round: 0.2 }), P.gold, { shadow: 10, stroke: P.ink, lw: 4, rim: P.goldLight });
    PC.text(g, o.text || 'LV UP!', 0, 4, 58, { family: 'latin', weight: 700, fill: P.red, align: 'center', stroke: P.paper, strokeW: 8 });
    g.restore();
  };
  PC.coins = (g, x, y, n, k = 1) => {
    g.save(); g.translate(x, y);
    PC.cut(g, PC.blob(0, 0, 24, 24, { seed: 61 }), P.coin, { ui: true, stroke: P.coinDark, lw: 3, rim: P.goldLight, shadow: 6 });
    PC.text(g, '× ' + n, 40, 2, 44 * (1 + 0.25 * Math.max(0, 1 - k * 4)), { family: 'latin', weight: 700, stroke: P.paper, strokeW: 7 });
    g.restore();
  };
  PC.damage = (g, x, y, n, age) => {
    if (age < 0 || age > 1.1) return;
    const s = E.outBack(clamp(age * 5), 2.4), a = 1 - Z.smooth(0.8, 1.1, age);
    g.save(); g.globalAlpha *= a; g.translate(x, y - age * 70); g.scale(s, s); g.rotate(-0.08);
    PC.text(g, String(n), 0, 0, 96, { family: 'latin', weight: 700, fill: P.red, align: 'center', stroke: P.paper, strokeW: 12 }); g.restore();
  };
  PC.menu = (g, R, items, sel, t) => {
    PC.panel(g, R, { seed: 81, cornerSize: 20 });
    items.forEach((it, i) => {
      const y = R.y + 55 + i * ((R.h - 110) / Math.max(1, items.length - 1));      // first and last item clear of the edges
      PC.text(g, it, R.x + 90, y, 44, { family: 'play' });
      if (i === sel) { const bx = R.x + 50 + Math.sin(t * 10) * 5; g.save(); g.fillStyle = P.red; g.beginPath(); g.moveTo(bx - 14, y - 14); g.lineTo(bx + 10, y); g.lineTo(bx - 14, y + 14); g.closePath(); g.fill(); g.restore(); }
    });
  };

  // ---------------------------------------------------------------- the parchment map with its route
  const icon = (g, kind, x, y, s) => {
    g.save(); g.translate(x, y); g.scale(s, s);
    if (kind === 'castle') { PC.cut(g, PC.poly([[-40, 20], [40, 20], [40, -20], [28, -20], [28, -40], [14, -40], [14, -20], [-14, -20], [-14, -40], [-28, -40], [-28, -20], [-40, -20]], { seed: 91 }), P.stone, { ui: true, stroke: P.ink, lw: 3, shadow: 4 }); PC.cut(g, PC.poly([[-6, -40], [6, -40], [0, -62]], { seed: 92 }), P.roofRed, { ui: true, stroke: P.ink, lw: 2.5 }); }
    else if (kind === 'tree') { PC.cut(g, PC.poly([[0, -44], [26, 10], [-26, 10]], { seed: 93, round: 0.3 }), P.forest, { ui: true, stroke: P.ink, lw: 3, shadow: 4 }); }
    else if (kind === 'peak') { PC.cut(g, PC.poly([[-46, 18], [0, -46], [46, 18]], { seed: 94 }), P.mountain, { ui: true, stroke: P.ink, lw: 3, shadow: 4 }); PC.cut(g, PC.poly([[-14, -26], [0, -46], [14, -26], [0, -20]], { seed: 95 }), P.snow, {}); }
    else if (kind === 'cave') { PC.cut(g, PC.blob(0, 0, 44, 32, { seed: 96 }), P.stoneDark, { ui: true, stroke: P.ink, lw: 3, shadow: 4 }); PC.cut(g, PC.blob(0, 8, 20, 18, { seed: 97 }), P.ink, {}); }
    else { PC.cut(g, PC.poly([[-24, 18], [24, 18], [24, -8], [0, -30], [-24, -8]], { seed: 98 }), P.sand, { ui: true, stroke: P.ink, lw: 3, shadow: 4 }); }
    g.restore();
  };
  PC.map = (g, R, route, p, o = {}) => {
    const path = PC.poly([[R.x, R.y], [R.x + R.w, R.y], [R.x + R.w, R.y + R.h], [R.x, R.y + R.h]], { seed: 101, amp: 3, step: 30 });
    PC.cut(g, path, P.kraft, { shadow: 16, stroke: P.woodDark, lw: 4 });
    PC.shade(g, path, P.woodDark, R.x, R.y, R.x + R.w, R.y + R.h, 0.05, 0.3);
    const at = ([u, v]) => [R.x + u * R.w, R.y + v * R.h];
    for (const m of o.marks || []) { const [x, y] = at(m.at); icon(g, m.icon, x, y, (o.iconScale ?? 1) * R.w / 1400); }
    const pts = route.map(at);
    PC.line(g, pts, { dash: [18, 14], lw: 7, color: P.red, p: clamp(p), seed: 7 });
    if (p > 0 && pts.length > 1) {
      const k = Math.min(pts.length - 1, Math.max(1, Math.ceil(pts.length * clamp(p)))), [hx, hy] = pts[k - 1];
      PC.cut(g, PC.poly([[hx, hy], [hx - 14, hy - 34], [hx + 14, hy - 34]], { seed: 111, round: 0.4 }), P.red, { ui: true, stroke: P.ink, lw: 3, shadow: 6 });
      g.save(); g.fillStyle = P.paper; g.beginPath(); g.arc(hx, hy - 34, 7, 0, TAU); g.fill(); g.restore();
    }
    // compass rose
    g.save(); g.translate(R.x + R.w - 90, R.y + 90); PC.cut(g, PC.poly([[0, -50], [10, -10], [50, 0], [10, 10], [0, 50], [-10, 10], [-50, 0], [-10, -10]], { seed: 121 }), P.paper, { ui: true, stroke: P.woodDark, lw: 3 }); g.restore();
  };
})();
