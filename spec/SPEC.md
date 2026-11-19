# Semantic Versions 1.0.0

## Introduction

Software versions are a communication mechanism. This specification outlines a
set of rules and requirements that dictate how software version numbers can be
assigned, incremented, grouped, compared and matched.

For this system to work, you **MUST** declare a public API. This **MAY**
consist of documentation or be enforced by the software itself. Regardless, it
is important that an API is clear and precise. Changes to your public API are
communicated with specific increments to your software's "Semantic Version".

## Specification

The key words "**MUST**", "**MUST NOT**", "**REQUIRED**", "**SHALL**",
"**SHALL NOT**", "**SHOULD**", "**SHOULD NOT**", "**RECOMMENDED**",
"**NOT RECOMMENDED**", "**MAY**", and "**OPTIONAL**" in this document are to be
interpreted as described in BCP 14 [RFC 2119](https://tools.ietf.org/html/rfc2119)
[RFC 8174](https://www.rfc-editor.org/rfc/rfc8174) when, and only when, they
appear in all capitals, as shown here.

### Versions

Given a semantic version `MAJOR.MINOR.PATCH`, increment the:

- `MAJOR` version when you make incompatible API changes
- `MINOR` version when you add functionality in a backward compatible manner
- `PATCH` version when you make backward compatible bug fixes

Given a semantic version with optional labels `MAJOR.MINOR.PATCH-PRERELEASE+BUILD`:

- `PRERELEASE` is ...
- `BUILD` is ...

1. Software using semantic versions **MUST** declare a public API. This API
could be declared in the code itself or exist strictly in documentation.
However it is done, it **SHOULD** be precise and comprehensive.

1. A normal version number **MUST** take the form `X.Y.Z` where `X`, `Y`, and
`Z` are non-negative integers, and **MUST NOT** contain leading zeroes. `X` is
the major version, `Y` is the minor version, and `Z` is the patch version. Each
element **MUST** increase numerically. For instance: `1.9.0` -> `1.10.0` ->
`1.11.0`.

1. A semantic version ...

2. A partical version ...

3. A set ...

4. An ordered set ...

5. An unordered set ...
  
6. A range ...
  
7. A comparator ...

8. Once a versioned package has been released, the contents of that version
**MUST NOT** be modified. Any modifications **MUST** be released as a new version.

1. Major version zero (`0.y.z`) is for initial development. Anything **MAY** change
at any time. The public API **SHOULD NOT** be considered stable.

1. Version `1.0.0` **SHOULD** be the first stable release and **MUST** define the public API. The way in which the version number
is incremented after this release is dependent on this public API and how it
changes.

1. Patch version `Z` (`x.y.Z | x > 0`) **MUST** be incremented when a release
leaves the declared public API unchanged. That covers corrections which bring
behaviour into agreement with the declaration, corrections which honour the
evident intended behaviour where the declaration is silent, and changes with no
bearing on the declaration at all — refactors, dependency updates, performance
work. A patch **MAY** be externally observable, and a correction usually is. What
makes it a patch is that the declared contract is the same before and after, not
that nothing visible changed.

1. Minor version Y (`x.Y.z | x > 0`) **MUST** be incremented if new, backward
compatible functionality is introduced to the public API. It **MUST** be
incremented if any public API functionality is marked as deprecated. It **MAY** be
incremented if substantial new functionality or improvements are introduced
within the private code. It **MAY** include patch level changes. Patch version
**MUST** be reset to 0 when minor version is incremented.

1. Major version `X` (`X.y.z | X > 0`) **MUST** be incremented if any backward
incompatible changes are introduced to the declared public API. It MAY also include minor
and patch level changes. Patch and minor versions **MUST** be reset to 0 when major
version is incremented.

1. Behaviour that the declaration does not describe **and** that was never
intended to form part of the public API — a symbol exported by accident, an
undocumented side effect, or an implementation detail a consumer can reach — is
**NOT** covered by the compatibility guarantees above. Correcting or removing such
behaviour **MUST NOT** require a major increment. Where it is known to be relied
upon in practice, authors **SHOULD** announce the correction in a minor release
before removing the behaviour, and **SHOULD** record it in release notes.
Undocumented behaviour that *was* intended is a different case: the declaration is
incomplete rather than the behaviour wrong. Correcting it toward that intent is a
patch; writing it into the declaration is a minor.

1. A pre-release version **MAY** be denoted by appending a hyphen and a
series of dot separated identifiers immediately following the patch
version. Identifiers **MUST** comprise only ASCII alphanumerics and hyphens
[0-9A-Za-z-]. Identifiers **MUST NOT** be empty. Numeric identifiers **MUST
NOT** include leading zeroes. Pre-release versions have a lower
precedence than the associated normal version. A pre-release version
indicates that the version is unstable and might not satisfy the
intended compatibility requirements as denoted by its associated
normal version. Examples: `1.0.0-alpha, 1.0.0-alpha.1, 1.0.0-0.3.7,
1.0.0-x.7.z.92, 1.0.0-x-y-z.\-\-`.

1. Build versions **MAY** be denoted by appending a plus sign and a series of dot
separated identifiers immediately following the patch or pre-release version.
Identifiers **MUST** comprise only ASCII alphanumerics and hyphens [0-9A-Za-z-].
Identifiers **MUST NOT** be empty. Unlike "build metadata" in later drafts, a build
**participates** in precedence; it is the antithesis of a pre-release. Two versions
that differ only in the build therefore do **not** have the same precedence — see
the precedence rules below. Examples: `1.0.0-alpha+001, 1.0.0+20130313144700,
1.0.0-beta+exp.sha.5114f85, 1.0.0+21AF26D3\-\-\-\-117B344092BD`.

1. Precedence refers to how versions are compared to each other when ordered.

   1. Precedence **MUST** be calculated by separating the version into major,
      minor, patch, pre-release, and build identifiers in that order.

   2. Precedence is determined by the first difference when comparing each of
      these identifiers from left to right as follows: Major, minor, and patch
      versions are always compared numerically.

      Example: `1.0.0 < 2.0.0 < 2.1.0 < 2.1.1`.

   3. When major, minor, and patch are equal, a pre-release version has lower
      precedence than a normal version:

      Example: `1.0.0-alpha < 1.0.0`.

   4. When major, minor, patch, and pre-release are equal, a version **with**
      build metadata has *higher* precedence than one without it. Unlike SemVer
      2.0.0 — which discards build metadata for ordering — Semantic Versions
      restores its precedence: a build names a more specific artifact of that
      release, so it ranks *above* the plain release rather than below it like a
      pre-release.

      Example: `1.0.0 < 1.0.0+build.1 < 1.0.0+build.2`.

   5. Precedence for two pre-release or build versions with the same major, minor, and patch version **MUST** be determined by comparing each dot separated identifier from left to right until a difference is found as follows:

      1. Identifiers consisting of only digits are compared numerically.

      2. Identifiers with letters or hyphens are compared lexically in ASCII
         sort order.

      3. Numeric identifiers always have lower precedence than non-numeric
         identifiers.

      4. A larger set of pre-release (or build) fields has a higher precedence
         than a smaller set, if all of the preceding identifiers are equal.

      Example: `1.0.0-alpha < 1.0.0-alpha.1 < 1.0.0-alpha.beta < 1.0.0-beta < 
      1.0.0-beta.2 < 1.0.0-beta.11 < 1.0.0-rc.1 < 1.0.0 < 1.0.0+build.1`.

### Sets

A **Set** is a collection of versions. Sets are how the ecosystem reasons about
software — *"every version of this package"*, *"the 1.x line"*, *"what this range
selects"*. Semantic Versions treats them as first-class so tools can talk about
groups of versions, not just one at a time.

1. A Set **MUST** contain a collection of semantic versions.
1. All potential MAJOR, MINOR, PATCH & PRE-RELEASE versions **MUST** be interpreted as valid Subsets to any set.
1. A Set **MAY** be scoped to a **context**; such a **Contextual Set** **MUST** contain only versions sharing that context.
1. Fixing any single identifier — MAJOR, MINOR, PATCH, PRE-RELEASE or BUILD — partitions a set into **Subsets**.
1. A Set **MAY** be sorted according to the version precedence.
1. Sets **MAY** contain duplicate versions.
1. Duplicate versions in a set **MUST** have unique build metadata.
1. An **Unordered Set** imposes no ordering; an **Ordered Set** **MUST** be sorted by their precedence.

#### Context

A version rarely travels alone — it is understood *in context*. A **context** is
the identity a version belongs to: a package, module, image, crate, service or any
other named artifact. It scopes a version with an `@` separator —
`context@MAJOR.MINOR.PATCH-PRE+BUILD` — so that where a bare `1.2.3` is ambiguous,
`app@1.2.3-canary.1+sha.1a8c…` names a specific build of a specific thing.

Context is deliberately **ecosystem-agnostic**: the version grammar, precedence,
sets and ranges make no assumption about where a version lives. An ecosystem binds
to the spec by qualifying a context with a **source**, written `source:name`, which
names the origin or ecosystem — and the same rules then apply identically:

- `npm:react@18.2.0`
- `cargo:serde@1.0.203`
- `oci:alpine@3.20.0`
- `pypi:flask@3.0.0`
- `go:golang.org/x/text@0.14.0`

A source-qualified context is what extensions build on, and it maps cleanly onto a
Package-URL (`npm:react@18.2.0` ↔ `pkg:npm/react@18.2.0`).

#### SubSets

Fixing any one coordinate of a version yields a **Subset** of `context@*`. Every
position defines its own family, and the full set `<context>@*` is their union:

- Major SubSet: `0.*.*`, `1.*.*`, `2.*.*`, …
- Minor SubSet: `*.0.*`, `*.1.*`, `*.2.*`, …
- Patch SubSet: `*.*.0`, `*.*.1`, `*.*.2`, …
- Prerelease SubSet: `*.*.*-0`, `*.*.*-1`, `*.*.*-2`, …
- Build SubSet: `*.*.*+0`, `*.*.*+1`, `*.*.*+2`, …

#### Ordered, unordered & contextual sets

The same members can be arranged two ways: an **unordered set** lists versions as
encountered, while an **ordered set** sorts them by precedence — ordering is a
property of the set, not its members. A set scoped to a single context
(`react@*`, `express@*`) is a **contextual set**: two contextual sets may hold
identical version numbers yet remain distinct, because their context differs.

Examples:

- Valid set: `5.6.7, 3.2.1+build.123, 3.2.1, 4.0.0, 1.16.3, 0.9.8`
- Invalid set: `3.2.1, 3.2.1`
- Valid set: `3.2.1, 3.2.1+build.123`
- Ordered set: `0.9.8, 1.16.3, 3.2.1, 3.2.1+build.123, 4.0.0, 5.6.7`
- Unordered set: `5.6.7, 3.2.1+build.123, 3.2.1, 4.0.0, 1.16.3, 0.9.8`
- Normal set: `0.9.8, 1.16.3, 3.2.1, 4.0.0, 5.6.7`
- Prerelease set: `1.0.0-pre.1, 1.0.0-pre.2, 1.0.0-pre.3`
- Build set: `1.0.0+build.1, 1.0.0+build.2, 1.0.0+build.3`

### Ranges

A `range` is a set of `comparators` which specify versions
that satisfy the range.

### Operators

A `operator` is a character or set of characters which express how to compare a version.

Supported operators are:

* `<` Less than
* `>` Greater than
* `=` Equal to
* `<=` Less than or equal to
* `>=` Greater than or equal to

### Comparator

A `comparator` is composed of an `operator` & a `version`. Comparators can be joined by whitespace to form a `comparator set`, which is satisfied by the **intersection** of all of the comparators it includes.

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

* `*` := `>=0.0.0` (Any stable version satisfies. Pre-releases are admitted
  only when the range declares a channel for them — see
  [Pre-release Channels](#pre-release-channels-100-rc); `*-*` is the universal
  channel that admits every pre-release.)
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
* `~1.2.3-beta.2` := `>=1.2.3-beta.2 <1.3.0-0`

A pre-release on the comparator declares a **pre-release channel** on the
`1.2.3` tuple (see [Pre-release Channels](#pre-release-channels-100-rc)). The
channel is the prefix `beta.2`, so `1.2.3-beta.2` and `1.2.3-beta.2.1` are
admitted, but `1.2.3-beta.3` (a different sibling) and `1.2.4-beta.2` (a
different tuple) are not.

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
* `^1.2.3-beta.2` := `>=1.2.3-beta.2 <2.0.0-0` — the pre-release declares a
  `beta.2` channel on the `1.2.3` tuple (see
  [Pre-release Channels](#pre-release-channels-100-rc)). `1.2.3-beta.2.4` is
  admitted; `1.2.3-rc.1` (a different channel) and `1.2.4-beta.2` (a different
  tuple) are not. Stable releases in range are admitted normally.
* `^0.0.3-beta` := `>=0.0.3-beta <0.0.4-0` — the `beta` channel on the `0.0.3`
  tuple: `0.0.3-beta.2` is admitted, `0.0.3-rc.1` is not.

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

- `~>1` is equivalent to the range `>=1.0.0, <2.0.0-0` or `^1.x`
- `~>1.2` is equivalent to the range `>=1.2.0, <1.2.0-0` or `^1.2.x`
- `~>1.2.3` is equivalent to the range `>=1.2.3, <1.3.0-0` or `~1.2.3`
- `~>1.2.3-alpha.1` is equivalent 


Note that, since ranges may be non-contiguous, a version might not be
greater than a range, less than a range, *or* satisfy a range!  For
example, the range `1.2 <1.2.9 || >2.0.0` would have a hole from `1.2.9`
until `2.0.0`, so the version `1.2.10` would not be greater than the
range (because `2.0.1` satisfies, which is higher), nor less than the
range (since `1.2.8` satisfies, which is lower), and it also does not
satisfy the range.

If you want to know if a version satisfies or does not satisfy a
range, use the `satisfies(version, range)` function.

### Pre-release Channels `^1.0.0-rc`

A pre-release is provisional: it ranks *below* its eventual release
(`1.0.0-rc < 1.0.0`), so it is a step *toward* a version rather than a
refinement *of* it. Consequently pre-releases are **excluded by default** — a
range of stable comparators never admits them — and a range opts in by naming
the pre-release it wants. That name is a **channel**: a prefix filter scoped to
the comparator's `[major, minor, patch]` tuple, exactly mirroring a
[build channel](#build-channels-100win). There is no global "include
pre-releases" switch; admission is always a property of the range.

1. A range with **no** pre-release token anywhere admits **stable versions
   only**.
2. A comparator, tilde, or caret carrying a pre-release declares a channel whose
   prefix is its pre-release identifiers, scoped to its tuple. A pre-release
   candidate is admitted if and only if it is within the numeric bounds **and**
   its identifiers, compared left to right, **begin with** some declared
   channel's on the **same** tuple.
   - `^1.0.0-rc` (prefix `rc`) admits `1.0.0-rc`, `1.0.0-rc.1`, `1.0.0-rc.2`;
     never `1.0.0-beta` (different channel) and never `1.5.0-rc` (different
     tuple).
   - `^1.0.0-rc.2` (prefix `rc.2`) admits the `rc.2` sub-tree only.
3. Two explicit **wildcards** provide the opt-in that a global flag used to:
   - `X.Y.Z-*` — the empty-prefix channel for one tuple: *any* pre-release of
     that release. `^1.0.0-*` admits `1.0.0-alpha`, `1.0.0-rc.1`, … (plus stable
     in range), but not `1.5.0-beta`.
   - `*-*` — the **universal** channel: admit pre-releases on **every** tuple.
     This is the in-range equivalent of the old toggle (npm's
     `includePrerelease`, pip's `--pre`).
4. Stable versions are unaffected by channels: once inside the numeric bounds
   they are always admitted.
5. A tilde or caret carrying a pre-release applies its channel to the numeric
   lower bound it desugars to. A hyphen range keeps each endpoint's pre-release
   as that endpoint's channel.

- `^1.0.0-rc` := `>=1.0.0-rc <2.0.0-0` — the `rc` channel of `1.0.0`, plus all
  stable up to `<2.0.0`.
- `~1.2.3-beta` := `>=1.2.3-beta <1.3.0-0` — the `beta` channel of `1.2.3`.
- `^1.0.0-*` := `>=1.0.0-0 <2.0.0-0` **+** any-pre channel on `1.0.0` — every
  pre-release of `1.0.0`, plus stable `1.x`.
- `*-*` — any version at all, stable or pre-release.

Pre-release channels are a deliberate divergence from Semantic Versioning 2.0.0
and its `node-semver` implementation, which admit *any* pre-release sharing a
comparator's tuple (an all-or-nothing, any-prefix rule) and expose a separate
`includePrerelease` flag. Scoping to a prefix makes `^1.0.0-alpha` mean the
alpha channel — not "everything from alpha onward" — and folds the flag into the
grammar. This precise, floating model follows NuGet's shipped behaviour
(`1.2.3-alpha.*` prefix floats, `*-*` for everything).

### Subset selection: one rule for pre-release and build

Pre-release and build are the two labels a version can carry, and a range
selects among them with the **same channel/prefix rule**: identifiers on a
comparator, matched left-to-right as a prefix, scoped to that comparator's
tuple. They differ only in their *default*, and that difference follows directly
from [precedence](#precedence):

| Label | Ranks vs. its release | Meaning | Default in a range | Opt in / narrow with |
| --- | --- | --- | --- | --- |
| Pre-release | **below** (`1.0.0-rc < 1.0.0`) | provisional, on the way *to* the release | **excluded** | name it (`-rc`), `-*`, or `*-*` |
| Build | **at/above** (`1.0.0 < 1.0.0+win`) | a refinement, a specific artifact *of* the release | **included** | a channel narrows (`+win`) |

A version is in a range when it passes every comparator's numeric test **and**,
for whichever labels it carries, the range's channels admit them. Nothing is
configured out-of-band.

### Build Channels `^1.0.0+win`

Because build metadata carries precedence, it can also *select*. A build attached
to a comparator, tilde, or caret is a **channel filter**: it is orthogonal to the
numeric comparison and admits only versions whose own build metadata *begins with*
the channel's identifiers. This makes build metadata a first-class way to range
over release channels and variants — signed builds, platform/architecture targets,
content digests.

1. A comparator's build metadata **MUST** be treated as a channel filter, not as
   part of the numeric comparison.
2. The numeric comparison **MUST** ignore build metadata on both the comparator
   and the candidate version.
3. A version satisfies a channel if and only if its build identifiers, compared
   left to right, **begin with** the channel's identifiers.
4. A range with **no** build channel matches any build (and the build-less
   release); a channel excludes versions that carry no build.
5. A tilde or caret carrying a channel **MUST** apply that channel to every
   comparator it desugars to. A hyphen range spans two endpoints and **MUST**
   ignore their build metadata.

- `^1.0.0+win` := `>=1.0.0+win <2.0.0-0+win` — the `win` channel within `^1.0.0`:
  matches `1.4.2+win.x64`, not `1.4.2+linux.x64` or `1.4.2`.
- `>=1.1.0+linux.x64` — the `linux.x64` variant at or above `1.1.0`.
- `1.0.0+sha.a1b2c3` — pins the exact artifact (and any narrower build beneath it).
- `^1.0.0` — no channel, so every variant of every release in range matches.

Build channels are a deliberate divergence from Semantic Versioning 2.0.0, which
discards build metadata during range resolution.

### PEP440 interoperability

Python's [PEP 440](https://peps.python.org/pep-0440/) is the other widely-used
version grammar, and it *recommends* Semantic Versioning for the public release
segment. Because Semantic Versions restores the two things Semantic Versioning
2.0.0 discarded — **build precedence** and **default pre-release exclusion** —
it lines up with PEP 440's ordering model more closely than 2.0.0 does. This
section defines the interoperable subset; it adds no grammar or precedence rules.

#### Compatible subset

A version is round-trippable between the two schemes when it stays within this
subset:

1. The release segment is exactly three components (`MAJOR.MINOR.PATCH`) with no
   leading zeroes. PEP 440 permits an arbitrary-length release segment, but
   recommends this form.
2. Pre-releases use the spellings `-a.N` (alpha), `-b.N` (beta) and `-rc.N`
   (release candidate). These sort correctly under Semantic Versions precedence
   (`a < b < rc`, then numerically), and map onto PEP 440's normalized `aN` /
   `bN` / `rcN` pre-release segments.

#### Ordering alignment

- **Local versions ↔ build metadata.** PEP 440 local versions (`1.0.0+abc`)
  participate in ordering and rank a labelled artifact above its plain release.
  Semantic Versions' restored [build precedence](#precedence) does the same
  (`1.0.0 < 1.0.0+build`) — where Semantic Versioning 2.0.0 discards it.
- **Default pre-release exclusion.** A range of stable comparators admits no
  pre-releases unless it opts in (see
  [Pre-release Channels](#pre-release-channels-100-rc)), mirroring `pip`'s
  requirement of `--pre`.
- **Post-releases.** PEP 440 post-releases (`1.0.0.post1`) rank *above* the
  release, matching the "refinement above the release" shape of build precedence,
  though the two are not byte-for-byte convertible (see below).

#### Specifier mapping

PEP 440 specifiers translate to Semantic Versions ranges:

| PEP 440 specifier | Semantic Versions range |
| --- | --- |
| `~=1.4.2` | `~1.4.2` (`>=1.4.2 <1.5.0-0`) |
| `~=1.4` | `^1.4` (`>=1.4.0 <2.0.0-0`) |
| `==1.4.*` | `1.4.x` (`>=1.4.0 <1.5.0-0`) |
| `>=1.4.2`, `>1.4.2`, `<=1.4.2`, `<1.4.2` | same operator, identical meaning |
| `==1.4.2` | `1.4.2` |

#### Lossy / out of scope

The following PEP 440 constructs are **not representable** in Semantic Versions
and are deliberately left unmapped rather than special-cased:

- **Epoch** (`1!1.0`) — there is no Semantic Versions equivalent; an epoch cannot
  be encoded without breaking Semantic Versioning 2.0.0 compatibility.
- **Development releases** (`.devN`) — PEP 440 sorts a dev release *below* its own
  parent pre-release (`1.0.0-a.1.dev.1 < 1.0.0-a.1`), which contradicts the
  Semantic Versions rule that a larger set of identifiers ranks *higher*.
- **Exact post-release numerics** (`.postN`) — the "above the release" concept
  maps onto build precedence, but the precise `.postN` counter semantics do not
  survive the round trip.

## FAQ

### What are the differences between `semver.org`?

**Semantic Versions** is a spirtual successor to
[`Semantic Versioning 2.0.0-rc.1`](https://semver.org/spec/v2.0.0-rc.1.html)
which originally introduced the concept of optional prerelease & build versions.
Notably, `Semantic Versioning 2.0.0-rc.2` changed the meaning of build versions
to "build metadata" making those definitions semantically useless. Semantic
Versions reverts this unfortunate change while also additing new definitions for
Sets, Ranges & Comparitors. These differences cover essential gaps required to
meaningfully handle software versions.

### Why **MUST** minor and patch reset to `0`?

Resetting keeps versions a single, well-defined total order and gives every line
an unambiguous first member: `2.5.0` is the start of the `2.5` series, and
`2.0.0` is the start of the `2.x` series. Tools that reason about "the first
release of a minor" or that desugar ranges (`~`, `^`, `~>`) rely on this — a
carried-forward counter like `2.5.1` with no `2.5.0` breaks that assumption.

The rule constrains *carrying a lower-position counter forward*, not *skipping
numbers*. You **MAY** skip values: `2.4.10` → `2.6.0` → `4.0.0` is fine, because
each increment still starts its lower positions at `0`. What the rule forbids is
`2.4.10` → `2.5.1` — the minor incremented, so patch **MUST** restart at `0`.

This is also why Semantic Versions keeps **MUST** rather than relaxing it to
**SHOULD** (as proposed in
[semver/semver#393](https://github.com/semver/semver/pull/393)): a normative
relaxation would fragment the ordering guarantees that existing Semantic
Versioning 2.0.0 tooling depends on, for a gain that is expressible by simply
skipping the numbers you do not want.

### Why keep `MAJOR.MINOR.PATCH` instead of renaming to `BREAKING.FEATURE.FIX`?

Backward compatibility is the whole pitch. Anything valid under Semantic
Versioning 2.0.0 stays valid here, and `MAJOR.MINOR.PATCH` is the vocabulary the
ecosystem — parsers, registries, changelog tools, and a decade of habit —
already speaks. Renaming the positions would fragment all of that for a purely
cosmetic gain, so we keep the names.

The common confusion the renaming proposals are reacting to is real, though, and
worth stating plainly: **an increment reflects the *nature* of the change to your
public API — incompatible, additive, or a fix — not the *amount* of code that
changed.** A complete internal rewrite that leaves the public API untouched is
still a patch; a one-character change that removes a parameter is a major bump.
The number you increment is decided by *what the change does to the contract*,
never by how much work it was.

To keep that meaning attached to the familiar labels, the summary states the
intent right next to each name: `MAJOR` = incompatible change, `MINOR` = additive
change, `PATCH` = a fix. And a patch is exactly that — *a fix*, not a promise of
backward compatibility (nothing can truly guarantee that); a fix stays a fix.

### What counts as the "public API", and is Semantic Versions for apps and products?

"Public API" is meant **broadly**: it is whatever public interface or contract
you declare — a library's function signatures, a CLI's flags and output, a GUI's
documented behaviour, a wire protocol, a file format. The spec does not care
*which* kind of interface it is; it only requires that you **declare one** and
increment based on changes to it. If your software's contract is its command-line
surface, then that surface *is* your public API for versioning purposes.

What a version is *about* is named by its **context**: `source:name@version`
(for example `npm:react@18.2.0`) identifies a specific artifact in a specific
ecosystem — the thing whose interface you are versioning. Context is how the spec
scopes a version to a concrete identity rather than leaving a bare `1.2.3` to mean
whatever the reader assumes.

Because of that, Semantic Versions targets a **declared interface**, not a
product's marketing, feature-set, or billing cadence. A "product version" that
jumps to `2.0.0` for a licensing change, or that must land features on a planned
`1.5.0`, is following a *different* (marketing) scheme — one where the number
communicates roadmap or pricing, not interface compatibility. That is a
legitimate thing to want, but it is not what a semantic version measures. If you
need both, version the declared interface semantically and let the product carry
its own separate, contextual label.

### What does the spec mean by "deprecated"?

Deprecation is a **documentation and registry concern, not version syntax**. The
spec references it once — a minor **MUST** be incremented when public API
functionality is marked as deprecated — and deliberately defines no notation for
it. None is planned.

The reason is that deprecation is *retroactive* while a version string is not.
You deprecate `1.2.3` after publishing it, often long after, and registries model
this as mutable metadata attached to an already-published version. But the
contents of a released version **MUST NOT** be modified, and its version string is
fixed at publish time. There is no moment at which the string could be rewritten
to record a decision made later.

Encoding it anyway would break precedence in both available slots. A pre-release
lowers precedence and announces instability, which is not what a deprecation says:
a deprecated release is usually stable, just unwanted. A build is worse. Because a
build **participates** in precedence here, `1.2.3+deprecated` would sort *above*
`1.2.3` and be preferred by every range that matched it — the deprecated release
would win, which is precisely backwards.

So mark deprecations in your documentation and in your registry's metadata, and
ship the announcement in a minor release. A version number records what changed in
the declared interface; it does not carry advice about whether to use a release.
That advice is real and worth publishing — it simply belongs somewhere mutable.

### License

[Apache License 2.0]()

### References & Links

- [Backus–Naur Form Grammar for **Versions**]()
- [Backus–Naur Form Grammar for **Ranges**]()
- [Backus–Naur Form Grammar for **Comparators**]()
- [Regular Expression](https://regex101.com/r/vkijKf/1/)
