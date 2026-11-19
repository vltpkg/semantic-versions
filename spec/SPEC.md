# Semantic Versions 1.0.0

## Introduction

Versions are a communication mechanism. This specification outlines a set of
rules and requirements that dictate how software version numbers can be
assigned, incremented, grouped, compared and matched.

For this system to work, you **MUST** declare a public API. This **MAY** consist
of documentation or be enforced by the software itself. Regardless, it is
important that an API is clear and precise. Changes to your public API are
communicated with specific increments to your software's Semantic Version.

> The key words "**MUST**", "**MUST NOT**", "**REQUIRED**", "**SHALL**",
> "**SHALL NOT**", "**SHOULD**", "**SHOULD NOT**", "**RECOMMENDED**",
> "**NOT RECOMMENDED**", "**MAY**", and "**OPTIONAL**" in this document are to be
> interpreted as described in BCP 14
> ([RFC 2119](https://www.rfc-editor.org/rfc/rfc2119),
> [RFC 8174](https://www.rfc-editor.org/rfc/rfc8174)) when, and only when, they
> appear in all capitals, as shown here.

## Versions

Given a semantic version `MAJOR.MINOR.PATCH`, increment the:

- `MAJOR` version when you make incompatible API changes;
- `MINOR` version when you add functionality in a backward compatible manner;
- `PATCH` version when you make a fix for unintended behaviour.

Optional labels for a pre-release and build extend the format:
`MAJOR.MINOR.PATCH-PRERELEASE+BUILD`.

1. Software using semantic versions **MUST** declare a public API. This API could
   be declared in the code itself or exist strictly in documentation. However it
   is done, it **SHOULD** be precise and comprehensive.

2. A normal version number **MUST** take the form `X.Y.Z` where `X`, `Y` and `Z`
   are non-negative integers, and **MUST NOT** contain leading zeroes. `X` is the
   major version, `Y` is the minor version, and `Z` is the patch version. Each
   element **MUST** increase numerically. For instance: `1.9.0` → `1.10.0` →
   `1.11.0`.

3. Once a versioned package has been released, the contents of that version
   **MUST NOT** be modified. Any modifications **MUST** be released as a new
   version.

4. Major version zero (`0.y.z`) is for initial development. Anything **MAY**
   change at any time. The public API **SHOULD NOT** be considered stable.

5. Version `1.0.0` **SHOULD** be the first stable release and **MUST** define the
   public API. The way in which the version number is incremented after this
   release is dependent on this public API and how it changes.

6. Patch version `Z` (`x.y.Z | x > 0`) **MUST** be incremented when a release
   leaves the declared public API unchanged. That covers corrections which bring
   behaviour into agreement with the declaration, corrections which honour the
   evident intended behaviour where the declaration is silent, and changes with
   no bearing on the declaration at all: refactors, dependency updates,
   performance work. A patch **MAY** be externally observable, and a correction
   usually is. What makes it a patch is that the declared contract is the same
   before and after, not that nothing visible changed.

7. Minor version `Y` (`x.Y.z | x > 0`) **MUST** be incremented if new, backward
   compatible functionality is introduced to the public API. It **MUST** be
   incremented if any public API functionality is marked as deprecated. It
   **MAY** be incremented if substantial new functionality or improvements are
   introduced within the private code. It **MAY** include patch level changes.
   Patch version **MUST** be reset to `0` when minor version is incremented.

8. Major version `X` (`X.y.z | X > 0`) **MUST** be incremented if any backward
   incompatible changes are introduced to the declared public API. It **MAY**
   also include minor and patch level changes. Patch and minor versions **MUST**
   be reset to `0` when major version is incremented.

9. Behaviour that the declaration does not describe **and** that was never
   intended to form part of the public API (a symbol exported by accident, an
   undocumented side effect, or an implementation detail a consumer can reach)
   is **NOT** covered by the compatibility guarantees above. Correcting or
   removing such behaviour **MUST NOT** require a major increment. Where it is
   known to be relied upon in practice, authors **SHOULD** announce the
   correction in a minor release before removing the behaviour, and **SHOULD**
   record it in release notes. Undocumented behaviour that *was* intended is a
   different case: the declaration is incomplete rather than the behaviour
   wrong. Correcting it toward that intent is a patch; writing it into the
   declaration is a minor.

10. A pre-release version **MAY** be denoted by appending a hyphen and a series
    of dot separated identifiers immediately following the patch version.
    Identifiers **MUST** comprise only ASCII alphanumerics and hyphens
    `[0-9A-Za-z-]`, **MUST NOT** be empty, and numeric identifiers **MUST NOT**
    include leading zeroes. Pre-release versions have lower precedence than the
    associated normal version. A pre-release version indicates that the version
    is unstable and might not satisfy the intended compatibility requirements as
    denoted by its associated normal version. Examples: `1.0.0-alpha`,
    `1.0.0-alpha.1`, `1.0.0-0.3.7`, `1.0.0-x.7.z.92`, `1.0.0-x-y-z.--`.

11. A build **MAY** be denoted by appending a plus sign and a series of dot
    separated identifiers immediately following the patch or pre-release
    version. Identifiers **MUST** comprise only ASCII alphanumerics and hyphens
    `[0-9A-Za-z-]` and **MUST NOT** be empty. Unlike "build metadata" in later
    drafts of Semantic Versioning, a build **participates** in precedence; it is
    the antithesis of a pre-release. Two versions that differ only in the build
    therefore do **not** have the same precedence (see
    [Precedence](#precedence)). Examples: `1.0.0-alpha+001`,
    `1.0.0+20130313144700`, `1.0.0-beta+exp.sha.5114f85`,
    `1.0.0+21AF26D3----117B344092BD`.

## Precedence

Precedence refers to how versions are compared to each other when ordered.

1. Precedence **MUST** be calculated by separating the version into major,
   minor, patch, pre-release and build identifiers, in that order.

2. Precedence is determined by the first difference when comparing each of these
   identifiers from left to right. Major, minor and patch are always compared
   numerically.

   Example: `1.0.0 < 2.0.0 < 2.1.0 < 2.1.1`

3. When major, minor and patch are equal, a pre-release version has lower
   precedence than a normal version.

   Example: `1.0.0-alpha < 1.0.0`

4. When major, minor, patch and pre-release are equal, a version **with** a build
   has *higher* precedence than one without it. Where Semantic Versioning 2.0.0
   discards build metadata for ordering, Semantic Versions restores it: a build
   names a more specific artifact of that release, so it ranks *above* the plain
   release rather than below it like a pre-release.

   Example: `1.0.0 < 1.0.0+build.1 < 1.0.0+build.2`

5. Precedence for two pre-release or build versions with the same major, minor
   and patch **MUST** be determined by comparing each dot separated identifier
   from left to right until a difference is found:

   1. Identifiers consisting of only digits are compared numerically.
   2. Identifiers with letters or hyphens are compared lexically in ASCII sort
      order.
   3. Numeric identifiers always have lower precedence than non-numeric
      identifiers.
   4. A larger set of pre-release (or build) fields has higher precedence than a
      smaller set, if all preceding identifiers are equal.

   Example: `1.0.0-alpha < 1.0.0-alpha.1 < 1.0.0-alpha.beta < 1.0.0-beta <
   1.0.0-beta.2 < 1.0.0-beta.11 < 1.0.0-rc.1 < 1.0.0 < 1.0.0+build.1`

## Sets

A **Set** is a collection of versions. Sets are how the ecosystem actually
reasons about software: *"every version of this package"*, *"the 1.x line"*,
*"what this range selects"*. Semantic Versions defines them directly, so tools
can talk about *groups* of versions, not just one at a time.

1. A **Set** **MUST** contain a collection of semantic versions.
2. All potential `MAJOR`, `MINOR`, `PATCH` and `PRE-RELEASE` versions **MUST** be
   interpreted as valid subsets of any set.
3. A Set **MAY** be scoped to a **context**; such a **Contextual Set** **MUST**
   contain only versions sharing that context.
4. Fixing any single identifier (`MAJOR`, `MINOR`, `PATCH`, `PRE-RELEASE` or
   `BUILD`) partitions a set into **Subsets**.
5. A Set **MAY** be sorted according to version precedence.
6. Sets **MAY** contain duplicate versions.
7. Duplicate versions in a set **MUST** have unique build metadata.
8. An **Unordered Set** imposes no ordering; an **Ordered Set** **MUST** be
   sorted by precedence.

Examples:

- Valid set: `5.6.7, 3.2.1+build.123, 3.2.1, 4.0.0, 1.16.3, 0.9.8`
- Invalid set: `3.2.1, 3.2.1`
- Valid set: `3.2.1, 3.2.1+build.123`
- Ordered set: `0.9.8, 1.16.3, 3.2.1, 3.2.1+build.123, 4.0.0, 5.6.7`
- Unordered set: `5.6.7, 3.2.1+build.123, 3.2.1, 4.0.0, 1.16.3, 0.9.8`
- Normal set: `0.9.8, 1.16.3, 3.2.1, 4.0.0, 5.6.7`
- Pre-release set: `1.0.0-pre.1, 1.0.0-pre.2, 1.0.0-pre.3`
- Build set: `1.0.0+build.1, 1.0.0+build.2, 1.0.0+build.3`

### Context

A version rarely travels alone; it is understood *in context*. A **context** is
the identity a version belongs to: a package, module, image, crate, service or
any other named artifact. It scopes a version with an `@` separator
(`context@MAJOR.MINOR.PATCH-PRE+BUILD`), so that where a bare `1.2.3` is
ambiguous, `app@1.2.3-canary.1+sha.1a8c…` names a specific build of a specific
thing.

Context is deliberately **ecosystem-agnostic**. Everything above (the version
grammar, precedence, sets and ranges) makes no assumption about where a version
lives. An ecosystem binds to the spec by qualifying a context with a **source**,
written `source:name`, which names the origin or ecosystem. The same rules then
apply identically everywhere: `npm:react@18.2.0`, `pypi:flask@3.0.0`,
`gem:rails@7.1.3`, `cargo:serde@1.0.203`, `golang:golang.org/x/text@0.14.0`.

A source-qualified context is what the
[extensions](https://semver.xyz/extensions/) build on, and it lines up with a
[Package-URL](https://github.com/package-url/purl-spec). Where an ecosystem
already has a
[Package-URL type](https://github.com/package-url/purl-spec/blob/main/PURL-TYPES.rst),
use it as the source, so a reference maps onto a `purl` one-to-one. The same
spec then covers JavaScript, Python, Ruby, Rust, Go, Java, .NET, PHP and
container images without change:

| Ecosystem | Semantic Versions reference | Package-URL |
| --- | --- | --- |
| JavaScript · npm | `npm:react@18.2.0` | `pkg:npm/react@18.2.0` |
| Python · PyPI | `pypi:flask@3.0.0` | `pkg:pypi/flask@3.0.0` |
| Ruby · RubyGems | `gem:rails@7.1.3` | `pkg:gem/rails@7.1.3` |
| Rust · Cargo | `cargo:serde@1.0.203` | `pkg:cargo/serde@1.0.203` |
| Go · modules | `golang:golang.org/x/text@0.14.0` | `pkg:golang/golang.org/x/text@0.14.0` |
| Java · Maven | `maven:com.google.guava/guava@33.0.0` | `pkg:maven/com.google.guava/guava@33.0.0` |
| .NET · NuGet | `nuget:Newtonsoft.Json@13.0.3` | `pkg:nuget/Newtonsoft.Json@13.0.3` |
| PHP · Composer | `composer:symfony/console@7.0.4` | `pkg:composer/symfony/console@7.0.4` |
| Containers · OCI | `oci:alpine@3.20.0` | `pkg:oci/alpine@3.20.0` |

Namespaces carry across too: an npm scope or a Maven group is part of the name
(`npm:@vue/cli@5.0.8`, `maven:com.google.guava/guava@33.0.0`), the same segment a
`purl` puts in its namespace. A source is just a lowercase token, so an ecosystem
without a Package-URL type (or a private origin) still fits:
`napi:sharp@0.33.0`, `internal:billing@2.4.0`.

### SubSets

Fixing any one coordinate of a version yields a **subset** of `context@*`. Every
position (major, minor, patch, pre-release and build) defines its own family. The
full set `<context>@*` is the union of all of them.

| Major SubSet | Minor SubSet | Patch SubSet | Pre-release SubSet | Build SubSet |
| --- | --- | --- | --- | --- |
| `0.*.*` | `*.0.*` | `*.*.0` | `*.*.*-0` | `*.*.*+0` |
| `1.*.*` | `*.1.*` | `*.*.1` | `*.*.*-1` | `*.*.*+1` |
| `2.*.*` | `*.2.*` | `*.*.2` | `*.*.*-2` | `*.*.*+2` |
| … | … | … | … | … |

### Ordered & unordered sets

The same members, two arrangements. An **unordered set** lists versions as they
were encountered; an **ordered set** sorts them by [precedence](#precedence).
Ordering is a property of the set, not of its members.

| Unordered | Ordered |
| --- | --- |
| `react@9.3.1` | `react@1.0.0` |
| `react@6.8.0` | `react@6.8.0` |
| `react@7.1.2` | `react@7.1.2` |
| `react@1.0.0` | `react@9.3.1` |

### Contextual sets

A set scoped to a single context (`react@*`, `express@*`) is a **contextual
set**: every version that shares that identity. Two contextual sets can hold
identical version *numbers* and still be distinct, because their context
differs.

| `react@*` | `express@*` |
| --- | --- |
| `react@1.2.3` | `express@1.2.3` |
| `react@8.9.1` | `express@8.9.1` |
| `react@7.1.0-alpha.3` | `express@7.1.0-alpha.3` |

## Ranges

A `range` is a set of `comparators` which specify the versions that satisfy the
range. A range is composed of one or more comparator sets, joined by `||`. A
version matches a range if and only if every comparator in at least one of the
`||`-separated comparator sets is satisfied by the version.

- `>=1.2.7 <1.3.0` matches `1.2.7`, `1.2.8` and `1.2.99`, but not `1.2.6`,
  `1.3.0` or `1.1.0`.
- `1.2.7 || >=1.2.9 <2.0.0` matches `1.2.7`, `1.2.9` and `1.4.6`, but not
  `1.2.8` or `2.0.0`.

Ranges may be non-contiguous, so a version might be neither greater than, less
than, *nor* a member of a range. For example, `1.2 <1.2.9 || >2.0.0` has a hole
from `1.2.9` to `2.0.0`: `1.2.10` is not greater than the range (`2.0.1`
satisfies, which is higher), not less than it (`1.2.8` satisfies, which is
lower), and does not satisfy it. Test membership directly with
`satisfies(version, range)`.

> The range, comparator and advanced range syntax in this specification descend
> from [`node-semver`](https://github.com/npm/node-semver), the `semver` package
> Isaac Z. Schlueter wrote for npm in 2011, which became the de facto range
> language of the JavaScript ecosystem. Isaac proposed bringing that grammar into
> Semantic Versioning in 2020
> ([semver/semver#584](https://github.com/semver/semver/pull/584)); the proposal
> is still open. Semantic Versions adopts it as normative text and extends it
> with the approximate operator `~>`, pre-release and build channels, explicit
> pre-release wildcards, and contexts.

## Operators

An `operator` expresses how to compare a version. Supported operators are:

- `<` Less than
- `>` Greater than
- `=` Equal to
- `<=` Less than or equal to
- `>=` Greater than or equal to

## Comparators

A `comparator` is composed of an `operator` and a `version`. Comparators can be
joined by whitespace to form a *comparator set*, satisfied by the
**intersection** of all the comparators it includes.

- `>=1.2.7` matches `1.2.7`, `1.2.8`, `2.5.3` and `1.3.9`, but not `1.2.6` or
  `1.1.0`.
- `>1` is equivalent to `>=2.0.0`; it matches `2.0.0` and `3.1.0`, but not
  `1.0.1` or `1.1.0`.

## Advanced range syntax

Advanced ranges desugar to primitive comparators in deterministic ways, and may
be combined in the same way as primitive comparators, using whitespace or `||`.

### Hyphen ranges `X.Y.Z - A.B.C`

Specifies an inclusive set.

- `1.2.3 - 2.3.4` := `>=1.2.3 <=2.3.4`

If a partial version is provided as the first version, the missing pieces are
replaced with zeroes.

- `1.2 - 2.3.4` := `>=1.2.0 <=2.3.4`

If a partial version is provided as the second version, all versions that start
with the supplied parts of the tuple are accepted, but nothing greater than them.

- `1.2.3 - 2.3` := `>=1.2.3 <2.4.0-0`
- `1.2.3 - 2` := `>=1.2.3 <3.0.0-0`

### X-ranges `1.2.x` `1.X` `1.2.*` `*`

Any of `X`, `x` or `*` may stand in for a numeric value in the
`[major, minor, patch]` tuple.

- `*` := `>=0.0.0` (any stable version). Pre-releases opt in through a
  [channel](#pre-release-channels); `*-*` is the universal channel that admits
  every pre-release.
- `1.x` := `>=1.0.0 <2.0.0-0` (matching major version)
- `1.2.x` := `>=1.2.0 <1.3.0-0` (matching major and minor versions)

A partial version range is treated as an x-range, so the special character is
optional.

- `""` (empty string) := `*` := `>=0.0.0`
- `1` := `1.x.x` := `>=1.0.0 <2.0.0-0`
- `1.2` := `1.2.x` := `>=1.2.0 <1.3.0-0`

### Tilde ranges `~1.2.3` `~1.2` `~1`

Allows patch-level changes if a minor version is specified on the comparator;
allows minor-level changes if not.

- `~1.2.3` := `>=1.2.3 <1.(2+1).0` := `>=1.2.3 <1.3.0-0`
- `~1.2` := `>=1.2.0 <1.(2+1).0` := `>=1.2.0 <1.3.0-0` (same as `1.2.x`)
- `~1` := `>=1.0.0 <(1+1).0.0` := `>=1.0.0 <2.0.0-0` (same as `1.x`)
- `~0.2.3` := `>=0.2.3 <0.(2+1).0` := `>=0.2.3 <0.3.0-0`
- `~0.2` := `>=0.2.0 <0.(2+1).0` := `>=0.2.0 <0.3.0-0` (same as `0.2.x`)
- `~0` := `>=0.0.0 <(0+1).0.0` := `>=0.0.0 <1.0.0-0` (same as `0.x`)
- `~1.2.3-beta.2` := `>=1.2.3-beta.2 <1.3.0-0`

A pre-release on the comparator declares a
[pre-release channel](#pre-release-channels) on the `1.2.3` tuple. The channel is
the prefix `beta.2`, so `1.2.3-beta.2` and `1.2.3-beta.2.1` are admitted, but
`1.2.3-beta.3` (a different sibling) and `1.2.4-beta.2` (a different tuple) are
not.

### Caret ranges `^1.2.3` `^0.2.5` `^0.0.4`

Allows changes that do not modify the left-most non-zero element in the
`[major, minor, patch]` tuple. In other words, this allows patch and minor
updates for versions `1.0.0` and above, patch updates for versions
`0.X >=0.1.0`, and *no* updates for versions `0.0.X`.

Many authors treat a `0.x` version as if the `x` were the major
"breaking-change" indicator. Caret ranges are ideal when an author may make
breaking changes between `0.2.4` and `0.3.0` releases, which is a common
practice. However, they presume that there will *not* be breaking changes
between `0.2.4` and `0.2.5`; they allow changes that are presumed to be additive
(but non-breaking), according to commonly observed practices.

- `^1.2.3` := `>=1.2.3 <2.0.0-0`
- `^0.2.3` := `>=0.2.3 <0.3.0-0`
- `^0.0.3` := `>=0.0.3 <0.0.4-0`
- `^1.2.3-beta.2` := `>=1.2.3-beta.2 <2.0.0-0`: the pre-release declares a
  `beta.2` [channel](#pre-release-channels) on the `1.2.3` tuple.
  `1.2.3-beta.2.4` is admitted; `1.2.3-rc.1` (a different channel) and
  `1.2.4-beta.2` (a different tuple) are not. Stable releases in range are
  admitted normally.
- `^0.0.3-beta` := `>=0.0.3-beta <0.0.4-0`: the `beta` channel on the `0.0.3`
  tuple, so `0.0.3-beta.2` is admitted and `0.0.3-rc.1` is not.

When parsing caret ranges, a missing `patch` value desugars to the number `0`,
but allows flexibility within that value, even if the major and minor versions
are both `0`.

- `^1.2.x` := `>=1.2.0 <2.0.0-0`
- `^0.0.x` := `>=0.0.0 <0.1.0-0`
- `^0.0` := `>=0.0.0 <0.1.0-0`

Missing `minor` and `patch` values desugar to zero, but also allow flexibility
within those values, even if the major version is zero.

- `^1.x` := `>=1.0.0 <2.0.0-0`
- `^0.x` := `>=0.0.0 <1.0.0-0`

## Approximate ranges

The pessimistic operator `~>` treats the last supplied digit as the beginning of
a range and matches only within that value. It is an alias of the
[tilde](#tilde-ranges-123-12-1) operator.

- `~>1` := `>=1.0.0 <2.0.0-0` (same as `^1.x`)
- `~>1.2` := `>=1.2.0 <1.3.0-0` (same as `~1.2`)
- `~>1.2.3` := `>=1.2.3 <1.3.0-0` (same as `~1.2.3`)
- `~>1.2.3-alpha.1` := `>=1.2.3-alpha.1 <1.3.0-0`: the `alpha.1`
  [channel](#pre-release-channels) on the `1.2.3` tuple (same as
  `~1.2.3-alpha.1`)

## Pre-release channels

A pre-release is provisional: it ranks *below* its eventual release
(`1.0.0-rc < 1.0.0`), so it is a step *toward* a version rather than a
refinement *of* it. Consequently pre-releases are **excluded by default** (a
range of stable comparators never admits them), and a range opts in by naming
the pre-release it wants, as in `^1.0.0-rc`. That name is a **channel**: a
prefix filter scoped to the comparator's `[major, minor, patch]` tuple, exactly
mirroring a [build channel](#build-channels). There is no global "include
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
   - `X.Y.Z-*` is the empty-prefix channel for one tuple: *any* pre-release of
     that release. `^1.0.0-*` admits `1.0.0-alpha`, `1.0.0-rc.1`, … (plus stable
     in range), but not `1.5.0-beta`.
   - `*-*` is the **universal** channel: admit pre-releases on **every** tuple.
     This is the in-range equivalent of the old toggle (npm's
     `includePrerelease`, pip's `--pre`).
4. Stable versions are unaffected by channels: once inside the numeric bounds
   they are always admitted.
5. A tilde or caret carrying a pre-release applies its channel to the numeric
   lower bound it desugars to. A hyphen range keeps each endpoint's pre-release
   as that endpoint's channel.

- `^1.0.0-rc` := `>=1.0.0-rc <2.0.0-0`: the `rc` channel of `1.0.0`, plus all
  stable up to `<2.0.0`.
- `~1.2.3-beta` := `>=1.2.3-beta <1.3.0-0`: the `beta` channel of `1.2.3`.
- `^1.0.0-*` := `>=1.0.0-0 <2.0.0-0` **+** any-pre channel on `1.0.0`: every
  pre-release of `1.0.0`, plus stable `1.x`.
- `*-*`: any version at all, stable or pre-release.

> Pre-release channels are a deliberate divergence from Semantic Versioning
> 2.0.0 and its `node-semver` implementation, which admit *any* pre-release
> sharing a comparator's tuple (an all-or-nothing, any-prefix rule) and expose a
> separate `includePrerelease` flag. Scoping to a prefix makes `^1.0.0-alpha`
> mean the alpha channel, not "everything from alpha onward", and folds the flag
> into the grammar. This precise, floating model follows NuGet's shipped
> behaviour (`1.2.3-alpha.*` prefix floats, `*-*` for everything). Try channels
> on the [range selector](https://semver.xyz/selector/).

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

## Build channels

Because a build carries [precedence](#precedence), it can also *select*. A build
attached to a comparator, tilde, or caret, as in `^1.0.0+win`, is a **channel
filter**: it is orthogonal to the numeric comparison and admits only versions
whose own build *begins with* the channel's identifiers. This makes the build a
first-class way to range over release channels and variants: signed builds,
platform or architecture targets, content digests.

1. A comparator's build **MUST** be treated as a channel filter, not as part of
   the numeric comparison.
2. The numeric comparison **MUST** ignore the build on both the comparator and
   the candidate version.
3. A version satisfies a channel if and only if its build identifiers, compared
   left to right, **begin with** the channel's identifiers.
4. A range with **no** build channel matches any build (and the build-less
   release); a channel excludes versions that carry no build.
5. A tilde or caret carrying a channel **MUST** apply that channel to every
   comparator it desugars to. A hyphen range spans two endpoints and **MUST**
   ignore their builds.

- `^1.0.0+win` := `>=1.0.0+win <2.0.0-0+win`: the `win` channel within `^1.0.0`,
  so it matches `1.4.2+win.x64`, not `1.4.2+linux.x64` or `1.4.2`.
- `>=1.1.0+linux.x64`: the `linux.x64` variant at or above `1.1.0`.
- `1.0.0+sha.a1b2c3`: pins the exact artifact (and any narrower build beneath
  it).
- `^1.0.0`: no channel, so every variant of every release in range matches,
  build or not.

> Build channels are a deliberate divergence from Semantic Versioning 2.0.0,
> which discards build metadata during range resolution. See
> [Build Variants](https://semver.xyz/extensions/variants/) for os/arch/abi
> channels and [Package Integrity](https://semver.xyz/extensions/integrity/) for
> a channel built on content digests.

---

This specification is licensed under
[CC BY 3.0](https://creativecommons.org/licenses/by/3.0/). The BNF grammars are at
[semver.xyz/grammar](https://semver.xyz/grammar/), implementations at
[semver.xyz/libraries](https://semver.xyz/libraries/), and answers to common questions,
including interoperability with Python's PEP 440, in the
[FAQ](https://semver.xyz/faq/).
