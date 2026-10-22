"""Find the stretches of an export where (almost) nothing moves: the "it looks like a slideshow" problem.

Per frame: mean absolute change from the previous frame on a 96x54 grey copy (0..1). Smoothed over 0.5 s.
A stretch is STATIC when that level stays under --threshold for at least --min seconds. Cuts are excluded (they
are change, not motion). Very low-contrast frames (frame std < 0.07: a dark UI, a night sky) get a proportionally lower
threshold (down to 40 %): on them a clear camera move (~130 px/s) changes few grey levels. Above that floor nothing
changes, so the calibration on reviewed films holds (a fully contrast-relative measure was tried and let slow crossfades
over paintings pass, which the reviewer had called "lacking animation"). Also prints the motion level per second as a bar chart, so you can see the energy
curve of the picture next to the music (the chorus should move more than the verse).

The threshold was calibrated on reviewer feedback ("it looks like a slideshow"): 0.006 is a picture where only a slow
fade or a tiny drift happens. Adapted from the lyric-mv skill (mv-studio, MIT).

Usage:  python tools/motion_check.py render/mv.mp4 [--start S] [--threshold 0.006] [--min 1.5]
Exit 1 when static stretches add up to more than 10 % of the export. Not counted: stillness inside the song's own
stops (analysis/audio.json `stops` of kind 'stop', +- 0.3 s) and after `music_cut`, and inside shots marked `hold: true`
(plan/shots.json from tools/storyboard.mjs; run it after changing the timeline) up to 8 % of the export.
"""
import argparse
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
W, H = 96, 54


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("mp4")
    ap.add_argument("--threshold", type=float, default=0.006)
    ap.add_argument("--min", type=float, default=1.5)
    ap.add_argument("--quiet", action="store_true", help="no per-second chart")
    ap.add_argument("--start", type=float, default=None, help="song time of the file's first frame (default: mv_start tag or 0)")
    a = ap.parse_args()
    probe = subprocess.run([FF, "-i", a.mp4], capture_output=True, text=True, encoding="utf-8", errors="replace").stderr
    fps = float(next(p for p in probe.split(",") if " fps" in p).split()[0])
    m = re.search(r"mv_start=(-?[0-9.]+)", probe)
    start = a.start if a.start is not None else float(m.group(1)) if m else 0.0
    raw = subprocess.run([FF, "-v", "error", "-i", a.mp4, "-vf", f"scale={W}:{H}:flags=area,format=gray", "-f", "rawvideo", "-"],
                         capture_output=True, check=True).stdout
    g = np.frombuffer(raw, dtype=np.uint8).reshape(-1, W * H).astype(np.float32) / 255
    d = np.abs(np.diff(g, axis=0)).mean(axis=1)
    d = np.where(d > 0.06, np.median(d), d)                   # a cut is not motion
    k = max(1, int(round(fps * 0.5)))
    lvl = np.convolve(d, np.ones(k) / k, mode="same")
    sd = np.convolve(g.std(axis=1)[1:], np.ones(k) / k, mode="same")
    static = lvl < a.threshold * np.clip(sd / 0.07, 0.4, 1.0)
    runs, i = [], 0
    while i < len(static):
        if static[i]:
            j = i
            while j < len(static) and static[j]:
                j += 1
            if (j - i) / fps >= a.min:
                runs.append((i, j))
            i = j
        else:
            i += 1
    total = len(d) / fps
    t = np.arange(len(d)) / fps + start                    # song time of each frame step
    silent, held, inrun = (np.zeros(len(d), bool) for _ in range(3))
    for i, j in runs:
        inrun[i:j] = True
    au = read_json(ROOT / "analysis" / "audio.json")
    for s in au.get("stops") or []:
        if s.get("kind") == "stop":
            silent |= (t >= s["start"] - 0.3) & (t <= s["end"] + 0.3)
    if au.get("music_cut"):
        silent |= t >= au["music_cut"]
    for s in read_json(ROOT / "plan" / "shots.json").get("shots") or []:
        if s.get("hold"):
            held |= (t >= s["t0"]) & (t < s["t1"])
    n_silent = int((inrun & silent).sum())
    n_hold = min(int((inrun & held & ~silent).sum()), int(0.08 * len(d)))
    still = (int(inrun.sum()) - n_silent - n_hold) / fps
    st = lambda f: f / fps + start
    print(f"[motion] {Path(a.mp4).name}: {total:.1f} s, mean motion {d.mean():.4f}, static stretches (< {a.threshold} for >= {a.min} s): "
          f"{len(runs)} totalling {inrun.sum() / fps:.1f} s; counted {still:.1f} s ({100 * still / total:.0f} %)"
          + (f", not counted: {n_silent / fps:.1f} s in the song's stops / after the cut, {n_hold / fps:.1f} s in hold shots" if n_silent or n_hold else ""))
    for i, j in runs:
        print(f"  STATIC  song {st(i):7.2f} - {st(j):7.2f} s  ({(j - i) / fps:.1f} s, level {lvl[i:j].mean():.4f})")
    if not a.quiet:
        sec = int(np.ceil(total))
        per = [float(d[int(s * fps):int((s + 1) * fps)].mean()) if int(s * fps) < len(d) else 0 for s in range(sec)]
        top = max(per) or 1
        for s in range(sec):
            print(f"  {st(s * fps):6.1f}s {'#' * int(round(per[s] / top * 40)):<40s} {per[s]:.4f}{'  <- static' if per[s] < a.threshold else ''}")
    sys.exit(1 if still / total > 0.10 else 0)


def read_json(p: Path) -> dict:
    try:
        return json.loads(p.read_text(encoding="utf-8-sig"))
    except (OSError, ValueError):
        return {}


if __name__ == "__main__":
    main()
