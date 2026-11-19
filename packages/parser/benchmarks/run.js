// Benchmarks `semantic-versions` against `semver` (node-semver) on real-world
// inputs, and scores both against the shared Semantic Versions conformance
// suite. Writes ../../benchmarks/results/javascript.json; run
// `node ../../benchmarks/report.mjs` afterwards to refresh the README tables.
//
//   vlt run bench            (from packages/parser)

import { readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import os from 'node:os'
import { fileURLToPath } from 'node:url'
import * as sv from '../index.js'
import semver from 'semver'

const require = createRequire(import.meta.url)
const root = (p) => fileURLToPath(new URL(`../../../${p}`, import.meta.url))
const corpus = JSON.parse(readFileSync(root('benchmarks/corpus.json'), 'utf8'))
const quick = process.argv.includes('--quick')

const LIBS = {
  'semantic-versions': {
    version: JSON.parse(readFileSync(new URL('../package.json', import.meta.url))).version,
    parse: (v) => sv.parse(v),
    valid: (v) => sv.valid(v),
    compare: (a, b) => sv.compare(a, b),
    sort: (l) => sv.sort(l),
    validRange: (r) => sv.validRange(r),
    satisfies: (v, r) => sv.satisfies(v, r),
    maxSatisfying: (l, r) => sv.maxSatisfying(l, r),
    context: true,
  },
  semver: {
    version: require('semver/package.json').version,
    // node-semver keeps the build in `.build` but leaves it out of `.version`;
    // put it back so the grammar is scored on what was parsed, not on
    // formatting. (Build *semantics* are scored by the build categories.)
    parse: (v) => {
      const p = semver.parse(v)
      if (p && p.build.length) {
        return { ...p, version: `${p.version}+${p.build.join('.')}` }
      }
      return p
    },
    valid: (v) => semver.valid(v),
    compare: (a, b) => semver.compare(a, b),
    sort: (l) => semver.sort(l),
    validRange: (r) => semver.validRange(r),
    satisfies: (v, r) => semver.satisfies(v, r),
    maxSatisfying: (l, r) => semver.maxSatisfying(l, r),
    context: false,
  },
}

// ---------------------------------------------------------------- harness
let sink = 0
const keep = (x) => { sink = (sink + (x ? 1 : 0)) | 0 }
const now = () => Number(process.hrtime.bigint())

// Runs `fn` (which performs `ops` operations) repeatedly for ~`ms` per sample
// and returns the median nanoseconds per operation.
const measure = (fn, ops) => {
  const sampleMs = quick ? 60 : 250
  const samples = quick ? 5 : 15
  const until = now() + 200e6
  while (now() < until) fn()
  const results = []
  for (let s = 0; s < samples; s++) {
    let calls = 0
    const start = now()
    const end = start + sampleMs * 1e6
    let t = start
    while (t < end) { fn(); calls++; t = now() }
    results.push((t - start) / (calls * ops))
  }
  results.sort((a, b) => a - b)
  return results[Math.floor(results.length / 2)]
}

// ---------------------------------------------------------------- workloads
const versions = corpus.versions
// Ranges every library accepts, so speed is compared on identical work.
const ranges = corpus.ranges.filter((r) => Object.values(LIBS).every((l) => l.validRange(r) !== null))
const resolutions = corpus.resolutions.filter(([, r]) => ranges.includes(r))
const pairs = resolutions.flatMap(([name, r]) => corpus.packages[name].map((v) => [v, r]))

const tasks = [
  { id: 'parse', label: 'Parse a version', description: `${versions.length.toLocaleString()} published versions`, ops: versions.length, run: (l) => () => { for (const v of versions) keep(l.parse(v)) } },
  { id: 'sort', label: 'Sort versions', description: `${versions.length.toLocaleString()} versions by precedence (per version)`, ops: versions.length, run: (l) => () => keep(l.sort(versions.slice()).length) },
  { id: 'range', label: 'Parse a range', description: `${ranges.length.toLocaleString()} real dependency ranges`, ops: ranges.length, run: (l) => () => { for (const r of ranges) keep(l.validRange(r)) } },
  { id: 'satisfies', label: 'satisfies(version, range)', description: `${pairs.length.toLocaleString()} version × range checks`, ops: pairs.length, run: (l) => () => { for (const [v, r] of pairs) keep(l.satisfies(v, r)) } },
  { id: 'resolve', label: 'Resolve a range', description: `${resolutions.length.toLocaleString()} maxSatisfying lookups against a package's versions`, ops: resolutions.length, run: (l) => () => { for (const [name, r] of resolutions) keep(l.maxSatisfying(corpus.packages[name], r)) } },
]

// ------------------------------------------------------------- conformance
const load = (n) => JSON.parse(readFileSync(root(`conformance/${n}.json`), 'utf8')).cases
const tryOr = (fn, d) => { try { return fn() } catch { return d } }
const checks = {
  versions: (l, c) => {
    const p = tryOr(() => l.parse(c.input), null)
    if (!c.valid) return p === null
    return !!p && p.version === c.version && (c.context ? p.context === c.context : true)
  },
  precedence: (l, c) => tryOr(() => Math.sign(l.compare(c.a, c.b)), null) === c.expected,
  ranges: (l, c) => tryOr(() => l.satisfies(c.version, c.range), null) === c.expected,
  desugar: (l, c) => { const r = tryOr(() => l.validRange(c.input), null); return r === c.output || (c.accept || []).includes(r) },
}
const conformance = {}
for (const [name, lib] of Object.entries(LIBS)) {
  const byCategory = {}
  for (const file of Object.keys(checks)) {
    for (const c of load(file)) {
      const cat = (byCategory[c.category] ??= { passed: 0, total: 0 })
      cat.total++
      if (checks[file](lib, c)) cat.passed++
    }
  }
  conformance[name] = byCategory
}

// ----------------------------------------------------------------- coverage
const coverage = {}
for (const [name, lib] of Object.entries(LIBS)) {
  coverage[name] = {
    versions: corpus.versions.filter((v) => lib.valid(v) !== null).length,
    ranges: corpus.ranges.filter((r) => lib.validRange(r) !== null).length,
  }
}

// ------------------------------------------------------------------- run
const results = []
for (const task of tasks) {
  const row = { id: task.id, label: task.label, description: task.description, results: {} }
  for (const [name, lib] of Object.entries(LIBS)) {
    const ns = measure(task.run(lib), task.ops)
    row.results[name] = { nsPerOp: Math.round(ns * 10) / 10, opsPerSec: Math.round(1e9 / ns) }
    process.stderr.write(`${task.id.padEnd(10)} ${name.padEnd(18)} ${ns.toFixed(1).padStart(9)} ns/op\n`)
  }
  results.push(row)
}

const out = {
  language: 'JavaScript',
  subject: 'semantic-versions',
  baseline: 'semver',
  environment: {
    runtime: `Node.js ${process.versions.node}`,
    cpu: os.cpus()[0]?.model?.trim() ?? 'unknown',
    platform: `${os.platform()} ${os.arch()}`,
    date: new Date().toISOString().slice(0, 10),
  },
  libraries: Object.fromEntries(Object.entries(LIBS).map(([n, l]) => [n, { version: l.version }])),
  corpus: { versions: corpus.versions.length, ranges: corpus.ranges.length, comparableRanges: ranges.length, fetched: corpus.fetched },
  coverage,
  tasks: results,
  conformance,
}
if (!quick) writeFileSync(root('benchmarks/results/javascript.json'), JSON.stringify(out, null, 2) + '\n')
console.log(JSON.stringify({ conformance, coverage }, null, 1))
if (sink === 42) console.log('')
