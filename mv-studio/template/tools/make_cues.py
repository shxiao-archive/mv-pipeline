#!/usr/bin/env python3
"""Build the CUE TABLE analysis/cues.json from analysis/audio.json + analysis/lyrics_mv.lrc (+ lyric_timing.json).

    python tools/make_cues.py            # (re)build; keeps every hint, by-ear fix and custom cue already in the file
    python tools/make_cues.py --list     # print the table (id, time, kind, source, hint)

Cues (engine: Z.cue(id), core/cues.js):
  L00, L01, ...   one per lyric line (index = the LRC line number the engine uses); source = where its time came from
                  (lrc / score / align / editor / estimate / by-ear: analysis/lyric_timing.json); section = the
                  section it belongs to (a line starting < 2 beats before a section and running into it is that
                  section's pickup: "pickup": true)
  sec:<label>     section starts (audio.json sections; a repeated label gets :2, :3 ...)
  stop1, ...      dead stops;   hit1, ...  impacts (first sound, drops, hits; strength);   end  the final cut
                  (short gaps stay in audio.json only)
  anything else   your own cues: add {"id": "drop", "t": 61.42, "kind": "custom", "hint": "..."} by hand
Hand-edited fields survive a rebuild: "hint" (the picture this moment needs, in your own words -- never lyric
text), "fix" (a time corrected by ear; wins over "t"), "lock" (keep "t" as it is). measure_cues.py checks cue
times against the onsets and only suggests.

mv-studio (MIT).
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

TOOLS = Path(__file__).resolve().parent
sys.path.insert(0, str(TOOLS))
from lrc import LRC, ROOT, load_timing, line_hash, parse_lrc  # noqa: E402

AUDIO = ROOT / "analysis" / "audio.json"
OUT = ROOT / "analysis" / "cues.json"
KEEP = ("hint", "fix", "lock", "note")


def build(audio: dict, lines: list[dict], timing: dict) -> list[dict]:
    rows = {r["i"]: r for r in timing.get("lines", [])}
    width = 3 if len(lines) > 100 else 2
    cues = []
    for L in lines:
        r = rows.get(L["i"])
        ok = (r is not None and r.get("n") == len(L["text"]) and r.get("h") == line_hash(L["text"])
              and abs(float(r.get("start", L["t"])) - L["t"]) <= 0.02)
        cues.append({"id": f"L{L['i']:0{width}d}", "t": round(L["t"], 3), "kind": "line", "line": L["i"],
                     "end": round(L["end"], 3), "source": (r.get("source") if ok else None) or "lrc",
                     "conf": (r.get("conf") if ok else None), "kime": L["kime"] or None})
    # which section a line belongs to: the one it starts in, unless it is a PICKUP -- it starts less than two beats
    # before the next section and runs into it (choruses that begin with an upbeat "I'm up-" before the downbeat)
    secs = sorted(audio.get("sections", []), key=lambda s: s["start"])
    beats = audio.get("beats", [])
    period = (audio.get("grid_fit") or {}).get("period") or ((beats[-1] - beats[0]) / (len(beats) - 1) if len(beats) > 1 else 0.5)
    names = []
    seen0: dict[str, int] = {}
    for s in secs:
        lab = str(s.get("label") or "")
        if lab in ("", "section"):
            lab = str(s.get("name") or "section")
        seen0[lab] = seen0.get(lab, 0) + 1
        names.append(f"sec:{lab}" + (f":{seen0[lab]}" if seen0[lab] > 1 else ""))
    for c in cues:
        k = max([i for i, s in enumerate(secs) if s["start"] <= c["t"] + 0.06] or [0]) if secs else None
        if k is None:
            continue
        if k + 1 < len(secs) and 0.06 < secs[k + 1]["start"] - c["t"] < 2 * period and c["end"] > secs[k + 1]["start"] + 0.05:
            k += 1
            c["pickup"] = True
        c["section"] = names[k]
    seen: dict[str, int] = {}
    for s in audio.get("sections", []):
        lab = str(s.get("label") or "")
        if lab in ("", "section"):                       # automatic sections: use their name (A1, B1 ...)
            lab = str(s.get("name") or "section")
        seen[lab] = seen.get(lab, 0) + 1
        cid = f"sec:{lab}" + (f":{seen[lab]}" if seen[lab] > 1 else "")
        cues.append({"id": cid, "t": round(float(s["start"]), 3), "kind": "section", "source": "measured",
                     "end": round(float(s.get("end", s["start"])), 3)})
    for n, s in enumerate([s for s in audio.get("stops", []) if s.get("kind", "stop") == "stop"], 1):
        cues.append({"id": f"stop{n}", "t": round(float(s["start"]), 3), "kind": "stop", "source": "measured",
                     "end": round(float(s["end"]), 3)})
    hits = [i for i in audio.get("impacts", []) if i.get("kind") not in ("final_cut", "end_of_tail", "gap", "stop")]
    for n, i in enumerate(hits, 1):
        cues.append({"id": f"hit{n}", "t": round(float(i["t"]), 3), "kind": "impact", "source": "measured",
                     "strength": i.get("strength"), "what": i.get("kind")})
    if audio.get("music_cut") is not None:
        cues.append({"id": "end", "t": round(float(audio["music_cut"]), 3), "kind": "end", "source": "measured"})
    return [{k: v for k, v in c.items() if v is not None} for c in cues]


def merge(new: list[dict], old: list[dict]) -> list[dict]:
    by_id = {c["id"]: c for c in old}
    out = []
    for c in new:
        o = by_id.pop(c["id"], None)
        if o:
            if o.get("lock"):
                c["t"] = o["t"]
            c.update({k: o[k] for k in KEEP if k in o})
        out.append(c)
    out += [c for c in by_id.values() if c.get("kind") == "custom"]     # hand-made cues stay; stale generated ones go
    return sorted(out, key=lambda c: (c.get("fix", c["t"]), c["id"]))


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--list", action="store_true", help="print the table instead of rebuilding")
    a = ap.parse_args()
    if a.list:
        if not OUT.is_file():
            print("no analysis/cues.json yet: python tools/make_cues.py"); return 1
        for c in json.loads(OUT.read_text(encoding="utf-8"))["cues"]:
            t = c.get("fix", c["t"])
            print(f"{c['id']:14s} {t:8.3f}  {c['kind']:8s} {c.get('source', ''):9s} {c.get('hint', '')}")
        return 0
    if not AUDIO.is_file():
        print("no analysis/audio.json: python tools/analyze_audio.py first"); return 1
    audio = json.loads(AUDIO.read_text(encoding="utf-8"))
    lines = parse_lrc(LRC, audio.get("duration", 1e9)) if LRC.is_file() else []
    old = json.loads(OUT.read_text(encoding="utf-8")).get("cues", []) if OUT.is_file() else []
    cues = merge(build(audio, lines, load_timing()), old)
    OUT.write_text(json.dumps({"version": 1, "note": "tools/make_cues.py; hint / fix / lock / custom cues are yours",
                               "cues": cues}, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    kinds = {}
    for c in cues:
        kinds[c["kind"]] = kinds.get(c["kind"], 0) + 1
    no_hint = sum(1 for c in cues if c["kind"] == "line" and not c.get("hint"))
    print(f"[cues] {len(cues)} cues -> analysis/cues.json ({', '.join(f'{v} {k}' for k, v in kinds.items())})")
    if no_hint:
        print(f"  {no_hint} line cue(s) without a picture hint: write one per line (your words, not the lyric)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
