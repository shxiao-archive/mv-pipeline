/* mv-studio engine — the CUE TABLE (analysis/cues.json, written by tools/make_cues.py) and project timing offsets.
 *
 * A cue is a named moment of the song: one per lyric line ('L00', 'L01', ...) plus the musical events of
 * analysis/audio.json (sections 'sec:<name>', stops 'stop1', impacts 'hit1', ...) and any cue added by hand
 * (kind 'custom'). Each cue has a time, a source (lrc / aligned / measured / by-ear / estimate) and a picture hint
 * in OUR OWN words (never lyric text). Timelines place shots on cues instead of typing seconds:
 *
 *   Z.cue('L07')            time of cue L07 (s); throws on an unknown id, so a typo cannot silently put a shot at 0
 *   Z.cue('L07', -0.1)      the same, 0.1 s earlier
 *   Z.cueOr('drop', 60)     the cue's time, or the fallback when the table has no such cue
 *   Z.cues(kind)            all cues (of one kind: 'line' | 'section' | 'stop' | 'impact' | 'custom'), sorted by time
 *   Z.CUES                  { id: cue }
 *
 * project.json -> "timing" (one place for offsets):
 *   offset       > 0 makes EVERY visual happen later (the picture runs late against the audio: check_sync.py says so)
 *   lyricOffset  > 0 makes the lyrics (code-drawn type, JIZURA, line cues) happen later, and nothing else
 * Both are applied by the engine (main.js / lyrics.js); scenes never add them themselves.
 *
 * project.json -> "render": { "shutter": { "samples": 1, "angle": 180 } }: shutter motion blur, off at 1 sample. 4-8
 * samples at 180 degrees look like film; the render costs that many times more. ?shutter=N overrides the samples
 * (render_final.mjs --shutter N; --preview renders with 1).
 *
 * mv-studio, MIT.
 */
(() => {
  'use strict';
  const Z = (window.Z = window.Z || {});
  Z.CUES = {};
  Z.OFFSET = 0;
  Z.LYRIC_OFFSET = 0;
  Z.PROJECT = {};
  Z.SHUTTER = { n: 1, angle: 180 };

  // a value that is there must be a number: "0.1" or a typo never silently becomes 0
  const num = (v, what) => {
    if (v == null) return null;
    if (typeof v !== 'number' || !Number.isFinite(v)) throw new Error(`${what} is not a number (${JSON.stringify(v)})`);
    return v;
  };
  Z.setProject = p => {
    Z.PROJECT = p || {};
    const tm = Z.PROJECT.timing || {};
    Z.OFFSET = num(tm.offset, 'project.json timing.offset') || 0;
    Z.LYRIC_OFFSET = num(tm.lyricOffset, 'project.json timing.lyricOffset') || 0;
    const sh = (Z.PROJECT.render || {}).shutter || {}, q = new URLSearchParams(location.search).get('shutter');
    const n = q != null ? num(+q, '?shutter') : num(sh.samples, 'project.json render.shutter.samples');
    Z.SHUTTER = { n: Math.max(1, Math.round(n || 1)), angle: Math.min(360, Math.max(1, num(sh.angle, 'project.json render.shutter.angle') || 180)) };
  };
  // the one place the offsets apply: song time -> film time (every picture), film time -> lyric time
  Z.filmT = t => t - Z.OFFSET;
  Z.lyricT = ft => ft - Z.LYRIC_OFFSET;
  Z.setCues = data => {
    Z.CUES = {};
    for (const c of (data && data.cues) || []) {
      if (Z.CUES[c.id]) throw new Error(`analysis/cues.json: the id '${c.id}' is used twice`);
      const t0 = num(c.fix != null ? c.fix : c.t, `analysis/cues.json ${c.id}: ${c.fix != null ? 'fix' : 't'}`);
      if (t0 == null) throw new Error(`analysis/cues.json ${c.id}: no time`);
      Z.CUES[c.id] = Object.assign({}, c, { t: t0 + (c.kind === 'line' ? Z.LYRIC_OFFSET : 0) });
    }
  };
  Z.cue = (id, dt = 0) => {
    const c = Z.CUES[id];
    if (!c) throw new Error(`unknown cue '${id}' (analysis/cues.json: python tools/make_cues.py)`);
    return c.t + dt;
  };
  Z.cueOr = (id, fallback, dt = 0) => (Z.CUES[id] ? Z.CUES[id].t + dt : fallback);
  Z.cues = kind => Object.values(Z.CUES).filter(c => !kind || c.kind === kind).sort((a, b) => a.t - b.t);
})();
