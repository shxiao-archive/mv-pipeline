#!/usr/bin/env python3
"""The pictures an independent jury reviews a film from (references/09 §8).

  python tools/jury_pack.py render/mv.mp4 [--out render/jury] [--hero 61.2,140.5] [--selftest]

From analysis/audio.json sections it writes into --out:
  sheets/NN_<label>/sheet_00.jpg   one contact sheet per section: 25 frames spread over it (tools/review_sheets.py)
  strips/<t>.jpg                   every frame of 1 s as a 10 x 3 filmstrip (a slam or an overshoot lasts 2-4 frames), at
                                   the start of every chorus / hook / drop section
                                   and at each --hero time (song seconds): how the fastest moves and the hero moments move
  cuts/<t>.jpg                     every frame from 0.3 s before to 0.3 s after each shot cut and lyric cut (plan/shots.json)
                                   and each time render/pops.json or render/<video>_flash.json flags: transitions,
                                   overlapping lyrics, pops (at most 40, at least 0.6 s apart)
  stills/<t>.png                   a full-resolution frame at the middle of each section: edges, type, banding, aliasing
  index.md                         the list with times and section names (no lyric text) and tools/motion_check.py's
                                   motion per second, for the jury prompt
Times are song seconds; the file's mv_start tag (or --start) maps them to the video. Needs ffmpeg.
mv-studio (MIT). Adapted from the review process of mg-styles-15 (Vincentwei1021, MIT).
"""
import argparse
import json
import re
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
FF = shutil.which("ffmpeg") or "ffmpeg"
HOOK = re.compile(r"chorus|hook|sabi|drop|climax|サビ", re.I)


def plan(sections, hero, duration):
    """-> (sheets [(n, label, t0, t1)], strips [t], stills [t]) in song seconds."""
    sheets = [(k + 1, s.get("label") or s.get("name") or "section", s["start"], min(s["end"], duration))
              for k, s in enumerate(sections) if s["end"] > s["start"]]
    strips = []
    for t in sorted({round(s["start"], 2) for s in sections if HOOK.search(f"{s.get('label', '')} {s.get('name', '')}")} | set(hero)):
        if not strips or t - strips[-1] >= 0.5:                   # a hero time next to a hook start: one strip
            strips.append(t)
    stills = [round((a + b) / 2, 2) for _, _, a, b in sheets]
    return sheets, strips, stills


def cut_plan(cuts, flags, cap=40, gap=0.6):
    """cuts [t], flags [(t, why)] -> [(t, why)]: shot cuts first, then flagged times, at least `gap` s apart, at most `cap`."""
    keep = []
    for t, why in [(c, "cut") for c in sorted(cuts)] + sorted(flags):
        if all(abs(t - k) >= gap for k, _ in keep):
            keep.append((round(t, 2), why))
    keep.sort()
    return keep if len(keep) <= cap else [keep[round(i * (len(keep) - 1) / (cap - 1))] for i in range(cap)]


def load(p: Path):
    try:
        return json.loads(p.read_text(encoding="utf-8-sig"))
    except (OSError, ValueError):
        return {}


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("video", nargs="?")
    ap.add_argument("--out", default="render/jury")
    ap.add_argument("--hero", default="", help="extra filmstrip times, song seconds, comma-separated")
    ap.add_argument("--start", type=float, default=None, help="song time of the file's first frame (default: mv_start tag or 0)")
    ap.add_argument("--selftest", action="store_true")
    a = ap.parse_args()
    if a.selftest:
        secs = [{"label": "intro", "start": 0, "end": 10}, {"label": "chorus", "start": 10, "end": 20}, {"label": "outro", "start": 20, "end": 30}]
        sh, st, sl = plan(secs, [25.5], 28.0)
        ok = [n for n, *_ in sh] == [1, 2, 3] and sh[2][3] == 28.0 and st == [10, 25.5] and sl == [5.0, 15.0, 24.0]
        ok = ok and plan(secs, [10.05, 25.5], 28.0)[1] == [10, 25.5]
        ok = ok and cut_plan([10.0, 10.5, 15.0, 22.0], [(15.3, "pop"), (18.0, "flash")]) == [(10.0, "cut"), (15.0, "cut"), (18.0, "flash"), (22.0, "cut")]
        ok = ok and len(cut_plan([i * 2.0 for i in range(100)], [])) == 40
        print(f"[jury_pack] selftest {'ok' if ok else 'FAIL'}"); sys.exit(0 if ok else 1)
    if not a.video:
        ap.error("the video is required")
    video = Path(a.video) if Path(a.video).is_file() else ROOT / a.video
    out = ROOT / a.out if not Path(a.out).is_absolute() else Path(a.out)
    probe = subprocess.run([FF, "-i", str(video)], capture_output=True, text=True, encoding="utf-8", errors="replace").stderr
    m = re.search(r"mv_start=(-?[0-9.]+)", probe)
    off = a.start if a.start is not None else float(m.group(1)) if m else 0.0
    d = re.search(r"Duration: (\d+):(\d+):([\d.]+)", probe)
    duration = off + int(d.group(1)) * 3600 + int(d.group(2)) * 60 + float(d.group(3)) - 0.05
    au = json.loads((ROOT / "analysis" / "audio.json").read_text(encoding="utf-8-sig"))
    secs = [s for s in au.get("sections") or [] if s["start"] < duration] or [{"label": "film", "start": off, "end": duration}]
    sheets, strips, stills = plan(secs, [float(x) for x in a.hero.split(",") if x.strip()], duration)
    if out.exists():
        shutil.rmtree(out)
    lines = [f"# Jury pack: {video.name}", "", "Times are song seconds (m:ss). Section names from analysis/audio.json.", "", "## Contact sheets", ""]
    fmt = lambda t: f"{int(t // 60)}:{t % 60:05.2f}"
    for n, label, t0, t1 in sheets:
        dst = out / "sheets" / f"{n:02d}_{re.sub(r'[^A-Za-z0-9_-]+', '-', label)}"
        step = max(0.25, (t1 - t0) / 25)
        subprocess.run([sys.executable, str(ROOT / "tools" / "review_sheets.py"), str(video), "--step", f"{step:.3f}", "--out", str(dst),
                        "--start", f"{max(0.0, t0 - off):.3f}", "--end", f"{max(0.0, t1 - off - 0.05):.3f}"], check=True, capture_output=True)
        lines.append(f"- `{dst.relative_to(out).as_posix()}/` section {n} `{label}` {fmt(t0)}-{fmt(t1)} (a frame every {step:.2f} s; labels are video time)")
    lines += ["", "## Filmstrips (every frame of 1 s, read left to right, top row first)", ""]
    (out / "strips").mkdir(parents=True, exist_ok=True)
    for t in strips:
        # shortcut: a 10 x 3 tile holds 30 frames (1 s at 30 fps, 0.5 s at 60); widen it if films go above 30 fps
        p = out / "strips" / f"{t:07.2f}.jpg"
        subprocess.run([FF, "-v", "error", "-y", "-ss", f"{max(0.0, t - off):.3f}", "-t", "1", "-i", str(video), "-vf", "scale=384:-2,tile=10x3",
                        "-frames:v", "1", str(p)], check=True)
        lines.append(f"- `strips/{p.name}` from {fmt(t)}")
    sp = load(ROOT / "plan" / "shots.json") or {}
    shots = sp.get("shots") or []
    pops = [(f["t"], f"pop ({f.get('kind', '')})") for f in (load(ROOT / "render" / "pops.json") or {}).get("found") or []]
    fl = load(ROOT / "render" / f"{video.stem}_flash.json") or {}
    flash = [(a, "flash warning") for a, _ in fl.get("warning_ranges") or []] + [(a, "overexposed") for a, _ in fl.get("overexposed") or []]
    lyric = [(t, "lyric cut") for t in sp.get("lyricCuts") or [] if t < duration - 0.3]   # JIZURA cut changes (tools/storyboard.mjs)
    cuts = cut_plan([s["t0"] for s in shots if 0.3 < s.get("t0", 0) < duration - 0.3], pops + flash + lyric)
    lines += ["", "## Around the cuts (every frame, 0.3 s before to 0.3 s after; read left to right, top row first)", "",
              "Transitions, lyrics that overlap while one line leaves and the next comes in, pops and flashes show here.", ""]
    (out / "cuts").mkdir(parents=True, exist_ok=True)
    for t, why in cuts:
        p = out / "cuts" / f"{t:07.2f}.jpg"
        subprocess.run([FF, "-v", "error", "-y", "-ss", f"{max(0.0, t - off - 0.3):.3f}", "-t", "0.6", "-i", str(video), "-vf", "scale=320:-2,tile=9x2",
                        "-frames:v", "1", str(p)], check=True)
        lines.append(f"- `cuts/{p.name}` {why} at {fmt(t)}")
    lines += ["", "## Full-resolution stills (section middles)", ""]
    (out / "stills").mkdir(parents=True, exist_ok=True)
    for t in stills:
        p = out / "stills" / f"{t:07.2f}.png"
        subprocess.run([FF, "-v", "error", "-y", "-ss", f"{max(0.0, t - off):.3f}", "-i", str(video), "-frames:v", "1", str(p)], check=True)
        lines.append(f"- `stills/{p.name}` at {fmt(t)}")
    mo = subprocess.run([sys.executable, str(ROOT / "tools" / "motion_check.py"), str(video), "--start", f"{off:.3f}"],
                        capture_output=True, text=True, encoding="utf-8", errors="replace").stdout.strip()
    if mo:
        lines += ["", "## Motion per second (tools/motion_check.py; a long bar = much changes on screen)", "", "```", mo, "```"]
    (out / "index.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"[jury_pack] {len(sheets)} section sheets, {len(strips)} filmstrips, {len(cuts)} cut strips, {len(stills)} stills -> {out / 'index.md'}")


if __name__ == "__main__":
    main()
