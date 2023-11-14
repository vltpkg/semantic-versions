
<img src="https://github.com/darcyclarke/octofiles/assets/459713/8ee74129-34e6-4bd4-8686-82954f424709" width="85" />

## Semantic Versions

##### Parsing, validating & comparing Semantic Versions

`semver.xyz`

## FAQ

##### What are the differences between `Semantic Versioning - 2.0.0`?

##### What are the differences between `npm`'s `semver`?

- `x%` faster
- build metadata is respected
- no dependencies
- bug fixes: `...`
- methods removed: `...`
- methods renamed: `...`
- no coercion
- comparing prereleases is not optional
  - note: if you want this, pre-prune the set of versions
- loose comparison is not optional (ex. `v1` will fail to parse but `1` is fine - ref. https://semver.org/#is-v123-a-semantic-version)
  - note: if you want this, coerce your versions prior to comparison
- no CLI implementation
  - note: if you want this, run `vlxf semantic-versions ...` 

### Usage

```js
import { 
  parse,
  valid,
  major,
  minor,
  patch,
  prerelease,
  build,
  diff,
  cmp,
  eq,
  neq,
  lt,
  lte,
  gt,
  gte
  valid,
  simplify,
  compare,
  subset,
  minimum,
  lowest,
  highest,
  intersects,
  increment,
  satisfies,
  sort,
  rsort,
  outside,
  ltr,
  gtr
} from 'semantic-versions'
```

## Definitions

### Versions

A "version" is described by the Semantic Version `2.0.0` specification found at <https://semver.org/>.

### Ranges

A `range` is a set of `comparators` which specify versions
that satisfy the range.

> [!WARNING] 
> Ranges are non-standard & can vary across tools & ecosystems

### Operators

A `operator` is a character or set of characters which express how to compare a version.

Supported operators are:

* `<` Less than
* `>` Greater than
* `=` Equal to
* `<=` Less than or equal to
* `>=` Greater than or equal to

> [!WARNING] 
> Operators beyond `<`, `>` & `=` are non-standard & can vary across tools & ecosystems

### Comparator 

A `comparator` is composed of an `operator` & a `version`. Comparators can be joined by whitespace to form a `comparator set`, which is satisfied by the **intersection** of all of the comparators it includes.

> [!WARNING]
> Comparators are non-standard & can vary across tools & ecosystems

#### Examples

- `>=1.2.7` 
  - matches versions `1.2.7`, `1.2.8`, `2.5.3`, & `1.3.9`
  - does not match versions `1.2.6` or `1.1.0`
- `>1`
  - is equivalent to `>=2.0.0`
  - matches versions `2.0.0` & `3.1.0`
  - does not match versions `1.0.1` or `1.1.0`

A range is composed of one or more comparator sets, joined by `||`.  A
version matches a range if and only if every comparator in at least
one of the `||`-separated comparator sets is satisfied by the version.

For example, the range `>=1.2.7 <1.3.0` would match the versions
`1.2.7`, `1.2.8`, and `1.2.99`, but not the versions `1.2.6`, `1.3.0`,
or `1.1.0`.

The range `1.2.7 || >=1.2.9 <2.0.0` would match the versions `1.2.7`,
`1.2.9`, and `1.4.6`, but not the versions `1.2.8` or `2.0.0`.

> TODO: Remove "Prerelease Identifier Base"

#### Prerelease Identifiers

```javascript
increment('1.2.3', 'prerelease', 'beta')
// '1.2.4-beta.0'
```

##### Old
```javascript

increment('1.2.3', 'prerelease', 'beta', '1')
// '1.2.4-beta.1'
```

```javascript
increment('1.2.3', 'prerelease', 'beta', false)
// '1.2.4-beta'
```
---

##### New

```javascript
increment('1.2.3-beta', 'prerelease')
// '1.2.4-beta.1'
```

```javascript
increment('1.2.3-beta.0', 'prerelease')
// '1.2.4-beta.1'
```

### Advanced Range Syntax

Advanced range syntax desugars to primitive comparators in
deterministic ways.

Advanced ranges may be combined in the same way as primitive
comparators using white space or `||`.

#### Hyphen Ranges `X.Y.Z - A.B.C`

Specifies an inclusive set.

* `1.2.3 - 2.3.4` := `>=1.2.3 <=2.3.4`

If a partial version is provided as the first version in the inclusive
range, then the missing pieces are replaced with zeroes.

* `1.2 - 2.3.4` := `>=1.2.0 <=2.3.4`

If a partial version is provided as the second version in the
inclusive range, then all versions that start with the supplied parts
of the tuple are accepted, but nothing that would be greater than the
provided tuple parts.

* `1.2.3 - 2.3` := `>=1.2.3 <2.4.0-0`
* `1.2.3 - 2` := `>=1.2.3 <3.0.0-0`

#### X-Ranges `1.2.x` `1.X` `1.2.*` `*`

Any of `X`, `x`, or `*` may be used to "stand in" for one of the
numeric values in the `[major, minor, patch]` tuple.

* `*` := `>=0.0.0` (Any non-prerelease version satisfies, unless
  `includePrerelease` is specified, in which case any version at all
  satisfies)
* `1.x` := `>=1.0.0 <2.0.0-0` (Matching major version)
* `1.2.x` := `>=1.2.0 <1.3.0-0` (Matching major and minor versions)

A partial version range is treated as an X-Range, so the special
character is in fact optional.

* `""` (empty string) := `*` := `>=0.0.0`
* `1` := `1.x.x` := `>=1.0.0 <2.0.0-0`
* `1.2` := `1.2.x` := `>=1.2.0 <1.3.0-0`

#### Tilde Ranges `~1.2.3` `~1.2` `~1`

Allows patch-level changes if a minor version is specified on the
comparator.  Allows minor-level changes if not.

* `~1.2.3` := `>=1.2.3 <1.(2+1).0` := `>=1.2.3 <1.3.0-0`
* `~1.2` := `>=1.2.0 <1.(2+1).0` := `>=1.2.0 <1.3.0-0` (Same as `1.2.x`)
* `~1` := `>=1.0.0 <(1+1).0.0` := `>=1.0.0 <2.0.0-0` (Same as `1.x`)
* `~0.2.3` := `>=0.2.3 <0.(2+1).0` := `>=0.2.3 <0.3.0-0`
* `~0.2` := `>=0.2.0 <0.(2+1).0` := `>=0.2.0 <0.3.0-0` (Same as `0.2.x`)
* `~0` := `>=0.0.0 <(0+1).0.0` := `>=0.0.0 <1.0.0-0` (Same as `0.x`)
* `~1.2.3-beta.2` := `>=1.2.3-beta.2 <1.3.0-0` Note that prereleases in
  the `1.2.3` version will be allowed, if they are greater than or
  equal to `beta.2`.  So, `1.2.3-beta.4` would be allowed, but
  `1.2.4-beta.2` would not, because it is a prerelease of a
  different `[major, minor, patch]` tuple.

#### Caret Ranges `^1.2.3` `^0.2.5` `^0.0.4`

Allows changes that do not modify the left-most non-zero element in the
`[major, minor, patch]` tuple.  In other words, this allows patch and
minor updates for versions `1.0.0` and above, patch updates for
versions `0.X >=0.1.0`, and *no* updates for versions `0.0.X`.

Many authors treat a `0.x` version as if the `x` were the major
"breaking-change" indicator.

Caret ranges are ideal when an author may make breaking changes
between `0.2.4` and `0.3.0` releases, which is a common practice.
However, it presumes that there will *not* be breaking changes between
`0.2.4` and `0.2.5`.  It allows for changes that are presumed to be
additive (but non-breaking), according to commonly observed practices.

* `^1.2.3` := `>=1.2.3 <2.0.0-0`
* `^0.2.3` := `>=0.2.3 <0.3.0-0`
* `^0.0.3` := `>=0.0.3 <0.0.4-0`
* `^1.2.3-beta.2` := `>=1.2.3-beta.2 <2.0.0-0` Note that prereleases in
  the `1.2.3` version will be allowed, if they are greater than or
  equal to `beta.2`.  So, `1.2.3-beta.4` would be allowed, but
  `1.2.4-beta.2` would not, because it is a prerelease of a
  different `[major, minor, patch]` tuple.
* `^0.0.3-beta` := `>=0.0.3-beta <0.0.4-0`  Note that prereleases in the
  `0.0.3` version *only* will be allowed, if they are greater than or
  equal to `beta`.  So, `0.0.3-pr.2` would be allowed.

When parsing caret ranges, a missing `patch` value desugars to the
number `0`, but will allow flexibility within that value, even if the
major and minor versions are both `0`.

* `^1.2.x` := `>=1.2.0 <2.0.0-0`
* `^0.0.x` := `>=0.0.0 <0.1.0-0`
* `^0.0` := `>=0.0.0 <0.1.0-0`

A missing `minor` and `patch` values will desugar to zero, but also
allow flexibility within those values, even if the major version is
zero.

* `^1.x` := `>=1.0.0 <2.0.0-0`
* `^0.x` := `>=0.0.0 <1.0.0-0`

### Approximate Ranges

The operator `~>` treats the last digit of corresponding version as the beginning of the range & matches only within that respective value.

- `~>1` is equivalent to the range `>=1.0.0, <2.0.0`
- `~>1.2` is equivalent to the range `>=1.2, <1.2` or `^1.2`
- `~>1.2.3` is equivalent to the range `>=1.2.3, <1.3.0` or `~1.2.3`
- `~>1.2.3-alpha.1` is equivalent 

## Functions

* `valid(v)`: Return the parsed version, or null if it's not valid.
* `increment(v, type)`: Return the version incremented by the type (`major`,   `premajor`, `minor`, `preminor`, `patch`,
  `prepatch`, or `prerelease`), or null if it's not valid
  * `premajor` in one call will bump the version up to the next major
    version and down to a prerelease of that major version.
    `preminor`, and `prepatch` work the same way.
  * If called from a non-prerelease version, the `prerelease` will work the
    same as `prepatch`. It increments the patch version, then makes a
    prerelease. If the input version is already a prerelease it simply
    increments it.
* `prerelease(v)`: Returns an array of prerelease components, or null
  if none exist. Example: `prerelease('1.2.3-alpha.1') -> ['alpha', 1]`
* `stable(v)`: Returns an array of releases that are considered "stable" (ie. no prereleases), or null if non exist.
* `major(v)`: Return the major version number.
* `minor(v)`: Return the minor version number.
* `patch(v)`: Return the patch version number.
* `intersects(r1, r2, loose)`: Return true if the two supplied ranges
  or comparators intersect.
* `parse(v)`: Attempt to parse a string as a semantic version, returning either
  a `SemVer` object or `null`.

### Comparison

* `gt(v1, v2)`: `v1 > v2`
* `gte(v1, v2)`: `v1 >= v2`
* `lt(v1, v2)`: `v1 < v2`
* `lte(v1, v2)`: `v1 <= v2`
* `eq(v1, v2)`: `v1 == v2` This is true if they're logically equivalent,
  even if they're not the exact same string.  You already know how to
  compare strings.
* `neq(v1, v2)`: `v1 != v2` The opposite of `eq`.
* `cmp(v1, comparator, v2)`: Pass in a comparison string, and it'll call
  the corresponding function above.  `"==="` and `"!=="` do simple
  string comparison, but are included for completeness.  Throws if an
  invalid comparison string is provided.
* `compare(v1, v2)`: Return `0` if `v1 == v2`, or `1` if `v1` is greater, or `-1` if
  `v2` is greater. Sorts in ascending order if passed to `Array.sort()`.
* `diff(v1, v2)`: Returns difference between two versions by the release type
  (`major`, `premajor`, `minor`, `preminor`, `patch`, `prepatch`, or `prerelease`),
  or null if the versions are the same.

### Comparators

* `intersects(comparator)`: Return true if the comparators intersect

### Ranges

* `validRange(range)`: Return the valid range or null if it's not valid
* `satisfies(version, range)`: Return true if the version satisfies the
  range.
* `highest(versions, range)`: Return the highest version in the list
  that satisfies the range, or `null` if none of them do.
* `lowest(versions, range)`: Return the lowest version in the list
  that satisfies the range, or `null` if none of them do.
* `minimum(range)`: Return the lowest version that can possibly match
  the given range.
* `gtr(version, range)`: Return `true` if version is greater than all the
  versions possible in the range.
* `ltr(version, range)`: Return `true` if version is less than all the
  versions possible in the range.
* `outside(version, range, hilo)`: Return true if the version is outside
  the bounds of the range in either the high or low direction.  The
  `hilo` argument must be either the string `'>'` or `'<'`.  (This is
  the function called by `gtr` and `ltr`.)
* `intersects(range)`: Return true if any of the ranges comparators intersect
* `simplify(versions, range)`: Return a "simplified" range that
  matches the same items in `versions` list as the range specified.  Note
  that it does *not* guarantee that it would match the same versions in all
  cases, only for the set of versions provided.  This is useful when
  generating ranges by joining together multiple versions with `||`
  programmatically, to provide the user with something a bit more
  ergonomic.  If the provided range is shorter in string-length than the
  generated range, then that is returned.
* `subset(subRange, superRange)`: Return `true` if the `subRange` range is
  entirely contained by the `superRange` range.

Note that, since ranges may be non-contiguous, a version might not be
greater than a range, less than a range, *or* satisfy a range!  For
example, the range `1.2 <1.2.9 || >2.0.0` would have a hole from `1.2.9`
until `2.0.0`, so the version `1.2.10` would not be greater than the
range (because `2.0.1` satisfies, which is higher), nor less than the
range (since `1.2.8` satisfies, which is lower), and it also does not
satisfy the range.

If you want to know if a version satisfies or does not satisfy a
range, use the `satisfies(version, range)` function.
