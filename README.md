# mv-pipeline

The **mv-studio** Claude skill: makes lyric music videos from a song and its lyrics with a deterministic
Canvas2D / WebGL2 engine, rendered headless with Playwright and ffmpeg. By default each film designs its own style from
the song; five presets on request (vocaloid, interface, stage, papercraft, magazine). A choice of image generator
(Codex, Grok, NovelAI or your own art), automated technical checks (timing, sync, flashes), a jury review, and delivery
tools.

- `mv-studio/SKILL.md` — the skill's entry point and its workflow (the phases, with detail in
  `mv-studio/references/01-workflow.md`)
- `mv-studio/references/` — the detailed guides
- `mv-studio/template/` — the project every film starts from (`scripts/new_project.py` scaffolds it)
- `mv-studio/evals/` — eval prompts and the grader; make the test song with
  `python mv-studio/evals/fixtures/make_test_song.py mv-studio/evals/fixtures`

Install: copy the `mv-studio` folder into your skills folder (for Claude Code, `~/.claude/skills/`).

Based on vocaloid-style-mv-pipeline (MIT); see `mv-studio/LICENSE`, `NOTICE.md` and `THIRD_PARTY_NOTICES.md`.
