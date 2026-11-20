import { test } from 'tap'
import {
  parse,
  valid,
  validRange,
  major,
  minor,
  patch,
  prerelease,
  build,
  diff,
  compare,
  satisfies,
  highest,
  lowest,
  maxSatisfying,
  minSatisfying,
  sort,
  rsort,
} from '../index.js'

test('parse & valid', t => {
  t.equal(valid('1.2.3'), '1.2.3', 'normalizes a valid version')
  t.equal(valid('v1.2.3'), null, 'no coercion: leading v is invalid')
  t.equal(valid('nope'), null, 'garbage is invalid')
  t.equal(parse('1.2.3').version, '1.2.3', 'parse returns a Version')
  t.equal(parse('nope'), null, 'parse returns null on invalid input')
  t.end()
})

test('accessors', t => {
  t.equal(major('4.5.6'), 4)
  t.equal(minor('4.5.6'), 5)
  t.equal(patch('4.5.6'), 6)
  t.same(prerelease('1.2.3-beta.4'), ['beta', 4], 'prerelease identifiers')
  t.equal(prerelease('1.2.3'), null, 'no prerelease returns null')
  t.same(build('1.2.3+exp.sha.5114f85'), ['exp', 'sha', '5114f85'], 'build identifiers')
  t.equal(build('1.2.3'), null, 'no build returns null')
  t.end()
})

test('diff', t => {
  t.equal(diff('1.2.3', '2.0.0'), 'major')
  t.equal(diff('1.2.3', '1.3.0'), 'minor')
  t.equal(diff('1.2.3', '1.2.4'), 'patch')
  t.equal(diff('1.2.3', '1.2.3'), null, 'equal versions differ by nothing')
  t.end()
})

test('build participates in precedence', t => {
  t.equal(compare('1.0.0', '1.0.0+build.1'), -1, 'a build ranks above its plain release')
  t.equal(compare('1.0.0+build.1', '1.0.0'), 1)
  t.equal(compare('1.0.0+build.1', '1.0.0+build.2'), -1, 'builds order against each other')
  t.end()
})

test('ranges & channels', t => {
  t.equal(validRange('~>1.2'), '>=1.2.0 <2.0.0-0', 'approximate operator keeps its RubyGems meaning')
  t.equal(validRange('~>1.2.3'), '>=1.2.3 <1.3.0-0', 'three parts: the same as a tilde')
  t.equal(validRange('~> 1.2'), '>=1.2.0 <2.0.0-0', 'whitespace after ~> is tolerated')
  t.equal(validRange('1.2.3+win - 2.0.0'), '>=1.2.3+win <=2.0.0', 'a hyphen endpoint keeps its build channel')
  t.equal(compare('1.0.0+1', '1.0.0+001'), -1, 'a leading-zero build identifier compares as text')
  t.ok(satisfies('1.4.0', '^1.2.3'))
  t.notOk(satisfies('2.0.0', '^1.2.3'))
  t.ok(satisfies('1.0.0-rc.1', '^1.0.0-rc'), 'pre-release channel admits its own train')
  t.notOk(satisfies('1.0.0-beta', '^1.0.0-rc'), 'a different channel is excluded')
  t.notOk(satisfies('1.0.0-rc.1', '^1.0.0'), 'stable range excludes pre-releases')
  t.end()
})

test('list helpers', t => {
  const versions = ['1.0.0', '1.2.0', '1.9.0', '2.0.0']
  t.equal(highest(versions, '^1.0.0'), '1.9.0')
  t.equal(lowest(versions, '^1.0.0'), '1.0.0')
  t.equal(maxSatisfying(versions, '^1.0.0'), '1.9.0')
  t.equal(minSatisfying(versions, '^1.0.0'), '1.0.0')
  t.same(sort(['2.0.0', '1.0.0', '1.5.0']), ['1.0.0', '1.5.0', '2.0.0'])
  t.same(rsort(['1.0.0', '2.0.0', '1.5.0']), ['2.0.0', '1.5.0', '1.0.0'])
  t.end()
})
