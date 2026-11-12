#!/usr/bin/env python3
"""The pictures an independent jury reviews a film from (references/09 §8).

  python tools/jury_pack.py render/mv.mp4 [--out render/jury] [--hero 61.2,140.5] [--selftest]

From analysis/audio.json sections it writes into --out:
  sheets/NN_<label>/sheet_00.jpg   one contact sheet per section: 25 frames spread over it (tools/review_sheets.py)
  lines/sheet_NN.jpg               the line sheet: one frame per sung line (analysis/cues.json), the one with the most
                                   type of five across the line, 5 x 4 per sheet, labelled with the line number, time
                                   and section: how the type changes with the lines, section by section
  strips/<t>.jpg                   every frame of 1 s as a 10 x 3 filmstrip (a slam or an overshoot lasts 2-4 frames), at
                                   the start of every chorus / hook / drop / instrumental section, every 10 s inside
                                   an instrumental stretch over 12 s (no line starts in it: where a build or a solo is)
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
HOOK = re.compile(r"chorus|hook|sabi|drop|climax|サビ|interlude|solo|inst|break|riff|間奏", re.I)


def plan(sections, hero, duration, lines=()):
    """-> (sheets [(n, label, t0, t1)], strips [t], stills [t]) in song seconds. lines [t]: line starts; a section over
    12 s that none starts in is instrumental and gets a strip every 10 s inside it."""
    sheets = [(k + 1, s.get("label") or s.get("name") or "section", s["start"], min(s["end"], duration))
              for k, s in enumerate(sections) if s["end"] > s["start"]]
    marks = {round(s["start"], 2) for s in sections if HOOK.search(f"{s.get('label', '')} {s.get('name', '')}")}
    for _, _, a, b in sheets:
        if b - a > 12 and not any(a <= t < b for t in lines):
            marks |= {round(a + 10 * k, 2) for k in range(1, int((b - a - 2) // 10) + 1)}
    strips = []
    for t in sorted(marks | set(hero)):
        if not strips or t - strips[-1] >= 0.5:                   # a hero time next to a hook start: one strip
            strips.append(t)
    stills = [round((a + b) / 2, 2) for _, _, a, b in sheets]
    return sheets, strips, stills


def line_plan(cues, duration):
    """analysis/cues.json cues -> [(id, t0, end)]: each sung line that starts inside the video, in time order."""
    out = []
    for c in sorted((c for c in cues if c.get("kind") == "line" and c["t"] < duration), key=lambda c: c["t"]):
        out.append((c.get("id") or f"L{c.get('line', 0):02d}", c["t"], min(c.get("end") or c["t"] + 1.0, duration)))
    return out


def line_times(t0, end):
    """Five times across a line, the middle first (it wins a tie)."""
    return [round(t0 + (end - t0) * k, 2) for k in (0.5, 0.3, 0.7, 0.1, 0.9)]


def edges(im):
    """How much fine detail a frame has (mean edge strength, the 1 px border left out): type on screen raises it."""
    from PIL import ImageFilter, ImageStat
    e = im.convert("L").filter(ImageFilter.FIND_EDGES)
    return ImageStat.Stat(e.crop((1, 1, e.width - 1, e.height - 1))).mean[0]


def line_sheets(video, off, items, out, label, cols=5, rows=4):
    """items [(id, t0, end)] -> sheet paths: one 384 x 216 frame per line, labelled label(id, t) under it. The frame is
    the one with the most detail of line_times(): the middle of a line can fall between two kinetic phrases, blank."""
    import tempfile
    from PIL import Image, ImageDraw
    w, h, per, paths = 384, 216, cols * rows, []
    tmp = Path(tempfile.mkdtemp(prefix="jury_lines_"))
    try:
        for si in range(0, len(items), per):
            part = items[si:si + per]
            S = Image.new("RGB", (cols * w, ((len(part) + cols - 1) // cols) * (h + 18)), (12, 12, 12))
            d = ImageDraw.Draw(S)
            for i, (lid, t0, end) in enumerate(part):
                f, best = tmp / f"{si + i:03d}.png", None
                # shortcut: a busier picture later in the line can beat the frame with the type; if a sheet shows
                # that, score only the change against the line's first frame
                for t in line_times(t0, end):
                    f.unlink(missing_ok=True)
                    subprocess.run([FF, "-v", "error", "-y", "-ss", f"{max(0.0, t - off):.3f}", "-i", str(video), "-frames:v", "1", "-vf",
                                    f"scale={w}:{h}:force_original_aspect_ratio=decrease,pad={w}:{h}:(ow-iw)/2:(oh-ih)/2", str(f)], check=True)
                    if not f.is_file():                           # past the last frame
                        continue
                    with Image.open(f) as src:
                        im = src.convert("RGB")
                    e = edges(im)
                    if best is None or e > best[0]:
                        best = (e, t, im)
                if best is None:
                    continue
                x, y = (i % cols) * w, (i // cols) * (h + 18)
                S.paste(best[2], (x, y))
                d.text((x + 4, y + h + 3), label(lid, best[1]), fill=(230, 230, 230))
            p = out / f"sheet_{si // per:02d}.jpg"
            S.save(p, quality=84)
            paths.append(p)
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
    return paths


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
        inst = [{"label": "verse", "start": 0, "end": 10}, {"label": "interlude", "start": 10, "end": 35}, {"label": "outro", "start": 35, "end": 60}]
        ok = ok and plan(inst, [], 60.0, [2.0, 36.0])[1] == [10, 20, 30]                # the interlude: its start, then every 10 s
        ok = ok and plan(inst, [], 60.0, [2.0])[1] == [10, 20, 30, 45, 55]               # an outro with no line is instrumental too
        cues = [{"kind": "line", "id": "L00", "t": 2, "end": 4}, {"kind": "impact", "t": 3}, {"kind": "line", "id": "L01", "t": 39, "end": 45},
                {"kind": "line", "id": "L02", "t": 41}]
        ok = ok and line_plan(cues, 40.0) == [("L00", 2, 4), ("L01", 39, 40.0)]
        ok = ok and line_times(2, 4) == [3.0, 2.6, 3.4, 2.2, 3.8]
        from PIL import Image, ImageDraw
        flat = Image.new("RGB", (96, 54), (40, 40, 40)); typed = flat.copy()
        ImageDraw.Draw(typed).text((8, 20), "TYPE", fill=(240, 240, 240))
        ok = ok and edges(flat) == 0 and edges(typed) > 0
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
    cues = (load(ROOT / "analysis" / "cues.json") or {}).get("cues") or []
    sheets, strips, stills = plan(secs, [float(x) for x in a.hero.split(",") if x.strip()], duration,
                                  [c["t"] for c in cues if c.get("kind") == "line"])
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
    sec_at = lambda t: next((s.get("name") or s.get("label") or "" for s in secs if s["start"] <= t < s["end"]), "")
    items = line_plan(cues, duration)
    if items:
        (out / "lines").mkdir(parents=True, exist_ok=True)
        lines += ["", "## Line sheet (per sung line, the frame with the most type of five across the line; label: line, song time, section)", ""]
        lines += [f"- `lines/{p.name}`" for p in line_sheets(video, off, items, out / "lines",
                                                              lambda i, t: f"{i} {fmt(t)} {re.sub(r'[^ -~]', '', sec_at(t))}".strip())]
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
        lines += ["", "## Motion per second (tools/motion_check.py; # = moves in the picture, ~ = camera movement)", "", "```", mo, "```"]
    (out / "index.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"[jury_pack] {len(sheets)} section sheets, {len(items)} lines on the line sheet, {len(strips)} filmstrips, {len(cuts)} cut strips, {len(stills)} stills -> {out / 'index.md'}")


if __name__ == "__main__":
    main()
