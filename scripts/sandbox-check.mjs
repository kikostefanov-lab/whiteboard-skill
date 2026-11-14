#!/usr/bin/env node
// Proves the Mermaid sandbox with the real renderer.
//  - Network: a diagram that tries every way we know to load a resource (image shapes, <img>,
//    CSS url() through themeCSS) is rendered next to a local HTTP server. The renderer's request log
//    must show those loads attempted and blocked (the control: the diagram really does try),
//    and the server must receive nothing.
//  - Disk: an image shape pointing at a red PNG on disk must render exactly like one pointing
//    at a missing file. Control: the same image inlined as data: does change the pixels.
// Also renders one diagram end to end through render.mjs.
import { execFile } from 'node:child_process'
import { createServer } from 'node:http'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { deflateSync } from 'node:zlib'

import { findRenderer } from '../skills/whiteboard/scripts/render.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const scripts = join(root, 'skills', 'whiteboard', 'scripts')

// A solid red PNG, built by hand so the check needs no dependencies.
export function redPng(size = 40) {
  const table = Array.from({ length: 256 }, (_, n) => {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    return c >>> 0
  })
  const crc = buf => {
    let c = 0xffffffff
    for (const b of buf) c = table[(c ^ b) & 0xff] ^ (c >>> 8)
    return (c ^ 0xffffffff) >>> 0
  }
  const chunk = (type, data) => {
    const len = Buffer.alloc(4)
    len.writeUInt32BE(data.length)
    const body = Buffer.concat([Buffer.from(type), data])
    const sum = Buffer.alloc(4)
    sum.writeUInt32BE(crc(body))
    return Buffer.concat([len, body, sum])
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr.set([8, 2, 0, 0, 0], 8)
  const row = Buffer.concat([Buffer.from([0]), Buffer.alloc(size * 3, Buffer.from([255, 0, 0]))])
  const raw = Buffer.concat(Array.from({ length: size }, () => row))
  return Buffer.concat([Buffer.from('89504e470d0a1a0a', 'hex'), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))])
}

const run = (args, input = '') =>
  new Promise(done => {
    const child = execFile(process.execPath, args, { cwd: work }, (err, stdout, stderr) => done({ code: err ? err.code : 0, out: stdout, err: stderr }))
    child.stdin.end(input)
  })

const found = findRenderer('mermaid')
if (!found.path) {
  console.log(`FAIL mermaid: ${found.error}`)
  process.exit(1)
}

const work = mkdtempSync(join(tmpdir(), 'whiteboard-sandbox-'))
const helper = (input, output, extra = []) => run([join(scripts, 'mermaid-render.mjs'), '--cli', found.cliDir, '-i', input, '-o', output, ...extra,
  ...(process.env.WHITEBOARD_PUPPETEER_CONFIG ? ['--puppeteer', process.env.WHITEBOARD_PUPPETEER_CONFIG] : [])])

const hits = []
const server = createServer((req, res) => {
  hits.push(req.url)
  res.writeHead(200, { 'content-type': 'image/png' })
  res.end(redPng())
})
await new Promise(ok => server.listen(0, '127.0.0.1', ok))
const base = `http://127.0.0.1:${server.address().port}`

let failed = 0
const check = (ok, message) => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} sandbox: ${message}`)
  if (!ok) failed++
}

try {
  const network = join(work, 'network.mmd')
  writeFileSync(network, [
    `%%{init: {"themeCSS": ".node rect { fill: url(${base}/themecss.png) }"}}%%`,
    'flowchart TD',
    `  A@{ img: "${base}/shape.png", label: "shape", pos: "t", w: 60, h: 60, constraint: "off" }`,
    `  B["<img src='${base}/html.png' width='40'> html"]`,
    '  A --> B',
  ].join('\n'))
  for (const format of ['svg', 'png']) {
    const r = await helper(network, join(work, `network.${format}`), ['--log-requests'])
    const lines = r.err.split('\n')
    const blocked = lines.filter(l => l.startsWith(`blocked ${base}`))
    check(r.code === 0, `${format}: a diagram with remote resources still renders${r.code ? ` (${r.err.trim()})` : ''}`)
    check(blocked.length > 0 && !lines.some(l => l.startsWith(`allowed ${base}`)), `${format}: ${blocked.length} remote load(s) attempted, all blocked`)
    check(hits.length === 0, `${format}: the server received no requests (${hits.join(', ')})`)
  }
  // Control: with the sandbox off, the same diagram's loads do leave the page.
  const open = await helper(network, join(work, 'open.svg'), ['--log-requests', '--allow-external'])
  const attempted = open.err.split('\n').filter(l => l.startsWith(`allowed ${base}`))
  check(attempted.length > 0, `control: with the sandbox off, ${attempted.length} load(s) leave the page`)

  const red = join(work, 'red.png')
  writeFileSync(red, redPng())
  const shape = (name, src) => {
    const file = join(work, `${name}.mmd`)
    writeFileSync(file, `flowchart TD\n  A@{ img: "${src}", label: "img", pos: "t", w: 40, h: 40, constraint: "on" }`)
    return helper(file, join(work, `${name}.png`)).then(r => (r.code ? Buffer.from(`failed: ${r.err}`) : readFileSync(join(work, `${name}.png`))))
  }
  const disk = await shape('disk', pathToFileURL(red).href)
  const missing = await shape('missing', pathToFileURL(join(work, 'missing.png')).href)
  const inline = await shape('inline', `data:image/png;base64,${redPng().toString('base64')}`)
  check(disk.subarray(1, 4).toString() === 'PNG', 'a diagram with an image on disk still renders')
  check(disk.equals(missing), 'the image on disk does not reach the rendered PNG')
  check(!inline.equals(missing), 'control: the same image inlined as data: does change the PNG')

  const e2e = await run([join(scripts, 'render.mjs'), '--title', 'Sandbox end to end', '--png', '--json'], 'flowchart LR\n  A --> B')
  check(e2e.code === 0 && JSON.parse(e2e.out).files.png, 'render.mjs renders SVG and PNG through the sandboxed renderer')
} finally {
  server.close()
  rmSync(work, { recursive: true, force: true })
}

if (failed) {
  console.log(`\n${failed} sandbox check(s) failed`)
  process.exit(1)
}
