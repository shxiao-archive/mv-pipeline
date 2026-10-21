/* engine/blocks/_template.js — a TEAM-MODE block (references/11-team.md): copy to engine/blocks/<id>.js. One builder
 * owns one block file (plus engine/blocks/<id>/ for private helpers); shared files are the lead's.
 * Render only this block:  node tools/stills.mjs --url "engine/index.html?only=b05" --times 42,43.1 --out render/review/b05
 */
(() => {
  'use strict';
  const Z = window.Z;
  const ID = 'bXX';
  // private scenes: name them <id>_xxx so blocks never collide
  Z.scene(ID + '_example', {
    draw(ctx, S) { ctx.fillStyle = '#F3EEE4'; ctx.fillRect(0, 0, 1920, 1080); },
  });
  Z.block(ID, {
    t0: c => c.cue('L05'), t1: c => c.cue('L09'),          // the block's range: from the storyboard, never raw seconds
    shots: c => [
      { id: ID + '_s1', t0: c.cue('L05'), t1: c.cue('L07'), scene: ID + '_example', args: {}, line: 4, cue: 'L05', lyric: 'none', hud: false,
        moment: 'what this shot shows and why (your words)' },
      { id: ID + '_s2', t0: c.cue('L07'), t1: c.cue('L09'), scene: ID + '_example', args: {}, line: 6, cue: 'L07', lyric: 'none', hud: false,
        moment: 'the next beat of the gag' },
    ],
  });
})();
