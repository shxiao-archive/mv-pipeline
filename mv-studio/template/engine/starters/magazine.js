/* engine/timeline.js — STARTER for the MAGAZINE style (styles/magazine; read <skill>/styles/magazine/BRIEF.md, then
 * its STYLE.md). A Japanese experimental print magazine: the song typeset in vertical columns, its pictures separated
 * into three inks on paper, editorial marks that keep time, and a page with a fate -- burned open, torn, flashed.
 *
 * This starter builds a plain first cut from the song's sections and lyric lines so a new project renders at once:
 * the cover burns open -> contents -> verses as spreads, one line per page -> the build cut into its beat groups ->
 * choruses slam a picture and a character per group -> the bridge takes a character apart -> the last chorus tears the
 * page -> the outro is a contact sheet. It is scaffolding, not the film: choose the inks, the pictures (MZ.stand
 * stand-ins until your art exists), the page's fate and the three climaxes from your shot list.
 * Lyric text never appears here: lines by index only.
 */
(() => {
  'use strict';
  const Z = window.Z, MZ = Z.MZ;
  Z.TITLE = 'untitled';
  Z.TITLE_SUB = '';
  Z.ARTIST = '';
  Z.CREDIT = '';
  // REPLACE: the film's paper and inks (key + two spots, MZ.INKS names or '#hex') and its pictures (art paths)
  MZ.LOOK = { paper: 'paper', inkK: 'black', inkA: 'red', inkB: 'teal' };
  const PICS = ['horizon', 'figure', 'flora', 'city'];          // e.g. ['assets/bg/sea.png', 'assets/char/her.png', ...]
  const WORDS = ['目', '手', '月', '声'];                        // REPLACE: the characters the chorus stamps (your words, not the lyric)
  const HEAD = '一　untitled';                                   // REPLACE: the running head

  Z.setup = async (audio) => {
    const secs = audio.sections || [], END = audio.music_cut || audio.duration, L = Z.LYR;
    Z.sectionAt = t => { let s = secs[0] || null; for (const x of secs) if (x.start <= t + 1e-6) s = x; return s; };
    Z.LOOK_DEFAULT = Object.assign({}, MZ.post);
    await MZ.loadFonts();
    const S = [], linesIn = (a, b) => L.filter(l => l.t >= a - 0.05 && l.t < b - 0.05).map(l => l.i);
    const nb = t => (audio.beats || []).reduce((b, x) => (Math.abs(x - t) < Math.abs(b - t) ? x : b), (audio.beats || [t])[0]);
    const shot = (id, t0, t1, scene, args, moment) => { if (t1 > t0 + 0.05) S.push({ id, t0, t1, scene, args: Object.assign({ head: HEAD }, args), lyric: 'none', hud: false, line: args.line || [], moment }); };
    const is = (s, re) => re.test(s.label || '') || re.test(s.group || '');
    const chorus = s => /^(last-)?chorus\b|sabi|hook/i.test(s.label || '');          // not pre- / post-chorus
    const list = secs.length ? secs.filter(s => s.start < END - 0.5) : [{ start: 0, end: END, label: 'verse' }];
    let chorusN = 0;
    list.forEach((s, j) => {
      const t0 = j === 0 ? 0 : s.start, t1 = Math.min(END, list[j + 1] ? list[j + 1].start : END), lines = linesIn(t0, t1), id = `s${String(j + 1).padStart(2, '0')}`;
      if (j === 0) return shot(id, t0, t1, 'mzBurn', { img: PICS[1], line: lines }, 'the cover burns open on the kicks: REPLACE with your first image');
      if (j === 1 && !lines.length) return shot(id, t0, t1, 'mzContents', { img: PICS[0] }, 'the contents: chapters = sections, pages = bars');
      if (chorus(s)) {
        chorusN++;
        const last = !list.slice(j + 1).some(chorus);
        if (last && t1 - t0 > 6) {
          const mid = nb(t0 + (t1 - t0) * 0.6);
          shot(id, t0, mid, 'mzSlam', { imgs: PICS, words: WORDS, react: 1, line: linesIn(t0, mid) }, 'the last chorus: the slam, harder (REPLACE)');
          return shot(id + 'b', mid, t1, 'mzTear', { img: PICS[2], world: 'deep', line: linesIn(mid, t1), at: mid + 0.4 }, 'the page tears: the world behind it (REPLACE)');
        }
        return shot(id, t0, t1, 'mzSlam', { imgs: PICS, words: WORDS, every: chorusN === 1 ? 2 : 1, react: 1, line: lines }, `chorus ${chorusN}: one picture and one character per beat group (REPLACE)`);
      }
      if (is(s, /pre|build|bridge-?up/i)) return shot(id, t0, t1, 'mzStrips', { img: PICS[3], line: lines }, 'the build: the bar cut into its beat groups');
      if (is(s, /bridge|inst|solo|break/i)) {
        const mid = nb((t0 + t1) / 2);
        shot(id, t0, mid, 'mzGrid', { imgs: PICS, bars: 4, open: true, line: linesIn(t0, mid) }, 'bars as page cells; the last opens to the page');
        return shot(id + 'b', mid, t1, 'mzDecon', { line: linesIn(mid, t1), parts: [{ ch: '亻', dx: -150, dy: 0, size: 440, exit: [-700, -420, -0.6], at: mid + (t1 - mid) * 0.35 }, { ch: '木', dx: 70, dy: 0, size: 520, exit: null }], result: '木' },
          'a character taken apart: REPLACE with the song\'s own');
      }
      if (is(s, /outro|end|tail|post/i)) return shot(id, t0, t1, 'mzContact', { imgs: PICS, windows: [7, 14], world: 'deep', pick: 9, line: lines }, 'the outro: every picture on one contact sheet');
      // verses (and anything else): a spread per lyric line, the picture side alternating
      const cuts = [t0, ...lines.map(i => nb(L[i].t - 0.1)).filter(t => t > t0 + 0.8 && t < t1 - 0.8)];
      cuts.forEach((c, k) => shot(`${id}${String.fromCharCode(97 + k)}`, c, cuts[k + 1] ?? t1, 'mzSpread', { img: PICS[(j + k) % PICS.length], side: k % 2 ? 'right' : 'left', line: linesIn(t0, cuts[k + 1] ?? t1) },
        'one line per page: REPLACE with this line\'s picture'));
    });
    // subliminal frames: one tatum of a picture from elsewhere in the film at the end of each chorus (memory / foreshadowing)
    const out = [];
    for (const sh of S) {
      const fl = /mzSlam/.test(sh.scene) ? [MZ.flash(sh.t1 - (Z.clock.meter(sh.t1 - 0.01).tatum || 0.12), { img: PICS[(out.length + 1) % PICS.length] })].filter(f => f.t0 > sh.t0 + 0.5) : [];
      fl.forEach(f => { f.t1 = sh.t1; Object.assign(f.shot, { insert: true, offgrid: 'a subliminal frame: the last tatum before the cut', moment: 'a picture from elsewhere in the film, one tatum (memory / foreshadowing)' }); });
      out.push(...(fl.length ? Z.withInserts(sh, fl) : [sh]));
    }
    Z.SHOTS = out;
    Z.VERTICAL_CFG = { full: [], planMap: {}, quiet: [], title: Z.TITLE, sub: Z.TITLE_SUB, artist: Z.ARTIST, credits: [0, END] };
    window.__zankoMeta.duration = END;
  };
})();
