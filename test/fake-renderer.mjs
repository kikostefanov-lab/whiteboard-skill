#!/usr/bin/env node
// Stands in for mmdc, d2 and plantuml (chosen by the name it is installed under) so the tests
// run without real renderers. A source containing BROKEN fails the way each real CLI fails.
import { appendFileSync, readFileSync, writeFileSync } from 'node:fs'
import { basename, join } from 'node:path'

const name = basename(process.argv[1]).replace(/\.(cmd|mjs)$/, '')
const args = process.argv.slice(2)
if (process.env.FAKE_LOG) appendFileSync(process.env.FAKE_LOG, `${name} ${JSON.stringify(args)}\n`)

const SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10"/></svg>\n'
const PNG = Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex')
const write = (path, format) => writeFileSync(path, format === 'png' ? PNG : SVG)
const formatOf = path => (path.endsWith('.png') ? 'png' : 'svg')

if (name === 'mmdc') {
  const input = args[args.indexOf('-i') + 1]
  const output = args[args.indexOf('-o') + 1]
  const p = args.indexOf('-p')
  if (p !== -1 && process.env.FAKE_LOG) appendFileSync(process.env.FAKE_LOG, `puppeteer ${readFileSync(args[p + 1], 'utf8')}\n`)
  if (readFileSync(input, 'utf8').includes('BROKEN')) {
    process.stderr.write('Error: Parse error on line 2:\n...BROKEN\n---^\nExpecting \'ACTOR\', got \'NEWLINE\'\n    at Parser.parseError (file:///x/mermaid.js:1:1)\n    at run (file:///x/mmdc.js:2:2)\n')
    process.exit(1)
  }
  write(output, formatOf(output))
} else if (name === 'd2') {
  const [input, output] = args.slice(-2)
  if (readFileSync(input, 'utf8').includes('BROKEN')) {
    process.stderr.write(`err: failed to compile ${input}: 1:1: unexpected text\n`)
    process.exit(1)
  }
  write(output, formatOf(output))
} else if (name === 'plantuml') {
  const format = args.find(a => a.startsWith('-t')).slice(2)
  const dir = args[args.indexOf('-o') + 1]
  const input = args[args.length - 1]
  const out = join(dir, `${basename(input).replace(/\.[^.]+$/, '')}.${format}`)
  const text = readFileSync(input, 'utf8')
  if (process.env.FAKE_LOG) appendFileSync(process.env.FAKE_LOG, `plantuml-env PLANTUML_SECURITY_PROFILE=${process.env.PLANTUML_SECURITY_PROFILE ?? ''}\n`)
  // PlantUML exits 0 on a syntax error and draws the error into the image; newer versions
  // also print "Error line N", older ones only draw it.
  if (text.includes('QUIET_BROKEN')) writeFileSync(out, '<svg xmlns="http://www.w3.org/2000/svg"><text x="1" y="1">Syntax Error?</text><text x="1" y="2">line 2</text></svg>')
  else {
    write(out, format)
    if (text.includes('BROKEN')) process.stderr.write('Error line 2 in file: diagram.puml\nSome diagram description contains errors\n')
  }
} else {
  process.stderr.write(`fake renderer: unknown name ${name}\n`)
  process.exit(9)
}
