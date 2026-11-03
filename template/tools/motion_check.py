"""Find the stretches of an export where (almost) nothing moves: the "it looks like a slideshow" problem.

Per frame: mean absolute change from the previous frame on a 96x54 grey copy (0..1), measured AFTER taking the camera
out: the previous frame is first aligned to this one with the best global move (pan, zoom, rotation; OpenCV ECC on a
192x108 copy), so what is left is what moves in the picture. Smoothed over 0.5 s. A stretch is STATIC when that
content level stays under --threshold for at least --min seconds, whatever the camera does: a pan, push, float or
reframing snap over a picture where nothing happens is a still picture moved, not animation. Those stretches print as
"camera only", and the per-second chart shows content and camera apart. Inside shots with a living
face (plan/shots.json `animFaces`: chars[].anim blinks and sings) 40 % of the threshold is enough, so a singer under a
slow push passes while a still picture does not (the push itself is taken out), up to 8 % of the export. Cuts are excluded (they
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
W, H = 192, 108                                          # aligned at this size, measured at half of it (96x54)


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
    f = np.frombuffer(raw, dtype=np.uint8).reshape(-1, H, W).astype(np.float32) / 255
    g = half(f).reshape(len(f), -1)
    d = np.abs(np.diff(g, axis=0)).mean(axis=1)               # the whole picture: content + camera
    c = content_diff(f, d)                                    # with the camera taken out
    cut = d > 0.06
    d = np.where(cut, np.median(d), d)                        # a cut is not motion
    c = np.where(cut, np.median(c), c)
    cam = np.maximum(d - c, 0)
    k = max(1, int(round(fps * 0.5)))
    lvl = np.convolve(c, np.ones(k) / k, mode="same")
    raw_lvl = np.convolve(d, np.ones(k) / k, mode="same")
    sd = np.convolve(g.std(axis=1)[1:], np.ones(k) / k, mode="same")
    thr = a.threshold * np.clip(sd / 0.07, 0.4, 1.0)
    t = np.arange(len(d)) / fps + start                    # song time of each frame step
    shots = read_json(ROOT / "plan" / "shots.json").get("shots") or []
    faces = np.zeros(len(d), bool)
    for s in shots:
        if s.get("animFaces"):
            faces |= (t >= s["t0"]) & (t < s["t1"])
    # a living face (chars[].anim: blinks, expressions) is motion too, over a frame that also drifts (>= 40 % of the
    # threshold). Read from the plan, not the pixels: a top-cells measure scored held stills with animated lyrics and
    # petals (0.008-0.03) above a singing mouth (0.006), so it cannot tell them apart
    rescued = faces & (lvl < thr) & (lvl >= 0.4 * thr)
    # capped at 8 % of the export, like holds: beyond it a held picture where only the face changes is static again
    # (iteration 5: ~8 s of such shots passed here while two juries scored the motion 4-5)
    idx = np.flatnonzero(rescued)
    rescued[idx[int(0.08 * len(d)):]] = False
    static = (lvl < thr) & ~rescued
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
    silent, held, inrun = (np.zeros(len(d), bool) for _ in range(3))
    for i, j in runs:
        inrun[i:j] = True
    au = read_json(ROOT / "analysis" / "audio.json")
    for s in au.get("stops") or []:
        if s.get("kind") == "stop":
            silent |= (t >= s["start"] - 0.3) & (t <= s["end"] + 0.3)
    if au.get("music_cut"):
        silent |= t >= au["music_cut"]
    for s in shots:
        if s.get("hold"):
            held |= (t >= s["t0"]) & (t < s["t1"])
    n_silent = int((inrun & silent).sum())
    n_hold = min(int((inrun & held & ~silent).sum()), int(0.08 * len(d)))
    still = (int(inrun.sum()) - n_silent - n_hold) / fps
    st = lambda f: f / fps + start
    cam_only = int((inrun & (raw_lvl >= thr)).sum()) / fps
    print(f"[motion] {Path(a.mp4).name}: {total:.1f} s, mean motion {c.mean():.4f} in the picture + {cam.mean():.4f} from the camera, static stretches (< {a.threshold} for >= {a.min} s): "
          f"{len(runs)} totalling {inrun.sum() / fps:.1f} s; counted {still:.1f} s ({100 * still / total:.0f} %)"
          + (f", not counted: {n_silent / fps:.1f} s in the song's stops / after the cut, {n_hold / fps:.1f} s in hold shots" if n_silent or n_hold else "")
          + (f"; {rescued.sum() / fps:.1f} s of slow drift in shots with a living face (chars[].anim): counted as motion" if rescued.sum() >= a.min * fps else "")
          + (f"; {cam_only:.1f} s of it moves only because the camera does" if cam_only else ""))
    for i, j in runs:
        only = raw_lvl[i:j].mean() >= thr[i:j].mean()
        print(f"  STATIC  song {st(i):7.2f} - {st(j):7.2f} s  ({(j - i) / fps:.1f} s, level {lvl[i:j].mean():.4f}{', camera only' if only else ''})")
    if not a.quiet:
        sec = int(np.ceil(total))
        sl = lambda x, s: float(x[int(s * fps):int((s + 1) * fps)].mean()) if int(s * fps) < len(x) else 0
        per, pcam = [sl(c, s) for s in range(sec)], [sl(cam, s) for s in range(sec)]
        top = max(p + q for p, q in zip(per, pcam)) or 1
        print("  (# = moves in the picture, ~ = camera)")
        for s in range(sec):
            bar = '#' * int(round(per[s] / top * 40)) + '~' * int(round(pcam[s] / top * 40))
            print(f"  {st(s * fps):6.1f}s {bar:<40s} {per[s]:.4f} +{pcam[s]:.4f}{'  <- static' if per[s] < a.threshold else ''}")
    sys.exit(1 if still / total > 0.10 else 0)


def half(f):
    """192x108 -> 96x54 (area)."""
    return f.reshape(len(f), H // 2, 2, W // 2, 2).mean(axis=(2, 4))


def content_diff(f, d):
    """Per frame step: the change left after aligning the previous frame to this one with the best global move."""
    import cv2
    crit = (cv2.TERM_CRITERIA_EPS | cv2.TERM_CRITERIA_COUNT, 40, 1e-5)
    out, warp = np.empty(len(f) - 1, np.float32), np.eye(2, 3, dtype=np.float32)
    for i in range(1, len(f)):
        prev, cur = f[i - 1], f[i]
        if d[i - 1] > 0.06 or cur.std() < 0.004:              # a cut, or a blank frame: nothing to align
            warp = np.eye(2, 3, dtype=np.float32)
            out[i - 1] = d[i - 1]
            continue
        try:
            _, w = cv2.findTransformECC(cur, prev, warp.copy(), cv2.MOTION_AFFINE, crit, None, 3)
            if abs(np.linalg.det(w[:, :2]) - 1) > 0.1 or np.abs(w[:, 2]).max() > W * 0.2:
                raise cv2.error("not a camera move")
            warp = w
        except cv2.error:
            warp = np.eye(2, 3, dtype=np.float32)
        al = cv2.warpAffine(prev, warp, (W, H), flags=cv2.INTER_LINEAR + cv2.WARP_INVERSE_MAP, borderMode=cv2.BORDER_REPLICATE)
        e = 4                                                  # the border the move uncovers is not content
        m = np.abs(half(cur[None])[0] - half(al[None])[0])[e // 2:-(e // 2), e // 2:-(e // 2)].mean()
        out[i - 1] = min(m, d[i - 1])
    return out


def selftest():
    """A picture panned and pushed is camera only; a square moving across a still picture is content."""
    import cv2
    rng = np.random.default_rng(1)
    base = cv2.GaussianBlur(rng.random((400, 700)).astype(np.float32), (0, 0), 3)
    base = (base - base.min()) / (base.max() - base.min())
    def view(i):                                            # ~300 px/s at 1920 wide and a push of 1 % a second
        z, x = 1 + 0.0003 * i, 40 + 2 * i
        m = np.float32([[z, 0, -x * z], [0, z, -60 * z]])
        return cv2.resize(cv2.warpAffine(base, m, (384, 216), flags=cv2.INTER_LINEAR), (W, H), interpolation=cv2.INTER_AREA)
    pan = np.stack([view(i) for i in range(30)])
    sq = np.stack([cv2.resize(base[60:276, 40:424], (W, H), interpolation=cv2.INTER_AREA) for _ in range(30)])
    for i in range(30):
        sq[i, 30:70, 10 + 4 * i:50 + 4 * i] = 1.0
    for name, f, want in (("pan", pan, False), ("square", sq, True)):
        g = half(f).reshape(len(f), -1)
        d = np.abs(np.diff(g, axis=0)).mean(axis=1)
        c = content_diff(f, d)
        moving = c.mean() >= 0.006 * 0.4
        print(f"  {name}: raw {d.mean():.4f}, content {c.mean():.4f}")
        assert moving == want and d.mean() > 0.006, name
    print("selftest ok")


def read_json(p: Path) -> dict:
    try:
        return json.loads(p.read_text(encoding="utf-8-sig"))
    except (OSError, ValueError):
        return {}


if __name__ == "__main__":
    selftest() if "--selftest" in sys.argv else main()
