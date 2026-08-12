# semantic-versions

The reference parser for [**Semantic Versions**](https://semver.xyz): parse, validate,
compare and range-match version numbers, with build metadata that participates in
precedence.

[![npm](https://img.shields.io/npm/v/semantic-versions.svg)](https://www.npmjs.com/package/semantic-versions)
[![license](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](./LICENSE)
[![spec](https://img.shields.io/badge/spec-semver.xyz-111.svg)](https://semver.xyz)

This package implements the [Semantic Versions specification](https://semver.xyz/spec/)
and its published [BNF grammars](https://semver.xyz/grammar/). It is a spiritual
successor to Semantic Versioning 2.0.0-rc.1: a build restores its precedence and ranks
at or above its plain release, and sets, ranges and comparators are defined rather than
left to each tool.

## Install

```sh
vlt install semantic-versions
```

It also installs with npm, pnpm or yarn:

```sh
npm install semantic-versions
```

## Usage

```js
import {
  parse,
  valid,
  satisfies,
  compare,
  validRange,
  Range,
} from 'semantic-versions'

parse('1.2.3-beta.4+build.7')      // Version { major: 1, minor: 2, patch: 3, ... }

valid('1.2.3')                     // '1.2.3'
valid('v1.2.3')                    // null  (no coercion)

satisfies('1.4.0', '^1.2.3')       // true
satisfies('1.0.0-rc.1', '^1.0.0-rc') // true   (pre-release channel)
satisfies('1.0.0-beta', '^1.0.0-rc') // false  (different channel)

compare('1.0.0', '1.0.0+build.1')  // -1  (build participates in precedence)

validRange('~>1.2')                // '>=1.2.0 <1.3.0-0'
new Range('1.2.7 || >=1.2.9 <2.0.0').test('1.4.6') // true
```

## How this differs from `semver`

This is not a drop-in replacement for [`node-semver`](https://github.com/npm/node-semver).
The behaviour follows [semver.xyz](https://semver.xyz) rather than semver.org:

- **Build metadata participates in precedence.** A build ranks *above* its plain
  release (`1.0.0 < 1.0.0+build.1`) instead of being discarded, and a build on a
  comparator acts as a [channel filter](https://semver.xyz/spec/#build-channels)
  (`^1.0.0+win`).
- **Pre-releases are range-driven.** A pre-release on a comparator is a
  [prefix channel](https://semver.xyz/spec/#prerelease-channels) scoped to its tuple
  (`^1.0.0-rc` admits `rc.*`, never `beta`). There is no `includePrerelease` option;
  wildcards `-*` and `*-*` opt in explicitly.
- **No coercion.** `v1.2.3` fails to parse; `1.2.3` is fine. Coerce before parsing if
  you need loose input.
- **No loose mode**, and no CLI. Run the tool through `vlx semantic-versions` if you
  want a one-off command.
- **No runtime dependencies.**

## API

Every function accepts version and range strings; parsing helpers also accept a
`Version` or `Range` instance.

### Classes

- `Version` — a parsed version. Exposes `major`, `minor`, `patch`, `prerelease`,
  `build`, `version`, and `compare(other)`.
- `Range` — a parsed range. `test(version)` checks membership; `range` is the desugared
  comparator string; `intersects(otherRange)` checks overlap.
- `Comparator` — a single operator + version primitive.

### Parsing & inspection

- `parse(version)` — returns a `Version`, or `null` if invalid.
- `valid(version)` — returns the normalized version string, or `null`.
- `validRange(range)` — returns the desugared range string, or `null`.
- `major(v)` / `minor(v)` / `patch(v)` — return the numeric component.
- `prerelease(v)` — returns the pre-release identifiers, or `null`.
- `build(v)` — returns the build identifiers, or `null`.
- `diff(v1, v2)` — returns the release type that changed (`major`, `minor`, `patch`,
  `premajor`, `preminor`, `prepatch`, `prerelease`), or `null` if equal.
- `increment(v, release, identifier?, identifierBase?)` — returns `v` bumped by the
  given release type, or `null`.

### Comparison

- `compare(v1, v2)` — `-1`, `0` or `1`. Sorts ascending with `Array.sort`.
- `cmp(v1, operator, v2)` — compares using an operator string (`>`, `>=`, `<`, `<=`,
  `=`, `!=`).
- `eq` · `neq` · `gt` · `gte` · `lt` · `lte` — boolean comparisons between two versions.

### Ranges & sets

- `satisfies(version, range)` — true if the version matches the range.
- `maxSatisfying(versions, range)` / `minSatisfying(versions, range)` — the highest or
  lowest matching version.
- `highest(versions, range)` / `lowest(versions, range)` — the highest or lowest matching
  version in a list.
- `minimum(range)` — the lowest version that can match the range.
- `outside(version, range, hilo)` — true if the version falls outside the range on the
  `'>'` or `'<'` side. `gtr` and `ltr` are the two directions.
- `intersects(r1, r2)` — true if two ranges or comparators overlap.
- `subset(sub, sup)` — true if `sub` is entirely contained by `sup`.
- `simplify(versions, range)` — a shorter range that selects the same members of
  `versions`.
- `sort(versions)` / `rsort(versions)` — sort ascending or descending by precedence.

## Grammar

The version, range and comparator grammars this parser implements are published as BNF
at [semver.xyz/grammar](https://semver.xyz/grammar/), so anyone can build a compatible
library.

## License

[Apache License 2.0](./LICENSE). The specification text at
[semver.xyz](https://semver.xyz) is licensed separately under
[CC BY 3.0](https://semver.xyz/license/).
