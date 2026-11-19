# Package Integrity

**Package Integrity** is an extension to [Semantic Versions](../../spec/SPEC.md) that
carries a content-addressable integrity digest **inside** a source-qualified
version, using build metadata:

```
npm:react@18.2.0+sha512.<digest>
```

Because Semantic Versions restores **build precedence** (a build participates in
ordering and is the antithesis of a pre-release), an integrity-bearing build is a
first-class version: two artifacts of `18.2.0` with different digests are distinct,
orderable versions. You can pin, compare and select software by its exact bytes —
in a specifier, a CLI argument, a manifest pin, or a log line — without a side file.

## Why build metadata

[Subresource Integrity](https://www.w3.org/TR/SRI/) strings look like
`sha512-<base64>`. They can't live in a version because Base64 uses `+`, `/` and
`=`, none of which are valid build-metadata identifier characters
(`[0-9A-Za-z-]`). Package Integrity defines a **build-metadata-safe transcoding**
of the same digest so it can travel inside the version string itself.

## Format

A Package Integrity build is one or more integrity digests appended as build
metadata:

```
<version>+<algorithm>.<digest> ( .<algorithm>.<digest> )*
```

- `<algorithm>` is one of the registered SHA-2 algorithms: `sha256`, `sha384`,
  `sha512`. The set is extensible; consumers **MUST** ignore digests whose
  algorithm they do not recognise, and **MUST NOT** treat an unrecognised
  algorithm as a failure on its own.
- `<digest>` is the raw hash bytes encoded as **lowercase hexadecimal**
  (canonical). Hex is a valid build identifier (`[0-9a-f]+`) and is
  unambiguous. A more compact **Base62** encoding (`[0-9A-Za-z]+`, the same
  alphabet used by [Dependency Locks](../dependency-locks/dependency-locks.md))
  **MAY** be used where size matters; both are grammar-valid build identifiers.
  Note that Base62 is case-sensitive and therefore does not survive
  case-normalizing ecosystems — a reason to prefer hex as the interchange default
  even though it is twice the length (see *Ecosystem applicability* below).
- The algorithm and its digest are two separate, dot-separated build
  identifiers (`sha512` then `<digest>`), so the pair is trivially tokenised.
- Multiple digests **MAY** be present, each as its own `<algorithm>.<digest>`
  pair, and **SHOULD** be ordered weakest-to-strongest.

Canonical hex digest lengths: `sha256` → 64 chars, `sha384` → 96 chars,
`sha512` → 128 chars.

### Examples

```
npm:react@18.2.0+sha512.d0a1e5…                 ; single digest
npm:lodash@4.17.21+sha256.5b2f…                 ; sha-256
npm:react@18.2.0+sha256.5b2f….sha512.d0a1e5…    ; multiple algorithms
npm:next@15.0.0-rc.1+sha512.a91c…               ; pre-release + integrity
```

## Precedence

Package Integrity relies on Semantic Versions §Precedence: build identifiers are
compared, so a digest-bearing version is ordered and distinguishable rather than
collapsed away (as it would be under the "build metadata" rules of Semantic
Versioning 2.0.0). This is what makes an integrity digest a usable part of an
identity rather than an inert annotation.

Integrity is **advisory to precedence** but **authoritative to trust**: the digest
does not change what a version *means*, but a mismatch **MUST** cause the artifact
to be rejected.

## Verification

To verify `<source>:<name>@<version>+<algorithm>.<digest>`:

1. Resolve `name@version` from the named source (`npm:` → the configured
   registry).
2. Obtain the artifact (for npm, the version's tarball).
3. Compute the digest of the artifact bytes with `<algorithm>`.
4. Transcode and compare to `<digest>`. The artifact satisfies the identity iff,
   for **every** listed algorithm the consumer supports, the computed digest is
   equal — and at least one supported algorithm was present.
5. A mismatch **MUST** be treated as a fatal integrity error.

The transcoding is lossless: an npm `dist.integrity` of `sha512-<base64>` is the
same bytes as `sha512.<hex>` here; either can be produced from the other.

## Relationship to Build Variants and Dependency Locks

Package Integrity is the **second** of the three extensions: it takes the artifact a
[Build Variant](../variants/variants.md) names and pins its exact bytes
(`1.0.0+linux.x64.musl.sha512.<digest>`).
[Dependency Locks](../dependency-locks/dependency-locks.md) then build on both — a
lock pins an entire resolved subgraph in which **each node** is written in exactly
this form, so the digest notation defined here is the notation a decoded lock uses.
Package Integrity remains the single-artifact, **inline** form: reach for it where a
full lock is unnecessary.

## Ecosystem applicability

The inline form depends on the `+…` build-metadata slot being preserved verbatim and
on a resolver being willing to act on it. Both hold in SemVer and npm. Neither holds
in Python, where the same slot is PEP 440's *local version identifier*: it is
normalized to lower case, resolvers **MUST** ignore it when matching version
specifiers, and PyPI "MUST NOT allow the use of local version identifiers" at all.
Lowercase hex digests survive the case-folding; a Base62 digest does not. But
publishing an integrity-bearing version to PyPI is not possible regardless, so in
that ecosystem the digest belongs in a lockfile or sidecar — where the notation here
is still the useful part. Measurements are in the
[Dependency Locks spec, Appendix E.5](../dependency-locks/dependency-locks-spec.md).

Two adjacent portability notes for npm-ecosystem tooling. An npm `dist.integrity` is
a hash of the published tarball and transcodes cleanly, as above. A **yarn**
`checksum` does not: it is a hash of yarn's own zip artifact, salted with the
lockfile's `cacheKey` (`10c0/3fb59c…`), so it is not the artifact digest and cannot
be transcoded into this form. Take digests from the registry, not from a
`yarn.lock`.

## Grammar (BNF)

Building on [`VERSION.bnf`](../../site/public/spec/VERSION.bnf)'s `<build>`:

```
<integrity build> ::= <integrity> ( "." <integrity> )*
<integrity>       ::= <algorithm> "." <digest>
<algorithm>       ::= "sha256" | "sha384" | "sha512"
<digest>          ::= <hex digest> | <base62 digest>
<hex digest>      ::= <hex> <hex>+
<base62 digest>   ::= <base62 char> <base62 char>+
<hex>             ::= "0" … "9" | "a" … "f"
<base62 char>     ::= "0" … "9" | "A" … "Z" | "a" … "z"
```

## License

Licensed under [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/).
