#!/usr/bin/env python3
"""meter_probe.py -- find the tatum grid and the metre of a song that does not stay in 4/4 (3/8, 5/8, 7/8, changing
metre, 3-3-2 groupings), and draft the bar map analysis/meter.json for tools/analyze_audio.py.

    python tools/meter_probe.py [--audio audio/song.wav] [--bpm 91] [--div 4] [--from 0 --to END]
    python tools/meter_probe.py --selftest

1. TATUM   sub-frame onsets (log-mel flux, 2.9 ms hop, parabolic peaks) -> a Rayleigh search for one period and phase
           near the analyzer's beat / div (default 16ths of analysis/audio.json bpm). A band that plays to a click
           locks to well under 5 ms; a live band drifts (see the residual plot).
2. METRE   per-tatum accent strength -> autocorrelation in tatum lags over sliding windows: a bright row at lag 16 is
           4/4, at 10 is 5/8, at 14 is 7/8, at 6 is 3/8 (in 16ths). Each window votes for a bar length.
3. DRAFT   analysis/meter_auto.json: the voted bar lengths laid end to end from the first downbeat (4/4 kept while
           the bar lag stays strong; a change needs two votes), groups split into 2s and 3s of eighths (5/8 -> 3+2
           eighths = [6, 4] 16ths). A rough starting point: votes smear over ~4 bars and breaks / stops vote oddly.
Plots (analysis/meter_probe.png): the Rayleigh curve, onset residuals against the grid, the autocorrelation map, and
the bar map (meter.json when it exists, else the draft) on the spectrogram, coloured by metre.

Then: copy meter_auto.json to analysis/meter.json, fix it by ear and against the plots (where the bars change, how
each bar groups: [4, 3, 3] or [3, 3, 4]), and re-run tools/analyze_audio.py: downbeats / bars / group_starts and the
engine's Z.clock.meter(t) follow it.
    {"tatum": 0.164835, "t0": 0.4085, "bars": [[12, "4/4", [3, 3, 3, 3, 4]], [1, "3/8", [6]], [9, "5/8", [4, 6]]]}
    rows: [count, metre, groups in tatums]; t0 = the first downbeat; one fixed tatum (constant tempo).

Method after he-drowns-mv-v2's tools/tatum.py and tools/meter.py (longruizhi2-beep, MIT); rewritten for mv-studio (MIT).
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

import numpy as np
from scipy.ndimage import maximum_filter1d, uniform_filter1d
from scipy.signal import find_peaks

TOOLS = Path(__file__).resolve().parent
sys.path.insert(0, str(TOOLS))
import kit_env  # noqa: E402  (sets NUMBA_CACHE_DIR before librosa)

ROOT = kit_env.ROOT
SR, HOP, NFFT = 44100, 128, 1024
# bar length in 16ths -> (metre, groups in eighths)
BARS = {6: ("3/8", [3]), 8: ("2/4", [2, 2]), 10: ("5/8", [3, 2]), 12: ("6/8", [3, 3]), 14: ("7/8", [2, 2, 3]),
        16: ("4/4", [2, 2, 2, 2])}


def onsets(y, sr=SR):
    """log-mel spectral flux -> onset times (s, sub-frame) and weights"""
    import librosa
    S = np.abs(librosa.stft(y, n_fft=NFFT, hop_length=HOP))
    LM = np.log1p(100 * librosa.feature.melspectrogram(S=S ** 2, sr=sr, n_mels=96, fmin=30, fmax=16000))
    lag = 3
    fl = np.clip(LM[:, lag:] - maximum_filter1d(LM, 3, axis=0)[:, :-lag], 0, None).sum(0)
    e = np.concatenate([np.zeros(lag), fl])
    dt = HOP / sr
    e = np.clip(e - uniform_filter1d(e, int(0.1 / dt)), 0, None)
    loc = uniform_filter1d(e, int(1.0 / dt)) + 1e-6
    p, _ = find_peaks(e, height=1.3 * loc, distance=int(0.05 / dt))
    p = p[(p > 0) & (p < len(e) - 1)]
    a, b, c = e[p - 1], e[p], e[p + 1]
    off = np.clip(0.5 * (a - c) / (a - 2 * b + c + 1e-9), -0.5, 0.5)
    return (p + off) * dt - lag * dt / 2, np.minimum(b / loc[p], 6), e, dt, LM


def tatum(tt, ww, P0, span=0.03):
    """Rayleigh search: the period P near P0 (+-span) whose phase the weighted onsets agree on; returns P, t0, R curve"""
    Ps = np.arange(P0 * (1 - span), P0 * (1 + span), 5e-6)
    Rs = np.array([np.abs(np.sum(ww * np.exp(2j * np.pi * tt / P))) for P in Ps]) / ww.sum()
    P = Ps[int(np.argmax(Rs))]
    t0 = (np.angle(np.sum(ww * np.exp(2j * np.pi * tt / P))) / (2 * np.pi)) * P % P
    return P, t0, Ps, Rs


def accents(e, dt, P, t0, dur):
    """per-tatum accent: the strongest flux within 25 ms of each grid point"""
    n = int((dur - t0) / P)
    out = np.zeros(n)
    for k in range(n):
        c = (t0 + k * P) / dt
        a, b = int(c - 0.025 / dt), int(c + 0.025 / dt) + 1
        out[k] = e[max(a, 0):b].max() if b > 0 else 0
    return out


def acorr_map(x, W=96, step=8, maxlag=40):
    rows, cs = [], []
    for c in range(W // 2, len(x) - W // 2, step):
        s = x[c - W // 2:c + W // 2]
        s = (s - s.mean()) / (s.std() + 1e-9)
        rows.append([np.mean(s[:-L] * s[L:]) for L in range(1, maxlag + 1)])
        cs.append(c)
    return np.array(rows), np.array(cs)


def draft(acc, P, t0, first_down):
    """lay voted bar lengths end to end from the first downbeat -> meter.json rows"""
    x = np.log1p(acc / (np.median(acc) + 1e-9))
    A, cs = acorr_map(x, W=64, step=4)                     # ~4 bars: narrow enough to see a short odd run
    lens = sorted(BARS)
    k = int(round((first_down - t0) / P))
    rows, cur, pend = [], 16, None
    while k < len(x) - 4:
        j = int(np.argmin(np.abs(cs - k))) if len(cs) else 0
        score = {L: A[j, L - 1] for L in lens} if len(cs) else {16: 1}
        best = max(score.values())
        L = max(L for L in score if score[L] >= 0.85 * best)   # a half bar repeats too: take the longest that fits
        if L != 16 and score[16] > 0.6 * best:                 # still 4-periodic at the bar: keep 4/4
            L = 16
        if L != cur:                                           # change metre only on two votes in a row
            L, pend = (L, None) if pend == L else (cur, L)
        else:
            pend = None
        cur = L
        meter, g8 = BARS[L]
        g = [2 * v for v in g8]
        if rows and rows[-1][1] == meter:
            rows[-1][0] += 1
        else:
            rows.append([1, meter, g])
        k += L
    return {"tatum": round(float(P), 6), "t0": round(float(t0 + round((first_down - t0) / P) * P), 4), "bars": rows}


def plot(path, Ps, Rs, P, tt, ww, t0, acc, LM, dt, M, a, b):
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    col = {"4/4": "white", "5/8": "cyan", "6/8": "lime", "3/8": "magenta", "2/4": "yellow", "7/8": "orange", "3/4": "violet"}
    fig, ax = plt.subplots(4, 1, figsize=(26, 18), gridspec_kw={"height_ratios": [1, 1.4, 2, 2]})
    ax[0].plot(Ps * 1000, Rs); ax[0].axvline(P * 1000, color="r"); ax[0].set_title(f"Rayleigh R vs tatum period (ms): {P * 1000:.3f}")
    r = ((tt - t0 + P / 2) % P) - P / 2
    ax[1].scatter(tt, r * 1000, s=np.clip(ww, 0.2, 6) * 3, alpha=0.5); ax[1].set_ylim(-P * 500, P * 500)
    ax[1].set_title("onset residual against the grid (ms): a flat band = click-locked; a slope = the tatum is off; drift = live"); ax[1].grid(alpha=0.3)
    A, cs = acorr_map(np.log1p(acc / (np.median(acc) + 1e-9)))
    if len(cs):
        ax[2].imshow(A.T, aspect="auto", origin="lower", extent=[t0 + cs[0] * P, t0 + cs[-1] * P, 0.5, A.shape[1] + 0.5],
                     cmap="magma", vmin=0, vmax=0.6)
    ax[2].set_yticks(range(0, 41, 2)); ax[2].set_title("accent autocorrelation, lag in tatums (16 = 4/4, 10 = 5/8, 14 = 7/8, 6 = 3/8, 12 = 6/8)")
    i0, i1 = int(a / dt), int(b / dt)
    ax[3].imshow(LM[:, i0:i1], aspect="auto", origin="lower", extent=[a, b, 0, LM.shape[0]], cmap="magma")
    t = M["t0"]
    for count, meter, groups in M["bars"]:
        for _ in range(int(count)):
            if a <= t <= b:
                ax[3].axvline(t, color=col.get(meter, "red"), lw=1.6)
                ax[3].text(t + 0.02, LM.shape[0] - 8, meter, color=col.get(meter, "red"), fontsize=8)
                g0 = t
                for g in groups[:-1]:
                    g0 += g * M["tatum"]
                    ax[3].axvline(g0, color=col.get(meter, "red"), lw=0.7, ls="--", alpha=0.7)
            t += sum(groups) * M["tatum"]
    ax[3].set_xlim(a, b); ax[3].set_title("bar map on the spectrogram (solid = bar, dashed = beat group)")
    for x in ax[1:]:
        x.set_xlim(a, b)
    plt.tight_layout(); plt.savefig(path, dpi=50); plt.close(fig)


def probe(y, bpm, div=4, first_down=None, sr=SR):
    tt, ww, e, dt, LM = onsets(y, sr)
    P, t0, Ps, Rs = tatum(tt, ww, 60.0 / bpm / div)
    acc = accents(e, dt, P, t0, len(y) / sr)
    M = draft(acc, P, t0, first_down if first_down is not None else t0)
    return dict(tt=tt, ww=ww, e=e, dt=dt, LM=LM, P=P, t0=t0, Ps=Ps, Rs=Rs, acc=acc, draft=M)


def selftest():
    """a click track: 8 bars 4/4, 8 bars 5/8 (3+2 eighths), 8 bars 4/4 at a 0.15 s tatum -> the tatum, the 5/8 run,
    and analyze_audio.meter_bars on the resulting map"""
    sr, P, t0 = SR, 0.15, 0.5
    rows = [[8, "4/4", [4, 4, 4, 4]], [8, "5/8", [6, 4]], [8, "4/4", [4, 4, 4, 4]]]
    n = int((t0 + sum(c * sum(g) for c, _, g in rows) * P + 1) * sr)
    y = np.zeros(n, np.float32)
    rng = np.random.default_rng(1)
    def click(t, amp, f):
        i = int(t * sr); m = int(0.04 * sr)
        if i + m < n:
            y[i:i + m] += amp * np.sin(2 * np.pi * f * np.arange(m) / sr) * np.exp(-np.arange(m) / (0.006 * sr))
    def tick(t, amp):
        i = int(t * sr); m = int(0.01 * sr)
        if i + m < n:
            y[i:i + m] += amp * rng.standard_normal(m) * np.exp(-np.arange(m) / (0.002 * sr))
    t = t0
    for c, _, g in rows:
        for _ in range(c):
            q = 0
            for gi, L in enumerate(g):
                click(t + q * P, 0.9 if gi == 0 else 0.45, 60 if gi == 0 else 200)
                q += L
            for k in range(sum(g)):
                tick(t + k * P, 0.12)
            t += sum(g) * P
    R = probe(y, 60 / P / 4, first_down=t0, sr=sr)
    assert abs(R["P"] - P) < 0.0005, f"tatum {R['P']:.5f} != {P}"
    assert abs(((R["t0"] - t0 + P / 2) % P) - P / 2) < 0.006, f"phase {R['t0']:.4f}"
    metres = [r[1] for r in R["draft"]["bars"]]
    assert "5/8" in metres and metres[0] == "4/4", f"draft metres {R['draft']['bars']}"
    import analyze_audio as AA
    beats = np.arange(t0, t, P * 4)
    down, bars, gs = AA.meter_bars({"tatum": P, "t0": t0, "bars": rows}, beats, t)
    assert len(down) == 24 and abs(down[9] - (t0 + 8 * 16 * P + 10 * P)) < 1e-6, down[:10]
    assert bars[8]["meter"] == "5/8" and bars[8]["groups"] == [6, 4] and len(gs) == 8 * 4 + 8 * 2 + 8 * 4
    print("meter_probe selftest ok:", f"tatum {R['P'] * 1000:.2f} ms", R["draft"]["bars"])


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--audio", default=str(kit_env.SONG))
    ap.add_argument("--bpm", type=float, default=None, help="beat tempo (default: analysis/audio.json bpm)")
    ap.add_argument("--div", type=int, default=4, help="tatums per beat (4 = 16ths)")
    ap.add_argument("--from", dest="a", type=float, default=0.0)
    ap.add_argument("--to", dest="b", type=float, default=None)
    ap.add_argument("--selftest", action="store_true")
    args = ap.parse_args()
    if args.selftest:
        return selftest()
    import librosa
    aj = ROOT / "analysis" / "audio.json"
    A = json.loads(aj.read_text(encoding="utf-8")) if aj.exists() else {}
    bpm = args.bpm or A.get("bpm")
    if not bpm:
        sys.exit("no tempo: run tools/analyze_audio.py first or pass --bpm")
    y, _ = librosa.load(str(kit_env.resolve(args.audio)), sr=SR, mono=True)
    first = (A.get("downbeats") or [None])[0]
    R = probe(y, bpm, args.div, first)
    out = ROOT / "analysis" / "meter_auto.json"
    out.write_text(json.dumps(R["draft"], ensure_ascii=False), encoding="utf-8")
    cur = ROOT / "analysis" / "meter.json"
    M = json.loads(cur.read_text(encoding="utf-8")) if cur.exists() else R["draft"]
    png = ROOT / "analysis" / "meter_probe.png"
    plot(png, R["Ps"], R["Rs"], R["P"], R["tt"], R["ww"], R["t0"], R["acc"], R["LM"], R["dt"], M,
         args.a, args.b or len(y) / SR)
    r = ((R["tt"] - R["t0"] + R["P"] / 2) % R["P"]) - R["P"] / 2
    print(f"tatum {R['P'] * 1000:.3f} ms (beat x{args.div} = {60 / R['P'] / args.div:.3f} BPM), phase {R['t0']:.4f} s, "
          f"median |residual| {np.median(np.abs(r)) * 1000:.1f} ms")
    print("draft:", " ".join(f"{m}x{c}" for c, m, _ in R["draft"]["bars"]))
    print("(a draft: short odd runs inside breaks, stops and fills are usually false -- check each by ear and on the "
          "plot; a song that stays in 4/4 needs no meter.json at all)")
    print(f"wrote {kit_env.rel(out)} and {kit_env.rel(png)}; curate into analysis/meter.json, then re-run analyze_audio.py")


if __name__ == "__main__":
    main()
