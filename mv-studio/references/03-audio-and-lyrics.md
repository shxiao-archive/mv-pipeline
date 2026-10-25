# 03 — Audio analysis and lyrics

Contents: 1 Prepare the audio · 2 Run the analysis · 3 `audio.json` reference · 4 `envelope_30fps.json` reference · 5 How the engine and Blender use it · 6 Curating sections (semi-manual) · 7 Verify by eye and ear · 8 Lyrics: what to trust · 9 Alignment / transcription pipeline · 10 Writing `lyrics_mv.lrc` · 11 Pitfalls · 12 Timing ground truth (mv-studio)

All commands run from the project root. Python = the interpreter that has librosa, numpy, scipy, soundfile, pillow, faster-whisper, onnxruntime (on the reference machine `"C:\Program Files\Python311\python.exe"`).

---

## 1. Prepare the audio

- Put the song at `audio/song.wav` (the default input of every audio tool; each has `--audio`). Use a lossless **48 kHz WAV**: the analysis runs at 48 kHz (the 30 fps envelope uses a hop of exactly 1600 samples = 1 video frame) and resamples other rates in memory, but the renderer muxes this same file, so convert compressed sources once:
  ```bash
  ffmpeg -i input.mp3 -ar 48000 -ac 2 -c:a pcm_s16le audio/song.wav
  ```
- Never edit the song to add a silent tail, fades or offsets. Extra silence after the song (for an end card / afterimage) is added **at mux time** with `apad` (see 08). The engine's time `t` is always song time.
- Write down the true duration (`ffprobe -v error -show_entries format=duration -of csv=p=0 audio/song.wav`); the timeline sets `window.__zankoMeta.duration` from it (plus any tail).

## 2. Run the analysis

```bash
python tools/analyze_audio.py                          # ~35–60 s on a 3:45 song (1–2 min with plots)
python tools/analyze_audio.py --sections auto          # first pass on a new song (§6)
python tools/analyze_audio.py --bpm-range 160,190      # when the tempo comes out an octave off
python tools/analyze_audio.py --vocal-stem analysis/stems/vocals_kim.wav   # better vocal_activity after separation (§9)
```
Options: `--audio FILE` · `--sections auto|curated|FILE` (default: `analysis/sections.json` when it exists, else `auto`) · `--bpm-range auto|LO,HI` · `--title NAME` · `--no-plot` · `--no-click` · `--vocal-stem PATH`.
Outputs:

| file | what |
|---|---|
| `analysis/audio.json` | tempo, beats, downbeats, bars, sections, stops, impacts, strong onsets, vocal activity |
| `analysis/envelope_30fps.json` | one value per video frame: rms / low / mid / high / onset / beat_phase / bar_phase / beat / bar / vocal |
| `analysis/overview.png` | 4000×1400 timeline: waveform, band energies, beats, downbeats, sections, impacts, vocals |
| `analysis/ssm.png` | bar-level self-similarity (chroma / MFCC) with the section grid: the evidence for repeats |
| `analysis/click_preview.m4a` | the song at −4 dB plus clicks (1.6 kHz on downbeats, 1 kHz on beats) for a listen-check |
| `docs/AUDIO_MAP.md` | human-readable map: timeline table, stops/drops, "where the big visual moments should land" |

Method in one paragraph: onset envelope at 100 fps (log-mel flux at 24 kHz); tempo from six estimators with an octave check (kick/snare backbeat decides ×½ / ×2); beats tracked with a **time-varying tempo curve**, smoothed by a robust spline over beat index and snapped to onset peaks within ±30 ms (残光: 97 % snapped, spline residual median 8 ms, p90 19 ms); downbeat phase scored from bass-chroma changes, chroma changes, kick vs backbeat snare and bass re-entries; sections from a curated bar table validated against novelty and chroma repetition; vocal activity from the separated stem if present (else REPET-SIM + Silero VAD).

## 3. `audio.json` reference

| field | type / example (残光) | use it for |
|---|---|---|
| `duration`, `sr`, `frames_30fps` | 224.32, 48000, 6730 | sanity |
| `music_start`, `music_cut`, `tail_end` | 0.43, **223.54**, 224.32 | first sound; where the music stops dead (last frame within 12 dB of the loud level); end of reverb tail |
| `bpm` | 130.471 (mean = 60·(n−1)/(last−first beat)) | labels only — **never build a grid from it** |
| `tempo` | `{bpm_start 128.28, bpm_end 132.39, bpm_median_local, estimators{…}, octave_check{…}, confidence 0.93}` | detecting drift; checking the octave decision |
| `beat_tracking` | `{spline_residual_ms_median, snapped_to_onset_fraction, …}` | quality report |
| `beats` | 486 times, onset-snapped | **hits**: cuts, flashes, slams |
| `beats_smooth` | same indices, jitter-free spline grid | continuous motion (camera speed, loops) |
| `downbeat_info.winning_phase` | 1 → downbeat = `beats[k]` with `k % 4 == 1` | the engine's bar numbering (`Z.makeClock(…, winning_phase)`) |
| `downbeat_info` (rest) | `phase_scores`, `per_feature_phase_means`, `confidence 0.82`, `top_repeat_lags` | auditing the downbeat choice |
| `downbeats` | 122 times | bar hits (from `analysis/meter.json` when it exists, §6b) |
| `meter`, `meter_map`, `group_starts` | `"4/4"`; with a bar map `"mixed"`, `{source, tatum, t0}` and every beat-group start | odd / changing metre: cut on `group_starts`; `bars[].meter / groups / tatum` |
| `bars[]` | `{index, start, end, bpm}`; `index 0` is a **pickup** bar (`pickup:true, beats:n`) when the song starts off the downbeat | `B(n)` = `start` of the bar whose `index` is n (array position ≠ bar number when there is no pickup); per-bar tempo |
| `sections[]` | `{index, name, start, end, label, group, bars:[first,last], bar_count, energy, vocal_fraction, boundary_novelty(_rank), nearest_auto_boundary_bars, repeat_similarity{section_k: sim}, vocal_entry, confidence, occurrence, character, notable, notes}` | palette/look per section, HUD, escalation plan |
| `auto_boundary_candidates_bars` | bar numbers | where the automatic novelty says sections change (input for §6) |
| `stops[]` | `{start, end, depth_db, kind: 'stop'\|'gap'}` — a dip ≥ 9 dB below the local 80th percentile; `stop` = ≥ 13 dB and ≥ 0.14 s, or ≥ 0.3 s; else `gap` | freeze frames, black frames, held breaths, hard cuts on silence |
| `impacts[]` | `{t, strength, kind, …}` with kinds `first_sound, stop, gap, drop` (bass re-enters), `breakdown` (bass drops out), `hit` (isolated transient, `on_downbeat`), `section_start, final_cut, end_of_tail` | the big sync candidates; 残光 had 60 |
| `onsets_strong[]` | ~520 × `{t, strength, band: kick\|snare\|hat\|tonal, grid: beat\|8th\|16th, beat}` | stutters, glitches on snares, particle bursts on kicks |
| `vocal_activity[]` | `{start, end}` segments (breaths < 0.18 s bridged) | lyric-free windows = showcase shots; mouth/glow driven by voice |
| `vocal_activity_method` | which method + thresholds | audit |

## 4. `envelope_30fps.json` reference

`{fps:30, frames, duration, frame_time, fields{…descriptions}, normalization{…}, rms[], low[], mid[], high[], onset[], beat_phase[], bar_phase[], beat[], bar[], vocal[]}` — one entry per frame, `t = frame/30`.

| key | meaning |
|---|---|
| `rms` | broadband loudness, dB mapped to 0..1 between `max(p5, p99.7−30 dB)` and p99.7 of the music frames; instant attack, 110 ms release |
| `low` | 20–150 Hz (kick/bass), 90 ms release — the best "slam" driver; breakdowns show as `low ≈ 0` |
| `mid` | 150–2000 Hz (voice / guitars / keys body) |
| `high` | 2–12 kHz (cymbals, air) — sparkle and glints |
| `onset` | spectral-flux onset strength, max-pooled per frame, ÷ p99.5, unsmoothed |
| `beat_phase`, `bar_phase` | 0..1 inside the current beat / 4-beat bar (0 = on the beat / downbeat) |
| `beat`, `bar` | index of the current beat in `beats` (−1 before) / bar number (= `bars[].index`) |
| `vocal` | 1 inside a `vocal_activity` segment |

The master is usually compressed: `rms` varies little between verse and chorus (残光 section means 0.14–0.86 only because of arrangement). Use `low` for breakdowns and drops, `onset` for transients.

## 5. How the engine and Blender use it

The engine loads both files at boot (`engine/core/main.js`) and exposes:
```js
Z.audio                       // the whole audio.json
Z.clock = Z.makeClock(audio.beats, audio.bpm, audio.downbeat_info.winning_phase, audio.bars)   // bars: the meter.json map (§6b)
Z.hit(kind, t, tau=0.12)      // drums: strongest recent onsets[kind] ('kick'|'snare'|'hat'|'vocal'), decaying exp(-dt/tau)
Z.lastHit(kind, t, thr) / Z.hitCount(kind, from, t, thr)   // last strong hit time; strong hits since `from` (accent montages)
Z.env   = Z.makeEnv(envelope)  // linear interpolation between frames
// inside a scene: S.clock === Z.clock, S.env === Z.env
S.clock.pulse(t, k=10)   // exp(-k · seconds since last beat): 1 on the beat, decays
S.clock.downPulse(t, k=6) // same, downbeats only
S.clock.phase(t) / barPhase(t)        // 0..1
S.clock.beat(t) / bar(t) / inBar(t)   // beat number (0 = first downbeat), bar number, 0..3 within the bar
S.clock.since(t) / nearest(t) / at(n) // seconds since beat, nearest beat time, time of beat n (extrapolates with spb)
S.clock.meter(t)                      // { bar, meter, len, q (tatum in the bar), group, groups, gq, gPhase, tatum }; 4/4 from beats without a map
S.clock.groupPulse(t, k=10)           // 1 at every beat-group start (= the beat in 4/4)
S.clock.beats / spb                   // raw list, 60/bpm (only for extrapolation past the end)
S.env.rms(t) low(t) mid(t) high(t) onset(t) vocal(t); S.env.get('bar_phase', t)
```
Timeline helpers (inside `Z.setup(audio)`):
```js
const lastBar = audio.bars.length ? audio.bars[audio.bars.length - 1].index : 0;
const B  = n => { const b = audio.bars.find(x => x.index === n); return b ? b.start : n > lastBar ? audio.music_cut : 0; };   // bar start, by bars[].index
const nb = t => audio.beats.reduce((b, x) => (Math.abs(x - t) < Math.abs(b - t) ? x : b), audio.beats[0] ?? t);              // nearest beat
const stopsIn = (a, b) => audio.stops.filter(s => s.kind === 'stop' && s.end > a && s.start < b);  // e.g. freeze windows
```
Patterns that worked: cut on `nb(lyricOnset)` inside a section and on `B(n)` at section changes; big hits (flash, slam, palette change) on chorus downbeats and `drop` impacts; freezes on `stops`; per-beat motion from `pulse`, per-bar loops from `barPhase`; a global camera shake driven by `env.low(t)^3` during choruses only (残光 `Z.globalFX`). Several library scenes read `Z.audio.stops` and `onsets_strong` directly (`fall`, `ember`, `road`).

Blender shot scripts read the same file (`blender/shots/_shared.py`: `beats_in(t0, t1, 'downbeats')`, `frame_of(t, t0)`) — see 07.

**Never** compute beat times as `t0 + n·60/bpm`: 残光 drifted 128.3 → 132.4 BPM (beat 468 → 453 ms), so a fixed grid is a full beat off after ~30 bars.

## 6. Curating sections (semi-manual)

Automatic section labelling is unreliable on compressed, AI-generated or heavily produced masters, so the final table is **chosen by you** and the script validates it (boundary novelty + repetition → `confidence`). The table is `analysis/sections.json`: a JSON list of rows `[first_bar, last_bar, label, group, name, character, notable]` (or objects with those keys; `{"sections": [...]}` also accepted). Bars are 1-based; bar 0 is the pickup and exists only when `bars[0].pickup` is true. Example — the start of the 残光 table (the full one is the built-in `CURATED` list, selected with `--sections curated`, valid only for that song):

```json
[
  [0, 5,   "intro",  "intro-build", "Intro (build)", "sparse, fragile opening; stop-start gaps", "micro-stops ~1.8 / 3.9 / 5.0 / 5.9 s"],
  [6, 9,   "intro",  "riff",        "Intro riff",    "full-band hook, first burst of energy",    "band slams in on bar 6 (~10.3 s)"],
  [10, 17, "verse",  "verse",       "Verse 1a",      "vocal over a thin arrangement, intimate",  "staccato gaps ~18.4 / 20.2 / 24.0 s"],
  [34, 42, "chorus", "chorus",      "Chorus 1",      "full band + hook, widest texture",         "bar 34 downbeat = first big payoff; last bar is a stop"],
  [116, 121, "outro", "riff",       "Outro riff",    "intro riff reprise, ends on a hard cut",   "music cuts at ~223.5 s"]
]
```
Procedure for a new song:
1. **Tempo first.** Listen to `click_preview.m4a`. If the tempo is half or double, re-run with `--bpm-range LO,HI` bracketing the true tempo (default `auto` = librosa's estimate ±12 %; 残光 used 115–145). The meter is assumed 4/4.
2. First pass with `--sections auto`: boundaries from bar-level novelty, groups by aligned bar-chroma similarity ≥ 0.6, labelled `section` / groups `A, B, C…`. The result appears in the `docs/AUDIO_MAP.md` timeline table (times, bar ranges, energy, vocal share) — the starting point for your JSON (`audio.json` records which table was used in `sections_source`).
3. Read the evidence: `overview.png` (energy, bass in/out, vocals), `ssm.png` (repeats show as diagonals), `auto_boundary_candidates_bars`, `stops`, `drop`/`breakdown` impacts, and the lyric line starts (lines start 0.2–1.5 s *before* section downbeats — pickups).
4. Write `analysis/sections.json`: whole bars, every bar covered once in order, last row ends at the final bar (the script ends it at `music_cut` and appends a `tail` section automatically). Use the label vocabulary `intro, verse, pre-chorus, break, chorus, post-chorus, interlude, bridge, last-chorus, outro` (HUD, overview colours and the style docs use it); `group` names material that repeats (`chorus`, `verse`, `riff`…) — `repeat_similarity` is measured within a group. Put mood and notable events in the last two fields: they flow into `AUDIO_MAP.md` and brief every later agent.
5. Re-run (the file is picked up by default). Check each section's `confidence` (残光: lowest 0.44–0.55 on arrangement-only boundaries — fine if your ears agree) and that `docs/AUDIO_MAP.md` reads right.

## 6b. Odd or changing metre (`analysis/meter.json`)

The analysis assumes 4/4: four beats to a bar. A song in 3/8, 5/8 or 7/8, one that changes metre (a 3/8 stab, a 2/4
fill, a math-rock 5-5-5-6 cycle), or one whose bars group unevenly (3+3+3+3+4) needs a curated bar map. A song that
stays in 4/4 needs none.

1. `python tools/meter_probe.py` locks a tatum grid (16ths of the analysed tempo; `--div`, `--bpm` to change) and writes
   `analysis/meter_probe.png`, which holds four panels:
   - the period search;
   - onset residuals against the grid (a flat band means the band plays to a click);
   - an autocorrelation map in tatum lags (a bright row at 16 is 4/4, 10 is 5/8, 14 is 7/8, 6 is 3/8);
   - the bar map on the spectrogram.

   It also writes a draft, `analysis/meter_auto.json`.

   **If it prints a WARNING that the analyser's beat is not 4 tatums:** the beat tracker locked to another pulse. In
   music that mixes 6/8 and 4/4 this is often 2:3, a dotted quarter. Re-run `tools/analyze_audio.py` with the
   `--bpm-range` it prints before anything else uses the beats.
2. Copy the draft to `analysis/meter.json` and fix it by ear and against the plot:
   ```json
   {"tatum": 0.164835, "t0": 0.4085, "bars": [[12, "4/4", [3, 3, 3, 3, 4]], [1, "3/8", [6]], [9, "5/8", [4, 6]]]}
   ```
   - each row is `[count, metre, groups in tatums]`;
   - `t0` is the first downbeat;
   - the tatum is fixed (constant tempo).

   The draft is rough: votes smear over about 4 bars, and breaks and stops vote oddly.
3. Re-run `tools/analyze_audio.py`. Then:
   - `downbeats`, `bars` (with `meter`, `groups`, `tatum`) and the sections follow the map;
   - `group_starts` lists every beat group;
   - `overview.png` colours odd bars;
   - re-run the probe to see the curated map drawn on the spectrogram.
4. **In the engine:**
   - `Z.clock.meter(t)` returns `{ bar, meter, len, q, group, groups, gq, gPhase, tatum }`;
   - `Z.clock.bar / inBar / barPhase / downPulse` follow the map, and `Z.clock.groupPulse(t)` gives 1 at every group
     start;
   - `pops.mjs` and `storyboard.mjs` count group starts as cut points.

## 7. Verify by eye and ear

- Listen to `analysis/click_preview.m4a` all the way through: clicks must sit on the kick, the high click on "1". A downbeat phase error shows as the high click on beat 2 or 4 — fix by checking `downbeat_info.phase_scores` and the bass re-entries.
- On `overview.png`: beats evenly spaced, section bands where the arrangement changes, vocal bars where the singer sings.
- Spot-check 3–4 events in a player (a chorus downbeat, a stop, the final cut) against `audio.json`.

## 8. Lyrics: what to trust

1. **Official lyrics from the artist are the text.** Always ask the user for them. ASR mishears homophones, drops soft words and invents text in silence; the official sheet also gives you the intended kanji/kana spelling and line breaks (残光's official text differed from the reconciled ASR in spelling choices like 堕ちれば / 落ちれば, 羽根 / 羽, わたし / 私, 要らない / いらない, and the ASR missed the final 「救って、救って」 line entirely).
2. **Timings** come from forced alignment of that text to the separated vocal stem (§9). Line onsets must be within ±0.15 s.
3. **Transcription** (multi-pass Whisper) only when no text exists — and then tell the user which lines are uncertain.
4. **Estimated timing** (mv-studio) — plain text, no time tags, and alignment not worth it (a demo, a short clip, a first
   cut, no CPU torch): `python tools/estimate_lrc.py analysis/lyrics_official.txt --start <first sung line, s>
   [--bars-per-line 2] [--line-bars 2,2,1,4,...]` places one line per N bars from the beat grid (blank line = +1 bar gap;
   `*line` → emphasis, ALL CAPS → キメ `!`). Without `--start` it takes the first vocal-activity onset after 1 s. It is an
   ESTIMATE: say so to the user, render stills at the first few line onsets and listen, then shift (`--start`) or fix rows.

## 9. Alignment / transcription pipeline (`tools/transcribe_*.py`)

Run in this order; each step is re-runnable and writes to `analysis/asr/` or `analysis/stems/`.

| step | script | what it does | cost (残光) |
|---|---|---|---|
| 1 | `transcribe_prep.py` | 16 kHz mono variants: `mix16k.wav`, `center16k.wav` (mid/side soft mask keeps centre-panned voice), `vocenh16k.wav` (centre + HPSS harmonic + 120–6000 Hz + slow AGC) | seconds |
| 2 | `transcribe_separate.py kim` (and `vocft`) | UVR MDX-Net ONNX on onnxruntime CPU (no torch): `Kim_Vocal_2.onnx` (HF `seanghay/uvr_models`), `UVR-MDX-NET-Voc_FT.onnx` (HF `AI4future/RVC`); n_fft 7680, dim_f 3072, dim_t 256, hop 1024, UVR ± "denoise" averaging → `analysis/stems/vocals_<m>.wav`, `instrumental_<m>.wav`, `analysis/asr/vocals16k*.wav` | ~130 s CPU per model; **the single biggest accuracy gain** |
| 3 | `transcribe_vocal_activity.py` | vocal/instrumental dB, pyin voicing + f0, vocal onset strength at 10 ms → `asr/vocal_activity.npz` (line-end refinement) | < 1 min |
| 4 | `transcribe_whisper.py --input vocals16k.wav --tag voc_novad_b8 --vad 0 --beam 8` | one faster-whisper **large-v3** pass (cuda float16; falls back to int8/CPU), word timestamps, `condition_on_previous_text=False`, temperature fallback 0–0.8, repetition_penalty 1.05, optional `--clip a,b`, `--lang ja`, `--prompt none\|<text>` → `asr/pass_<tag>.json` | load 4–7 s, pass 18–55 s |
| 5 | `transcribe_score.py` | **forced-decoding scoring**: for each ambiguous spot, force-decode every candidate text on a tight clip and compare Σ log P (e.g. いらない −9.8 vs 言わない −11.5); edit `SCORE_TESTS` in `transcribe_lines.py` (or pass `--tests <file.json>`) | ~1 min |
| 6 | `transcribe_lines.py` (data) | **the line table you edit**: `(text, reading_hiragana, section, approx_start, confidence, alternatives, note)` per line — put the *official* text and a hand-checked hiragana reading here | — |
| 7 | `transcribe_align_mms.py` | mora-level **CTC forced alignment** with torchaudio `MMS_FA` (wav2vec2, 1.18 GB) on the vocal stem; readings romanised per mora (`transcribe_kana.py`, needs `pykakasi`); lines aligned in groups (consecutive lines of one section, ≤ 8 per group; `--groups a-b,b-c,…` to override), each window cut from the lines' approximate starts (`LINES[i][3]`), `*` star tokens at group ends → `asr/align_mms.json` | ~54 s CPU |
| 8 | `transcribe_onset_probe.py` (optional) | independent check: cut the stem at t, ask Whisper whether it still prefers the full line over the line minus its first mora; the "flip" time brackets the onset | minutes |
| 9 | `transcribe_reconcile.py` | final build: line start = MMS onset (manual `START_OVERRIDE` where MMS grabbed the previous phrase's tail), per-word and per-character times, line end from vocal-energy decay, repeats, nearest 16th-note (`start_16th`), gaps ≥ 2 s → `analysis/lyrics.json`, `lyrics.lrc`, `lyrics_jizura.txt` (gaps as `[間奏]`), `lyrics_sections.json`, `lyrics_translation.json` (from `transcribe_translation.py`) | seconds |

Install notes: CUDA Whisper needs `pip install nvidia-cublas-cu12` (ctranslate2 ships cuDNN but not cuBLAS; the script adds the pip `nvidia/*/bin` folders to the DLL path on Windows). The Python packages of steps 2–9 (faster-whisper, onnxruntime, huggingface_hub, pykakasi) come with the setup's lyric set: scaffold with `--setup-args "-Lyrics"` (bash `--lyrics`) or re-run `setup.ps1 -Lyrics` / `./setup.sh --lyrics`. MMS needs CPU torch + torchaudio **2.8**, kept out of the global site-packages: `python -m pip install --target vendor/pydeps_torch torch==2.8.0 torchaudio==2.8.0 --index-url https://download.pytorch.org/whl/cpu`. `transcribe_align_mms.py` finds `vendor/pydeps_torch` automatically (or set `TORCH_DEPS_DIR`).

**For official lyrics without timings** (the usual case: plain text, `--lyrics` saved it as `analysis/lyrics_official.txt`) run steps 2, 3, 4 — one Whisper pass on the stem, used only for each line's approximate start (±1 s): `transcribe_align_mms.py` cuts its windows from `LINES[i][3]` — then 6, 7, 9 (≈ 15 min). Replace all song data first; the shipped values are 残光's:
- `transcribe_lines.py`: `LINES` (official text, hand-checked hiragana reading, section, approximate start), `SONG` (title, language, wordless vocal regions, instrumental breaks), `START_OVERRIDE = {}`, `MORA_OVERRIDE = {}`, `SCORE_TESTS`;
- `transcribe_reconcile.py`: `SECTION_NAMES` (display names for the section keys used in `LINES`; unknown keys pass through);
- `transcribe_translation.py`: `TRANS = []`, `ROMAJI = {}` unless you write translations — entries are matched by line index, so leftovers attach 残光's translations to your lines;
- `transcribe_whisper.py`: `PROMPTS` (song keywords).

Alignment groups are automatic (by section; `--groups` to override); `SONG_LEN` comes from `audio.json` (or `--song-len`). Write the hiragana reading of every line by hand and check it with `python tools/transcribe_kana.py` (every line must print `OK`). **Japanese only**: Chinese or English lyrics need the mora/romaji step of `transcribe_align_mms.py` replaced (e.g. pypinyin syllables), or time the lines by ear.

**For transcription from scratch** run step 4 several times on different inputs and settings, diff the passes, settle disagreements with step 5, then continue from step 6. What 残光 taught (11 passes):

| pass (large-v3, ja) | result |
|---|---|
| mix, VAD on, beam 5 | **failed**: one hallucinated segment 「ご視聴ありがとうございました」 covering 0.6–103 s |
| centre, VAD off, beam 8 | good; errors on homophones; trailing 「チャンネル登録…」 hallucination |
| **Kim vocal stem, VAD off, beam 8** | **best** (base text); independent confirmation from the Voc_FT stem |
| vocal stem, VAD on | VAD swallowed 55–91 s |
| vocenh (DSP enhancement) | ~65 % characters right — DSP is no substitute for separation |
| stem, beam 10, condition on previous text | same text + 「作詞・作曲・編曲 初音ミク」 hallucination in the interlude |

Rules: **VAD off** (Silero misreads sung vowels), separated stem beats every DSP trick, the initial prompt barely matters once the input is clean, stems and centre mix matched the final text at 96.4–97.5 % of characters. **Whisper word timestamps run early** (0.04–2.0 s, median 0.62 s; worst after held notes) — never use them as onsets; use MMS. In 残光 every final onset sat 35–85 ms after a 16th-note grid point (median 47 ms) — a good consistency check.

**Hallucinations to delete on sight** (they appear on silence, vocal chops and vocalise): 「ご視聴ありがとうございました」, 「チャンネル登録…」, 「作詞・作曲・編曲 初音ミク」, 「ラララ…」, repeated short tokens. Mark wordless regions (vocalise, chops) instead of inventing words.

`lyrics.json` per line: `index, start, end, text, words[{w, reading, start, end}], chars[{c, start, end}]` (per display character — for tegaki reveals and karaoke fills), `section_hint, repeat_of, confidence, alternatives, reading, romaji, last_mora_start, start_16th, timing_source, note`.

## 10. Writing `analysis/lyrics_mv.lrc`

This file is what the film shows: the **official text**, broken into **display lines**, timed at the **sung onset**, with JIZURA markup. The timeline loads it at boot (without it the film renders with no lyric layer), strips `[ti:]` and hands it to every JIZURA plan.

Merging official text with aligned timings:
1. Start from `analysis/lyrics.json` (aligned with the official text in `transcribe_lines.py`).
2. One LRC row per display line. Where you split a sung line into two display lines, take the second row's time from `words[]` (e.g. 残光 line 12 「それでも 消えないで」 → `[00:58.98]それでも` + `[01:00.38]消えないで`; the hook 「救って 救って この夜から」 → `[01:02.22]*救って*、*救って*!` + `[01:04.12]この夜から`).
3. Use the official spelling, punctuation (、) and kana choices; keep the LRC time = `start` from alignment (not beat-snapped — JIZURA already shows text ~0.2 s early with `typeset: true`, and lyric cuts snap to its own beat logic).
4. Add markup:

| markup | effect in JIZURA | example |
|---|---|---|
| `/` inside a line | forced cut/line break: the halves become separate beats of the layout | `[00:17.50]ひび割れた空を/見上げて` |
| `*word*` | emphasis: bigger, impact parts, accent colour | `[02:25.47]*ひかり*を残して!` |
| trailing `!` | キメ line: the strongest treatment (flash/shake if enabled) — use for 1–2 lines per chorus | `[01:02.22]*救って*、*救って*!` |
| `[間奏]` row | an instrumental line: stops the previous line from lingering through a gap | `[01:19.49][間奏]` |
| blank line | ignored; use it to separate sections for humans | |

5. Header: keep only `[ar:]`, `[by:…]`, `[offset:0]` (any other `[xx:…]` tag would be read as lyric text; `[ti:]` is stripped by the timeline unless you want JIZURA's title card).

Excerpt of the shipped file:
```
[ar:]
[by:official lyrics (user) + faster-whisper/MMS forced-alignment timings]
[00:17.50]ひび割れた空を/見上げて
[00:20.76]名前もない影を/抱いた
[00:47.00]ねえ、/どこまで堕ちれば
[01:02.22]*救って*、*救って*!
[01:04.12]この夜から
[01:17.57]*ひかり*を残して!
[01:19.49][間奏]
```
After editing the LRC, every JIZURA cut is re-planned: re-render stills (06-jizura.md).

## 11. Pitfalls

- Tempo an octave off (half/double) → every downstream cut is wrong; check the click preview first and fix with `--bpm-range` (§6).
- Section rows referring to bars that don't exist (bar 0 without a pickup, bars past the end) → the script stops with a clear error; `--sections curated` on a new song is always wrong (it is the 残光 table).
- Treating `bpm` as a grid → drift (§5). Treating `beats_smooth` as hit times → hits up to ~20 ms off the transient; use `beats` for hits.
- Hook vocals start before the downbeat (残光: ~0.3 s): start the lyric animation on the pickup, land the visual hit on the downbeat.
- Chorus-ending "stop bars" (band drops out) are the near-a-cappella moments — the title line was sung inside them in 残光; they deserve the film's most important images, not a cut-away.
- Whisper on a full mix with VAD: one hour-long hallucination. Stems, VAD off, several passes, forced scoring.
- MMS can attach a line's first mora to the previous phrase's tail after a pause; check onsets that land in silence on `vocal_activity.npz` and override (`START_OVERRIDE`).
- A missing line in every ASR pass is invisible to diffing — compare against the official sheet line by line.


## 12. mv-studio: timing ground truth

**Tiers.** Every lyric line's start time has a source; `analysis/lyric_timing.json` records it (text-free: index,
character count, hash, start; tools/lrc.py), with a confidence and optional per-character times. The line START
times themselves always live in `analysis/lyrics_mv.lrc` (JIZURA and the engine read it). Best first:

| tier | how | source |
|---|---|---|
| official timed LRC | the artist's / distributor's file | `lrc` (`lyric_timing.py mark --source lrc`) |
| score | `python tools/score_timing.py <file.ust / file.mid> [--offset auto] [--readings FILE]`: UST / MIDI notes, offset fitted to the voice onsets, per-character onsets; rewrites the LRC starts | `score` |
| forced alignment | 03 §9 (Japanese), then `python tools/lyric_timing.py import-align analysis/lyrics.json` | `align` |
| editor | `node tools/lyric_editor/server.mjs` → http://127.0.0.1:5178/: play, tap (T), nudge (← →), snap to a voice onset (O) or the grid (G), save (backs up the LRC) | `editor` |
| by ear | `python tools/lyric_timing.py mark --source by-ear --lines 3,7` | `by-ear` |
| estimate | `python tools/estimate_lrc.py` (bar grid) | `estimate`, conf 0.3 |

`python tools/lyric_timing.py status` prints every line's tier and confidence and the lines to check by ear first.
A timing row is ignored once its line's text or start time changes in the LRC, so stale character times never pair
with an edited line. With per-character times, `Z.charsAt(i, t)` reveals each character when it is sung.

**Readings for the score** (`--readings`): one row per lyric line, the syllables of each display character separated
by spaces, characters separated by `|` (kanji, English words). Without it CJK characters count one syllable each
(small kana join the previous one) and a Latin word one per vowel group.

**Cues.** `python tools/make_cues.py` → `analysis/cues.json`: `L00…` per line (with `section`; a line that starts
< 2 beats before a section and runs into it is that section's `pickup`), `sec:<label>`, `stop<n>`, `hit<n>`, `end`,
plus your own `custom` cues. `hint` (the picture, your words), `fix` (a time corrected by ear) and `lock` survive a
rebuild. Timelines use `Z.cue('L07')`. `python tools/measure_cues.py` prints, per cue, the nearest voice (line cues)
or drum onset, its strength and the half-beat it sits on: suggestions only.

**Is each line on the right phrase?** `python tools/check_sync.py --lyrics-only` (no render needed) checks the LRC
against the voice: the best global shift, the nearest onset per line, and whether every line starts after a breath.
A line that starts INSIDE a sung phrase usually sits on the right beat of the wrong phrase (an estimate that
counted bars wrong): the shift test cannot see that, the phrase test can. Run it after `estimate_lrc.py`, listen to
the listed lines, fix them in the editor.

**Offsets.** `project.json` → `timing.offset` (> 0: every picture later) and `timing.lyricOffset` (> 0: only the
lyrics later). `python tools/check_sync.py render/mv.mp4` measures what to put there (audio mux, cut frames, lyric
vs voice).

**Analysis additions.** `audio.json` → `grid_fit` (a constant-tempo fit through the attack-refined beats; with
`--grid auto`, the default, a metronomic song's `beats` ARE the fitted grid: no onset jitter), `onsets` (`kick`,
`snare`, `hat`, `vocal`: `[time, strength]`, approximate on a full mix; for hits, not transcription). `beats_smooth`
is the jitter-free spline for continuous motion. Onset tools use a 1024-sample window with a 128 hop: a 2048 window
reads onsets ~25 ms early (measured on the test song).

**Same file everywhere.** Analyse, render and mux the same decoded `audio/song.wav` (new_project.py converts MP3 /
AAC once, with ffmpeg's encoder-delay trimming). A stem or an MP3 decoded by another tool can be shifted by its
encoder delay (pdoom-video measured 23 ms): check_sync step 1 shows it.

**librosa hangs at import** (sandboxed agents, read-only site-packages): numba's cache probe retries forever.
`tools/kit_env.py` points `NUMBA_CACHE_DIR` at `.cache/numba` in the project; import kit_env before librosa.

---
Author: **NikusonP** · vocaloid-style-mv-pipeline (MIT)
