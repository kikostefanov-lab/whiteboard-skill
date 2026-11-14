#!/usr/bin/env node
// Renders every example in references/syntax.md with the real renderers that are installed,
// plus one broken diagram per renderer to check that its error is recognised.
// Fails when Mermaid is missing; D2 and PlantUML are skipped when absent unless --all is passed.
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { findRenderer } from '../skills/whiteboard/scripts/render.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const script = join(root, 'skills', 'whiteboard', 'scripts', 'render.mjs')
const requireAll = process.argv.includes('--all')
const syntax = readFileSync(join(root, 'skills', 'whiteboard', 'references', 'syntax.md'), 'utf8')
const examples = [...syntax.matchAll(/^```(mermaid|d2|plantuml)\n([\s\S]*?)^```$/gm)].map(([, language, source]) => ({ language, source }))
const BROKEN = { mermaid: 'sequenceDiagram\n  Alice-->>\n', d2: 'a -> {\n', plantuml: '@startuml\nA -> B : ok\nthis is ((( not plantuml\n@enduml\n' }

const work = mkdtempSync(join(tmpdir(), 'whiteboard-smoke-'))
let failed = 0
const render = (language, source, title) => {
  const file = join(work, 'in.txt')
  writeFileSync(file, source)
  return spawnSync(process.execPath, [script, '--title', title, '--language', language, '--file', file, '--check'], { encoding: 'utf8', cwd: work })
}

try {
  for (const language of ['mermaid', 'd2', 'plantuml']) {
    if (!findRenderer(language).path) {
      const required = language === 'mermaid' || requireAll
      console.log(`${required ? 'FAIL' : 'skip'} ${language}: not installed`)
      if (required) failed++
      continue
    }
    for (const [i, { source }] of examples.filter(e => e.language === language).entries()) {
      const r = render(language, source, `${language} ${i + 1}`)
      const label = source.split('\n')[0]
      if (r.status === 0) console.log(`ok   ${language}: ${label}`)
      else {
        failed++
        console.log(`FAIL ${language}: ${label}\n${r.stderr}`)
      }
    }
    const bad = render(language, BROKEN[language], `${language} broken`)
    if (bad.status === 1 && /Render failed/.test(bad.stderr)) console.log(`ok   ${language}: broken source rejected (${/\((\w+),/.exec(bad.stderr)?.[1]})`)
    else {
      failed++
      console.log(`FAIL ${language}: broken source exited ${bad.status}\n${bad.stdout}${bad.stderr}`)
    }
  }
} finally {
  rmSync(work, { recursive: true, force: true })
}
if (failed) {
  console.log(`\n${failed} failure(s)`)
  process.exit(1)
}
