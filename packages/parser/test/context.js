import { test } from 'tap'
import { Version, Range, splitReference, satisfies, maxSatisfying } from '../index.js'

test('splitReference', t => {
  t.same(splitReference('1.2.3'), { context: null, rest: '1.2.3' },
    'a bare version has no context')
  t.same(splitReference('npm:react@1.2.3'), { context: 'npm:react', rest: '1.2.3' },
    'source-qualified context')
  t.same(splitReference('react@1.2.3'), { context: 'react', rest: '1.2.3' },
    'bare-name context')
  t.same(splitReference('npm:@babel/core@7.24.0'),
    { context: 'npm:@babel/core', rest: '7.24.0' },
    'scoped npm name keeps its leading @ in the context')
  t.same(splitReference('go:golang.org/x/text@0.14.0'),
    { context: 'go:golang.org/x/text', rest: '0.14.0' },
    'path-like context')
  t.same(splitReference('npm:react@>=1.2.0 <2.0.0'),
    { context: 'npm:react', rest: '>=1.2.0 <2.0.0' },
    'context strips off a multi-comparator range body')
  t.same(splitReference('1.0.0 - 2.0.0'), { context: null, rest: '1.0.0 - 2.0.0' },
    'a hyphen range without a context is untouched')
  t.same(splitReference('npm:react@1.0.0 - 2.0.0'),
    { context: 'npm:react', rest: '1.0.0 - 2.0.0' },
    'context in front of a hyphen range')
  t.end()
})

test('Version exposes context without affecting the core', t => {
  const v = new Version('npm:react@1.2.3-beta.4+build.7')
  t.equal(v.context, 'npm:react', 'context is parsed off')
  t.equal(v.version, '1.2.3-beta.4+build.7', 'version stays bare')
  t.equal(v.raw, '1.2.3-beta.4+build.7', 'raw stays bare')
  t.equal(v.reference, 'npm:react@1.2.3-beta.4+build.7', 'reference re-joins context')
  t.same(v.build, ['build', '7'], 'build still parses')

  const bare = new Version('1.2.3')
  t.equal(bare.context, null, 'no context on a bare version')
  t.equal(bare.reference, '1.2.3', 'reference equals version when contextless')
  t.end()
})

test('context does not participate in precedence', t => {
  const a = new Version('npm:react@1.0.0')
  const b = new Version('cargo:serde@1.0.0')
  const c = new Version('1.0.0')
  t.equal(a.compare(b), 0, 'same number, different context: equal precedence')
  t.equal(a.compare(c), 0, 'context vs no context, same number: equal precedence')
  t.equal(new Version('npm:react@1.0.0').compare(new Version('npm:react@2.0.0')), -1,
    'numeric precedence is unchanged')
  t.end()
})

test('a context-scoped range forms a contextual set', t => {
  const r = new Range('npm:react@^1.2.3')
  t.equal(r.context, 'npm:react', 'range carries its context')
  t.equal(r.range, '>=1.2.3 <2.0.0-0', 'range body desugars on the bare version-space')

  t.ok(r.test(new Version('npm:react@1.2.5')), 'same context, in range: matches')
  t.notOk(r.test(new Version('npm:react@2.0.0')), 'same context, out of range: no match')
  t.notOk(r.test(new Version('cargo:serde@1.2.5')),
    'different context, in numeric range: excluded')
  t.notOk(r.test(new Version('1.2.5')),
    'no context on the version, contextual range: excluded')
  t.end()
})

test('an unqualified range stays context-agnostic', t => {
  const r = new Range('^1.2.3')
  t.equal(r.context, null, 'no context on a bare range')
  t.ok(r.test(new Version('npm:react@1.2.5')),
    'a bare range matches a context-qualified version on its number')
  t.ok(r.test(new Version('1.2.5')), 'and matches a bare version')
  t.end()
})

test('context flows through satisfies and maxSatisfying', t => {
  t.ok(satisfies('npm:react@1.2.5', 'npm:react@^1.2.3'), 'satisfies honors context')
  t.notOk(satisfies('cargo:serde@1.2.5', 'npm:react@^1.2.3'),
    'satisfies excludes a foreign context')
  const versions = ['npm:react@1.2.3', 'npm:react@1.9.0', 'cargo:serde@1.9.9', 'npm:react@2.0.0']
  t.equal(maxSatisfying(versions, 'npm:react@^1.2.3'), 'npm:react@1.9.0',
    'maxSatisfying stays within the context and picks the highest')
  t.end()
})
