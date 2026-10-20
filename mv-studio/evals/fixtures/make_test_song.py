"""Synthesise a royalty-free 34 s test song (120 BPM, 4/4, beat 0 at 0.25 s) + original test lyrics.
Structure: bars 0-1 intro (pad + hats), bars 2-9 verse (+ kick, bass, lead), bars 10-15 chorus (+ snare, louder,
higher lead), bar 16 tail. Lyric lines start on bar lines; the lead sings one phrase per line with a breath before
the next line (bars 2, 4, 6, 8, 10, 11, 13, 14: the chorus lines are 1, 2, 1, 2 bars).
  python make_test_song.py <outdir>
"""
import sys
import wave
from pathlib import Path

import numpy as np

SR, BPM, T0 = 44100, 120.0, 0.25
BEAT = 60 / BPM
BAR = 4 * BEAT
DUR = T0 + 17 * BAR
rng = np.random.default_rng(7)
y = np.zeros(int(DUR * SR) + SR)


def add(sig, t, gain=1.0):
    i = int(round(t * SR))
    y[i:i + len(sig)] += sig[: max(0, len(y) - i)] * gain


def env(n, a=0.005, d=0.2):
    t = np.arange(n) / SR
    return np.minimum(1, t / a) * np.exp(-t / d)


def kick():
    n = int(0.35 * SR); t = np.arange(n) / SR
    f = 45 + 80 * np.exp(-t / 0.04)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * env(n, 0.002, 0.12)


def snare():
    n = int(0.25 * SR); noise = rng.standard_normal(n)
    noise = np.diff(noise, prepend=0)
    return (noise * 0.5 + np.sin(2 * np.pi * 190 * np.arange(n) / SR)) * env(n, 0.001, 0.07)


def hat():
    n = int(0.06 * SR); noise = np.diff(np.diff(rng.standard_normal(n), prepend=0), prepend=0)
    return noise * env(n, 0.001, 0.015) * 0.25


def tone(freq, dur, harm=(1, 0.5, 0.25), a=0.01, d=0.5, vib=0.0):
    n = int(dur * SR); t = np.arange(n) / SR
    ph = 2 * np.pi * freq * (t + vib * np.sin(2 * np.pi * 5.5 * t) / (2 * np.pi * 5.5))
    s = sum(h * np.sin((k + 1) * ph) for k, h in enumerate(harm))
    rel = np.minimum(1, (n - np.arange(n)) / (0.03 * SR))
    return s * np.minimum(1, t / a) * np.exp(-t / d) * rel


CHORDS = [(220.0, 261.6, 329.6), (174.6, 220.0, 261.6), (261.6, 329.6, 392.0), (196.0, 246.9, 293.7)]   # Am F C G
ROOTS = [110.0, 87.31, 130.81, 98.0]
VERSE_MEL = [440, 392, 349.2, 329.6, 392, 440, 392, 329.6]
CHORUS_MEL = [659.3, 587.3, 523.3, 587.3, 659.3, 784.0, 659.3, 587.3]

for bar in range(17):
    tb = T0 + bar * BAR
    ch = bar % 4
    loud = 1.0 if bar >= 10 else 0.6
    if bar < 16:
        for f in CHORDS[ch]:
            add(tone(f, BAR, harm=(1, 0.2), a=0.3, d=4.0), tb, 0.05 * (0.6 if bar < 2 else 1.0))
    else:
        for f in CHORDS[0]:
            add(tone(f, 2 * BAR, harm=(1, 0.2), a=0.05, d=1.2), tb, 0.06)
    if bar >= 16:
        continue
    for e in range(8):
        add(hat(), tb + e * BEAT / 2, 0.5 if e % 2 else 0.8)
    if bar >= 2:
        for b in range(4):
            add(kick(), tb + b * BEAT, 0.9 * loud)
            add(tone(ROOTS[ch], BEAT * 0.9, harm=(1, 0.6, 0.4, 0.2), a=0.005, d=0.3), tb + b * BEAT, 0.18 * loud)
    if bar >= 10:
        for b in (1, 3):
            add(snare(), tb + b * BEAT, 0.5)

# lead ("vocal"): one phrase per lyric line, from the line's bar to just before the next line, with a breath
# (~0.45 s rest) before each new line, so the line starts can be heard (and measured) like a sung melody
LINE_BARS = [2, 4, 6, 8, 10, 11, 13, 14, 16]
for k, b0 in enumerate(LINE_BARS[:-1]):
    t0, t1 = T0 + b0 * BAR, T0 + LINE_BARS[k + 1] * BAR - 0.45
    mel, loud = (CHORUS_MEL, 1.0) if b0 >= 10 else (VERSE_MEL, 0.6)
    n = 0
    while t0 + n * BEAT < t1 - 0.1:
        dur = min(BEAT * 0.95, t1 - (t0 + n * BEAT))
        add(tone(mel[n % 8], dur, harm=(1, 0.35, 0.1), a=0.02, d=0.7, vib=0.004), t0 + n * BEAT, 0.16 * loud)
        n += 1

y = y[: int(DUR * SR)]
y = y / np.max(np.abs(y)) * 0.89
pcm = (np.stack([y, y], axis=1) * 32767).astype(np.int16)

out = Path(sys.argv[1] if len(sys.argv) > 1 else ".")
out.mkdir(parents=True, exist_ok=True)
with wave.open(str(out / "test_song.wav"), "wb") as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())

tag = lambda s: f"[{int(s // 60):02d}:{s % 60:05.2f}]"
bar_t = lambda n: T0 + n * BAR
EN = [(2, "The night train hums below my window"), (4, "Paper lanterns drifting on the river"),
      (6, "I count the stations you never named"), (8, "Every light is a door left open"),
      (10, "*LIGHT IT UP"), (11, "Carry me over the sleeping town"), (13, "*LIGHT IT UP"), (14, "We are the sparks that will not come down")]
ZH = [(2, "晚风吹过空荡的站台"), (4, "我把行李留在了门外"), (6, "远方的灯一盏一盏亮起来"), (8, "说好的再见我没有说出来"),
      (10, "*回家"), (11, "穿过整座沉睡的城市"), (13, "*回家"), (14, "把夕阳装进我的口袋")]
for name, rows in (("lyrics_en.lrc", EN), ("lyrics_zh.lrc", ZH)):
    body = "[ti:Lantern Line (test song)]\n[ar:Test Fixture]\n"
    for k, (b, s) in enumerate(rows):
        if b == 10:
            body += "\n"
        body += f"{tag(bar_t(b))}{s}\n"
    body += f"{tag(bar_t(16))}\n"
    (out / name).write_text(body, encoding="utf-8")
plain = "\n".join(s for _, s in EN[:4]) + "\n\n" + "\n".join(s for _, s in EN[4:]) + "\n"
(out / "lyrics_en_plain.txt").write_text(plain, encoding="utf-8")
print(f"wrote {out}/test_song.wav ({DUR:.2f} s), lyrics_en.lrc, lyrics_zh.lrc, lyrics_en_plain.txt")
