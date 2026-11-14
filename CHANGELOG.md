# Changelog

## 1.0.0 — 2026-11-14

First release as a standalone Agent Skill, ported from the Claude Code whiteboard mod
(claude-code-mods 0.2.0).

- `whiteboard` skill: when to draw, how to pick a diagram type, and playbooks for
  architecture, control flow and data model diagrams.
- `scripts/render.mjs`: renders Mermaid, D2 and PlantUML to SVG and PNG with the local CLIs,
  returns parse errors without stack traces, keeps earlier versions, `--check`, `--open`,
  `--share` (secret gist), `--json` and `--doctor`. Finds renderers through PATH, the login
  shell, nvm and Homebrew, or `WHITEBOARD_*` variables.
- Safe with untrusted input: PlantUML runs with `PLANTUML_SECURITY_PROFILE=SANDBOX`; file, URL
  and environment includes are refused unless `WHITEBOARD_ALLOW_INCLUDES=1`; D2 leaves icon
  URLs unfetched; output files are written through temp files and never through symbolic links.
- Recognises PlantUML syntax errors that older versions only draw into the image.
- Syntax reference with examples of every Mermaid diagram type, D2 and PlantUML, all rendered
  in CI.
- Claude Code plugin and marketplace manifests; release zip for Claude.ai and skill marketplaces.
