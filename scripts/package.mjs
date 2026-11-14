#!/usr/bin/env node
// Zips skills/whiteboard into dist/whiteboard-<version>.zip: the upload format for Claude.ai,
// the Claude desktop app and skill marketplaces. The archive holds the whiteboard/ folder.
import { spawnSync } from 'node:child_process'
import { mkdirSync, readFileSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const { version } = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const dist = join(root, 'dist')
const zip = join(dist, `whiteboard-${version}.zip`)
mkdirSync(dist, { recursive: true })
rmSync(zip, { force: true })
const r = spawnSync('zip', ['-r', '-X', zip, 'whiteboard', '-x', '*.DS_Store'], { cwd: join(root, 'skills'), stdio: 'inherit' })
if (r.status !== 0) process.exit(r.status ?? 1)
console.log(`Wrote ${zip}`)
