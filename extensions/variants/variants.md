# Build Variants

**Build Variants** is an extension to [Semantic Versions](../../spec/SPEC.md) that
encodes deployment-target coordinates — operating system, architecture, ABI and
feature flags — as build metadata, so that one version line addresses a whole
family of concrete artifacts:

```
npm:esbuild@0.21.0+darwin.arm64
oci:node@22.3.0+linux.arm64
napi:sharp@0.33.0+linux.x64.musl
```

The same release, built for many targets, stays a single identity. The variants
are siblings of that release, distinguished only by their build metadata — and
because Semantic Versions restores **build precedence**, each is a real, orderable
version rather than an inert tag. The payoff is selection: with the core
[Build Channels](../../spec/SPEC.md#build-channels) rule, a range can address a
coherent *subset* of variants — `^1.0.0+linux.x64` is "the linux/x64 line of the
1.x series" — which no numeric range can express.

## Why build metadata (not a pre-release, not a separate package)

A platform build is **not** a pre-release. A pre-release lowers precedence and
signals "on the way to a release"; a variant is a *finished* sibling of the
release, one of several equally-valid artifacts of the same source. Semantic
Versions ranks a build **at or above** its plain release for exactly this reason.

Nor should a variant fork the identity. The prevailing workaround — publishing
`@img/sharp-linux-x64`, `@img/sharp-darwin-arm64`, … as distinct packages wired
together with `optionalDependencies` and `os`/`cpu`/`libc` filters — scatters one
piece of software across N package names and moves target selection *out* of the
version grammar and into ad-hoc manifest fields. Build Variants keeps one name,
one version, and one selection mechanism (ranges).

## Coordinates

A Build Variant is build metadata whose identifiers name target axes, ordered
**coarse to fine** so that channel prefix-matching drills down cleanly:

```
<version>+<os>[.<arch>[.<abi>]][.<feature>]*
```

1. The axes appear in a fixed order — **os**, then **arch**, then **abi** — and
   each fixed axis **MAY** be omitted only if every later fixed axis is also
   omitted. A variant is therefore always a *prefix* of the axis sequence: `linux`,
   `linux.x64` and `linux.x64.musl` are valid; `x64` alone (arch without os) is not.
2. **Feature tags** — optional, lowercase, free-form (`avx2`, `cuda`, `neon`) —
   **MUST** follow the fixed axes and **SHOULD** be sorted, so a canonical form
   exists.
3. Each axis value is its own dot-separated build identifier, so a variant
   tokenises trivially and slots straight into the existing `<build>` grammar.

Registered axis vocabularies (aligned with common runtime values, e.g. Node's
`process.platform` / `process.arch`):

| Axis   | Values (extensible) |
| ------ | ------------------- |
| `os`   | `linux` · `darwin` · `win32` · `freebsd` · `openbsd` · `android` · `sunos` · `aix` |
| `arch` | `x64` · `arm64` · `arm` · `ia32` · `ppc64` · `s390x` · `riscv64` · `loong64` · `wasm32` |
| `abi`  | `glibc` · `musl` · `msvc` (platform-appropriate) |

Consumers **MUST** ignore axis or feature identifiers they do not recognise and
**MUST NOT** treat an unrecognised identifier as a match failure on its own — an
unknown coordinate simply does not narrow their selection.

## Selection

Selection is nothing new: it is the core **Build Channels** rule applied to variant
coordinates. A `+`-channel on a comparator, tilde or caret is orthogonal to the
numeric comparison and admits only versions whose build coordinates *begin with*
the channel's. Because coordinates are ordered coarse→fine, a shorter channel is a
broader subset:

- `^1.0.0+linux` — every linux variant in the 1.x line (x64, arm64, any libc).
- `^1.0.0+linux.x64` — narrows to linux/x64, both glibc and musl.
- `^1.0.0+linux.x64.musl` — just the musl build.
- `>=1.1.0+darwin.arm64` — the Apple-silicon build at or above 1.1.0.
- `1.2.0+win32.x64` — one exact artifact (and any narrower build beneath it).
- `^1.0.0` — no channel, so **every** variant of every release in range, plus the
  plain build-less release.

Within any such subset the fixed axes are equal, so ordering falls back to numeric
precedence: "the latest linux/x64 build of 1.x" is well-defined and resolvable.

> Prefix matching means a coarse channel also admits deeper refinements: `+linux.x64`
> matches `linux.x64.musl`. To distinguish siblings that share a prefix, make the
> distinguishing axis explicit — model libc as `linux.x64.glibc` vs `linux.x64.musl`
> rather than leaving glibc implicit.

## Relationship to other schemes

- **npm `os`/`cpu`/`libc` + optional-dependency fanout.** Build Variants expresses
  the same target matrix inside one version instead of across many packages, and
  makes it *rangeable*. A resolver can still map a selected variant onto whatever
  artifact layout a registry uses. pnpm has since grown a first-class version of
  the same idea in its lockfile — a `variations` resolution holding a list of
  `variants`, each pairing one artifact with a list of `targets` typed exactly
  `{ os, cpu, libc? }` — which is independent evidence that these are the right
  axes; Build Variants differs in putting the coordinate in the version, where it
  survives outside a lockfile.
- **OCI / Docker multi-arch manifests.** A manifest list selects an image by
  `os`/`architecture`/`variant`; Build Variants lifts that platform tuple into the
  version grammar so the same selection works in a specifier or a lockfile, not
  only at pull time.
- **[Package-URL](https://github.com/package-url/purl-spec) qualifiers.** PURL
  carries target facts in `?arch=…&os=…` query qualifiers, outside the version and
  outside precedence. Build Variants keeps them *in* the version, where they order
  and where ranges can select them — while remaining round-trippable to PURL
  qualifiers for interchange.

## Composability

Variant coordinates are ordinary build identifiers, so they compose with other
build-metadata extensions. Build Variants is the **first** of the three extensions
for a reason: it answers *which artifact*, and the other two build on that answer. A
variant precedes an integrity digest — `1.0.0+linux.x64.musl.sha512.<digest>` pins
the exact bytes of one target — and a
[Dependency Lock](../dependency-locks/dependency-locks.md) pins a whole resolved
graph whose every node is an identity of exactly that shape.

## Ecosystem applicability

Because coordinates live in the `+…` build-metadata slot, this extension applies
wherever that slot is preserved and comparable. That is true of SemVer and of the
npm ecosystem. It is **not** true of Python: PEP 440 calls the same slot a *local
version identifier*, normalizes it to lower case, and requires resolvers to ignore
it when matching version specifiers — and PyPI "MUST NOT allow the use of local
version identifiers" at all. So a variant coordinate cannot be published to PyPI
in a version, and could not influence resolution if it were. In Python-like
ecosystems the coordinate vocabulary is still useful as a *notation* — for
labelling wheels in a lockfile or sidecar, where the platform tags already exist —
but not as an in-version mechanism. See the
[Dependency Locks spec, Appendix E.5](../dependency-locks/dependency-locks-spec.md)
for the measurements.

## Grammar (BNF)

Building on [`VERSION.bnf`](../../site/public/spec/VERSION.bnf)'s `<build>`:

```
<variant build> ::= <os> ( "." <arch> ( "." <abi> )? )? ( "." <feature> )*
<os>            ::= "linux" | "darwin" | "win32" | "freebsd" | "openbsd"
                  | "android" | "sunos" | "aix"
<arch>          ::= "x64" | "arm64" | "arm" | "ia32" | "ppc64" | "s390x"
                  | "riscv64" | "loong64" | "wasm32"
<abi>           ::= "glibc" | "musl" | "msvc"
<feature>       ::= <build identifier>   ; lowercase, alphanumeric-with-hyphen
```

The vocabularies above are the registered baseline and are extensible; a consumer
that meets an unrecognised value treats it as opaque rather than invalid.

## License

Licensed under [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/).
