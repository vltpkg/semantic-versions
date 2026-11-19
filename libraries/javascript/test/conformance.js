// Runs the shared, language-neutral conformance suite (../../../conformance) —
// the same cases the Rust crate runs.
import { test } from 'tap'
import { readFileSync } from 'node:fs'
import { parse, compare, satisfies, validRange } from '../index.js'

const load = (name) =>
  JSON.parse(readFileSync(new URL(`../../../conformance/${name}.json`, import.meta.url), 'utf8')).cases

test('versions', (t) => {
  for (const c of load('versions')) {
    const v = parse(c.input)
    if (c.valid) {
      t.ok(v, `${c.input} is a version`)
      t.equal(v && v.version, c.version, `${c.input} normalizes to ${c.version}`)
      if (c.context) t.equal(v && v.context, c.context, `${c.input} has context ${c.context}`)
    } else {
      t.equal(v, null, `${c.input} is not a version`)
    }
  }
  t.end()
})

test('precedence', (t) => {
  for (const c of load('precedence')) {
    t.equal(Math.sign(compare(c.a, c.b)), c.expected, `compare(${c.a}, ${c.b})`)
  }
  t.end()
})

test('ranges', (t) => {
  for (const c of load('ranges')) {
    t.equal(satisfies(c.version, c.range), c.expected, `${c.version} ${c.expected ? 'satisfies' : 'does not satisfy'} ${c.range}`)
  }
  t.end()
})

test('desugar', (t) => {
  for (const c of load('desugar')) {
    const got = validRange(c.input)
    t.ok(got === c.output || (c.accept || []).includes(got), `${c.input} desugars to ${c.output} (got ${got})`)
  }
  t.end()
})
