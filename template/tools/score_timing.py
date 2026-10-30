#!/usr/bin/env python3
"""Lyric timing from the producer's SCORE (UTAU .ust or a MIDI file): exact per-character onsets, no speech model.

    python tools/score_timing.py assets/score/main.ust [--offset auto|0.012] [--readings analysis/readings.txt] [--dry]
    python tools/score_timing.py assets/score/vocal.mid [--track 2] ...

Vocaloid / UTAU / SynthV songs are sung from a note list, and every sung syllable is one note. This reads the notes
(UST: Length in ticks at 480 per quarter, Tempo, Lyric, R = rest; MIDI: the tempo map, note on/off and lyric meta
events), finds the score's offset against the song, and gives every lyric line its first note and every display
character the onset of its first note. Then it rewrites the line start times in analysis/lyrics_mv.lrc (unless
--dry) and writes analysis/lyric_timing.json (source "score", per-character times).

  --offset auto     cross-correlate the note onsets with the voice onsets of audio/song.wav (+-3 s); or a number:
                    song time of the score's time 0
  --readings FILE   needed for text whose characters are not one syllable each (kanji, English): one row per lyric
                    line, the sung syllables of each display character separated by spaces and the characters by |
                    e.g. "よ ぞら を み た" is wrong (no |); "よ|ぞ ら|を|み|た" is right (5 characters, 6 syllables).
                    Without it: CJK characters count one syllable each (small kana join the previous one), a Latin
                    word one syllable per vowel group; check the result.
  Notes whose lyric is "-", "+", "ー" or empty-continuation hold the previous syllable (melisma).

mv-studio (MIT). Idea after netsu-ijou-pv's per-character UST timing (CC BY-NC 4.0; no code taken).
"""
from __future__ import annotations

import argparse
import re
import struct
import sys
from pathlib import Path

import numpy as np

TOOLS = Path(__file__).resolve().parent
sys.path.insert(0, str(TOOLS))
import kit_env  # noqa: E402
from lrc import LRC, ROOT, parse_lrc, rewrite_lrc_times, save_timing  # noqa: E402

HOLD = {"-", "+", "+~", "ー", "~"}
REST = {"r", "R", "", "rest"}
SMALL = set("ぁぃぅぇぉゃゅょゎっァィゥェォャュョヮッー")
PUNCT = re.compile(r"[\s、。，．,.!?！？「」『』（）()\"'“”‘’…・~〜:;：；-]")


# ------------------------------------------------------------------------------------------------ readers
def read_ust(path: Path) -> list[dict]:
    text = path.read_bytes().decode("shift_jis", errors="replace") if b"\x82" in path.read_bytes()[:4000] else path.read_text(encoding="utf-8", errors="replace")
    tempo, t, notes = 120.0, 0.0, []
    for block in re.split(r"^\[#", text, flags=re.M)[1:]:
        head, _, body = block.partition("]")
        kv = dict(re.findall(r"^(\w+)=(.*)$", body, flags=re.M))
        if head.upper() == "SETTING":
            if "Tempo" in kv:
                tempo = float(kv["Tempo"].strip())
            continue
        if not head.strip().isdigit():
            continue
        if "Tempo" in kv:
            tempo = float(kv["Tempo"].strip())
        dur = float(kv.get("Length", "0")) / 480 * 60 / tempo
        lyr = kv.get("Lyric", "").strip()
        notes.append({"t": t, "dur": dur, "lyric": lyr, "rest": lyr in REST})
        t += dur
    return notes


def read_midi(path: Path, track: int | None) -> list[dict]:
    data = path.read_bytes()
    if data[:4] != b"MThd":
        sys.exit(f"{path}: not a standard MIDI file")
    _, ntrk, div = struct.unpack(">HHH", data[8:14])
    pos, tracks = 14, []
    for _ in range(ntrk):
        assert data[pos:pos + 4] == b"MTrk"
        ln = struct.unpack(">I", data[pos + 4:pos + 8])[0]
        tracks.append(data[pos + 8:pos + 8 + ln]); pos += 8 + ln

    def events(tr: bytes):
        i, tick, status = 0, 0, 0
        while i < len(tr):
            dv = 0
            while True:
                b = tr[i]; i += 1; dv = (dv << 7) | (b & 0x7F)
                if b < 0x80:
                    break
            tick += dv
            b = tr[i]
            if b == 0xFF:
                typ, i = tr[i + 1], i + 2
                ln = 0
                while True:
                    c = tr[i]; i += 1; ln = (ln << 7) | (c & 0x7F)
                    if c < 0x80:
                        break
                yield tick, "meta", typ, tr[i:i + ln]; i += ln
            elif b in (0xF0, 0xF7):
                i += 1; ln = 0
                while True:
                    c = tr[i]; i += 1; ln = (ln << 7) | (c & 0x7F)
                    if c < 0x80:
                        break
                i += ln
            else:
                if b >= 0x80:
                    status, i = b, i + 1
                kind = status & 0xF0
                n = 1 if kind in (0xC0, 0xD0) else 2
                d = tr[i:i + n]; i += n
                yield tick, "midi", kind, d

    tempos, per_track = [(0, 500000)], []
    for tr in tracks:
        notes, lyrics, on = [], {}, {}
        for tick, kind, typ, d in events(tr):
            if kind == "meta" and typ == 0x51:
                tempos.append((tick, int.from_bytes(d, "big")))
            elif kind == "meta" and typ in (0x05, 0x01) and d:
                lyrics.setdefault(tick, d.decode("utf-8", errors="replace").strip())
            elif kind == "midi" and typ == 0x90 and d[1] > 0:
                on[d[0]] = tick
            elif kind == "midi" and (typ == 0x80 or (typ == 0x90 and d[1] == 0)) and d[0] in on:
                notes.append((on.pop(d[0]), tick))
        per_track.append((sorted(notes), lyrics))
    tempos.sort()

    def sec(tick):
        s, last_t, last_us = 0.0, 0, tempos[0][1]
        for tt, us in tempos[1:]:
            if tt >= tick:
                break
            s += (tt - last_t) / div * last_us / 1e6; last_t, last_us = tt, us
        return s + (tick - last_t) / div * last_us / 1e6

    cand = [k for k, (n, _) in enumerate(per_track) if n]
    if not cand:
        sys.exit(f"{path}: no notes")
    k = track if track is not None else max(cand, key=lambda j: (len(per_track[j][1]), len(per_track[j][0])))
    notes, lyrics = per_track[k]
    out = []
    for a, b in notes:
        lyr = lyrics.get(a, "")
        out.append({"t": sec(a), "dur": sec(b) - sec(a), "lyric": lyr, "rest": False})
    return out


# ------------------------------------------------------------------------------------------------ units
def units_of(text: str, reading: str | None) -> list[int]:
    """Syllable count per display character of `text` (0 for spaces / punctuation)."""
    chars = list(text)
    if reading:
        groups = [g.strip() for g in reading.split("|")]
        sung = [c for c in chars if not PUNCT.match(c)]
        if len(groups) != len(sung):
            raise ValueError(f"reading has {len(groups)} groups for {len(sung)} sung characters")
        it = iter(len(g.split()) if " " in g else max(1, sum(1 for ch in g if ch not in SMALL)) for g in groups)
        return [0 if PUNCT.match(c) else next(it) for c in chars]
    out = []
    latin = all(ord(c) < 0x250 for c in text)
    if latin:                                              # one syllable per vowel group, given to the word's first letter
        res = [0] * len(chars)
        for m in re.finditer(r"[A-Za-zÀ-ɏ']+", text):
            w = m.group(0).lower()
            n = max(1, len(re.findall(r"[aeiouyàâäéèêëîïôöùûü]+", w)) - (1 if w.endswith("e") and len(w) > 3 and not w.endswith(("le", "ee")) else 0))
            res[m.start()] = n
        return res
    for c in chars:
        out.append(0 if PUNCT.match(c) or c in SMALL else 1)
    return out


def fit_offset(onsets: np.ndarray, audio: Path) -> tuple[float, float]:
    import librosa  # after kit_env
    y, sr = librosa.load(str(audio), sr=22050, mono=True)
    harm = librosa.effects.harmonic(y, margin=2.0)
    S = np.abs(librosa.stft(harm, n_fft=1024, hop_length=128))
    fr = librosa.fft_frequencies(sr=sr, n_fft=1024)
    env = np.maximum(0, np.diff(np.log1p(S[(fr >= 300) & (fr <= 3400)] * 50).sum(axis=0), prepend=0))
    et = np.arange(len(env)) * 128 / sr
    shifts = np.arange(-3.0, 3.0001, 0.005)
    score = np.array([np.interp(onsets + s, et, env, left=0, right=0).mean() for s in shifts])
    k = int(np.argmax(score))
    z = (score[k] - score.mean()) / (score.std() + 1e-9)
    return float(shifts[k]), float(z)


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("score")
    ap.add_argument("--offset", default="auto")
    ap.add_argument("--readings")
    ap.add_argument("--track", type=int)
    ap.add_argument("--audio", default="audio/song.wav")
    ap.add_argument("--dry", action="store_true", help="print, do not write")
    a = ap.parse_args()
    sp = kit_env.resolve(a.score)
    notes = read_midi(sp, a.track) if sp.suffix.lower() in (".mid", ".midi") else read_ust(sp)
    sung = [n for n in notes if not n["rest"]]
    starts = [n for n in sung if n["lyric"] not in HOLD]       # notes that begin a syllable
    if not starts:
        print("no sung notes in the score"); return 1
    on = np.array([n["t"] for n in starts])
    if a.offset == "auto":
        off, z = fit_offset(on, kit_env.resolve(a.audio))
        print(f"[score] offset {off:+.3f} s (song time of score 0; fit z {z:.1f}{' -- weak, pass --offset' if z < 3 else ''})")
    else:
        off = float(a.offset)
    on = on + off
    lines = parse_lrc(LRC)
    readings = Path(a.readings).read_text(encoding="utf-8").splitlines() if a.readings else []
    total = 0
    per_line = []
    for L in lines:
        try:
            u = units_of(L["text"], readings[L["i"]] if L["i"] < len(readings) and readings[L["i"]].strip() else None)
        except ValueError as e:
            print(f"line {L['i']}: {e}"); return 1
        per_line.append(u); total += sum(u)
    if total != len(on):
        print(f"[score] WARNING: the lyrics need {total} syllables, the score has {len(on)} syllable notes: "
              "the lines are matched in order, so check the result (or give --readings)")
    k, rows, starts_new = 0, [], {}
    for L, u in zip(lines, per_line):
        chars, first = [], None
        for c_units in u:
            if c_units and k < len(on):
                chars.append(float(on[k])); first = first if first is not None else float(on[k]); k += c_units
            else:
                chars.append(chars[-1] if chars else (float(on[k]) if k < len(on) else L["t"]))
        if first is None:
            rows.append({"start": L["t"], "end": L["end"], "source": "lrc", "conf": None}); continue
        starts_new[L["i"]] = first
        rows.append({"start": first, "end": L["end"], "source": "score", "conf": 0.95 if total == len(on) else 0.6, "chars": chars})
        print(f"line {L['i']:3d}  LRC {L['t']:8.3f}  score {first:8.3f}  ({first - L['t']:+.3f} s)")
    if a.dry:
        print("[score] --dry: nothing written"); return 0
    n = rewrite_lrc_times(LRC, starts_new)
    lines = parse_lrc(LRC)                                    # re-read with the new times (ends follow the starts)
    for L, r in zip(lines, rows):
        r["start"] = L["t"]; r["end"] = L["end"]
    save_timing(lines, rows)
    print(f"[score] {n} line start(s) rewritten in analysis/lyrics_mv.lrc; per-character times -> analysis/lyric_timing.json")
    return 0


if __name__ == "__main__":
    sys.exit(main())
