// Runs the shared conformance suite through the public API, using nothing but
// standard JavaScript, so the same file runs on servers (Node, Deno, Bun),
// in browsers and in workers. Each harness loads the JSON its own way and
// passes it in.
import * as sv from '../index.js'

export function check ({ versions, precedence, ranges, desugar }) {
  const failures = []
  let total = 0
  const expect = (ok, message) => {
    total++
    if (!ok) failures.push(message)
  }
  for (const c of versions.cases) {
    const v = sv.parse(c.input)
    if (c.valid) {
      expect(v !== null && v.version === c.version, `parse ${c.input}`)
      if (c.context) expect(v !== null && v.context === c.context, `context ${c.input}`)
    } else {
      expect(v === null, `rejects ${c.input}`)
    }
  }
  for (const c of precedence.cases) {
    expect(Math.sign(sv.compare(c.a, c.b)) === c.expected, `compare ${c.a} ${c.b}`)
  }
  for (const c of ranges.cases) {
    expect(sv.satisfies(c.version, c.range) === c.expected, `satisfies ${c.version} ${c.range}`)
  }
  for (const c of desugar.cases) {
    const got = sv.validRange(c.input)
    expect(got === c.output || (c.accept || []).includes(got), `desugar ${c.input}`)
  }
  // A few helpers that build and sort lists, beyond the per-case functions.
  expect(sv.maxSatisfying(['1.0.0', '1.9.0', '2.0.0'], '^1') === '1.9.0', 'maxSatisfying')
  expect(sv.sort(['2.0.0', '1.0.0+b', '1.0.0']).join() === '1.0.0,1.0.0+b,2.0.0', 'sort')
  return { total, failures }
}

export const SUITES = ['versions', 'precedence', 'ranges', 'desugar']
