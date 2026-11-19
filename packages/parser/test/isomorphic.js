// Guards the package's portability: the published code must run unchanged on
// servers (Node, Deno, Bun, workerd) and in browsers and workers, so it may use
// only standard JavaScript. runtimes/ runs the conformance suite in each of
// those; this test catches regressions on every `tap` run.
import { test } from 'tap'
import { readFileSync, readdirSync } from 'node:fs'

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')
const lib = readdirSync(new URL('../lib/', import.meta.url)).filter((f) => f.endsWith('.js')).map((f) => `lib/${f}`)
const published = ['index.js', ...lib]

// Strip comments and string contents so prose and messages can't trip the checks.
const code = (src) => src
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/(^|[^:\\])\/\/.*$/gm, '$1')
  .replace(/'(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"|`(?:\\.|[^`\\])*`/g, "''")

const IMPORT = /\b(?:import|export)\s[^;]*?\sfrom\s*(['"])([^'"]+)\1|\bimport\s*\(\s*(['"])([^'"]+)\3/g

test('imports are relative ES module paths with extensions', (t) => {
  for (const file of published) {
    for (const m of read(file).matchAll(IMPORT)) {
      const spec = m[2] || m[4]
      t.match(spec, /^\.\.?\/.+\.js$/, `${file} imports ${spec}`)
    }
    t.notMatch(code(read(file)), /\brequire\s*\(/, `${file} has no require()`)
  }
  t.end()
})

test('no runtime-specific globals', (t) => {
  const NODE = ['Buffer', 'process', '__dirname', '__filename', 'global', 'setImmediate', 'module', 'exports']
  const DOM = ['window', 'document', 'navigator', 'localStorage', 'self']
  for (const file of published) {
    const src = code(read(file))
    for (const name of [...NODE, ...DOM]) {
      // A bare identifier, not a property (`x.process`) or object key (`process:`).
      t.notMatch(src, new RegExp(`(?<![.\\w$])${name}(?![\\w$:])`), `${file} does not use ${name}`)
    }
  }
  t.end()
})

test('every published module is reachable from index.js', (t) => {
  // Catches leftover files (scratch code, debug helpers) that would ship in
  // the tarball without being part of the API.
  const seen = new Set()
  const visit = (file) => {
    if (seen.has(file)) return
    seen.add(file)
    const dir = file.includes('/') ? file.slice(0, file.lastIndexOf('/') + 1) : ''
    for (const m of read(file).matchAll(IMPORT)) {
      const spec = m[2] || m[4]
      visit(new URL(spec, `file:///${dir}`).pathname.slice(1))
    }
  }
  visit('index.js')
  for (const file of published) t.ok(seen.has(file), `${file} is imported`)
  t.end()
})

test('loading the package has no side effects', (t) => {
  // package.json declares "sideEffects": false; top-level code must not log.
  for (const file of published) {
    const top = code(read(file)).split('\n').filter((l) => /^\S/.test(l))
    t.notOk(top.some((l) => /^console\./.test(l)), `${file} does not log on import`)
  }
  t.end()
})
