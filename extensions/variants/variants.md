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
Versions ranks a build **above** its plain release for exactly this reason.

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
<version>+<os>[.<arch>[.<abi>[.<floor>]]][.<qualifier>]*
<version>+wasm32[.<qualifier>]*
```

1. The **fixed axes** appear in a fixed order — **os**, then **arch**, then
   **abi** — and each fixed axis **MAY** be omitted only if every later fixed
   axis is also omitted. A variant is therefore always a *prefix* of the axis
   sequence: `linux`, `linux.x64` and `linux.x64.musl` are valid; `x64` alone
   (arch without os) is not. An omitted axis is no constraint: `linux.x64` with
   no abi is a build that runs on glibc and musl alike.
2. An `abi` of `glibc` or `musl` **MAY** be followed by a **version floor**, the
   lowest version of that C library the build runs on, as numeric identifiers:
   `linux.x64.glibc.2.28` runs on glibc 2.28 or later (the `manylinux` rule).
3. **Qualifiers** follow the fixed axes, in any order. Three kinds are registered:
   - **Floors**, a key followed by numeric identifiers, meaning *this value or
     later*: `osv.11.0` (the OS version, for `darwin` and `win32`: `11.0` is
     macOS Big Sur), `napi.8` (the N-API version a Node addon needs).
   - **Exact tags**, a key followed by one value that must match exactly:
     `node.127` and `electron.123` (the `NODE_MODULE_VERSION` an addon was
     built against). A variant carries `napi` or `node`/`electron`, not both.
   - **Feature tags**, single lowercase identifiers naming an optional
     capability of the target (`avx2`, `cuda`, `neon`), which **SHOULD** be
     sorted so a canonical form exists.
4. `wasm32` stands alone as the whole platform: a WebAssembly build is not tied
   to an operating system, so it takes the place of the fixed axes.
5. Each axis value is its own dot-separated build identifier, so a variant
   tokenises trivially and slots straight into the existing `<build>` grammar.
   Floors are ordinary numeric identifiers, so they compare numerically under
   the core precedence rules with nothing added.

Registered vocabularies (aligned with common runtime values, e.g. Node's
`process.platform` / `process.arch`, and with the platform fields of pnpm and
npm's `variants` proposal):

| Axis or key | Values (extensible) |
| ----------- | ------------------- |
| `os`        | `linux` · `darwin` · `win32` · `freebsd` · `openbsd` · `android` · `sunos` · `aix` |
| `arch`      | `x64` · `arm64` · `arm` (ARMv7) · `ia32` · `ppc64` · `s390x` · `riscv64` · `loong64` |
| `abi`       | `glibc[.M.m]` · `musl[.M.m]` · `msvc` (platform-appropriate) |
| platform    | `wasm32`, in place of the fixed axes |
| floors      | `osv.M[.m]` · `napi.N` |
| exact tags  | `node.N` · `electron.N` |
| features    | any other lowercase identifier |

Consumers **MUST** ignore axis, key or feature identifiers they do not recognise
and **MUST NOT** treat an unrecognised identifier as a match failure on its own —
an unknown coordinate simply does not narrow their selection.

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

A channel narrows a range to the variants a *specifier* asks for. Members of a
subset still order by precedence, so "the latest linux/x64 build of 1.x" is
well-defined: the highest release, and within it the highest build. Precedence
among siblings of one release is lexical, though, and says nothing about which
sibling suits a machine. That is the job of target matching, below.

> Prefix matching means a coarse channel also admits deeper refinements: `+linux.x64`
> matches `linux.x64.musl`. To distinguish siblings that share a prefix, make the
> distinguishing axis explicit — model libc as `linux.x64.glibc` vs `linux.x64.musl`
> rather than leaving glibc implicit.

### Target matching

A **target** is what a client installs for: by default the host, described in the
same vocabulary as a coordinate (`process.platform`, `process.arch`, the C library
and its version, the OS version, the N-API version and `NODE_MODULE_VERSION`, and
whatever features the client can detect). A target can also be configured, for a
container image or a cross-compile; any value it does not state is **unknown**.

A variant **applies to** a target when every coordinate it states is satisfied:

1. Each fixed axis it states equals the target's. An omitted axis is no
   constraint. `wasm32` applies to every target.
2. Each floor it states (a C-library version, `osv`, `napi`) is at or below the
   target's value for that key, compared numerically. A floor on a key the target
   leaves unknown is **not** satisfied: linking a build the host may not run is
   worse than falling through to a broader variant.
3. Each exact tag it states (`node`, `electron`) equals the target's.
4. Each feature tag the client recognises is one the target has; a feature tag the
   client does not recognise is ignored, per the rule above.

The build-less release applies to every target, as the fallback.

To **resolve** a range for a target, a client takes the highest release in the
range that has at least one applicable member, then the most **specific**
applicable member of that release:

1. a variant that states more fixed axes before one that states fewer;
2. then a higher floor before a lower one, and any floor before none;
3. then an exact `node`/`electron` tag before a `napi` floor before neither;
4. then a variant that states more matched feature tags;
5. then a native variant (one with an `os`) before `wasm32`, and `wasm32` before
   the build-less release.

So for a glibc 2.31 host with N-API 9, `1.4.0+linux.x64.glibc.2.28.napi.8` wins
over `1.4.0+linux.x64.glibc.2.17.napi.8`, which wins over `1.4.0+linux.x64`, which
wins over `1.4.0+wasm32` and `1.4.0`. Specificity is computed from the coordinates,
so a publisher never has to order anything by hand, and two clients given the same
target select the same artifact.

## Relationship to other schemes

- **npm `os`/`cpu`/`libc` + optional-dependency fanout.** Build Variants expresses
  the same target matrix inside one version instead of across many packages, and
  makes it *rangeable*. A resolver can still map a selected variant onto whatever
  artifact layout a registry uses.
- **pnpm's platform variants.** pnpm describes a platform build with `os`, `cpu`,
  `libc`, `libcVersion`, `osVersion`, `napi` and `nodeAbi`, ranks the archives of
  one version by how specific their platform is, and writes the result into its
  lockfile. That is the same vocabulary as the coordinates above, and the
  specificity order in [target matching](#target-matching) is pnpm's rank
  computed from the coordinate. Build Variants differs in putting the coordinate
  in the version, where it survives outside a lockfile.
- **npm's `variants` field ([npm/rfcs#928](https://github.com/npm/rfcs/pull/928)).**
  The RFC lists, on a package, the separate packages that replace it per target,
  using pnpm's fields; it is the projection of this extension onto registries that
  hold one artifact per version, and the RFC itself names *several archives per
  version* as its future shape. An entry maps onto a coordinate and back:

  | `variants` entry | Coordinate |
  | --- | --- |
  | `os`, `cpu`, `libc` (one value each) | the fixed axes, in order |
  | `libcVersion: "2.28"` | `glibc.2.28` on the abi axis (the RFC's floor implies glibc) |
  | `osVersion: "11.0"` | `osv.11.0` |
  | `napi: 8` | `napi.8` |
  | `nodeAbi: "node-127"` / `"electron-123"` | `node.127` / `electron.123` |
  | an omitted `libc` | an omitted abi |
  | a cross product (`os: ["darwin"], cpu: ["arm64", "x64"]`) | one coordinate per cell, or the common prefix (`darwin`) when one artifact serves them all |
  | a `!value` exclusion | no counterpart: a coordinate says what an artifact *is*, so an exclusion becomes an omitted axis or several coordinates |
  | `engines.node` | no counterpart: a requirement on the consumer, which stays a manifest field |
  | the unconditional fallback entry | `wasm32`, or the build-less release |

  The RFC's author order ("narrower first, higher floors first, `nodeAbi` before
  `napi`, native before the fallback") is the specificity order here, so a tool
  can generate a correctly ordered `variants` list from a set of coordinates.
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
<variant build> ::= <platform> ( "." <qualifier> )*
<platform>      ::= <os> ( "." <arch> ( "." <abi> )? )?
                  | "wasm32"
<os>            ::= "linux" | "darwin" | "win32" | "freebsd" | "openbsd"
                  | "android" | "sunos" | "aix"
<arch>          ::= "x64" | "arm64" | "arm" | "ia32" | "ppc64" | "s390x"
                  | "riscv64" | "loong64"
<abi>           ::= "glibc" <floor version>? | "musl" <floor version>? | "msvc"
<qualifier>     ::= <floor> | <exact tag> | <feature>
<floor>         ::= ( "osv" | "napi" ) <floor version>
<floor version> ::= "." <numeric identifier> ( "." <numeric identifier> )?
<exact tag>     ::= ( "node" | "electron" ) "." <numeric identifier>
<feature>       ::= <build identifier>   ; lowercase, alphanumeric-with-hyphen
```

The vocabularies above are the registered baseline and are extensible; a consumer
that meets an unrecognised value treats it as opaque rather than invalid.

## License

Licensed under [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/).
