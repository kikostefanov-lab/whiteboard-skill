#!/usr/bin/env node
// Checks every skills/*/SKILL.md against the Agent Skills specification (https://agentskills.io/specification),
// that relative links resolve, and that the version is the same in every manifest.
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const problems = []
const fail = (where, message) => problems.push(`${where}: ${message}`)

// The frontmatter subset the spec uses: `key: value` lines, and one level of nested map (metadata).
function frontmatter(text) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/.exec(text)
  if (!m) return null
  const data = {}
  let map = null
  for (const line of m[1].split(/\r?\n/)) {
    if (!line.trim() || line.trim().startsWith('#')) continue
    const nested = /^\s+([\w-]+):\s*(.*)$/.exec(line)
    const top = /^([\w-]+):\s*(.*)$/.exec(line)
    const unquote = v => v.replace(/^(['"])(.*)\1$/, '$2')
    if (nested && map) map[nested[1]] = unquote(nested[2])
    else if (top) {
      if (top[2] === '') data[top[1]] = map = {}
      else {
        data[top[1]] = unquote(top[2])
        map = null
      }
    } else return { error: `cannot read frontmatter line: ${line}` }
  }
  return { data, body: m[2] }
}

const versions = new Map()
const skillsDir = join(root, 'skills')
for (const dir of readdirSync(skillsDir, { withFileTypes: true }).filter(d => d.isDirectory())) {
  const where = `skills/${dir.name}/SKILL.md`
  const file = join(skillsDir, dir.name, 'SKILL.md')
  if (!existsSync(file)) {
    fail(where, 'missing')
    continue
  }
  const parsed = frontmatter(readFileSync(file, 'utf8'))
  if (!parsed || parsed.error) {
    fail(where, parsed?.error ?? 'no YAML frontmatter')
    continue
  }
  const { data, body } = parsed
  const allowed = new Set(['name', 'description', 'license', 'compatibility', 'metadata', 'allowed-tools'])
  for (const key of Object.keys(data)) if (!allowed.has(key)) fail(where, `unknown frontmatter field "${key}"`)
  const name = data.name ?? ''
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(name) || name.length > 64) fail(where, `invalid name "${name}"`)
  if (name !== dir.name) fail(where, `name "${name}" must match its folder "${dir.name}"`)
  const description = data.description ?? ''
  if (description.length < 1 || description.length > 1024) fail(where, `description is ${description.length} characters (1-1024)`)
  if (data.compatibility !== undefined && (data.compatibility.length < 1 || data.compatibility.length > 500)) {
    fail(where, `compatibility is ${data.compatibility.length} characters (1-500)`)
  }
  if (data.metadata !== undefined && typeof data.metadata !== 'object') fail(where, 'metadata must be a map')
  const lines = body.split('\n').length
  if (lines > 500) fail(where, `body is ${lines} lines; keep it under 500`)
  for (const [, target] of body.matchAll(/\]\(((?!https?:|#|mailto:)[^)\s]+)\)/g)) {
    if (!existsSync(join(skillsDir, dir.name, target.split('#')[0]))) fail(where, `broken link ${target}`)
  }
  if (data.metadata?.version) versions.set(where, data.metadata.version)
}

const plugin = JSON.parse(readFileSync(join(root, '.claude-plugin', 'plugin.json'), 'utf8'))
const market = JSON.parse(readFileSync(join(root, '.claude-plugin', 'marketplace.json'), 'utf8'))
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const script = readFileSync(join(skillsDir, 'whiteboard', 'scripts', 'render.mjs'), 'utf8')
versions.set('.claude-plugin/plugin.json', plugin.version)
for (const p of market.plugins) versions.set(`.claude-plugin/marketplace.json (${p.name})`, p.version)
versions.set('package.json', pkg.version)
versions.set('render.mjs VERSION', /export const VERSION = '([^']+)'/.exec(script)?.[1])
if (new Set(versions.values()).size !== 1) {
  fail('versions', `differ: ${[...versions].map(([k, v]) => `${k}=${v}`).join(', ')}`)
}

if (problems.length) {
  console.error(problems.map(p => `✗ ${p}`).join('\n'))
  process.exit(1)
}
console.log(`✓ skills valid, version ${pkg.version} everywhere`)
