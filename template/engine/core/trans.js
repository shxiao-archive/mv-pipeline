/* mv-studio engine — transitions. fn(ctx, A, B, k, o): draw the blend of outgoing canvas A and incoming canvas B at k∈[0,1].
 * o carries the shot's trans spec (type, dur, and any extra params such as cx/cy/angle/color). */
(() => {
  'use strict';
  const Z = window.Z, T = Z.transition, E = Z.ease;
  const W = 1920, H = 1080;

  T('cut', (ctx, A, B) => ctx.drawImage(B, 0, 0));
  T('xfade', (ctx, A, B, k) => { ctx.drawImage(A, 0, 0); ctx.globalAlpha = E.inOutSine(k); ctx.drawImage(B, 0, 0); ctx.globalAlpha = 1; });
  // white/colour flash: A brightens to flash, B emerges. peak 0.7: at full strength, under bloom, the frame burns white
  // for several frames (a jury and a viewer both called it overexposed); peak: 1 for a real white-out
  T('flash', (ctx, A, B, k, o) => {
    ctx.drawImage(k < 0.5 ? A : B, 0, 0);
    ctx.fillStyle = o.color || '#FFF4DC'; ctx.globalAlpha = (o.peak ?? 0.7) * (k < 0.5 ? E.inQuad(k * 2) : 1 - E.outQuad((k - 0.5) * 2)); ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1;
  });
  T('black', (ctx, A, B, k) => {
    ctx.drawImage(k < 0.5 ? A : B, 0, 0);
    ctx.fillStyle = '#000'; ctx.globalAlpha = k < 0.5 ? E.inQuad(k * 2) : 1 - E.outQuad((k - 0.5) * 2); ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1;
  });
  // iris: B revealed by a growing circle from (cx,cy) — sun ↔ lamp ↔ 。 match cuts
  T('iris', (ctx, A, B, k, o) => {
    ctx.drawImage(A, 0, 0);
    const cx = o.cx ?? W / 2, cy = o.cy ?? H / 2, r = E.inOutExpo(k) * Math.hypot(W, H);
    ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, Math.max(0.1, r), 0, Z.TAU); ctx.clip(); ctx.drawImage(B, 0, 0); ctx.restore();
    if (k > 0 && k < 1) { ctx.save(); ctx.strokeStyle = Z.rgba(o.color || '#FFA552', 1 - k); ctx.lineWidth = 10 * (1 - k) + 2; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Z.TAU); ctx.stroke(); ctx.restore(); }
  });
  T('irisClose', (ctx, A, B, k, o) => {                      // A shrinks into a circle, then B
    ctx.drawImage(B, 0, 0);
    const cx = o.cx ?? W / 2, cy = o.cy ?? H / 2, r = (1 - E.inOutExpo(k)) * Math.hypot(W, H);
    ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, Math.max(0.1, r), 0, Z.TAU); ctx.clip(); ctx.drawImage(A, 0, 0); ctx.restore();
  });
  // diagonal wipe with a hard graphic edge
  T('wipe', (ctx, A, B, k, o) => {
    const e = E.inOutExpo(k), ang = o.angle ?? -0.35;
    ctx.drawImage(A, 0, 0);
    ctx.save(); ctx.translate(W / 2, H / 2); ctx.rotate(ang);
    const D = Math.hypot(W, H), x = Z.lerp(-D, D, e) - D / 2;
    ctx.beginPath(); ctx.rect(-D, -D, x + D, 2 * D); ctx.clip(); ctx.rotate(-ang); ctx.translate(-W / 2, -H / 2); ctx.drawImage(B, 0, 0); ctx.restore();
    ctx.save(); ctx.translate(W / 2, H / 2); ctx.rotate(ang); ctx.fillStyle = o.color || '#C8373A'; ctx.fillRect(x - 18, -D, 18, 2 * D); ctx.restore();
  });
  // horizontal slices sliding in alternately
  T('slices', (ctx, A, B, k, o) => {
    ctx.drawImage(A, 0, 0);
    const n = o.n || 9;
    for (let i = 0; i < n; i++) {
      const y0 = (i / n) * H, h = H / n + 1;
      const d = Z.clamp(k * 1.6 - (i / n) * 0.6), off = (1 - E.outExpo(d)) * W * (i % 2 ? 1 : -1);
      ctx.drawImage(B, 0, y0, W, h, off, y0, W, h);
    }
  });
  // push: A slides out, B slides in (direction dx,dy)
  T('push', (ctx, A, B, k, o) => {
    const e = E.inOutExpo(k), dx = o.dx ?? -1, dy = o.dy ?? 0;
    ctx.drawImage(A, dx * e * W, dy * e * H); ctx.drawImage(B, (dx * e - dx) * W, (dy * e - dy) * H);
  });
  // zoom through: A scales up and fades, B scales from small
  T('zoom', (ctx, A, B, k) => {
    const e = E.inExpo(Z.clamp(k * 1.3));
    ctx.save(); ctx.translate(W / 2, H / 2); ctx.scale(1 + e * 3, 1 + e * 3); ctx.globalAlpha = 1 - e; ctx.drawImage(A, -W / 2, -H / 2); ctx.restore();
    const e2 = E.outExpo(Z.clamp(k * 1.3 - 0.3));
    ctx.save(); ctx.translate(W / 2, H / 2); ctx.scale(Z.lerp(0.4, 1, e2), Z.lerp(0.4, 1, e2)); ctx.globalAlpha = e2; ctx.drawImage(B, -W / 2, -H / 2); ctx.restore();
  });
  // ink bloom: B appears through growing organic blobs
  T('ink', (ctx, A, B, k, o) => {
    ctx.drawImage(A, 0, 0);
    const R = Z.rng(o.seed || 7), n = 14, e = E.inOutCubic(k);
    ctx.save(); ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const x = R() * W, y = R() * H, r = e * (300 + R() * 700) * (0.4 + 0.6 * Z.clamp(e * 2 - R()));
      ctx.moveTo(x + r, y);
      for (let a = 0; a <= 24; a++) { const th = (a / 24) * Z.TAU, rr = r * (0.85 + 0.15 * Math.sin(th * 5 + i)); ctx.lineTo(x + Math.cos(th) * rr, y + Math.sin(th) * rr); }
    }
    ctx.clip(); ctx.drawImage(B, 0, 0); ctx.restore();
  });
})();
