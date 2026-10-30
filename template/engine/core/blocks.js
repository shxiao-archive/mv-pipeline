/* mv-studio engine — core/blocks.js: TEAM MODE (references/11-team.md). The film is split into blocks of 8-18 s that
 * different builders write at the same time, one file each, so nobody edits engine/timeline.js but the lead.
 *
 *   Z.block(id, { t0, t1, shots(ctx) })   in engine/blocks/<id>.js: register the block. t0 / t1 may be numbers or
 *                                         functions of ctx; shots(ctx) returns the block's shots (ids start with the
 *                                         block id; private scenes are named <id>_xxx). ctx = what the lead passes
 *                                         (audio, B, nb, beat, END, cue, L ...)
 *   await Z.loadBlocks(['b01', ...])      in timeline.js Z.setup: loads engine/blocks/<id>.js for each. A block that is
 *                                         missing or throws is reported ('[block] ...' in the console) and left out:
 *                                         its range shows up as a gap in storyboard.mjs, the rest of the film still runs
 *   Z.blockShots(ctx)                     the shots of every loaded block, checked: id prefix, inside [t0, t1)
 *   ?only=b05,b06                         load only these blocks (a builder renders its own block fast)
 *
 * mv-studio (MIT). Idea after dalabengba-mv's dynamically loaded scene blocks (ISC).
 */
(() => {
  'use strict';
  const Z = window.Z;
  Z.BLOCKS = {};
  Z.block = (id, def) => { Z.BLOCKS[id] = Object.assign({ id }, def); };
  const load = src => new Promise(ok => {
    const s = document.createElement('script');
    s.src = src; s.onload = () => ok(true); s.onerror = () => { console.error(`[block] failed to load ${src}`); ok(false); };
    document.head.appendChild(s);
  });
  Z.loadBlocks = async (ids, dir = 'blocks/') => {
    const only = (new URLSearchParams(location.search).get('only') || '').split(',').filter(Boolean);
    const list = only.length ? ids.filter(id => only.includes(id)) : ids;
    for (const id of list) await load(`${dir}${id}.js`);                    // in order: a block may reuse an earlier one's helpers
    return list;
  };
  Z.blockShots = ctx => {
    const out = [];
    for (const b of Object.values(Z.BLOCKS)) {
      try {
        const t0 = typeof b.t0 === 'function' ? b.t0(ctx) : b.t0, t1 = typeof b.t1 === 'function' ? b.t1(ctx) : b.t1;
        for (const s of b.shots(ctx) || []) {
          if (!String(s.id).startsWith(b.id)) console.error(`[block] ${b.id}: shot ${s.id} must start with the block id`);
          if (s.t0 < t0 - 1e-3 || s.t1 > t1 + (s.trans ? s.trans.dur || 0 : 0) + 1e-3) console.error(`[block] ${b.id}: shot ${s.id} [${s.t0.toFixed(2)}, ${s.t1.toFixed(2)}) leaves the block [${t0.toFixed(2)}, ${t1.toFixed(2)})`);
          out.push(Object.assign({ block: b.id }, s));
        }
      } catch (e) { console.error(`[block] ${b.id} threw: ${e && e.message}`); }
    }
    return out;
  };
})();
