# whiteboard-skill

A portable [Agent Skill](https://agentskills.io/specification) that draws Mermaid, D2 and
PlantUML diagrams rendered locally to SVG/PNG. It is also a Claude Code plugin and marketplace
(`whiteboard@whiteboard-skill`). Ported from the Claude Code-only whiteboard mod in
`kikostefanov-lab/claude-code-mods`.

## Layout

| Path | What |
|---|---|
| `skills/whiteboard/SKILL.md` | The skill: when to draw, workflow, script options, safety rules |
| `skills/whiteboard/scripts/render.mjs` | CLI: finds renderers, validates input, renders, saves with versions, doctor, share |
| `skills/whiteboard/scripts/mermaid-render.mjs` | Sandboxed Mermaid renderer (Puppeteer + Mermaid borrowed from the user's mermaid-cli) |
| `skills/whiteboard/references/` | `syntax.md` (an example of every diagram type, all rendered in CI), `modes.md` (architecture / flow / data model playbooks) |
| `scripts/` | `validate.mjs` (spec + versions), `smoke.mjs` (real renderers), `sandbox-check.mjs` (sandbox proof), `package.mjs` (release zip) |
| `test/` | `node:test` suite against fake renderers (`fake-renderer.mjs`) |

No runtime dependencies beyond Node 18+ and the renderer CLIs. Keep it that way.

## Commands

```bash
npm test                 # unit + CLI tests (fake renderers), runs everywhere incl. Windows
npm run validate         # SKILL.md spec, links, same version in all 5 places
npm run smoke -- --all   # every syntax.md example with real mmdc, d2, plantuml
npm run sandbox          # proves the Mermaid sandbox against real Chrome
```

All four must pass before a release. CI runs them on macOS, Linux and Windows (smoke and sandbox on Linux).

## Release

Bump the version in `package.json`, `.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`,
`SKILL.md` metadata and `VERSION` in `render.mjs` (validate checks they match), add a CHANGELOG
entry, push, wait for CI, then `git tag -a vX.Y.Z && git push origin vX.Y.Z`. The release
workflow attaches `whiteboard-X.Y.Z.zip`. Update the local install with
`claude plugin marketplace update whiteboard-skill && claude plugin update whiteboard@whiteboard-skill`.

## Security model — keep these invariants

Diagrams may be drawn from untrusted content (READMEs, issues), so no diagram may read local
files, environment variables or URLs into its output. Each of these came out of a security
review; don't loosen them without the same evidence:

- **Mermaid** renders only through `mermaid-render.mjs`: `about:blank` page, request
  interception aborting everything but `data:`, CSP `default-src 'none'`, closed-port proxy,
  `securityLevel: 'strict'` forced. No source pattern checks — the sandbox is the control, and
  `npm run sandbox` proves it with controls. Don't go back to spawning `mmdc` (its page is
  `file://`, so local images leak into PNGs).
- **PlantUML**: directive allowlist (`PLANTUML_ALLOWED`), refused built-ins and `<img:`, plus
  `PLANTUML_SECURITY_PROFILE=SANDBOX` (verified with PlantUML 1.2026.10).
- **D2**: `@` imports refused; PNG skipped when `hasD2External` matches; `--bundle=false` for SVG.
- Renderers run from an empty temp dir; outputs are written via temp file + rename and never
  through symlinks.
- `WHITEBOARD_ALLOW_INCLUDES=1` lifts all of it, only when the user asks.

## Status (2026-11-14)

- v1.1.1 released and installed locally from the marketplace (user scope); the old
  `mods/whiteboard` mod is no longer loaded. D2 0.9.0 and PlantUML 1.2026.10 are installed via
  Homebrew; mermaid-cli 12.0.0 via nvm's global npm.
- Verified: 35 tests, 28 smoke checks (24 Mermaid types incl. ZenUML, D2, PlantUML), 11 sandbox checks.

## Next session

Start here, in order of value:

1. **Agensi listing** (user action): upload `whiteboard-1.1.1.zip` from the v1.1.1 release.
2. **Plugin icon** before any directory submission: square PNG, 512–2048 px, at
   `.claude-plugin/icon.png` (`claude plugin validate .` warns without it; the listing icon is
   set only on first submission).
3. **Other agents**: install with `npx skills add kikostefanov-lab/whiteboard-skill` into Cursor,
   Copilot or Codex and draw one diagram; README deliberately doesn't list per-agent folders.
4. Known gaps in `mermaid-render.mjs`: the optional `layout: tidy-tree` loader is not registered
   (falls back to the default layout), and Iconify icon packs can't load in the sandbox (only
   built-in architecture icons work).
5. Optional: point the whiteboard section of `claude-code-mods`' README at this repo.

Any recent Claude model is fine for these; use the strongest available for further security work.
