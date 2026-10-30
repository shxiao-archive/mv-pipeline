#!/usr/bin/env python3
"""Measure every cue of analysis/cues.json against the audio and SUGGEST corrections (never writes them).

    python tools/measure_cues.py [--window 0.30] [--kinds line,impact,stop,section,custom] [id-prefix ...]

For a line cue it looks for onsets of the VOICE (harmonic part, 300-3400 Hz spectral flux); for impacts, stops,
sections and custom cues, onsets of the DRUMS (percussive part, full band). It prints, per cue:

    cue   time in cues.json   source   nearest onset   delta   strength   that onset on the half-beat grid   others

Then correct by ear: put the time you trust into the cue's "fix" field (make_cues.py keeps it), or fix the lyric
timing itself (tools/lyric_editor) for line cues. A cue whose nearest onset is weak or far is the first thing to
listen to. Writes render/measure_cues.json.

Method after world-execute-me-lyric-mv's tools/measure_cues.py (Nyankomint, MIT); rewritten for mv-studio (MIT).
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import numpy as np

TOOLS = Path(__file__).resolve().parent
sys.path.insert(0, str(TOOLS))
import kit_env  # noqa: E402  (sets NUMBA_CACHE_DIR before librosa)
import librosa  # noqa: E402

ROOT = kit_env.ROOT


N_FFT, HOP = 1024, 128   # a 2048 window reads onsets ~25 ms early; 1024 / 128 measured ~2 ms on the test song


def envelope(y, sr, hop, lo, hi):
    S = np.abs(librosa.stft(y, n_fft=N_FFT, hop_length=hop))
    fr = librosa.fft_frequencies(sr=sr, n_fft=N_FFT)
    band = S[(fr >= lo) & (fr <= hi)]
    return np.maximum(0, np.diff(np.log1p(band * 50).sum(axis=0), prepend=0))


def peaks(env, hop, sr):
    norm = env / (np.percentile(env, 99.5) + 1e-9)
    idx = librosa.util.peak_pick(norm, pre_max=3, post_max=3, pre_avg=12, post_avg=12, delta=0.08, wait=4)
    return idx * hop / sr, np.clip(norm[idx], 0, 1)


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("prefix", nargs="*")
    ap.add_argument("--window", type=float, default=0.30)
    ap.add_argument("--kinds", default="line,impact,stop,section,custom")
    ap.add_argument("--audio", default="audio/song.wav")
    a = ap.parse_args()
    cues_p = ROOT / "analysis" / "cues.json"
    if not cues_p.is_file():
        print("no analysis/cues.json: python tools/make_cues.py"); return 1
    cues = json.loads(cues_p.read_text(encoding="utf-8"))["cues"]
    audio = json.loads((ROOT / "analysis" / "audio.json").read_text(encoding="utf-8"))
    beats = np.array(audio.get("beats", []))
    halves = np.sort(np.concatenate([beats, (beats[:-1] + beats[1:]) / 2])) if len(beats) > 1 else beats
    snap = (lambda t: float(halves[np.argmin(np.abs(halves - t))])) if len(halves) else (lambda t: t)
    y, sr = librosa.load(str(kit_env.resolve(a.audio)), sr=22050, mono=True)
    hop = HOP
    pv = peaks(envelope(librosa.effects.harmonic(y, margin=2.0), sr, hop, 300, 3400), hop, sr)
    pd = peaks(envelope(librosa.effects.percussive(y, margin=2.0), sr, hop, 40, 8000), hop, sr)
    kinds = set(a.kinds.split(","))
    out = []
    print(f"{'cue':14s} {'time':>8s} {'source':9s} {'onset':>8s} {'delta':>7s} {'str':>5s} {'grid':>8s}   others in the window")
    for c in cues:
        if c["kind"] not in kinds or (a.prefix and not any(c["id"].startswith(p) for p in a.prefix)):
            continue
        t = float(c.get("fix", c["t"]))
        times, strength = pv if c["kind"] == "line" else pd
        m = np.abs(times - t) <= a.window
        row = {"id": c["id"], "t": t, "kind": c["kind"], "source": c.get("source", "")}
        if not m.any():
            print(f"{c['id']:14s} {t:8.3f} {row['source']:9s} {'(none)':>8s}")
            out.append(row); continue
        tt, ss = times[m], strength[m]
        j = int(np.argmin(np.abs(tt - t)))
        row.update(onset=round(float(tt[j]), 3), delta=round(float(tt[j] - t), 3), strength=round(float(ss[j]), 2), grid=round(snap(tt[j]), 3))
        rest = ", ".join(f"{x:.2f}({s:.2f})" for x, s in zip(tt, ss) if x != tt[j])
        flag = "  <- listen" if abs(row["delta"]) > 0.08 or row["strength"] < 0.25 else ""
        print(f"{c['id']:14s} {t:8.3f} {row['source']:9s} {row['onset']:8.3f} {row['delta']:+7.3f} {row['strength']:5.2f} {row['grid']:8.3f}   {rest}{flag}")
        out.append(row)
    (ROOT / "render").mkdir(exist_ok=True)
    (ROOT / "render" / "measure_cues.json").write_text(json.dumps(out, indent=1), encoding="utf-8")
    print(f"[measure_cues] {len(out)} cues -> render/measure_cues.json (suggestions only: put a trusted time into \"fix\")")
    return 0


if __name__ == "__main__":
    sys.exit(main())
