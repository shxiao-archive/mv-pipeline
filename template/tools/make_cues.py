#!/usr/bin/env python3
"""Build the CUE TABLE analysis/cues.json from analysis/audio.json + analysis/lyrics_mv.lrc (+ lyric_timing.json).

    python tools/make_cues.py            # (re)build; keeps every hint, by-ear fix and custom cue already in the file
    python tools/make_cues.py --list     # print the table (id, time, kind, source, hint)
    python tools/make_cues.py --selftest # check the merge (inserted / moved / edited / deleted lines)

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
text), "fix" (a time corrected by ear; wins over "t"), "lock" (keep "t" as it is). A line cue's id is its LRC
position, so an inserted or moved line renumbers the lines after it: their fields follow the line's text hash ("h")
to its new id, and the rebuild lists every move and every engine/ line that names a moved id (Z.cue('L07')).
measure_cues.py checks cue times against the onsets and only suggests. A table with a duplicate id, an unknown kind
or a time that is not a number is reported and left unchanged.

mv-studio (MIT).
"""
from __future__ import annotations

import argparse
import json
import math
import re
import sys
from pathlib import Path

TOOLS = Path(__file__).resolve().parent
sys.path.insert(0, str(TOOLS))
import kit_env  # noqa: E402
from lrc import LRC, ROOT, TIMING, load_timing, line_hash, parse_lrc  # noqa: E402

AUDIO = ROOT / "analysis" / "audio.json"
OUT = ROOT / "analysis" / "cues.json"
KEEP = ("hint", "fix", "lock", "note")
KINDS = ("line", "section", "stop", "impact", "end", "custom")
NEAR = 0.25          # s: a re-analysed stop / impact within this of an old one is the same moment


def build(audio: dict, lines: list[dict], timing: dict) -> list[dict]:
    rows = {r["i"]: r for r in timing.get("lines", [])}
    width = 3 if len(lines) > 100 else 2
    cues = []
    for L in lines:
        r = rows.get(L["i"])
        ok = (r is not None and r.get("n") == len(L["text"]) and r.get("h") == line_hash(L["text"])
              and abs(float(r.get("start", L["t"])) - L["t"]) <= 0.02)
        cues.append({"id": f"L{L['i']:0{width}d}", "t": round(L["t"], 3), "kind": "line", "line": L["i"], "h": line_hash(L["text"]),
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


def _num(v) -> bool:
    return isinstance(v, (int, float)) and not isinstance(v, bool) and math.isfinite(v)


def problems(cues) -> list[str]:
    """What is wrong with a cue table (hand edits included); empty when it is usable."""
    if not isinstance(cues, list):
        return ["'cues' is not a list"]
    out, seen = [], set()
    for k, c in enumerate(cues):
        cid = c.get("id") if isinstance(c, dict) else None
        if not isinstance(cid, str) or not cid:
            out.append(f"cue #{k}: no id")
            continue
        if cid in seen:
            out.append(f"{cid}: the id is used twice")
        seen.add(cid)
        if c.get("kind") not in KINDS:
            out.append(f"{cid}: kind {c.get('kind')!r} is not one of {', '.join(KINDS)}")
        for f in ("t", "fix", "end"):
            if (f == "t" or f in c) and not _num(c.get(f)):
                out.append(f"{cid}: {f} is not a number ({c.get(f)!r})")
        if "lock" in c and not isinstance(c["lock"], bool):
            out.append(f"{cid}: lock is not true / false ({c['lock']!r})")
    return out


def merge(new: list[dict], old: list[dict]) -> tuple[list[dict], dict[str, str], list[str]]:
    """The new table with the old one's hand-made fields (KEEP) carried over -> (cues, {old id: new id}, notes).
    A line's fields follow its text hash (the nearest in time among repeated lines); a line whose text was edited
    keeps them at its id; a stop / impact renumbered by a re-analysis keeps them within NEAR seconds."""
    pairs, free = {}, list(old)

    def take(k, o):
        pairs[k] = o
        free.remove(o)
    hashed = any("h" in o for o in old if o.get("kind") == "line")       # a table from before "h" pairs lines by id
    for k, c in enumerate(new):
        same = [o for o in free if o.get("kind") == "line" and o.get("h") == c.get("h")] if hashed and c["kind"] == "line" else []
        if same:
            take(k, min(same, key=lambda o: abs(o["t"] - c["t"])))
    for k, c in enumerate(new):
        o = None if k in pairs else next((o for o in free if o["id"] == c["id"]), None)
        if o and (c["kind"] != "line" or not o.get("h") or o.get("kind") == "line") and \
                not (c["kind"] in ("stop", "impact") and abs(o["t"] - c["t"]) > NEAR):
            take(k, o)
    for k, c in enumerate(new):
        near = [] if k in pairs or c["kind"] not in ("stop", "impact") else \
            [o for o in free if o.get("kind") == c["kind"] and abs(o["t"] - c["t"]) <= NEAR]
        if near:
            take(k, min(near, key=lambda o: abs(o["t"] - c["t"])))
    moved, notes = {}, []
    for k, c in enumerate(new):
        o = pairs.get(k)
        if not o:
            continue
        hand = [f for f in KEEP if f in o]
        if "fix" in o and abs(o["t"] - c["t"]) > 0.05:
            notes.append(f"{c['id']}: its time moved {o['t']:.2f} -> {c['t']:.2f} s; check its by-ear fix ({o['fix']})")
        if o.get("lock"):
            c["t"] = o["t"]
        c.update({f: o[f] for f in hand})
        if o["id"] != c["id"]:
            moved[o["id"]] = c["id"]
            if hand:
                notes.append(f"{o['id']} -> {c['id']}: its {' / '.join(hand)} moved with it")
    out = new + [o for o in free if o.get("kind") == "custom"]        # hand-made cues stay; stale generated ones go
    for o in free:
        if o.get("kind") != "custom" and any(f in o for f in KEEP):
            notes.append(f"{o['id']}: no cue matches it any more (its line is gone, or the moment moved > {NEAR} s); "
                         f"dropped {json.dumps({f: o[f] for f in KEEP if f in o}, ensure_ascii=False)}")
    return sorted(out, key=lambda c: (c.get("fix", c["t"]), c["id"])), moved, notes


def code_refs(moved: dict[str, str]) -> list[str]:
    """The engine/ lines that name a line cue now meaning another line (the film's own code, not the library)."""
    out = []
    for p in sorted((ROOT / "engine").rglob("*.js")) if moved else []:
        if {"core", "starters", "styles", "blocks", "tests"} & set(p.relative_to(ROOT / "engine").parts[:-1]):
            continue
        for n, s in enumerate(p.read_text(encoding="utf-8", errors="replace").splitlines(), 1):
            for m in re.finditer(r"""cue(?:Or)?\(\s*['"](L\d+)['"]""", s):
                if m.group(1) in moved:
                    out.append(f"{kit_env.rel(p)}:{n}: {m.group(0)})  -- that line is now {moved[m.group(1)]}")
    return out


def selftest() -> int:
    def ln(i, t, h, **kw):
        return {"id": f"L{i:02d}", "t": t, "kind": "line", "line": i, "h": h, **kw}
    old = [ln(0, 1, "a"), ln(1, 2, "b", hint="B1"), ln(2, 3, "c", fix=3.02), ln(3, 4, "b", hint="B2"),
           {"id": "stop1", "t": 10, "kind": "stop", "hint": "S"}, {"id": "my", "t": 5, "kind": "custom"}]
    ins = [ln(0, .5, "new"), ln(1, 1, "a"), ln(2, 2, "b"), ln(3, 3, "c"), ln(4, 4, "b"),
           {"id": "stop1", "t": 9, "kind": "stop"}, {"id": "stop2", "t": 10.1, "kind": "stop"}]
    by = {c["id"]: c for c in merge(json.loads(json.dumps(ins)), json.loads(json.dumps(old)))[0]}
    ok = [by["L02"].get("hint") == "B1", by["L04"].get("hint") == "B2", by["L03"].get("fix") == 3.02,
          "hint" not in by["L00"], by["stop2"].get("hint") == "S", "hint" not in by["stop1"], "my" in by]
    edit = [ln(0, 1, "a"), ln(1, 2, "b2"), ln(2, 3, "c"), ln(3, 4, "b")]          # text edited in place
    by = {c["id"]: c for c in merge(edit, json.loads(json.dumps(old)))[0]}
    ok += [by["L01"].get("hint") == "B1", by["L03"].get("hint") == "B2"]
    cues, _, notes = merge([ln(0, 1, "a"), ln(1, 3, "c"), ln(2, 4, "b")], json.loads(json.dumps(old)))   # L01 deleted
    by = {c["id"]: c for c in cues}
    ok += ["hint" not in by["L01"], by["L02"].get("hint") == "B2", any(n.startswith("L01: no cue") for n in notes)]
    ok += [problems(old) == [], len(problems([{"id": "x", "t": "1", "kind": "line"}, {"id": "x", "t": 1, "kind": "?"}])) == 3]
    print(f"[cues] selftest {'ok' if all(ok) else 'FAIL ' + str(ok)}")
    return 0 if all(ok) else 1


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--list", action="store_true", help="print the table instead of rebuilding")
    ap.add_argument("--selftest", action="store_true", help="check the merge on a made-up table")
    a = ap.parse_args()
    if a.selftest:
        return selftest()
    old = json.loads(OUT.read_text(encoding="utf-8")).get("cues", []) if OUT.is_file() else []
    bad = problems(old)
    if bad:
        print("analysis/cues.json has problems (fix them by hand; the file was not changed):\n  " + "\n  ".join(bad))
        return 1
    if a.list:
        if not OUT.is_file():
            print("no analysis/cues.json yet: python tools/make_cues.py"); return 1
        for c in old:
            t = c.get("fix", c["t"])
            print(f"{c['id']:14s} {t:8.3f}  {c['kind']:8s} {c.get('source', ''):9s} {c.get('hint', '')}")
        return 0
    if not AUDIO.is_file():
        print("no analysis/audio.json: python tools/analyze_audio.py first"); return 1
    audio = json.loads(AUDIO.read_text(encoding="utf-8"))
    lines = parse_lrc(LRC, audio.get("duration", 1e9)) if LRC.is_file() else []
    cues, moved, notes = merge(build(audio, lines, load_timing()), old)
    OUT.write_text(json.dumps({"version": 1, "note": "tools/make_cues.py; hint / fix / lock / custom cues are yours",
                               "inputs": kit_env.inputs_of(AUDIO, LRC, TIMING), "cues": cues},
                              ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    kinds = {}
    for c in cues:
        kinds[c["kind"]] = kinds.get(c["kind"], 0) + 1
    shifts = [n for n in notes if " moved with it" in n]          # an inserted line moves every line after it
    more = [f"... and {len(shifts) - 6} more moved the same way"] if len(shifts) > 6 else []
    for n in shifts[:6] + more + [n for n in notes if n not in shifts] + code_refs(moved):
        print("  " + n)
    no_hint = sum(1 for c in cues if c["kind"] == "line" and not c.get("hint"))
    print(f"[cues] {len(cues)} cues -> analysis/cues.json ({', '.join(f'{v} {k}' for k, v in kinds.items())})")
    if no_hint:
        print(f"  {no_hint} line cue(s) without a picture hint: write one per line (your words, not the lyric)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
