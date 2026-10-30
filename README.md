# mv-pipeline

The **mv-studio** Claude skill: makes lyric music videos from a song and its lyrics with a deterministic
Canvas2D / WebGL2 engine, rendered headless with Playwright and ffmpeg. By default each film designs its own style from
the song; three presets on request (vocaloid, interface, magazine). A choice of image generator
(Codex, Grok, NovelAI or your own art), automated technical checks (timing, sync, flashes), a jury review, and delivery
tools.

- `SKILL.md` — the skill's entry point and its workflow (the phases, with detail in `references/01-workflow.md`)
- `references/` — the detailed guides
- `styles/` — the presets' briefs and style sheets
- `template/` — the project every film starts from (`scripts/new_project.py` scaffolds it)
- `evals/` — eval prompts and the grader; make the test song with
  `python evals/fixtures/make_test_song.py evals/fixtures`

Install: clone this repo as a folder named `mv-studio` in your skills folder, e.g. for Claude Code:
`git clone https://github.com/shxiao-archive/mv-pipeline.git ~/.claude/skills/mv-studio`.

Based on vocaloid-style-mv-pipeline (MIT); see `LICENSE`, `NOTICE.md` and `THIRD_PARTY_NOTICES.md`.
