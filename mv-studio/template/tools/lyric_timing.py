#!/usr/bin/env python3
"""Where each lyric line's timing came from and how sure it is: analysis/lyric_timing.json (text-free; tools/lrc.py).

    python tools/lyric_timing.py status                         # per line: source, confidence; what to check by ear
    python tools/lyric_timing.py mark --source lrc [--conf 1]   # every line without a row (an official timed LRC)
    python tools/lyric_timing.py mark --source by-ear --lines 3,7 [--conf 0.9]
    python tools/lyric_timing.py import-align [analysis/lyrics.json]   # per-character times from transcribe_reconcile.py
    python tools/lyric_timing.py apply edits.json               # start times from tools/lyric_editor (it calls this)
    python tools/lyric_timing.py selftest

Tiers, best first (references/03): an official timed LRC (lrc) · the producer's score (score: tools/score_timing.py)
· forced alignment (align: the transcribe_* chain, Japanese) · tapped in the editor (editor: tools/lyric_editor) ·
corrected by ear (by-ear) · estimated from the bar grid (estimate: tools/estimate_lrc.py). The line START times
always live in analysis/lyrics_mv.lrc (JIZURA reads it); this file adds source, confidence and character times,
and is ignored for any line whose text or start time changed since (character count + hash, start).

mv-studio (MIT).
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

TOOLS = Path(__file__).resolve().parent
sys.path.insert(0, str(TOOLS))
from lrc import LRC, ROOT, SOURCES, line_hash, load_timing, parse_lrc, save_timing  # noqa: E402

RANK = {"lrc": 0, "score": 1, "align": 2, "editor": 3, "by-ear": 3, "estimate": 5}


def rows_by_line(lines: list[dict]) -> list[dict]:
    """The current timing rows aligned to the LRC lines ({} where a line has none or its row is stale)."""
    have = {r["i"]: r for r in load_timing().get("lines", [])}
    out = []
    for L in lines:
        r = have.get(L["i"])
        ok = r is not None and r.get("n") == len(L["text"]) and r.get("h") == line_hash(L["text"])
        if ok and abs(float(r.get("start", L["t"])) - L["t"]) > 0.02:
            ok = False                                    # the LRC time was edited since: the row no longer describes it
        out.append({k: v for k, v in r.items() if k not in ("i", "n", "h")} if ok else {})
    return out


def status(lines: list[dict]) -> int:
    rows = rows_by_line(lines)
    counts: dict[str, int] = {}
    listen = []
    for L, r in zip(lines, rows):
        src = r.get("source", "lrc (unmarked)")
        counts[src] = counts.get(src, 0) + 1
        conf = r.get("conf")
        mark = ""
        if src == "estimate" or (conf is not None and conf < 0.6):
            listen.append(L["i"]); mark = "  <- check by ear"
        chars = "chars" if r.get("chars") else ""
        print(f"line {L['i']:3d}  {L['t']:8.2f} s  {src:15s} conf {'' if conf is None else f'{conf:.2f}':5s} {chars}{mark}")
    print("[timing] " + ", ".join(f"{v} {k}" for k, v in sorted(counts.items(), key=lambda kv: RANK.get(kv[0], 4))))
    if listen:
        print(f"  check by ear first: lines {', '.join(map(str, listen[:40]))}"
              " (tools/lyric_editor, then: python tools/lyric_timing.py mark --source editor --lines ...)")
    return 0


def mark(lines: list[dict], source: str, conf: float, only: set[int] | None, force: bool) -> int:
    rows = rows_by_line(lines)
    n = 0
    for L, r in zip(lines, rows):
        if only is not None and L["i"] not in only:
            continue
        if r and only is None and not force:
            continue                                  # without --lines: only lines that have no row yet
        keep = {k: v for k, v in r.items() if k in ("chars", "words")} if source in ("by-ear", "editor") and r else {}
        r.clear(); r.update(keep, start=L["t"], end=L["end"], source=source, conf=conf); n += 1
    for L, r in zip(lines, rows):
        if not r:
            r.update(start=L["t"], end=L["end"], source="lrc", conf=None)
    save_timing(lines, rows)
    print(f"[timing] marked {n} line(s) as {source} -> analysis/lyric_timing.json")
    return 0


def import_align(lines: list[dict], path: Path) -> int:
    """analysis/lyrics.json of the alignment chain: [{index, text, start, end, chars: [{c, start, end}], confidence}]."""
    src = json.loads(path.read_text(encoding="utf-8"))
    rows = rows_by_line(lines)
    norm = lambda s: "".join(s.split())
    pool = list(src)
    n = 0
    for L, r in zip(lines, rows):
        k = next((j for j, x in enumerate(pool) if norm(x.get("text", "")) == norm(L["text"])), None)
        if k is None:
            continue
        x = pool.pop(k)
        chars = [c["start"] for c in x.get("chars", [])]
        r.clear()
        r.update(start=x.get("start", L["t"]), end=x.get("end", L["end"]), source="align", conf=x.get("confidence"))
        if len(chars) == len(L["text"]):
            r["chars"] = chars
        n += 1
    for L, r in zip(lines, rows):
        if not r:
            r.update(start=L["t"], end=L["end"], source="lrc", conf=None)
    save_timing(lines, rows)
    print(f"[timing] {n} of {len(lines)} line(s) from {path.name} -> analysis/lyric_timing.json"
          + ("" if n == len(lines) else " (lines whose text differs from the LRC kept their old rows)"))
    return 0


def follow_rows(lines: list[dict], old_rows: list[dict], edits: dict[int, float], new_lines: list[dict]) -> list[dict]:
    """The timing rows for new_lines (the LRC re-parsed after the edits). An edit can move a line past its neighbours
    and parse_lrc numbers lines by time, so each old line is followed to its new place by its text and new start: a row
    and its character times stay with their own line. Edited lines get a fresh 'editor' row."""
    pool = [(L, r, max(0.0, edits.get(L["i"], L["t"]))) for L, r in zip(lines, old_rows)]
    rows = []
    for L in new_lines:
        k = next((j for j, (o, _, t) in enumerate(pool) if o["text"] == L["text"] and abs(t - L["t"]) < 0.006), None)
        o, r, _ = pool.pop(k) if k is not None else (None, {}, None)   # 0.006: the LRC keeps hundredths
        if o is not None and o["i"] in edits:
            rows.append({"start": L["t"], "end": L["end"], "source": "editor", "conf": 0.9})
        else:
            r = dict(r) if r else {"source": "lrc", "conf": None}
            r.update(start=L["t"], end=L["end"])
            rows.append(r)
    return rows


def selftest() -> int:
    from lrc import parse_lrc_text
    old = parse_lrc_text("[00:01.00]aa\n[00:02.00]bb\n[00:03.00]cc\n")
    rows = [{"source": "align", "conf": 0.8, "chars": [1.0, 1.5]}, {"source": "align", "conf": 0.8, "chars": [2.0, 2.5]},
            {"source": "lrc", "conf": None}]
    new = parse_lrc_text("[00:02.50]aa\n[00:02.00]bb\n[00:03.00]cc\n")    # line 0 moved past line 1
    out = follow_rows(old, rows, {0: 2.5}, new)
    ok = [new[0]["text"] == "bb" and out[0].get("chars") == [2.0, 2.5] and out[0]["source"] == "align",
          new[1]["text"] == "aa" and out[1]["source"] == "editor" and "chars" not in out[1],
          out[2]["source"] == "lrc"]
    print(f"[timing] selftest {'ok' if all(ok) else 'FAIL ' + str(ok)}")
    return 0 if all(ok) else 1


def apply_edits(lines: list[dict], path: Path) -> int:
    """{"starts": {"3": 12.41, ...}} from tools/lyric_editor: back up the LRC, rewrite those start times, mark the
    lines 'editor' (their old character times no longer fit and are dropped)."""
    import shutil
    import time
    from lrc import rewrite_lrc_times
    edits = {int(k): float(v) for k, v in json.loads(path.read_text(encoding="utf-8")).get("starts", {}).items()}
    if not edits:
        print("[timing] no edits"); return 0
    old_rows = rows_by_line(lines)
    bdir = ROOT / "analysis" / "backup"
    bdir.mkdir(parents=True, exist_ok=True)
    shutil.copy2(LRC, bdir / f"lyrics_mv.{time.strftime('%Y%m%d-%H%M%S')}.lrc")
    n = rewrite_lrc_times(LRC, edits)
    new_lines = parse_lrc(LRC)
    save_timing(new_lines, follow_rows(lines, old_rows, edits, new_lines))
    print(f"[timing] {n} start time(s) from the editor -> analysis/lyrics_mv.lrc (backup in analysis/backup/)")
    return 0


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("step", choices=["status", "mark", "import-align", "apply", "selftest"])
    ap.add_argument("file", nargs="?")
    ap.add_argument("--source", choices=SOURCES)
    ap.add_argument("--conf", type=float, default=None)
    ap.add_argument("--lines", help="comma-separated line numbers (default: every line without a row)")
    ap.add_argument("--force", action="store_true", help="mark: overwrite existing rows too")
    a = ap.parse_args()
    if a.step == "selftest":
        return selftest()
    if not LRC.is_file():
        print("no analysis/lyrics_mv.lrc yet"); return 1
    lines = parse_lrc(LRC)
    if a.step == "status":
        return status(lines)
    if a.step == "mark":
        if not a.source:
            ap.error("mark needs --source")
        conf = a.conf if a.conf is not None else {"lrc": 1.0, "score": 0.95, "align": 0.8, "editor": 0.9, "by-ear": 0.9, "estimate": 0.3}[a.source]
        only = {int(x) for x in a.lines.split(",")} if a.lines else None
        return mark(lines, a.source, conf, only, a.force)
    if a.step == "apply":
        return apply_edits(lines, Path(a.file))
    return import_align(lines, Path(a.file) if a.file else ROOT / "analysis" / "lyrics.json")


if __name__ == "__main__":
    sys.exit(main())
