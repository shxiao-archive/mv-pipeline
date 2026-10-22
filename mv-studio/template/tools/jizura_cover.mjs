#!/usr/bin/env node
/* Which JIZURA parts cover the picture in front mode (the lyric layer over a scene): measured, not guessed.
 *   node tools/jizura_cover.mjs [--style gold] [--groups trans,layout,decor,fx,treat,cam] [--max 0.3] [--out jizura/cover.json]
 *   node tools/jizura_cover.mjs --selftest
 * For each part it plans the sample lyrics with only that part enabled in its group, renders front mode every 0.25 s
 * and records the largest share of the frame with alpha > 0.5. Parts above --max are printed as DENY lines for
 * engine/timeline.js (references/06 §5). Run it again after changing styles, schemes or the JIZURA pin.
 * Needs jizura/app/jizura_engine.js (node tools/build_jizura_bundle.mjs). mv-studio (MIT). */
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, cliArg, cliFlag, handleHelp, launchBrowser, gpuArgs } from './kit_env.mjs';
import { startServer } from './jizura_serve.mjs';

handleHelp(`
jizura_cover.mjs -- measure which JIZURA parts draw opaque plates over the scene in front mode
  --style NAME      JIZURA style                                    [gold]
  --groups LIST     part groups to measure                          [trans,layout,decor,fx,treat,cam]
  --max F           share of the frame (0..1) that counts as cover  [0.3]
  --out FILE        JSON report (relative to the project root)      [jizura/cover.json]
  --selftest        the plain layout 'center' must stay under --max, the doors transition 'doorsOpen' go over it`);

const selftest = cliFlag('selftest');
const style = cliArg('style', 'gold');
const max = Number(cliArg('max', '0.3'));
const groups = selftest ? ['layout', 'trans'] : cliArg('groups', 'trans,layout,decor,fx,treat,cam').split(',');
const only = selftest ? { layout: ['center'], trans: ['doorsOpen'] } : null;
const outFile = path.resolve(ROOT, cliArg('out', 'jizura/cover.json'));
// our own sample words (no song lyrics): 8 lines, ~2 s apart, so every part gets cuts, transitions and events
const lyrics = ['[00:00.50]ゆうぐれの/まちを', '[00:02.60]あるいて*いく*', '[00:04.70]ひかりが/ゆれる', '[00:06.80]とおい/こえ!',
  '[00:08.90]the night is/long', '[00:11.00]we *carry* on', '[00:13.10]かぜが/ふいて', '[00:15.20]また/あした'].join('\n');
const beats = Array.from({ length: 40 }, (_, i) => +(0.5 + i * 0.5).toFixed(3));

const { origin, close } = await startServer(0);
const browser = await launchBrowser({ headless: true, args: gpuArgs() });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
await page.goto(`${origin}/project/jizura/app/engine.html`);
await page.waitForFunction(() => window.JZ_READY === true);

const report = await page.evaluate(async ({ lyrics, beats, style, groups, only }) => {
  JZ.setAudio({ duration: 18, beats, energy: null, energyRate: 0 });
  const big = document.createElement('canvas'); big.width = 1920; big.height = 1080;
  const bctx = big.getContext('2d');
  const small = document.createElement('canvas'); small.width = 192; small.height = 108;
  const sctx = small.getContext('2d', { willReadFrequently: true });
  const coverAt = t => {
    bctx.setTransform(1, 0, 0, 1, 0, 0); bctx.clearRect(0, 0, 1920, 1080);
    JZ.drawPlan('cover', bctx, t, 'front');
    sctx.clearRect(0, 0, 192, 108); sctx.drawImage(big, 0, 0, 192, 108);
    const a = sctx.getImageData(0, 0, 192, 108).data; let n = 0;
    for (let i = 3; i < a.length; i += 4) if (a[i] > 127) n++;
    return n / (192 * 108);
  };
  // every other group is pinned to its plain part (or to none at all), else their own opaque parts (a doorsOpen
  // transition, a card camera) show up in every measurement
  const PLAIN = { layout: 'center', enter: 'cut', hold: 'still', exit: 'cut', treat: 'none', bg: 'none', decor: null, fx: null, trans: null, cam: null };
  const only1 = (g, k) => Object.fromEntries(J.order(g).map(x => [x, x === k]));
  const out = {};
  for (const g of groups) {
    out[g] = {};
    for (const k of (only && only[g]) || J.order(g)) {
      const enabled = Object.fromEntries(Object.keys(PLAIN).map(h => [h, only1(h, h === g ? k : PLAIN[h])]));
      try {
        await JZ.addPlan('cover', { lyrics, style, fps: 30, res: 1080, aspect: '16:9', seed: 2609, unify: true, typeset: true, extra: true, enabled });
        const pl = JZ.plans.cover.plan;
        const has = c => g === 'decor' ? (c.decor || []).some(d => (d.id || d.type || d) === k) : c[g] === k;
        const cuts = pl.cuts.filter(has), events = g === 'fx' ? pl.events.filter(e => e.type === k) : [];
        // sample where the part is: across each cut that uses it (a transition at its start), at each fx event
        const times = cuts.flatMap(c => [c.start + 0.02, c.start + 0.1, c.start + 0.2, (c.start + c.end) / 2, c.end - 0.1])
          .concat(events.flatMap(e => [e.t + 0.02, e.t + Math.min(e.dur || 0.2, 0.4) / 2]));
        let worst = 0, at = 0;
        for (const t of times) { const c = coverAt(t); if (c > worst) { worst = c; at = t; } }
        out[g][k] = times.length ? { cover: +worst.toFixed(3), at: +at.toFixed(2), uses: cuts.length + events.length } : { placed: false };
      } catch (e) { out[g][k] = { error: String(e).slice(0, 120) }; }
    }
  }
  return out;
}, { lyrics, beats, style, groups, only });
await browser.close(); await close();

const over = {};
for (const g of groups) over[g] = Object.entries(report[g]).filter(([, r]) => r.cover > max).map(([k]) => k);
if (selftest) {
  const none = report.layout.center.cover, white = report.trans.doorsOpen.cover;
  console.log(`[jizura_cover] selftest: layout center ${none}, trans doorsOpen ${white} (cover above ${max})`);
  if (!(none <= max && white > max)) { console.log('[jizura_cover] selftest FAIL'); process.exit(1); }
  console.log('[jizura_cover] selftest ok'); process.exit(0);
}
fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, JSON.stringify({ style, max, parts: report }, null, 1));
for (const g of groups) {
  const errs = Object.entries(report[g]).filter(([, r]) => r.error).length, unplaced = Object.entries(report[g]).filter(([, r]) => r.placed === false).length;
  console.log(`${g}: ${Object.keys(report[g]).length} parts, ${over[g].length} cover > ${max}${unplaced ? `, ${unplaced} never placed (not measured)` : ''}${errs ? `, ${errs} failed to plan` : ''}`);
  if (over[g].length) console.log(`  DENY.${g} += ' ${over[g].join(' ')}';`);
}
console.log('wrote', path.relative(ROOT, outFile));
