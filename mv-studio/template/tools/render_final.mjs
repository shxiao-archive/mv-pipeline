#!/usr/bin/env node
// render_final.mjs -- final render: engine frames -> NVENC video (tools/render_frames.mjs), then mux the song,
// padded with silence to the video length (the afterimage tail may run past the music's dead stop).
// -----------------------------------------------------------------------------------------
//   node tools/render_final.mjs [--workers 3] [--start 0] [--end 226.54] [--name mv] [--preview]
//                               [--url engine/index.html] [--selector canvas#out] [--width 1920] [--height 1080]
//                               [--audio audio/song.wav] [--codec nvenc|x264|hevc] [--cq 16] [--fps 30] [--shutter 6]
//                               [--patch 62.4:66,120:121.5]
//
// Writes render/<name>_video.mp4 (picture only), render/<name>.mp4 (picture + AAC 320k / 48 kHz) and
// render/<name>_stats.json and render/<name>.render.json (the manifest: what this video was made from -- url, size,
// start, the hashes of engine/, assets/, analysis/ and the audio, and the toolchain -- which verify.mjs checks against
// and tools/stale.mjs compares with the files now), then prints an ffprobe summary. Without --end, render_frames.mjs uses the page's
// window.__zankoMeta.duration. Use --codec x264 on machines without an NVIDIA GPU.
// --patch re-renders only those ranges (widened to the keyframes around them) into the existing render/<name>_video.mp4
// and copies every other frame across: for fixes local to a few shots. A change to shared code (a palette, a helper
// many shots use, the engine) changes frames outside the ranges: render the whole film then.
// Cross-platform replacement of the old render_final.ps1 (which is now a thin wrapper around this file).
// Author: NikusonP -- vocaloid-style-mv-pipeline, MIT licence.
// -----------------------------------------------------------------------------------------
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { ROOT, TOOLS_DIR, FFMPEG, FFPROBE, inputsOf } from './kit_env.mjs';

// everything the engine page reads (engine/core/main.js, lyrics.js, assets.js): a change to one makes the video stale
const RENDER_INPUTS = ['engine/', 'jizura/app/', 'assets/', 'project.json', 'analysis/audio.json',
  'analysis/envelope_30fps.json', 'analysis/lyrics_mv.lrc', 'analysis/lyric_timing.json', 'analysis/cues.json', 'analysis/meter.json'];

const HELP = `
render_final.mjs -- full render (render_frames.mjs) + audio mux
  node tools/render_final.mjs [options]
  --workers N        parallel render workers                                       [3]
  --start T          start time in seconds                                         [0]
  --end T            end time in seconds (exclusive)          [page's window.__zankoMeta.duration]
  --name NAME        output base name -> render/NAME.mp4                           [mv]
  --preview          half-res fast preview (render_frames --preview)
  --url PAGE         engine page relative to the project root                       [engine/index.html]
  --selector CSS     canvas to capture                                              [canvas#out]
  --width W --height H   output size                                                [1920x1080]
  --fps N            frames per second                                              [30]
  --codec C          nvenc | x264 | hevc                                            [nvenc]
  --cq N             nvenc constant quality                                         [16]
  --crf N            x264 crf of the master (15 = near-lossless and large; 18-21 for a file to share)   [18]
  --audio FILE       song to mux (relative to the project root)                     [audio/song.wav]
  --shutter N        motion-blur sub-frames per frame (overrides project.json render.shutter.samples; 1 = off)
                     [project.json; 1 with --preview]
  --no-audio         skip the mux (render/NAME.mp4 = the picture-only file)
  --patch A:B[,C:D]  re-render only these ranges (seconds of the film) into the existing render/NAME_video.mp4,
                     widened to its keyframes; pass the same --start, --codec, --preview and size as that render
Env: BROWSER_CHANNEL, BROWSER_ANGLE, FFMPEG, FFPROBE (see tools/kit_env.mjs)`;

function parseArgs(argv) {
  const a = { workers: 3, start: 0, end: null, name: 'mv', preview: false, url: 'engine/index.html', selector: 'canvas#out',
    width: 1920, height: 1080, fps: 30, codec: 'nvenc', cq: 16, crf: 18, audio: 'audio/song.wav', noAudio: false, shutter: null, patch: null };
  const nums = new Set(['workers', 'start', 'end', 'width', 'height', 'fps', 'cq', 'crf', 'shutter']);
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (k === '--help' || k === '-h') { console.log(HELP.replace(/^\n/, '')); process.exit(0); }
    if (k === '--preview') { a.preview = true; continue; }
    if (k === '--no-audio') { a.noAudio = true; continue; }
    // also accept the old PowerShell spelling (-Workers 3, -End 226.54, -Preview ...)
    const key = k.replace(/^--?/, '').toLowerCase();
    if (key === 'preview') { a.preview = true; continue; }
    if (!(key in a) || !k.startsWith('-')) throw new Error(`unknown option ${k} (see --help)`);
    const v = argv[++i];
    if (v === undefined) throw new Error(`missing value for ${k}`);
    a[key] = nums.has(key) ? Number(v) : v;
    if (nums.has(key) && !Number.isFinite(a[key])) throw new Error(`bad number for ${k}: ${v}`);
  }
  if (a.patch != null) {
    a.patch = String(a.patch).split(',').map(r => r.split(':').map(Number));
    if (a.patch.some(r => r.length !== 2 || !r.every(Number.isFinite) || r[1] <= r[0])) throw new Error('--patch wants A:B[,C:D] in seconds, B > A');
  }
  return a;
}

// keyframe frame numbers K (ascending, K[0] = 0), N frames, ranges [[a, b]] in frames -> merged [[k0, k1]] on keyframes
export function patchSpans(K, N, ranges) {
  const out = [];
  for (const [a, b] of ranges.map(([a, b]) => [Math.max(0, a), Math.min(N, b)]).filter(([a, b]) => b > a).sort((x, y) => x[0] - y[0])) {
    const k0 = K.filter(k => k <= a).pop() ?? 0, k1 = K.find(k => k >= b) ?? N;
    if (out.length && k0 <= out[out.length - 1][1]) out[out.length - 1][1] = Math.max(out[out.length - 1][1], k1);
    else out.push([k0, k1]);
  }
  return out;
}

function probe(args, file) {
  const r = spawnSync(FFPROBE, ['-v', 'error', '-select_streams', 'v:0', ...args, '-of', 'csv=p=0', file], { encoding: 'utf8', maxBuffer: 1 << 26 });
  if (r.status !== 0) throw new Error(`ffprobe failed on ${file}`);
  return String(r.stdout).trim().split(/\r?\n/).filter(Boolean);
}

// re-render a.patch into the existing picture-only file; returns its frame count
function patchVideo(a, video, renderArgs) {
  if (!fs.existsSync(video)) throw new Error(`--patch needs an earlier render: ${video} not found`);
  const N = parseInt(probe(['-count_packets', '-show_entries', 'stream=nb_read_packets'], video)[0], 10);
  const [W] = probe(['-show_entries', 'stream=width'], video).map(Number), want = a.preview ? Math.round(a.width / 2) : a.width;
  if (W !== want) throw new Error(`${video} is ${W} px wide, this render would be ${want}: pass the same size / --preview as that render`);
  const K = probe(['-skip_frame', 'nokey', '-show_entries', 'frame=pts_time'], video).map(t => Math.round(parseFloat(t) * a.fps));
  const spans = patchSpans(K, N, a.patch.map(([s, e]) => [Math.floor((s - a.start) * a.fps), Math.ceil((e - a.start) * a.fps)]));
  if (!spans.length) throw new Error('--patch: no range falls inside the video');
  const dir = path.join(path.dirname(video), `${a.name}_patch`);
  fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir);
  const cuts = [...new Set(spans.flat())].filter(f => f > 0 && f < N).sort((x, y) => x - y), bounds = [0, ...cuts, N];
  if (cuts.length) run(FFMPEG, ['-y', '-hide_banner', '-loglevel', 'error', '-i', video, '-map', '0:v:0', '-c', 'copy', '-f', 'segment',
    '-segment_frames', cuts.join(','), '-reset_timestamps', '1', path.join(dir, 'old_%03d.mp4')], 'split');
  else fs.copyFileSync(video, path.join(dir, 'old_000.mp4'));
  const list = [];
  for (let i = 0; i + 1 < bounds.length; i++) {
    const [f0, f1] = [bounds[i], bounds[i + 1]];
    let file = path.join(dir, `old_${String(i).padStart(3, '0')}.mp4`);
    if (spans.some(([k0, k1]) => f0 >= k0 && f1 <= k1)) {
      const f = a.start * a.fps;
      console.log(`[patch] frames ${f0}-${f1} (${((f + f0) / a.fps).toFixed(2)}-${((f + f1) / a.fps).toFixed(2)} s)`);
      file = path.join(dir, `new_${i}.mp4`);
      run(process.execPath, renderArgs(`${Math.round(f + f0)}f`, `${Math.round(f + f1)}f`, file), 'render_frames');
    }
    list.push(`file '${file.replace(/\\/g, '/')}'`);
  }
  fs.writeFileSync(path.join(dir, 'concat.txt'), list.join('\n') + '\n');
  const tmp = path.join(dir, 'joined.mp4');
  run(FFMPEG, ['-y', '-hide_banner', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', path.join(dir, 'concat.txt'), '-c', 'copy',
    '-movflags', '+faststart', tmp], 'concat');
  const got = parseInt(probe(['-count_packets', '-show_entries', 'stream=nb_read_packets'], tmp)[0], 10);
  if (got !== N) throw new Error(`the patched video has ${got} frames, the old one ${N}: kept the old one (parts in ${dir})`);
  fs.renameSync(tmp, video); fs.rmSync(dir, { recursive: true, force: true });
  return N;
}

function run(cmd, args, label) {
  const r = spawnSync(cmd, args, { cwd: ROOT, stdio: 'inherit' });
  if (r.error) throw new Error(`${label}: cannot start ${cmd} (${r.error.message})`);
  if (r.status !== 0) throw new Error(`${label} failed (exit ${r.status})`);
}

function main() {
  const a = parseArgs(process.argv.slice(2));
  const audio = path.resolve(ROOT, a.audio);
  if (!a.noAudio && !fs.existsSync(audio)) throw new Error(`audio not found: ${audio} (pass --audio FILE or --no-audio)`);
  const renderDir = path.join(ROOT, 'render');
  fs.mkdirSync(renderDir, { recursive: true });
  const video = path.join(renderDir, `${a.name}_video.mp4`);
  const final = path.join(renderDir, `${a.name}.mp4`);
  const statsFile = path.join(renderDir, `${a.name}_stats.json`);
  const manifestFile = path.join(renderDir, `${a.name}.render.json`);
  const rel = p => path.relative(ROOT, p).split(path.sep).join('/');
  const inputs = inputsOf([...RENDER_INPUTS, ...(a.noAudio ? [] : [rel(audio)])]);   // hashed before the render starts
  let base = null;
  if (a.patch) try { base = JSON.parse(fs.readFileSync(manifestFile, 'utf8')); } catch { /* an older render without one */ }

  const shutter = a.shutter ?? (a.preview ? 1 : null);
  const url = shutter == null ? a.url : a.url + (a.url.includes('?') ? '&' : '?') + 'shutter=' + shutter;
  const renderArgs = (start, end, out, stats) => {
    const r = [path.join(TOOLS_DIR, 'render_frames.mjs'), '--url', url, '--selector', a.selector,
      '--width', String(a.width), '--height', String(a.height), '--start', String(start)];
    if (end != null) r.push('--end', String(end));
    r.push('--fps', String(a.fps), '--workers', String(a.workers), '--mode', 'blob', '--out', out,
      '--codec', a.codec, '--cq', String(a.cq), '--crf', String(a.crf));
    if (stats) r.push('--stats', stats);
    if (a.preview) r.push('--preview');
    return r;
  };

  const t0 = performance.now();
  let expect = null, dur = null;
  if (a.patch) { expect = patchVideo(a, video, renderArgs); dur = expect / a.fps; }
  else {
    run(process.execPath, renderArgs(a.start, a.end, video, statsFile), 'render_frames');
    if (a.end != null) dur = a.end - a.start;
  }

  // video length: from the stats render_frames just wrote (exact), else ffprobe
  if (dur == null) {
    try { const st = JSON.parse(fs.readFileSync(statsFile, 'utf8')); dur = st.frames / st.args.fps; } catch { /* fall through */ }
  }
  if (dur == null) {
    const r = spawnSync(FFPROBE, ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', video], { encoding: 'utf8' });
    dur = parseFloat(String(r.stdout).trim());
    if (!Number.isFinite(dur)) throw new Error('cannot determine the video duration (ffprobe failed)');
  }

  if (a.noAudio) fs.copyFileSync(video, final);
  else {
    // audio: song from --start, padded with silence to the video length (the afterimage tail runs past the dead stop)
    run(FFMPEG, ['-y', '-hide_banner', '-loglevel', 'error', '-i', video, '-ss', String(a.start), '-i', audio,
      '-filter_complex', `[1:a]apad=whole_dur=${dur.toFixed(6)}[a]`, '-map', '0:v', '-map', '[a]', '-c:v', 'copy',
      '-c:a', 'aac', '-b:a', '320k', '-ar', '48000', '-t', dur.toFixed(6), '-metadata', `comment=mv_start=${a.start}`,
      '-movflags', '+faststart', final], 'mux');     // mv_start: check_flash / motion_check / jury_pack read the song time
  }
  // the master must contain every rendered frame (guards against a truncated segment or a failed concat)
  if (expect == null) try { expect = JSON.parse(fs.readFileSync(statsFile, 'utf8')).frames; } catch { /* no stats */ }
  if (expect == null && a.end != null) expect = Math.round((a.end - a.start) * a.fps);
  if (expect != null) {
    const r = spawnSync(FFPROBE, ['-v', 'error', '-count_packets', '-select_streams', 'v:0', '-show_entries', 'stream=nb_read_packets',
      '-of', 'csv=p=0', final], { encoding: 'utf8' });
    const got = parseInt(String(r.stdout).trim(), 10);
    if (got !== expect) throw new Error(`${final} has ${Number.isFinite(got) ? got : '?'} video frames, expected ${expect}: re-run the render`);
  }
  let st = {};
  try { st = JSON.parse(fs.readFileSync(statsFile, 'utf8')); } catch { /* no stats */ }
  const pw = (() => { try { return JSON.parse(fs.readFileSync(path.join(ROOT, 'node_modules/playwright/package.json'), 'utf8')).version; } catch { return null; } })();
  const ff = String(spawnSync(FFMPEG, ['-version'], { encoding: 'utf8' }).stdout || '').split('\n')[0].trim() || null;
  fs.writeFileSync(manifestFile, JSON.stringify({
    version: 1, generator: 'tools/render_final.mjs', video: rel(final), url, selector: a.selector,
    width: a.width, height: a.height, fps: a.fps, start: a.start, end: a.end, shutter, preview: a.preview, codec: a.codec, audio: a.noAudio ? null : rel(audio),
    // a patch re-rendered only these spans with today's files; the rest is the earlier render's (base_inputs)
    patched: a.patch ? [...(base?.patched || []), ...a.patch] : null,
    base_inputs: a.patch ? (base?.base_inputs || base?.inputs || null) : null,
    inputs, env: { node: process.version, playwright: pw, browser: st.browser || null, gpu: st.gpu?.renderer || null, ffmpeg: ff, platform: `${process.platform}-${process.arch}` },
  }, null, 1) + '\n');
  console.log(`done in ${((performance.now() - t0) / 60000).toFixed(1)} min -> ${final} (+ ${rel(manifestFile)})`);
  spawnSync(FFPROBE, ['-v', 'error', '-show_entries', 'stream=codec_name,width,height,r_frame_rate:format=duration,size',
    '-of', 'compact', final], { stdio: 'inherit' });
}

function selftest() {
  const K = [0, 60, 120, 180, 240], eq = (x, y) => JSON.stringify(x) === JSON.stringify(y);
  const ok = [
    eq(patchSpans(K, 300, [[70, 80]]), [[60, 120]]),                      // widened to the keyframes around it
    eq(patchSpans(K, 300, [[70, 80], [110, 130]]), [[60, 180]]),          // touching spans merge
    eq(patchSpans(K, 300, [[250, 400], [0, 10]]), [[0, 60], [240, 300]]), // clamped to the video, sorted
    eq(patchSpans(K, 300, [[400, 500]]), []),
  ];
  if (ok.every(Boolean)) console.log('selftest ok'); else { console.error('selftest FAIL', ok); process.exit(1); }
}

if (process.argv.includes('--selftest')) selftest();
else try { main(); } catch (e) { console.error('[render_final] ' + e.message); process.exit(1); }
