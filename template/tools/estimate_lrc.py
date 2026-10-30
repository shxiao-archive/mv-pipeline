#!/usr/bin/env python3
"""Plain-text lyrics (no timestamps) -> analysis/lyrics_mv.lrc with ESTIMATED times on the bar grid.

The quick path when there is no LRC and forced alignment (tools/transcribe_*.py, CPU torch) is not worth it — a demo,
a short clip, a first cut. Lines are placed on bar starts from analysis/audio.json:
  --start S          time of the first sung line (default: the first vocal-activity onset after 1 s, snapped to a bar)
  --bars-per-line N  bars per line (default 2);  a BLANK line in the text adds --gap-bars bars (default 1)
  --line-bars "1,2,2,4,..."   per-line bar counts instead (overrides --bars-per-line)
Markup carried into the LRC: a line starting with '*' -> the whole line is *emphasised*; an ALL-CAPS Latin line ->
trailing '!' (a キメ line); existing JIZURA markup (/, *word*, !) is kept as written.
The file gets a [by:] header saying the times are estimated: TELL THE USER, and check the first stills against the
voice (shift everything with --start, or fix single rows by hand).

Usage:  python tools/estimate_lrc.py lyrics.txt [--start 4.25] [--bars-per-line 2] [--out analysis/lyrics_mv.lrc]
mv-studio (MIT).
"""
import argparse
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "tools"))
from lrc import LRC, parse_lrc, save_timing  # noqa: E402


def read_text(p: Path) -> str:
    raw = p.read_bytes()
    if raw.startswith(b"\xef\xbb\xbf"):
        return raw.decode("utf-8-sig")
    if raw[:2] in (b"\xff\xfe", b"\xfe\xff"):
        return raw.decode("utf-16")
    for enc in ("utf-8", "gb18030", "big5", "shift_jis"):
        try:
            return raw.decode(enc)
        except UnicodeDecodeError:
            pass
    return raw.decode("latin-1")


def stamp(t: float) -> str:
    m, s = divmod(max(0.0, t), 60)
    return f"[{int(m):02d}:{s:05.2f}]"


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("lyrics")
    ap.add_argument("--start", type=float)
    ap.add_argument("--bars-per-line", type=float, default=2)
    ap.add_argument("--gap-bars", type=float, default=1)
    ap.add_argument("--line-bars")
    ap.add_argument("--out", default="analysis/lyrics_mv.lrc")
    a = ap.parse_args()
    audio = json.loads((ROOT / "analysis" / "audio.json").read_text(encoding="utf-8"))
    bars = [b["start"] for b in audio["bars"]]
    if not bars:
        sys.exit("analysis/audio.json has no bars: run tools/analyze_audio.py first")
    spb = (bars[-1] - bars[0]) / max(1, len(bars) - 1)
    start = a.start
    if start is None:
        va = [v["start"] for v in audio.get("vocal_activity", []) if v["start"] > 1.0]
        start = va[0] if va else bars[min(1, len(bars) - 1)]
        print(f"[lrc] no --start: first vocal activity after 1 s = {start:.2f} s")
    # snap the start to the nearest bar start (or keep it when the singing starts off the bar: pickups)
    nb = min(bars, key=lambda b: abs(b - start))
    if abs(nb - start) < 0.2 * spb:
        start = nb
    bar_of = lambda t: next((i for i, b in enumerate(bars) if b > t - 1e-3), len(bars))
    rows = read_text(Path(a.lyrics)).splitlines()
    per = [float(x) for x in a.line_bars.split(",")] if a.line_bars else None
    out, t_bar, k, gap = [], None, 0, 0.0
    for raw in rows:
        line = raw.strip()
        if not line:
            gap += a.gap_bars
            continue
        if re.match(r"^\[\d+:\d+", line):
            sys.exit("this file already has timestamps: copy it to analysis/lyrics_mv.lrc instead")
        if line.startswith("*") and not line.startswith("**") and line.count("*") == 1:
            line = "*" + line[1:].strip() + "*"
        letters = [c for c in line if c.isalpha() and c.isascii()]
        if len(letters) >= 2 and all(c.isupper() for c in letters) and not line.endswith("!"):
            line += "!"
        if t_bar is None:
            t, t_bar = start, float(bar_of(start))
        else:
            t_bar += gap
            i = int(t_bar)
            t = bars[i] + (t_bar - i) * spb if i < len(bars) else bars[-1] + (t_bar - len(bars) + 1) * spb
        gap = 0.0
        out.append(f"{stamp(t)}{line}")
        t_bar += per[k] if per and k < len(per) else a.bars_per_line
        k += 1
    end_t = bars[int(t_bar)] if t_bar is not None and int(t_bar) < len(bars) else audio.get("music_cut", 0)
    out.append(f"{stamp(end_t)}[間奏]")
    head = ["[ar:]", f"[by:ESTIMATED timing (tools/estimate_lrc.py: start {start:.2f} s, {a.bars_per_line:g} bars per line) - check against the voice]", "[offset:0]"]
    dst = ROOT / a.out
    dst.parent.mkdir(parents=True, exist_ok=True)
    dst.write_text("\n".join(head + out) + "\n", encoding="utf-8")
    print(f"[lrc] {len(out) - 1} lines -> {a.out} (estimated: first {out[0][:10]}, last {out[-2][:10]})")
    if dst.resolve() == LRC.resolve():                 # record the tier: every line is an ESTIMATE (lyric_timing.py)
        lines = parse_lrc(dst)
        save_timing(lines, [{"start": L["t"], "end": L["end"], "source": "estimate", "conf": 0.3} for L in lines])
        print("[lrc] analysis/lyric_timing.json: all lines marked 'estimate' (check them: python tools/check_sync.py"
              " after a render, fix them in tools/lyric_editor)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
