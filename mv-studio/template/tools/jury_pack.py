#!/usr/bin/env python3
"""The pictures an independent jury reviews a film from (references/09 §8).

  python tools/jury_pack.py render/mv.mp4 [--out render/jury] [--hero 61.2,140.5] [--selftest]

From analysis/audio.json sections it writes into --out:
  sheets/NN_<label>/sheet_00.jpg   one contact sheet per section: 25 frames spread over it (tools/review_sheets.py)
  strips/<t>.jpg                   2 s at 8 fps as a 8 x 2 filmstrip, at the start of every chorus / hook / drop section
                                   and at each --hero time (song seconds): how the fastest moves and the hero moments move
  stills/<t>.png                   a full-resolution frame at the middle of each section: edges, type, banding, aliasing
  index.md                         the list with times and section names (no lyric text), for the jury prompt
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
    strips = sorted({round(s["start"], 2) for s in sections if HOOK.search(f"{s.get('label', '')} {s.get('name', '')}")} | set(hero))
    stills = [round((a + b) / 2, 2) for _, _, a, b in sheets]
    return sheets, strips, stills


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
    lines += ["", "## Filmstrips (2 s at 8 fps, read left to right, top row first)", ""]
    (out / "strips").mkdir(parents=True, exist_ok=True)
    for t in strips:
        p = out / "strips" / f"{t:07.2f}.jpg"
        subprocess.run([FF, "-v", "error", "-y", "-ss", f"{max(0.0, t - off):.3f}", "-t", "2", "-i", str(video), "-vf", "fps=8,scale=480:-2,tile=8x2",
                        "-frames:v", "1", str(p)], check=True)
        lines.append(f"- `strips/{p.name}` from {fmt(t)}")
    lines += ["", "## Full-resolution stills (section middles)", ""]
    (out / "stills").mkdir(parents=True, exist_ok=True)
    for t in stills:
        p = out / "stills" / f"{t:07.2f}.png"
        subprocess.run([FF, "-v", "error", "-y", "-ss", f"{max(0.0, t - off):.3f}", "-i", str(video), "-frames:v", "1", str(p)], check=True)
        lines.append(f"- `stills/{p.name}` at {fmt(t)}")
    (out / "index.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"[jury_pack] {len(sheets)} section sheets, {len(strips)} filmstrips, {len(stills)} stills -> {out / 'index.md'}")


if __name__ == "__main__":
    main()
