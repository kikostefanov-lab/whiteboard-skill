---
name: whiteboard
description: Draws diagrams as real rendered images: architecture and C4-style overviews, flowcharts, sequence, class, state and ER diagrams, gantt charts, mind maps. Writes Mermaid, D2 or PlantUML source, renders it locally to SVG (and PNG) with a bundled script, and fixes syntax errors the renderer reports. Use when the user asks for a diagram, chart, UML, visual or picture of code, a system, a data model or a process, or when a diagram would explain a design better than prose.
license: MIT
compatibility: Needs Node.js 18+ and a shell. Mermaid diagrams need @mermaid-js/mermaid-cli (mmdc); D2 and PlantUML are optional. Rendering is local; nothing is uploaded unless the user asks to share.
metadata:
  author: Kiko Stefanov
  version: "1.0.0"
  repository: https://github.com/kikostefanov-lab/whiteboard-skill
---

# Whiteboard

Turn an explanation into a diagram the user can see, keep and paste anywhere. You write the
diagram source; `scripts/render.mjs` renders it with the user's locally installed CLI and tells
you exactly what is wrong when it does not parse.

## Workflow

1. **Pick the diagram type and language.** Default to Mermaid. Use D2 for large architecture
   diagrams with nested containers, PlantUML only when the user asks for it or the project
   already uses it. See [references/syntax.md](references/syntax.md) for each type's syntax.
2. **Read before drawing.** When the diagram describes code, read the code first. Draw what
   exists, with real names, not a generic picture. For whole-project requests (architecture,
   control flow, data model) follow [references/modes.md](references/modes.md).
3. **Write the source and render it.** Pipe it on stdin with a short title (at most 80
   characters). The title names the files, so reuse it when you redraw the same diagram:

   ```bash
   node <skill-dir>/scripts/render.mjs --title "Checkout sequence" <<'EOF'
   sequenceDiagram
     Browser->>API: POST /checkout
     API->>Payments: charge(card)
     Payments-->>API: ok
     API-->>Browser: 201 Created
   EOF
   ```

   `<skill-dir>` is the folder this file is in. Add `--language d2` or `--language plantuml`
   for those languages. On Windows, or when heredocs are awkward, write the source to a
   temporary file and pass `--file <path>` instead.
4. **Fix and rerun on failure.** Exit code 1 means the renderer rejected the source; the
   message names the line. Fix that line and run the same command again. Do not hand the
   user a diagram that did not render. Common fixes are listed at the end of
   [references/syntax.md](references/syntax.md).
5. **Report back briefly.** Say what the diagram shows and give the file paths the script
   printed (for example `diagrams/checkout-sequence.svg`). If the user wants to paste it into
   a README, issue or wiki, give the source in a fenced ```mermaid block: GitHub, GitLab and
   Notion render it.

## Script reference

| Option | Use |
|---|---|
| `--title <text>` | Required. Names the files: `diagrams/<slug>.svg` and the source next to it. |
| `--language <name>` | `mermaid` (default), `d2` or `plantuml`. |
| `--file <path>` | Read the source from a file instead of stdin. |
| `--out <dir>` | Output folder; default `diagrams` in the current folder. |
| `--png` | Also write a PNG (slides, chat apps, terminals that show images). |
| `--theme <name>` | `default`, `neutral`, `dark` or `forest`. |
| `--config <file>` | A Mermaid JSON config, for team colours and fonts. |
| `--check` | Validate only; writes nothing. |
| `--open` | Open the SVG in the user's default viewer. Use it when the user wants to see the diagram now. |
| `--share` | Upload the source to a **secret** GitHub gist and print the link. Run it only after the user asked to share and agreed to the upload. |
| `--json` | Machine-readable result. |
| `--doctor` | Checks Node, each renderer and the GitHub CLI, and says what to install. |

Exit codes: `0` rendered, `1` source rejected (fix it and rerun), `2` bad arguments,
`3` renderer not installed.

PlantUML `!include`/`!import`/`%getenv` and D2 `@` imports are refused, because they read
local files, environment variables or URLs into the image. Inline the content instead.
PlantUML's bundled library (`!include <C4/C4_Container>`) still works. Only if the user
explicitly wants file includes, rerun with `WHITEBOARD_ALLOW_INCLUDES=1`.

Redrawing with the same title keeps the earlier files in `diagrams/.versions/<slug>/<n>/`, so
iterating on a diagram never loses the previous version.

## When a renderer is missing

Exit code 3 prints the install command. Tell the user what to run and do not install global
packages yourself unless they ask:

- Mermaid: `npm i -g @mermaid-js/mermaid-cli`
- D2: `brew install d2`, or see https://d2lang.com/tour/install
- PlantUML: `brew install plantuml` or `apt install plantuml` (needs Java)

If a renderer is installed but not found (common in desktop apps that start without the
login shell's PATH), set `WHITEBOARD_MMDC`, `WHITEBOARD_D2` or `WHITEBOARD_PLANTUML` to its
full path. When nothing can be installed, give the Mermaid source in a fenced block so it
still renders on GitHub, and say it was not checked by a renderer.

## Good diagrams

- One idea per diagram. Split anything over about 15 nodes or 20 messages into an overview
  plus detail diagrams.
- Label every edge with what flows or happens (`HTTP`, `publishes OrderPlaced`, `1..*`).
- Use the names from the code: class, module and service names, real endpoints, real tables.
- Choose the type that matches the question: who calls whom over time → sequence;
  what the parts are → architecture/flowchart; what the data looks like → ER or class;
  how something changes over time → state.
- Keep text short inside nodes; put detail in edge labels or notes.
