# Whiteboard

**An agent skill that draws real diagrams.** Ask your coding agent for an architecture overview, a
sequence diagram of a request, the class structure of a module or the database schema. It writes
Mermaid, D2 or PlantUML, renders it **locally** to SVG (and PNG), and fixes the source itself
when the renderer reports a syntax error.

It follows the open [Agent Skills](https://agentskills.io) format, so the same folder works in
Claude Code, Codex, Cursor, GitHub Copilot, Gemini CLI and other agents that read `SKILL.md`
skills.

```
> draw the checkout flow as a sequence diagram

  Read src/checkout/*.ts
  $ node .../whiteboard/scripts/render.mjs --title "Checkout sequence" <<'EOF' ...
  Render failed (syntax, Mermaid): Parse error on line 7 ...
  $ node .../whiteboard/scripts/render.mjs --title "Checkout sequence" <<'EOF' ...
  Rendered "Checkout sequence" (Mermaid)
    source diagrams/checkout-sequence.mmd
    svg    diagrams/checkout-sequence.svg
```

## What you get

- **Every common diagram type**: flowcharts and C4-style architecture, sequence, class, state,
  ER, gantt and mind maps in Mermaid; large nested architecture in D2; PlantUML when your
  team already uses it.
- **Checked before you see it.** The bundled script renders before the agent answers. A parse
  error goes back to the agent with the line number, and the agent fixes it and renders again.
- **Files you keep**: `diagrams/<title>.svg` plus the source next to it, ready to commit or paste
  into a README. GitHub, GitLab and Notion render the Mermaid source directly.
- **Versions**: redrawing a title moves the earlier files to `diagrams/.versions/<title>/<n>/`.
- **Playbooks for project diagrams**: architecture, control flow and data model, each starting
  from the real code with its real names.
- **Local and private.** Nothing is uploaded. `--share` (a secret GitHub gist) runs only when
  you ask for it.
- **Safe with untrusted input.** The agent may draw from READMEs or issues it didn't write.
  So anything that reads files, environment variables or URLs into the image is refused
  unless `WHITEBOARD_ALLOW_INCLUDES=1` is set: PlantUML directives outside an allowlist,
  `%getenv` and similar built-ins, `<img:…>`, D2 `@` imports and Mermaid images. PlantUML
  also runs in its `SANDBOX` security profile (newer versions), Mermaid's browser has
  networking turned off, every renderer runs from an
  empty temporary folder, and D2 images stay links in SVGs. The script never writes
  through a symbolic link.
- **No dependencies** beyond Node 18+ and the renderer CLIs. Works on macOS, Linux and Windows.

## Install

### 1. A renderer

Mermaid is required; D2 and PlantUML are optional.

```bash
npm i -g @mermaid-js/mermaid-cli
```

```bash
brew install d2 plantuml
```

### 2. The skill

**Any agent**, with the [`skills` CLI](https://github.com/vercel-labs/skills). It asks which
agents you use and installs into each one's skills folder:

```bash
npx skills add kikostefanov-lab/whiteboard-skill
```

**Claude Code**, as a plugin:

```
/plugin marketplace add kikostefanov-lab/whiteboard-skill
/plugin install whiteboard@whiteboard-skill
```

**Claude.ai and the Claude desktop app**: download `whiteboard-<version>.zip` from
[Releases](https://github.com/kikostefanov-lab/whiteboard-skill/releases) and upload it under
*Settings → Capabilities → Skills*. Rendering needs a machine with the renderer installed. In a
hosted sandbox without `mmdc`, the skill falls back to giving you the Mermaid source.

**By hand**: copy [`skills/whiteboard`](skills/whiteboard) into your agent's skills folder, for
example `~/.claude/skills/whiteboard` (Claude Code) or `.agents/skills/whiteboard` (the shared
project folder several agents read).

Check the setup any time:

```bash
node ~/.claude/skills/whiteboard/scripts/render.mjs --doctor
```

## Use it

Just ask: *"diagram the architecture of this repo"*, *"show the login flow as a sequence
diagram"*, *"draw the data model"*, *"make a state diagram of an order's lifecycle"*,
*"redo that diagram left to right, as a PNG too"*.

The script also works on its own:

```bash
node skills/whiteboard/scripts/render.mjs --title "Auth flow" --file auth.mmd --png --open
```

| Option | |
|---|---|
| `--title <text>` | Required; names the output files |
| `--file <path>` | Source file (otherwise stdin) |
| `--language` | `mermaid` (default), `d2`, `plantuml` (guessed from the file extension or a ```` ```d2 ```` fence) |
| `--out <dir>` | Output folder, default `diagrams` |
| `--png` | Also write a PNG |
| `--theme` | `default`, `neutral`, `dark`, `forest` (or `WHITEBOARD_THEME`) |
| `--config <file>` | Mermaid JSON config for team colours (or `WHITEBOARD_MERMAID_CONFIG`) |
| `--check` | Validate only |
| `--open` | Open the SVG in your default viewer |
| `--share` | Secret GitHub gist via the `gh` CLI |
| `--json` | JSON output |
| `--doctor` | Check renderers and setup |

If a renderer is installed but not found (desktop apps often start without your shell's
`PATH`), set `WHITEBOARD_MMDC`, `WHITEBOARD_D2` or `WHITEBOARD_PLANTUML` to its full path.

## Relationship to the Claude Code whiteboard mod

[claude-code-mods](https://github.com/kikostefanov-lab/claude-code-mods) has a Claude Code-only
*mod* with a live whiteboard pane, history buttons and in-pane editing. It's built on Claude
Code's early-access mods API. This repository is the portable version: the same drawing and
rendering as a standard skill, without the pane, for any agent.

## Development

```bash
npm test          # unit and CLI tests against fake renderers
npm run validate  # SKILL.md against the Agent Skills spec, links, versions
npm run smoke     # renders every example in references/syntax.md with the real renderers
npm run package   # dist/whiteboard-<version>.zip
```

To release, bump the version in `package.json`, `.claude-plugin/*.json`, `SKILL.md` metadata
and `render.mjs` (`npm run validate` checks they match), then push a `v<version>` tag. The
release workflow attaches the zip.

## License

[MIT](LICENSE)
