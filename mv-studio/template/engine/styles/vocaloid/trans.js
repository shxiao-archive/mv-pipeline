/* vocaloid preset — its transitions: barrier (a striped railway arm wipes B in), shatter (A breaks into falling glass shards).
 */
(() => {
  'use strict';
  const Z = window.Z, T = Z.transition, E = Z.ease;
  const W = 1920, H = 1080;

  // crossing barrier arm: a striped bar sweeps down (pivot at left) wiping in B
  T('barrier', (ctx, A, B, k, o) => {
    const e = E.inOutCubic(k), ang = Z.lerp(-Math.PI / 2, 0.02, e);
    const px = o.px ?? -40, py = o.py ?? H * 0.62;
    ctx.drawImage(A, 0, 0);
    ctx.save(); ctx.beginPath(); ctx.moveTo(px, py);
    const L = 4000; ctx.lineTo(px + Math.cos(ang) * L, py + Math.sin(ang) * L); ctx.lineTo(px + Math.cos(ang - 1.6) * L, py + Math.sin(ang - 1.6) * L); ctx.closePath(); ctx.clip();
    ctx.drawImage(B, 0, 0); ctx.restore();
    // the arm itself: black / yellow stripes
    ctx.save(); ctx.translate(px, py); ctx.rotate(ang);
    const bw = 44; for (let i = 0; i < 40; i++) { ctx.fillStyle = i % 2 ? '#FFC21A' : '#0A0A0C'; ctx.fillRect(i * 60, -bw / 2, 60, bw); }
    ctx.restore();
  });
  // glass shatter: A breaks into voronoi-ish shards that fall away revealing B
  T('shatter', (ctx, A, B, k, o) => {
    ctx.drawImage(B, 0, 0);
    const cols = 9, rows = 5, R = Z.rng(o.seed || 3), cx = o.cx ?? W / 2, cy = o.cy ?? H / 2;
    const jit = (i, j) => [Z.clamp((i + (i > 0 && i < cols ? Z.rnds(i, j, 1) * 0.35 : 0)) / cols) * W, Z.clamp((j + (j > 0 && j < rows ? Z.rnds(i, j, 2) * 0.35 : 0)) / rows) * H];
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      const p = [jit(i, j), jit(i + 1, j), jit(i + 1, j + 1), jit(i, j + 1)];
      for (const tri of [[p[0], p[1], p[2]], [p[0], p[2], p[3]]]) {
        const mx = (tri[0][0] + tri[1][0] + tri[2][0]) / 3, my = (tri[0][1] + tri[1][1] + tri[2][1]) / 3;
        const dist = Math.hypot(mx - cx, my - cy) / Math.hypot(W, H);
        const d = Z.clamp((k - dist * 0.6) / 0.5); const e = E.inQuad(d);
        if (d >= 1) continue;
        const vx = (mx - cx) * 0.9 + R.range(-200, 200), vy = (my - cy) * 0.5 + R.range(-100, 100);
        ctx.save();
        ctx.translate(mx + vx * e, my + vy * e + 1400 * e * e); ctx.rotate(R.range(-3, 3) * e); ctx.scale(1 - e * 0.3, 1 - e * 0.3); ctx.translate(-mx, -my);
        ctx.beginPath(); ctx.moveTo(...tri[0]); ctx.lineTo(...tri[1]); ctx.lineTo(...tri[2]); ctx.closePath(); ctx.clip();
        ctx.globalAlpha = 1 - e * 0.5; ctx.drawImage(A, 0, 0);
        ctx.strokeStyle = Z.rgba('#FFE3B0', 0.8 * (1 - e)); ctx.lineWidth = 2; ctx.stroke();
        ctx.restore();
      }
    }
  });
})();
