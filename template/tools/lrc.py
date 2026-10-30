#!/usr/bin/env python3
"""Shared lyric helpers for the Python tools: the SAME line parsing as engine/core/lyrics.js, and the text-free files.

    from lrc import parse_lrc, line_hash, load_timing, save_timing, read_project

parse_lrc(path) -> [{i, t, end, text, parts, emph, kime}]   (gap rows like [間奏] end the previous line; no line of
                   their own; '/' splits parts; *word* marks emphasis; a trailing '!' marks the kime line)
line_hash(text)  -> 8 hex digits (FNV-1a over code points; engine/core/lyrics.js computes the same) so a timing file
                   can tell that its line still matches the LRC without containing the text
analysis/lyric_timing.json (text-free; written by estimate_lrc / score_timing / the lyric editor / alignment):
    {"version": 1, "lines": [{"i": 0, "n": 12, "h": "1a2b3c4d", "start": 2.0, "end": 4.1,
                              "source": "lrc|score|align|editor|estimate|by-ear", "conf": 0..1,
                              "chars": [t, ...] (one start per display character, optional),
                              "words": [[t0, t1], ...] (optional, Latin text)}]}
project.json: {"mode", "style", "timing": {"offset", "lyricOffset", ...}, "review": {...}}   (read_project())

mv-studio (MIT).
"""
from __future__ import annotations

import json
import re
from pathlib import Path

TOOLS = Path(__file__).resolve().parent
ROOT = TOOLS.parent
LRC = ROOT / "analysis" / "lyrics_mv.lrc"
TIMING = ROOT / "analysis" / "lyric_timing.json"
PROJECT = ROOT / "project.json"
GAP = re.compile(r"^\s*\[(間奏|interlude|inst|instrumental|間|gap|—|-)\]\s*$", re.I)
TIME = re.compile(r"\[(\d+):(\d+(?:\.\d+)?)\]")
HEADER = re.compile(r"^\s*(\[[A-Za-z#][^\]]*\]|\{.*\})\s*$")   # [ar:...] [offset:...], {"t":0,"c":...} credits: no lyric line
SOURCES = ("lrc", "score", "align", "editor", "estimate", "by-ear")


def _latin(s: str) -> bool:
    return all(ord(c) < 0x80 or 0xC0 <= ord(c) <= 0x24F for c in s)


def parse_lrc_text(src: str, duration: float = 1e9) -> list[dict]:
    rows = []
    for n, raw in enumerate(src.lstrip("﻿").splitlines(), 1):
        times = [int(m.group(1)) * 60 + float(m.group(2)) for m in TIME.finditer(raw)]
        if any(float(m.group(2)) >= 60 for m in TIME.finditer(raw)):
            raise ValueError(f"LRC row {n}: seconds of 60 or more in a time tag")
        if not times:
            if raw.strip() and not HEADER.match(raw):     # a lyric row without a readable [mm:ss.xx] would vanish
                raise ValueError(f"LRC row {n}: no time tag [mm:ss.xx] (lines without one are not shown)")
            continue
        body = TIME.sub("", raw).strip()
        rows += [{"t": t, "body": body} for t in times]
    rows.sort(key=lambda r: r["t"])
    out = []
    for k, r in enumerate(rows):
        nxt = rows[k + 1] if k + 1 < len(rows) else None
        if not r["body"] or GAP.match(r["body"]):
            continue
        s, kime = r["body"], False
        if re.search(r"!\s*$", s) and not re.search(r"[!！]{2,}\s*$", s):
            kime, s = True, re.sub(r"!\s*$", "", s)
        parts_raw = [p.strip() for p in s.split("/") if p.strip()]
        joiner = " " if all(_latin(p) for p in parts_raw) else ""
        text, emph, open_, parts = "", [], -1, []
        for pi, p in enumerate(parts_raw):
            if pi:
                text += joiner
            clean = ""
            for ch in p:
                if ch == "*":
                    if open_ < 0:
                        open_ = len(text)
                    else:
                        emph.append([open_, len(text)]); open_ = -1
                    continue
                text += ch; clean += ch
            parts.append(clean)
        if open_ >= 0:
            emph.append([open_, len(text)])
        end = min(nxt["t"] if nxt else r["t"] + 4, duration)
        out.append({"i": len(out), "t": r["t"], "end": end, "text": text, "parts": parts, "emph": emph, "kime": kime})
    return out


def parse_lrc(path: Path | str = LRC, duration: float = 1e9) -> list[dict]:
    return parse_lrc_text(Path(path).read_text(encoding="utf-8-sig"), duration)


def line_hash(text: str) -> str:
    h = 2166136261
    for ch in text:
        h ^= ord(ch)
        h = (h * 16777619) & 0xFFFFFFFF
    return f"{h:08x}"


def _num(v) -> bool:
    return isinstance(v, (int, float)) and not isinstance(v, bool) and v == v and abs(v) != float("inf")


def load_timing(path: Path = TIMING) -> dict:
    """analysis/lyric_timing.json, checked: a row with a non-numeric time is an error, not a silent fallback."""
    if not path.is_file():
        return {"version": 1, "lines": []}
    d = json.loads(path.read_text(encoding="utf-8-sig"))
    for k, r in enumerate(d.get("lines", []) if isinstance(d, dict) else [None]):
        ok = (isinstance(r, dict) and isinstance(r.get("i"), int) and all(_num(r[f]) for f in ("start", "end") if f in r)
              and all(_num(x) for x in r.get("chars") or []) and all(_num(x) for w in r.get("words") or [] for x in w))
        if not ok:
            raise ValueError(f"{path.name}: row {k} has a missing line index or a time that is not a number")
    return d


def save_timing(lines: list[dict], timing_rows: list[dict], path: Path = TIMING) -> Path:
    """timing_rows[i] = {start, end, source, conf, chars?, words?} for LRC line i; n / h are added from the LRC."""
    out = []
    for L, row in zip(lines, timing_rows):
        r = {"i": L["i"], "n": len(L["text"]), "h": line_hash(L["text"])}
        r.update({k: v for k, v in row.items() if v is not None})
        for k in ("start", "end"):
            if k in r:
                r[k] = round(float(r[k]), 3)
        if "chars" in r:
            r["chars"] = [round(float(x), 3) for x in r["chars"]]
        out.append(r)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps({"version": 1, "lines": out}, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    return path


def fmt_time(t: float) -> str:
    m, s = divmod(max(0.0, t), 60)
    return f"[{int(m):02d}:{s:05.2f}]"


def rewrite_lrc_times(path: Path, new_starts: dict[int, float]) -> int:
    """Set the time tag of LRC line i (as numbered by parse_lrc) to new_starts[i]; other rows are kept as written.
    Returns how many tags changed. Rows with several tags (repeats) have each tag retimed on its own."""
    src = path.read_text(encoding="utf-8-sig").splitlines()
    entries = []                                    # (time, row, tag k) in the order parse_lrc numbers them
    for n, raw in enumerate(src):
        body = TIME.sub("", raw).strip()
        for k, m in enumerate(TIME.finditer(raw)):
            entries.append((int(m.group(1)) * 60 + float(m.group(2)), n, k, body))
    entries.sort(key=lambda e: e[0])
    edits: dict[int, dict[int, float]] = {}
    idx = 0
    for t, n, k, body in entries:
        if not body or GAP.match(body):
            continue
        if idx in new_starts:
            edits.setdefault(n, {})[k] = new_starts[idx]
        idx += 1
    for n, by_tag in edits.items():
        count = iter(range(10 ** 6))
        src[n] = TIME.sub(lambda m: fmt_time(by_tag[k]) if (k := next(count)) in by_tag else m.group(0), src[n])
    path.write_text("\n".join(src) + "\n", encoding="utf-8")
    return sum(len(v) for v in edits.values())


def read_project(path: Path = PROJECT) -> dict:
    p = json.loads(path.read_text(encoding="utf-8-sig")) if path.is_file() else {}
    for k, v in (p.get("timing") or {}).items():
        if k in ("offset", "lyricOffset") and not _num(v):
            raise ValueError(f"project.json timing.{k} is not a number ({v!r})")
    return p
