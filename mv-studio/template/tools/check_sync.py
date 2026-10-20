#!/usr/bin/env python3
"""Sync check of a rendered film: is the picture where the song is?

    python tools/check_sync.py render/mv.mp4 [--start 0] [--audio audio/song.wav] [--json render/sync.json]
    python tools/check_sync.py --lyrics-only            # step 3 only, before any render

1. AUDIO MUX   the MP4's audio against the song (cross-correlation): a muxing offset shifts everything at once.
               PASS within one frame.
2. CUTS        every planned hard cut (plan/shots.json, written by tools/storyboard.mjs) against the frame where the
               picture actually changes: the first frame at or after the cut time must be the first new frame.
               A late analyzer, a frame-rounding bug or an offset shows up as a constant lag. PASS when the median
               lag is under half a frame and >= 90 % of the measurable cuts are within one frame.
3. LYRICS      the lyric line starts (analysis/lyrics_mv.lrc + project.json timing.lyricOffset) against the onsets of
               the voice (harmonic part, 300-3400 Hz spectral flux): the best global shift and, per line, the nearest
               onset. PASS within 80 ms; estimated timings (estimate_lrc.py) usually fail here -- that is the point.
               Then PHRASES: every line should start after a breath; a line that starts inside a sung phrase is likely
               on the wrong phrase (a correct onset of the wrong line). Run it before rendering:
                   python tools/check_sync.py --lyrics-only
Times are song times; --start is the song time of the file's first frame (render_final.mjs --start).
Exit 1 when 1 or 2 fails; a doubtful step 3 makes the result WARN (exit 0: onset detection on a full mix is noisy, so
listen to the listed lines before trusting or changing them).

Method after world-execute-me-lyric-mv's tools/check_sync.py (Nyankomint, MIT); rewritten for mv-studio (MIT).
"""
from __future__ import annotations

import argparse
import json
import subprocess
import sys
from pathlib import Path

import numpy as np

TOOLS = Path(__file__).resolve().parent
sys.path.insert(0, str(TOOLS))
import kit_env  # noqa: E402  (sets NUMBA_CACHE_DIR before librosa)
from lrc import LRC, ROOT, parse_lrc, read_project  # noqa: E402


def decode_audio(path: Path, sr: int) -> np.ndarray:
    raw = subprocess.run([kit_env.FFMPEG, "-v", "error", "-i", str(path), "-ac", "1", "-ar", str(sr), "-f", "f32le", "-"],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype=np.float32)


def video_fps(path: Path) -> float:
    out = subprocess.run([kit_env.FFPROBE, "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=r_frame_rate",
                          "-of", "csv=p=0", str(path)], capture_output=True, text=True, check=True).stdout.strip()
    a, b = (out.split("/") + ["1"])[:2]
    return float(a) / float(b)


def frame_diffs(path: Path) -> np.ndarray:
    raw = subprocess.run([kit_env.FFMPEG, "-v", "error", "-i", str(path), "-vf", "scale=64:36,format=gray", "-f", "rawvideo", "-"],
                         capture_output=True, check=True).stdout
    g = np.frombuffer(raw, dtype=np.uint8).reshape(-1, 64 * 36).astype(np.float32)
    d = np.zeros(len(g), np.float32)
    d[1:] = np.abs(np.diff(g, axis=0)).mean(axis=1) / 255
    return d


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("video", nargs="?", help="the rendered film (leave out with --lyrics-only)")
    ap.add_argument("--lyrics-only", action="store_true", help="only step 3, from the song and the LRC: no render needed")
    ap.add_argument("--start", type=float, default=0.0, help="song time of the file's first frame")
    ap.add_argument("--audio", default="audio/song.wav")
    ap.add_argument("--shots", default="plan/shots.json")
    ap.add_argument("--json", default="render/sync.json")
    a = ap.parse_args()
    if not a.video and not a.lyrics_only:
        ap.error("give the video, or --lyrics-only")
    mp4 = kit_env.resolve(a.video) if a.video and not a.lyrics_only else None
    song = kit_env.resolve(a.audio)
    proj = read_project()
    tm = proj.get("timing", {})
    offset, loff = float(tm.get("offset", 0) or 0), float(tm.get("lyricOffset", 0) or 0)
    res: dict = {"video": kit_env.rel(mp4) if mp4 else None, "start": a.start, "offset": offset, "lyricOffset": loff}
    fail = warn = False

    if mp4:
        fps = video_fps(mp4)
        # ---- 1. audio mux
        sr = 8000
        try:
            dec, src = decode_audio(mp4, sr), decode_audio(song, sr)
            dec0 = dec[int(round(max(0.0, -a.start) * sr)):]
            src0 = src[int(round(max(0.0, a.start) * sr)):]
            n = min(len(dec0), len(src0), sr * 40)
            L = int(0.3 * sr)
            x, y = dec0[:n], src0[:n]
            core = slice(L, n - L)
            xc = np.array([float(np.dot(x[core], y[L + l: n - L + l])) for l in range(-L, L + 1)])
            lag_ms = -(int(np.argmax(xc)) - L) / sr * 1000          # > 0: the film's audio is LATE against the song
            ok = abs(lag_ms) <= 1000 / fps
            fail |= not ok
            res["audio_mux_ms"] = round(lag_ms, 1)
            print(f"[1] audio mux   {lag_ms:+7.1f} ms   {'PASS' if ok else 'FAIL'} ({'in step with' if abs(lag_ms) < 0.5 else 'late against' if lag_ms > 0 else 'early against'} audio/song.wav)")
        except subprocess.CalledProcessError:
            print("[1] audio mux   no audio stream in the file: skipped")

        # ---- 2. cuts
        shots_p = kit_env.resolve(a.shots)
        if shots_p.is_file():
            shots = json.loads(shots_p.read_text(encoding="utf-8"))["shots"]
            d = frame_diffs(mp4)
            rows = []
            for k, s in enumerate(shots[1:], 1):
                if s.get("trans"):
                    continue                                         # a transition is not a frame-exact change
                tc = s["t0"] + offset - a.start
                f0 = int(np.ceil(tc * fps - 1e-6))
                if f0 < 5 or f0 > len(d) - 6:
                    continue
                w = np.arange(f0 - 4, f0 + 5)
                j = int(w[int(np.argmax(d[w]))])
                around = np.median(np.concatenate([d[max(1, f0 - 20):f0 - 4], d[f0 + 5:f0 + 20]])) if len(d) > f0 + 20 else np.median(d)
                if d[j] < max(0.02, 3 * around):                     # no clear change near this cut: not measurable
                    continue
                rows.append({"shot": s["id"], "t": round(s["t0"], 3), "lag_frames": j - f0})
            if rows:
                lags = np.array([r["lag_frames"] for r in rows])
                within = float(np.mean(np.abs(lags) <= 1))
                med = float(np.median(lags))
                ok = abs(med) < 0.5 and within >= 0.9
                fail |= not ok
                res["cuts"] = {"measured": len(rows), "median_lag_frames": med, "within_1_frame": round(within, 3),
                               "off": [r for r in rows if abs(r["lag_frames"]) > 1]}
                print(f"[2] cuts        median {med:+.1f} frame(s) ({med / fps * 1000:+.0f} ms), {within:.0%} within one frame "
                      f"of {len(rows)} measurable cuts   {'PASS' if ok else 'FAIL'}")
                for r in res["cuts"]["off"][:12]:
                    print(f"      {r['shot']:10s} cut {r['t']:8.3f} s  picture changes {r['lag_frames']:+d} frame(s) from it")
            else:
                print("[2] cuts        no measurable hard cuts")
        else:
            print(f"[2] cuts        no {a.shots}: run node tools/storyboard.mjs first")

    # ---- 3. lyrics vs voice
    if LRC.is_file():
        import librosa  # after kit_env
        y, sr2 = librosa.load(str(song), sr=22050, mono=True)
        hop = 128                                                # 1024 / 128: onsets ~2 ms early (2048 reads ~25 ms early)
        harm = librosa.effects.harmonic(y, margin=2.0)
        S = np.abs(librosa.stft(harm, n_fft=1024, hop_length=hop))
        fr = librosa.fft_frequencies(sr=sr2, n_fft=1024)
        band = S[(fr >= 300) & (fr <= 3400)]
        env = np.maximum(0, np.diff(np.log1p(band * 50).sum(axis=0), prepend=0))
        env_t = np.arange(len(env)) * hop / sr2
        lines = parse_lrc(LRC, len(y) / sr2)
        starts = np.array([L["t"] + loff for L in lines])
        if len(starts):
            shifts = np.arange(-0.4, 0.4001, 0.005)
            score = np.array([np.interp(starts + s, env_t, env).mean() for s in shifts])
            sm = np.convolve(score, np.ones(5) / 5, mode="same")
            best = float(shifts[int(np.argmax(sm))])
            z = float((sm.max() - sm.mean()) / (sm.std() + 1e-9))
            near = []
            for i, s0 in enumerate(starts):
                m = (env_t >= s0 - 0.25) & (env_t <= s0 + 0.25)
                near.append(float(env_t[m][int(np.argmax(env[m]))] - s0) if m.any() else 0.0)
            near_a = np.array(near)
            ok = abs(best) <= 0.08
            res["lyrics"] = {"best_shift_ms": round(best * 1000), "peak_z": round(z, 1), "median_nearest_ms": round(float(np.median(near_a)) * 1000),
                             "lines_off_120ms": [i for i, v in enumerate(near) if abs(v) > 0.12]}
            print(f"[3] lyrics      best shift {best * 1000:+.0f} ms (z {z:.1f}; > 0 = the voice comes AFTER the LRC time), "
                  f"per-line nearest onset median {np.median(near_a) * 1000:+.0f} ms   {'PASS' if ok else 'WARN'}")
            # a line should start a sung PHRASE: a breath (little voice-band energy) just before it, voice right after.
            # A line placed on the right onset of the wrong phrase passes the shift test above but fails here.
            # Calibrated on the test song (true starts <= 0.40, starts inside a phrase >= 0.57).
            e = np.convolve(np.sqrt((band ** 2).mean(axis=0)), np.ones(5) / 5, mode="same")
            dt = hop / sr2
            def breath_ratio(s0):
                best = 9.0
                for j in range(max(1, int((s0 - 0.15) / dt)), int((s0 + 0.15) / dt)):
                    pre = e[max(0, j - int(0.35 / dt)):max(1, j - int(0.06 / dt))].mean()
                    best = min(best, float(pre / (e[j:j + int(0.3 / dt)].mean() + 1e-9)))
                return best
            mid = [i for i, s0 in enumerate(starts) if breath_ratio(s0) >= 0.5]
            res["lyrics"]["lines_inside_phrase"] = mid
            warn |= bool(mid) or not ok
            print(f"      phrase starts: {len(starts) - len(mid)}/{len(starts)} lines start after a breath"
                  + (f"; lines {', '.join(map(str, mid))} start INSIDE a sung phrase: they may sit on the wrong phrase"
                     " (estimated timing?) -- listen, fix in tools/lyric_editor" if mid else "   PASS"))
            off = res["lyrics"]["lines_off_120ms"]
            if off:
                print(f"      lines whose nearest voice onset is > 120 ms away: {', '.join(map(str, off[:30]))}"
                      " (check them by ear: tools/lyric_editor)")
    res["result"] = "FAIL" if fail else "WARN" if warn else "PASS"     # WARN: the lyric timing needs a listen
    out = kit_env.resolve(a.json)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(res, indent=1), encoding="utf-8")
    print(f"[check_sync] {res['result']} -> {kit_env.rel(out)}")
    return 1 if fail else 0


if __name__ == "__main__":
    sys.exit(main())
