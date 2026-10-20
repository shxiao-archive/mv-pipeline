"""Photosensitivity + single-frame-glitch check for an exported MP4.

Approximates the WCAG 2.3.1 "three flashes" thresholds on a 64x36 down-scaled copy:
  general flash : a pair of opposing luminance changes of >= 10 % of full scale (darker
                  state below 0.80) on >= 25 % of the frame
  red flash     : a pair of opposing transitions to / from saturated red on >= 25 % of the frame
A film passes when no 1-second window holds more than 3 flashes of either kind.

Also lists single-frame pops: a frame that differs strongly from both neighbours while the
neighbours look alike (an unintended one-frame flash or a missing frame).

Times are printed as SONG time: render/<name>.mp4 from render_final.mjs starts at song time 0; for a clip rendered
with render_frames.mjs --start S pass --start S (or the mp4 carries a `comment` tag mv_start=S).

Writes render/<name>_flash.json: the results plus the WARNING RANGES (song time) -- every stretch with >= 2 flashes or
>= 4 hard cuts in one second -- which tools/preroll.py turns into the warning card and the upload description.

Adapted from world-execute-me-lyric-mv (MIT, (c) 2026 Nyankomint). An approximation, not a certified PSE test
(ITU-R BT.1702 / WCAG 2.3.1 spirit). Run it on every render of a fast-cut film; it exits 1 on FAIL.

Usage:  python tools/check_flash.py render/mv.mp4 [--start 62.5]
"""
import json
import os
import re
import shutil
import subprocess
import sys
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent.parent
FF = shutil.which("ffmpeg") or "ffmpeg"
W, H, AREA = 64, 36, 0.25
WARN_FLASHES, WARN_CUTS = 2, 4          # per second: a stretch at or above either gets a warning range


def transitions(value, thresh, dark_limit=None):
    """Per pixel and frame: 1 where the pixel completes a rise or fall of >= thresh since its last
    extreme (directions alternate by construction, so two marks = one flash for that pixel)."""
    n = value.shape[0]
    ext = value[0].copy()                 # last extreme per pixel
    direction = np.zeros(value.shape[1], dtype=np.int8)
    marks = np.zeros(value.shape, dtype=np.int16)
    for i in range(1, n):
        v = value[i]
        rise = (v - ext >= thresh) & (direction <= 0)
        fall = (ext - v >= thresh) & (direction >= 0)
        if dark_limit is not None:        # only counts when the darker of the two states is below the limit
            rise &= ext < dark_limit
            fall &= v < dark_limit
        marks[i] = rise | fall
        direction[rise], direction[fall] = 1, -1
        ext[rise], ext[fall] = v[rise], v[fall]
        ext = np.where(direction > 0, np.maximum(ext, v), np.where(direction < 0, np.minimum(ext, v), ext))
    return marks


def flashes_per_second(marks, fps):
    """Largest F such that at least AREA of the frame flashes F times inside some 1 s window."""
    win = int(round(fps))
    cum = np.cumsum(marks, axis=0, dtype=np.int32)
    counts = cum[win:] - cum[:-win]                                   # transitions per pixel per window
    area_level = np.percentile(counts, 100 * (1 - AREA), axis=1)      # value reached by the busiest 25 % of pixels
    at = int(np.argmax(area_level))
    return float(area_level[at]) / 2, at, int((marks.mean(axis=1) >= AREA).sum()), area_level / 2


def main():
    args = [a for a in sys.argv[1:]]
    if not args:
        sys.exit("usage: python tools/check_flash.py <export.mp4> [--start S]")
    start_arg = None
    if "--start" in args:
        k = args.index("--start"); start_arg = float(args[k + 1]); del args[k:k + 2]
    mp4 = Path(args[0])
    probe = subprocess.run([FF, "-i", str(mp4)], capture_output=True, text=True, encoding="utf-8", errors="replace").stderr
    fps = float(next(p for p in probe.split(",") if " fps" in p).split()[0])
    m = re.search(r"mv_start=(-?[0-9.]+)", probe)
    start = start_arg if start_arg is not None else float(m.group(1)) if m else 0.0   # song time of the file's first frame
    at = lambda frame: f"{frame / fps + start:.2f} s song time (file {frame / fps:.2f} s)"
    raw = subprocess.run([FF, "-v", "error", "-i", str(mp4), "-vf", f"scale={W}:{H}:flags=area,format=rgb24", "-f", "rawvideo", "-"],
                         capture_output=True, check=True).stdout
    rgb = np.frombuffer(raw, dtype=np.uint8).reshape(-1, W * H, 3).astype(np.float32) / 255.0
    n = rgb.shape[0]
    lin = np.where(rgb <= 0.04045, rgb / 12.92, ((rgb + 0.055) / 1.055) ** 2.4)
    lum = 0.2126 * lin[..., 0] + 0.7152 * lin[..., 1] + 0.0722 * lin[..., 2]
    print(f"[flash] {mp4.name}: {n} frames @ {fps:g} fps ({n / fps:.1f} s), first frame at song time {start:+.3f} s"
          + ("" if m else " (no mv_start tag: assumed 0)"))

    worst, w0, cnt, gen_ps = flashes_per_second(transitions(lum, 0.10, dark_limit=0.80), fps)
    failed = worst > 3
    res = {"file": mp4.name, "fps": fps, "start": start, "frames": n, "general_worst": worst}
    print(f"  general: {cnt} frames with a large-area luminance transition; worst 1 s window = {worst:.1f} flashes "
          f"(window starting {at(w0)}) -> {'PASS' if worst <= 3 else 'FAIL'} (limit 3)")

    s = rgb.sum(axis=2) + 1e-6                               # saturated red: R / (R+G+B) >= 0.8, scaled by its strength
    red = np.where(rgb[..., 0] / s >= 0.8, np.clip((rgb[..., 0] - rgb[..., 1] - rgb[..., 2]) * 320 / 255, 0, None), 0)
    worst, w0, cnt, red_ps = flashes_per_second(transitions(red, 20 / 255), fps)
    failed = failed or worst > 3
    res["red_worst"] = worst
    print(f"  red:     {cnt} frames with a large-area saturated-red transition; worst 1 s window = {worst:.1f} flashes "
          f"(window starting {at(w0)}) -> {'PASS' if worst <= 3 else 'FAIL'} (limit 3)")

    # busiest second in terms of big whole-frame changes (cuts, heavy glitching)
    flat = rgb.reshape(n, -1)
    d1 = np.abs(flat[1:] - flat[:-1]).mean(axis=1)           # d1[i] = change from frame i to i+1
    cuts = np.where(d1 > 0.12)[0]
    if len(cuts):
        per = [int(np.searchsorted(cuts, c + fps) - j) for j, c in enumerate(cuts)]
        j = int(np.argmax(per))
        print(f"  hard frame changes (mean abs diff > 0.12): {len(cuts)}; busiest second has {per[j]} (from {at(cuts[j])})")

    # single-frame pops: frame i unlike i-1 and i+1, while i-1 and i+1 are alike
    d2 = np.abs(flat[2:] - flat[:-2]).mean(axis=1)           # d2[i] = change from frame i to i+2
    pops = [i + 1 for i in range(n - 2) if d1[i] > 0.05 and d1[i + 1] > 0.05 and d2[i] < 0.35 * min(d1[i], d1[i + 1])]
    if pops:
        print(f"  single-frame pops: {len(pops)} (song time) -> " + ", ".join(f"{p / fps + start:.3f}s" for p in pops[:40]))
    else:
        print("  single-frame pops: none")

    # warning ranges: 1 s windows with >= WARN_FLASHES flashes or >= WARN_CUTS hard cuts, merged when < 1 s apart
    win = int(round(fps))
    cut_ps = np.convolve(np.r_[0, (d1 > 0.12)].astype(int), np.ones(win, int), mode="valid")[1:][: len(gen_ps)]
    hot = np.where((np.maximum(gen_ps, red_ps)[: len(cut_ps)] >= WARN_FLASHES) | (cut_ps >= WARN_CUTS))[0]
    ranges = []
    for i in hot:                                             # window i covers frames i+1 .. i+win
        t0, t1 = (i + 1) / fps + start, (i + win) / fps + start
        if ranges and t0 - ranges[-1][1] < 1.0:
            ranges[-1][1] = t1
        else:
            ranges.append([t0, t1])
    res.update({"result": "FAIL" if failed else "PASS", "single_frame_pops": len(pops),
                "warning_ranges": [[round(a, 2), round(b, 2)] for a, b in ranges]})
    fmt = lambda t: f"{int(t // 60)}:{t % 60:04.1f}"
    print("  warning ranges (>= %d flashes or >= %d cuts per second): " % (WARN_FLASHES, WARN_CUTS)
          + (", ".join(f"{fmt(a)}-{fmt(b)}" for a, b in ranges) + "  -> python tools/preroll.py" if ranges else "none"))
    out = mp4.with_name(mp4.stem + "_flash.json")
    out.write_text(json.dumps(res, indent=1), encoding="utf-8")
    print(f"  -> {out}")
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()
