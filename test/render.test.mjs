import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { chmodSync, copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { after, before, describe, test } from 'node:test'
import { fileURLToPath } from 'node:url'

import {
  byNewestVersion, cleanTitle, failureOf, fenceBlock, languageFrom, parseArgs, renderArgv, slug, stripFences, unsafeDirective, UsageError,
} from '../skills/whiteboard/scripts/render.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const SCRIPT = join(here, '..', 'skills', 'whiteboard', 'scripts', 'render.mjs')

describe('helpers', () => {
  test('slug', () => {
    assert.equal(slug('Checkout sequence'), 'checkout-sequence')
    assert.equal(slug('  Café / Über API!! '), 'cafe-uber-api')
    assert.equal(slug('***'), 'diagram')
    assert.ok(slug('x'.repeat(200)).length <= 60)
  })

  test('cleanTitle drops control characters and extra space', () => {
    assert.equal(cleanTitle(' a\n\tb\u0007  c '), 'a b c')
    assert.equal(cleanTitle(undefined), '')
  })

  test('stripFences keeps the language hint', () => {
    assert.deepEqual(stripFences('```d2\na -> b\n```\n'), { source: 'a -> b', hint: 'd2' })
    assert.deepEqual(stripFences('~~~\nflowchart TD\n~~~'), { source: 'flowchart TD', hint: '' })
    assert.deepEqual(stripFences('﻿  graph TD\n  A-->B  '), { source: 'graph TD\n  A-->B', hint: '' })
  })

  test('languageFrom: flag, fence, extension, content', () => {
    assert.equal(languageFrom({ flag: 'd2', source: '' }), 'd2')
    assert.equal(languageFrom({ flag: 'svg', source: '' }), null)
    assert.equal(languageFrom({ hint: 'plantuml', source: '' }), 'plantuml')
    assert.equal(languageFrom({ hint: 'puml', source: '' }), 'plantuml')
    assert.equal(languageFrom({ file: 'x/arch.D2', source: '' }), 'd2')
    assert.equal(languageFrom({ file: 'a.txt', source: '@startuml\nA->B\n@enduml' }), 'plantuml')
    assert.equal(languageFrom({ source: 'sequenceDiagram' }), 'mermaid')
  })

  test('fenceBlock outgrows backticks in the source', () => {
    assert.equal(fenceBlock('mermaid', 'A'), '```mermaid\nA\n```')
    assert.equal(fenceBlock('mermaid', 'note: ```'), '````mermaid\nnote: ```\n````')
  })

  test('failureOf drops the stack and classifies syntax errors', () => {
    const f = failureOf({ status: 1, stderr: 'Error: Parse error on line 2:\nx\n    at a (file:///b.js:1:1)\n    at c', stdout: '' })
    assert.equal(f.kind, 'syntax')
    assert.equal(f.message, 'Error: Parse error on line 2:\nx')
    assert.equal(failureOf({ status: 4, stderr: '', stdout: '' }).message, 'The renderer exited with code 4.')
    assert.equal(failureOf({ status: 1, stderr: 'chrome crashed', stdout: '' }).kind, 'failed')
  })

  test('renderArgv', () => {
    const base = { input: 'i.mmd', output: 'o.svg', dir: 'd', format: 'svg', theme: 'default', mermaidConfig: '', puppeteerConfig: '' }
    assert.deepEqual(renderArgv('mermaid', base), ['-i', 'i.mmd', '-o', 'o.svg', '-b', 'white', '-q', '--no-font-embed'])
    assert.deepEqual(renderArgv('mermaid', { ...base, theme: 'dark', mermaidConfig: 'c.json', puppeteerConfig: 'p.json' }),
      ['-i', 'i.mmd', '-o', 'o.svg', '-b', '#1e1e1e', '-q', '--no-font-embed', '-t', 'dark', '-c', 'c.json', '-p', 'p.json'])
    assert.ok(!renderArgv('mermaid', { ...base, format: 'png' }).includes('--no-font-embed'))
    assert.deepEqual(renderArgv('d2', { ...base, theme: 'dark' }), ['--theme=200', '--pad=24', '--bundle=false', 'i.mmd', 'o.svg'])
    assert.deepEqual(renderArgv('d2', { ...base, format: 'png', output: 'o.png' }), ['--pad=24', 'i.mmd', 'o.png'])
    assert.deepEqual(renderArgv('plantuml', { ...base, format: 'png' }), ['-tpng', '-o', 'd', 'i.mmd'])
  })

  test('parseArgs', () => {
    assert.deepEqual(parseArgs(['--title', 'A', '--png', '--out=x']), { title: 'A', png: true, out: 'x' })
    assert.throws(() => parseArgs(['--nope']), UsageError)
    assert.throws(() => parseArgs(['--title']), UsageError)
    assert.throws(() => parseArgs(['stray']), UsageError)
  })

  test('unsafeDirective finds includes that read files, env or URLs', () => {
    assert.equal(unsafeDirective('plantuml', '@startuml\n!include /etc/passwd\n@enduml'), '!include /etc/passwd')
    assert.equal(unsafeDirective('plantuml', '@startuml\n  !includeurl https://x/y\n@enduml'), '!includeurl https://x/y')
    assert.equal(unsafeDirective('plantuml', '@startuml\n!import foo\n@enduml'), '!import foo')
    assert.equal(unsafeDirective('plantuml', '@startuml\nA -> B : %getenv("AWS_SECRET")\n@enduml'), 'A -> B : %getenv("AWS_SECRET")')
    assert.equal(unsafeDirective('plantuml', '@startuml\n!include <C4/C4_Container>\nA -> B\n@enduml'), null)
    assert.equal(unsafeDirective('d2', 'a -> b\n...@../../secrets'), '...@../../secrets')
    assert.equal(unsafeDirective('d2', 'x: @other'), 'x: @other')
    assert.equal(unsafeDirective('d2', 'a -> b: email me@example.com'), null)
    assert.equal(unsafeDirective('mermaid', '!include /etc/passwd'), null)
  })

  test('unsafeDirective: bypasses found in review', () => {
    // A `#` earlier on the line, quoted and array imports.
    assert.equal(unsafeDirective('d2', 'a: "#"; ...@/abs/secrets'), 'a: "#"; ...@/abs/secrets')
    assert.equal(unsafeDirective('d2', 'x: "@/abs/file"'), 'x: "@/abs/file"')
    assert.equal(unsafeDirective('d2', 'vars: [@a; @b]'), 'vars: [@a; @b]')
    // PlantUML: only allowlisted directives; dynamic calls and image loads anywhere.
    assert.equal(unsafeDirective('plantuml', '@startuml\n!theme cerulean from /tmp/x\n@enduml'), '!theme cerulean from /tmp/x')
    assert.equal(unsafeDirective('plantuml', '@startuml\n!includedef foo\n@enduml'), '!includedef foo')
    assert.equal(unsafeDirective('plantuml', '@startuml\n!include <C4/C4_Container> x\n@enduml'), '!include <C4/C4_Container> x')
    assert.equal(unsafeDirective('plantuml', '@startuml\nA : %call_user_func("getenv", "HOME")\n@enduml'), 'A : %call_user_func("getenv", "HOME")')
    assert.equal(unsafeDirective('plantuml', '@startuml\nA : <img:/home/me/secret.png>\n@enduml'), 'A : <img:/home/me/secret.png>')
    for (const ok of ['!theme cerulean', '!$x = 1', '!define FOO bar', '!procedure $a()', '!endprocedure', '!if $x', '!endif', '!pragma layout smetana']) {
      assert.equal(unsafeDirective('plantuml', `@startuml\n${ok}\n@enduml`), null, ok)
    }
    // Mermaid image shapes and HTML images.
    assert.equal(unsafeDirective('mermaid', 'flowchart TD\n  A@{ img: "file:///etc/x.png" }'), 'A@{ img: "file:///etc/x.png" }')
    assert.equal(unsafeDirective('mermaid', 'flowchart TD\n  A["<img src=\'http://169.254.169.254/\'>"]'), 'A["<img src=\'http://169.254.169.254/\'>"]')
    assert.equal(unsafeDirective('mermaid', 'flowchart TD\n  A[an img: tag] --> B'), null)
  })

  test('byNewestVersion sorts nvm folders newest first', () => {
    assert.deepEqual(['v18.2.0', 'system', 'v22.10.1', 'v22.9.0'].sort(byNewestVersion), ['v22.10.1', 'v22.9.0', 'v18.2.0', 'system'])
  })
})

// The CLI tests run the script against fake renderers; Windows would need .cmd shims.
describe('cli', { skip: process.platform === 'win32' && 'POSIX fake renderers' }, () => {
  let root
  let bin
  let log
  let cwd

  before(() => {
    root = mkdtempSync(join(tmpdir(), 'whiteboard-test-'))
    bin = join(root, 'bin')
    mkdirSync(bin)
    for (const name of ['mmdc', 'd2', 'plantuml']) {
      copyFileSync(join(here, 'fake-renderer.mjs'), join(bin, name))
      chmodSync(join(bin, name), 0o755)
    }
    // The fakes have no .mjs extension; Node 18 needs this to load them as ES modules.
    writeFileSync(join(bin, 'package.json'), '{ "type": "module" }\n')
    log = join(root, 'calls.log')
  })
  after(() => rmSync(root, { recursive: true, force: true }))

  function cli(args, { input = '', env = {} } = {}) {
    const r = spawnSync(process.execPath, [SCRIPT, ...args], {
      cwd,
      input,
      encoding: 'utf8',
      env: {
        ...process.env,
        WHITEBOARD_MMDC: join(bin, 'mmdc'),
        WHITEBOARD_D2: join(bin, 'd2'),
        WHITEBOARD_PLANTUML: join(bin, 'plantuml'),
        WHITEBOARD_THEME: '',
        WHITEBOARD_MERMAID_CONFIG: '',
        FAKE_LOG: log,
        ...env,
      },
    })
    return { code: r.status, out: r.stdout, err: r.stderr }
  }

  function freshCwd() {
    cwd = mkdtempSync(join(root, 'cwd-'))
    writeFileSync(log, '')
    return cwd
  }

  test('renders Mermaid from stdin into diagrams/', () => {
    freshCwd()
    const r = cli(['--title', 'Checkout sequence'], { input: 'sequenceDiagram\n  A->>B: hi\n' })
    assert.equal(r.code, 0, r.err)
    assert.match(r.out, /Rendered "Checkout sequence" \(Mermaid\)/)
    assert.match(r.out, /diagrams\/checkout-sequence\.svg/)
    assert.match(readFileSync(join(cwd, 'diagrams', 'checkout-sequence.svg'), 'utf8'), /<svg/)
    assert.equal(readFileSync(join(cwd, 'diagrams', 'checkout-sequence.mmd'), 'utf8'), 'sequenceDiagram\n  A->>B: hi\n')
  })

  test('strips a pasted fence and uses its language', () => {
    freshCwd()
    const r = cli(['--title', 'Fenced', '--json'], { input: '```d2\na -> b\n```\n' })
    assert.equal(r.code, 0, r.err)
    const json = JSON.parse(r.out)
    assert.equal(json.language, 'd2')
    assert.equal(json.files.source, join('diagrams', 'fenced.d2'))
  })

  test('redrawing a title keeps the earlier version', () => {
    freshCwd()
    assert.equal(cli(['--title', 'Flow'], { input: 'flowchart TD\n A-->B' }).code, 0)
    const second = JSON.parse(cli(['--title', 'Flow', '--json'], { input: 'flowchart TD\n A-->C' }).out)
    assert.equal(second.version, 2)
    const v1 = join(cwd, 'diagrams', '.versions', 'flow', '1')
    assert.deepEqual(readdirSync(v1).sort(), ['flow.mmd', 'flow.svg'])
    assert.match(readFileSync(join(v1, 'flow.mmd'), 'utf8'), /A-->B/)
    assert.match(readFileSync(join(cwd, 'diagrams', 'flow.mmd'), 'utf8'), /A-->C/)
    // The same source again is a re-render, not a new version.
    const third = JSON.parse(cli(['--title', 'Flow', '--json'], { input: 'flowchart TD\n A-->C' }).out)
    assert.equal(third.version, 2)
    assert.deepEqual(readdirSync(join(cwd, 'diagrams', '.versions', 'flow')), ['1'])
  })

  test('a syntax error exits 1 with the message, no stack, and writes nothing', () => {
    freshCwd()
    const r = cli(['--title', 'Bad'], { input: 'sequenceDiagram\n BROKEN' })
    assert.equal(r.code, 1)
    assert.match(r.err, /Render failed \(syntax, Mermaid\)/)
    assert.match(r.err, /Parse error on line 2/)
    assert.doesNotMatch(r.err, /\bat Parser/)
    assert.match(r.err, /Fix the source and run again/)
    assert.equal(existsSync(join(cwd, 'diagrams')), false)
  })

  test('a failed render is JSON with --json', () => {
    freshCwd()
    const r = cli(['--title', 'Bad', '--language', 'd2', '--json'], { input: 'BROKEN' })
    assert.equal(r.code, 1)
    const json = JSON.parse(r.out)
    assert.equal(json.ok, false)
    assert.equal(json.kind, 'syntax')
    assert.match(json.message, /^err: failed to compile/)
  })

  test('PlantUML errors count even when it exits 0', () => {
    freshCwd()
    const r = cli(['--title', 'Bad', '--language', 'plantuml'], { input: '@startuml\nBROKEN\n@enduml' })
    assert.equal(r.code, 1)
    assert.match(r.err, /Error line 2/)
  })

  test('PlantUML errors drawn into the image count too (older PlantUML)', () => {
    freshCwd()
    const r = cli(['--title', 'Bad', '--language', 'plantuml'], { input: '@startuml\nQUIET_BROKEN\n@enduml' })
    assert.equal(r.code, 1)
    assert.match(r.err, /PlantUML reported a syntax error: Syntax Error\? line 2/)
    assert.equal(existsSync(join(cwd, 'diagrams')), false)
  })

  test('PlantUML runs in its SANDBOX security profile', () => {
    freshCwd()
    assert.equal(cli(['--title', 'S', '--language', 'plantuml'], { input: '@startuml\nA -> B\n@enduml' }).code, 0)
    assert.match(readFileSync(log, 'utf8'), /PLANTUML_SECURITY_PROFILE=SANDBOX/)
  })

  test('includes that read files or env are refused unless allowed', () => {
    freshCwd()
    const r = cli(['--title', 'Leak', '--language', 'plantuml', '--json'], { input: '@startuml\n!include ~/.ssh/id_rsa\n@enduml' })
    assert.equal(r.code, 1)
    assert.equal(JSON.parse(r.out).kind, 'blocked')
    assert.equal(readFileSync(log, 'utf8'), '', 'the renderer must not run')
    const d2 = cli(['--title', 'Leak', '--language', 'd2'], { input: '...@../../secrets' })
    assert.equal(d2.code, 1)
    assert.match(d2.err, /blocked/)
    const allowed = cli(['--title', 'Leak', '--language', 'plantuml'], {
      input: '@startuml\n!include shared.puml\n@enduml',
      env: { WHITEBOARD_ALLOW_INCLUDES: '1' },
    })
    assert.equal(allowed.code, 0, allowed.err)
    assert.match(readFileSync(log, 'utf8'), /PLANTUML_SECURITY_PROFILE=\n/)
  })

  test('D2 PNG is skipped when the source has icons; renderers run in the work folder', () => {
    freshCwd()
    const r = cli(['--title', 'Icons', '--language', 'd2', '--png', '--json'], { input: 'a: {icon: https://example.com/x.svg}' })
    assert.equal(r.code, 0, r.err)
    const json = JSON.parse(r.out)
    assert.equal(json.files.png, undefined)
    assert.match(json.warning, /PNG skipped/)
    assert.equal(readFileSync(log, 'utf8').split('\n').filter(l => l.startsWith('d2 ')).length, 1, 'only the SVG render ran')
    const allowed = JSON.parse(cli(['--title', 'Icons', '--language', 'd2', '--png', '--json'], {
      input: 'a: {icon: https://example.com/x.svg}',
      env: { WHITEBOARD_ALLOW_INCLUDES: '1' },
    }).out)
    assert.ok(allowed.files.png)
  })

  test('refuses to write through a symbolic link', { skip: process.platform === 'win32' }, () => {
    freshCwd()
    const outside = join(root, 'outside.txt')
    writeFileSync(outside, 'precious\n')
    mkdirSync(join(cwd, 'diagrams'))
    symlinkSync(outside, join(cwd, 'diagrams', 'flow.svg'))
    const r = cli(['--title', 'Flow'], { input: 'flowchart TD\n A-->B' })
    assert.equal(r.code, 2)
    assert.match(r.err, /symbolic link/)
    assert.equal(readFileSync(outside, 'utf8'), 'precious\n')
    rmSync(join(cwd, 'diagrams', 'flow.svg'))
    symlinkSync(root, join(cwd, 'diagrams', '.versions'))
    assert.equal(cli(['--title', 'Flow'], { input: 'flowchart TD\n A-->B' }).code, 2)
  })

  test('PlantUML from a .puml file', () => {
    freshCwd()
    const src = join(cwd, 'seq.puml')
    writeFileSync(src, '@startuml\nA -> B\n@enduml\n')
    const r = cli(['--title', 'Seq', '--file', src, '--png'])
    assert.equal(r.code, 0, r.err)
    assert.ok(existsSync(join(cwd, 'diagrams', 'seq.puml')))
    assert.ok(existsSync(join(cwd, 'diagrams', 'seq.svg')))
    assert.equal(readFileSync(join(cwd, 'diagrams', 'seq.png')).subarray(1, 4).toString(), 'PNG')
  })

  test('--check validates without writing', () => {
    freshCwd()
    const r = cli(['--title', 'Only check', '--check'], { input: 'flowchart TD\n A-->B' })
    assert.equal(r.code, 0, r.err)
    assert.match(r.out, /Nothing was written/)
    assert.equal(existsSync(join(cwd, 'diagrams')), false)
  })

  test('a source already at the output path is rendered in place', () => {
    freshCwd()
    mkdirSync(join(cwd, 'diagrams'))
    const src = join(cwd, 'diagrams', 'in-place.mmd')
    writeFileSync(src, 'flowchart TD\n A-->B\n')
    assert.equal(cli(['--title', 'In place', '--file', src]).code, 0)
    writeFileSync(src, 'flowchart TD\n A-->C\n')
    assert.equal(cli(['--title', 'In place', '--file', src]).code, 0)
    assert.equal(readFileSync(src, 'utf8'), 'flowchart TD\n A-->C\n')
    assert.equal(existsSync(join(cwd, 'diagrams', '.versions')), false)
  })

  test('--out and --theme reach the renderer', () => {
    freshCwd()
    const r = cli(['--title', 'Dark', '--theme', 'dark', '--out', 'docs/img'], { input: 'flowchart TD\n A-->B' })
    assert.equal(r.code, 0, r.err)
    assert.ok(existsSync(join(cwd, 'docs', 'img', 'dark.svg')))
    const call = readFileSync(log, 'utf8')
    assert.match(call, /"-t","dark"/)
    assert.match(call, /"-b","#1e1e1e"/)
  })

  test('a missing renderer exits 3 with the install command', () => {
    freshCwd()
    const pinned = cli(['--title', 'X', '--language', 'd2'], { input: 'a -> b', env: { WHITEBOARD_D2: join(root, 'nope') } })
    assert.equal(pinned.code, 3)
    assert.match(pinned.err, /WHITEBOARD_D2 is set to/)
    const unpinned = cli(['--title', 'X'], { input: 'flowchart TD', env: { WHITEBOARD_MMDC: '', PATH: join(root, 'empty'), WHITEBOARD_LOOKUP: 'path' } })
    assert.equal(unpinned.code, 3)
    assert.match(unpinned.err, /npm i -g @mermaid-js\/mermaid-cli/)
  })

  test('usage errors exit 2', () => {
    freshCwd()
    assert.equal(cli([], { input: 'flowchart TD' }).code, 2)
    assert.equal(cli(['--title', 'x'.repeat(81)], { input: 'flowchart TD' }).code, 2)
    assert.equal(cli(['--title', 'A', '--language', 'svg'], { input: 'flowchart TD' }).code, 2)
    assert.equal(cli(['--title', 'A', '--theme', 'pink'], { input: 'flowchart TD' }).code, 2)
    assert.equal(cli(['--title', 'A'], { input: '   ' }).code, 2)
    assert.equal(cli(['--title', 'A', '--file', 'missing.mmd']).code, 2)
    assert.equal(cli(['--help']).code, 0)
  })

  test('--doctor reports each renderer', () => {
    freshCwd()
    const r = cli(['--doctor', '--json'])
    assert.equal(r.code, 0, r.out + r.err)
    const { ok, checks } = JSON.parse(r.out)
    assert.equal(ok, true)
    assert.deepEqual(checks.filter(c => ['Mermaid', 'D2', 'PlantUML'].includes(c.label)).map(c => c.ok), [true, true, true])
  })
})
