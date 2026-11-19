import { test } from 'tap'
import { Range } from '../lib/range.js'
import { includes, excludes } from './fixtures/ranges.js'

const key = (r, v) => `${r} :: ${v}`

// These require `{ loose: true }` parsing (e.g. `1.2.3pre`, `1.0.3alpha`), which
// this strict implementation intentionally does not accept.
const needsLoose = new Set([
  key('1.2.3pre+asdf - 2.4.3-pre+asdf', '1.2.3'),
  key('1.2.3-pre+asdf - 2.4.3pre+asdf', '1.2.3'),
  key('1.2.3pre+asdf - 2.4.3pre+asdf', '1.2.3'),
  key('~ 1.0.3alpha', '1.0.12')
])

// Semantic Versions intentionally diverges from node-semver here: build
// metadata on a `~`/`^`/comparator is a *channel filter*, not ignored. So a
// caret carrying a build channel no longer matches build-less versions — these
// node-semver "includes" are now (correctly) non-matches.
const divergesBuildChannel = new Set([
  key('^1.2.3+build', '1.2.3'),
  key('^1.2.3+build', '1.3.0')
])

// Pre-release channels are the other deliberate divergence. Node-semver admits a
// pre-release when *any* comparator names *any* pre-release on the same tuple
// (and offers a global `includePrerelease` flag). Semantic Versions instead
// treats a comparator's pre-release as a prefix *channel*: only pre-releases
// beginning with those identifiers, on that exact tuple, are admitted. So these
// node-semver "includes" become non-matches — the pre-release is either on a
// tuple no comparator names, or in a different channel than the one declared.
// Opt in explicitly with `X.Y.Z-*` (a tuple's whole channel) or `*-*` (all).
const divergesPrereleaseChannel = new Set([
  // Different channel than the one the caret declares (alpha vs pre/beta).
  key('1.2.3-pre+asdf - 2.4.3-pre+asdf', '2.4.3-alpha'),
  key('^1.2.3-alpha', '1.2.3-pre'),
  key('^1.2.0-alpha', '1.2.0-pre'),
  key('^0.0.1-alpha', '0.0.1-beta'),
  key('^0.1.1-alpha', '0.1.1-beta'),
  // No comparator names a pre-release on the candidate's tuple (formerly only
  // matched under `{ includePrerelease: true }`).
  key('2.x', '2.0.0-pre.0'),
  key('2.x', '2.1.0-pre.0'),
  key('1.1.x', '1.1.0-a'),
  key('1.1.x', '1.1.1-a'),
  key('*', '1.0.0-rc1'),
  key('^1.0.0-0', '1.0.1-rc1'),
  key('^1.0.0-rc2', '1.0.1-rc1'),
  key('^1.0.0', '1.0.1-rc1'),
  key('^1.0.0', '1.1.0-rc1'),
  key('1 - 2', '2.0.0-pre'),
  key('1 - 2', '1.0.0-pre'),
  key('1.0 - 2', '1.0.0-pre'),
  key('=0.7.x', '0.7.0-asdf'),
  key('>=0.7.x', '0.7.0-asdf'),
  key('<=0.7.x', '0.7.0-asdf'),
  key('>=1.0.0 <=1.1.0', '1.1.0-pre')
])

const satisfies = (version, range) => {
  try {
    return new Range(range).test(version)
  } catch (er) {
    return false
  }
}

test('range includes', (t) => {
  for (const [range, version] of includes) {
    const k = key(range, version)
    if (needsLoose.has(k)) {
      t.skip(`${k} (loose mode not supported)`)
      continue
    }
    if (divergesBuildChannel.has(k)) {
      t.notOk(satisfies(version, range), `${version} is NOT in the build channel ${range}`)
      continue
    }
    if (divergesPrereleaseChannel.has(k)) {
      t.notOk(satisfies(version, range), `${version} is NOT in the pre-release channel ${range}`)
      continue
    }
    t.ok(satisfies(version, range), `${version} satisfies ${range}`)
  }
  t.end()
})

test('range excludes', (t) => {
  for (const [range, version] of excludes) {
    t.notOk(satisfies(version, range), `${version} does not satisfy ${range}`)
  }
  t.end()
})

// Build metadata as a channel/variant filter (a Semantic Versions extension to
// range grammar). Build sorts at/above its plain release, so a build-less range
// still includes build variants, while a build channel narrows to that variant.
test('build channels', (t) => {
  // Caret carrying a channel: numeric range AND build begins with the channel.
  t.ok(satisfies('1.0.0+win.x64', '^1.0.0+win'), 'win build in caret channel')
  t.ok(satisfies('1.2.0+win.x64', '^1.0.0+win'), 'later win build in caret channel')
  t.notOk(satisfies('1.0.0+linux.x64', '^1.0.0+win'), 'other channel excluded')
  t.notOk(satisfies('1.0.0', '^1.0.0+win'), 'build-less version excluded from a channel')
  t.notOk(satisfies('2.0.0+win.x64', '^1.0.0+win'), 'out of numeric range excluded')

  // A build-less range includes build variants (build ranks >= plain release).
  t.ok(satisfies('1.0.0+win.x64', '>=1.0.0'), 'build variant satisfies build-less range')
  t.ok(satisfies('1.0.0', '>=1.0.0'), 'plain release still satisfies')

  // Comparator + exact channel, and narrowing.
  t.ok(satisfies('1.0.0+linux.x64', '1.0.0+linux.x64'), 'exact build channel')
  t.notOk(satisfies('1.0.0+linux.arm64', '1.0.0+linux.x64'), 'sibling build excluded')
  t.ok(satisfies('1.0.0+win.x64', '>=1.0.0+win'), 'broad win channel')
  t.notOk(satisfies('1.0.0+win.x64', '>=1.0.0+win.arm'), 'narrower channel excludes x64')

  // Tilde carries a channel too.
  t.ok(satisfies('1.2.9+win.x64', '~1.2.3+win'), 'tilde channel match')
  t.notOk(satisfies('1.2.9+linux.x64', '~1.2.3+win'), 'tilde channel mismatch')
  t.end()
})

// Pre-release channels: a pre-release named on a comparator is a prefix filter
// scoped to that comparator's tuple, symmetric with build channels. Explicit
// wildcards (`X.Y.Z-*`, `*-*`) replace the old include-prereleases toggle.
test('prerelease channels', (t) => {
  // Named channel: prefix match on the caret's own tuple.
  t.ok(satisfies('1.0.0-rc', '^1.0.0-rc'), 'bare channel name matches')
  t.ok(satisfies('1.0.0-rc.1', '^1.0.0-rc'), 'rc.1 in the rc channel')
  t.ok(satisfies('1.0.0-rc.2', '^1.0.0-rc'), 'rc.2 in the rc channel')
  t.ok(satisfies('1.0.0', '^1.0.0-rc'), 'stable still satisfies a channel range')
  t.ok(satisfies('1.5.0', '^1.0.0-rc'), 'later stable still satisfies')
  t.notOk(satisfies('1.0.0-beta', '^1.0.0-rc'), 'a different channel is excluded')
  t.notOk(satisfies('1.0.0-rd', '^1.0.0-rc'), 'a non-prefix sibling is excluded')

  // Channels never leak across tuples.
  t.notOk(satisfies('1.5.0-rc', '^1.0.0-rc'), 'another tuple\'s pre-release is excluded')

  // A deeper prefix scopes to that sub-tree.
  t.ok(satisfies('1.0.0-rc.2.1', '^1.0.0-rc.2'), 'rc.2.x in the rc.2 sub-channel')
  t.notOk(satisfies('1.0.0-rc.3', '^1.0.0-rc.2'), 'rc.3 is outside the rc.2 sub-channel')

  // Default (no pre-release token anywhere): stable only.
  t.notOk(satisfies('1.0.0-rc', '^1.0.0'), 'stable-only range excludes pre-releases')
  t.notOk(satisfies('1.2.0-beta', '^1.0.0'), 'stable-only range excludes later pre-releases')

  // Empty-prefix wildcard: any pre-release of that one tuple.
  t.ok(satisfies('1.0.0-rc.1', '^1.0.0-*'), 'X.Y.Z-* admits an rc')
  t.ok(satisfies('1.0.0-beta', '^1.0.0-*'), 'X.Y.Z-* admits a beta')
  t.ok(satisfies('1.0.0-0', '^1.0.0-*'), 'X.Y.Z-* admits the -0 boundary')
  t.ok(satisfies('1.0.0', '^1.0.0-*'), 'X.Y.Z-* still admits stable')
  t.ok(satisfies('1.4.0', '^1.0.0-*'), 'X.Y.Z-* still admits later stable')
  t.notOk(satisfies('1.5.0-beta', '^1.0.0-*'), 'X.Y.Z-* does not leak to another tuple')
  t.ok(satisfies('1.2.3-anything', '~1.2.3-*'), 'tilde tuple wildcard admits any pre-release')

  // Universal wildcard: every tuple opts in (the toggle replacement).
  t.ok(satisfies('1.0.0-rc.1', '*-*'), '*-* admits any pre-release')
  t.ok(satisfies('1.5.0-beta', '*-*'), '*-* admits a pre-release on any tuple')
  t.ok(satisfies('0.0.0-0', '*-*'), '*-* admits the lowest pre-release')
  t.ok(satisfies('2.3.4', '*-*'), '*-* admits stable too')

  // Universal wildcard combined with a numeric bound.
  t.ok(satisfies('1.5.0-beta', '*-* <2.0.0'), 'bounded *-* admits an in-range pre-release')
  t.notOk(satisfies('2.5.0-beta', '*-* <2.0.0'), 'bounded *-* still respects the ceiling')
  t.end()
})
