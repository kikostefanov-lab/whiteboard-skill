# Changelog

## 1.0.4 — 2026-11-14

- Mermaid: any backslash is refused, so CSS, JSON and YAML escapes in styles, `%%{init}%%`
  directives or frontmatter cannot disguise a resource load. Use `<br>` for line breaks.
- Mermaid: CSS image functions that load without `url()` (`image-set(`, `cross-fade(`,
  `image(`, `element(`, `src(`) and `@font-face` are refused.

## 1.0.3 — 2026-11-14

- Mermaid: HTML in labels is an allowlist (`<br>`, `<b>`, `<i>`, `<u>`, `<em>`, `<strong>`,
  `<sub>`, `<sup>`, `<small>`, `<code>`, `<span>`, `<p>`, `<hr>`) and no tag may carry `src`,
  `srcset`, `poster`, `href`, `data`, `background` or `style` attributes. Backslashes in
  `style`/`classDef`/`linkStyle` lines (CSS escapes) are refused. This covers local image
  files, which the offline browser could still load from disk.
- D2: PNG export is skipped for any block string whatever its delimiter, any HTML tag or
  entity, backslash escapes and any URL-like text.

## 1.0.2 — 2026-11-14

- Mermaid renders in a headless browser with networking turned off (every http(s) request,
  loopback included, goes to a closed proxy port), so nothing in a diagram can reach the
  network. Your `WHITEBOARD_PUPPETEER_CONFIG` is merged in. Also refused: `<image>`, `url(…)`,
  `@import`, `themeCSS` and any `img` key in a shape.
- D2 PNG export is skipped for markdown or HTML blocks, images and any URL or file
  reference, not only icons; the SVG keeps them as links.

## 1.0.1 — 2026-11-14

Stricter protection against diagrams that read files, environment variables or URLs into
the image, after a security review of 1.0.0:

- PlantUML: only an allowlist of preprocessor directives is accepted (`!define`, `!if`,
  `!procedure`, `!$var`, `!theme <name>`, `!include <stdlib>` …), so `!theme … from`,
  `!includedef` and future file directives are refused too. `%call_user_func`, `<img:…>`
  and the file and environment built-ins are refused. This also protects older PlantUML
  versions that ignore the `SANDBOX` profile.
- D2: `@` imports are found anywhere on a line, quoted or in arrays. Diagrams with `icon:`
  render to SVG only, because D2's PNG export would fetch or read the icons.
- Mermaid: `<img>` and image shapes (`@{ img: … }`) are refused.
- Every renderer runs from the empty temporary folder, so relative paths resolve to nothing.

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
