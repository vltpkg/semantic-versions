# Dependency Locks — Full Specification & Internals

**Status:** Specification v1 — implemented by vlt
**Audience:** Package manager implementers, registry operators, security engineers

> **New here? Start with the one-pager.** This document is the complete, normative
> specification with all binary-format, parsing, validation, security, and reference-
> algorithm detail. For a short, approachable overview (website-ready), read
> [`dependency-locks.md`](./dependency-locks.md) first and come back here for the depth.

> **Format identity lives in the payload, not the specifier.** A lock carries no
> version token in the dependency string (the marker is just `+lock.<payload>`). The wire
> format is identified by a single *frame byte* at the front of the decoded payload
> (§5), so the format can evolve without ever changing the specifier grammar, and an
> unknown future format is detected by reading one byte — no in-string version needed.

---

## 1. Abstract

A *Dependency Lock* is a fully resolved, reproducible dependency subgraph embedded
inline within a dependency specifier. It lets a package author publish not just
`source + name + version`, but `source + name + version + resolved dependency closure`,
so a single dependency value pins both the direct dependency and the transitive subgraph
rooted at that dependency **before a consumer generates a native lockfile later**.

A dependency specifier therefore becomes a *portable lockfile fragment*:

```txt
npm:react@19.1.0+lock.<payload>
```

The lock is expressed as **standard SemVer build metadata**: the reserved identifier
`lock` followed by a single payload identifier, both legal SemVer build-metadata
identifiers inside the version component. This means the version remains valid SemVer,
while the surrounding package identity can still include a source/context prefix such as
`npm:`. Lock-unaware tools handle the version through their *existing* build-metadata
behavior (preserve it verbatim, or drop it per normal SemVer precedence rules) rather
than choking on it.

The `<payload>` is a compact, deterministic, self-describing binary blob (text-armored
for transport) describing the resolved graph rooted at the dependency. It is a
maintainer-generated, distributable *seed* for the consumer's native lockfile, not a
parallel validation system (§6.6).

This document is package-manager agnostic. It deliberately avoids any vendor branding
or namespace. Examples use `npm:` as a concrete source/context prefix because it is the
most familiar complete identity for packages from the npm ecosystem. It defines:

1. The dependency-specifier grammar (ABNF).
2. The binary payload format.
3. The text encoding pipeline (binary → Brotli → frame byte → Base62).
4. The precise graph semantics.
5. Validation rules.
6. The consumer policy model.
7. Publishing rules.
8. Security analysis and mitigations.
9. Ecosystem comparison.
10. Size analysis.
11. Reference algorithms (`encode` / `decode` / `validate` / `install`).

Design priorities, in order: **correctness, determinism, portability, long-term
ecosystem adoption**. Backwards compatibility with any single existing package
manager is explicitly a non-goal.

---

## 2. Terminology

The key words **MUST**, **MUST NOT**, **REQUIRED**, **SHALL**, **SHOULD**,
**SHOULD NOT**, **MAY**, and **OPTIONAL** are to be interpreted as in RFC 2119/8174.

- **Specifier** — the textual `source:name@version+lock.<payload>` string that appears in a manifest, e.g. `npm:react@19.1.0+lock.<payload>`.
- **Source/context prefix** — the optional `source:` prefix that identifies the package ecosystem or source context (`npm:` in examples). It is outside SemVer.
- **Lock** — the resolved subgraph plus metadata encoded in the payload.
- **Payload** — the text-armored encoding of the lock that appears after the `lock`
  build-metadata identifier (a single Base62 identifier).
- **Frame byte** — the first octet of the Base62-decoded payload; identifies the
  format version and compression codec (§5).
- **Blob** — the decoded canonical binary form (post Base62, post frame byte, post Brotli).
- **Root** — the package instance the specifier names; the entry point of the graph.
- **Node** — a single resolved package *instance* (a package at a specific resolution).
- **Edge** — a directed, named dependency relationship from one node to another.
- **Closure** — the set of all nodes reachable from the root via edges.
- **Lock digest** — a cryptographic digest computed over the canonical blob (§7.2).
- **Artifact integrity** — the package manager's normal metadata/native-lockfile digest
  for a package's distributed artifact (tarball). Dependency Locks do not replace it.

A **resolved package instance** is the unit identified by the tuple
`(source, name, version, resolution-context)`. Two dependents that resolve the same package
to the same tuple share one node; if resolution differs (e.g. different peer
context forcing a different version) they are distinct nodes.

---

## 3. Dependency Spec Syntax

### 3.1 Design decisions

**Relationship to SemVer Extended / SemVer v3.** Dependency Locks deliberately separate
package identity from the SemVer value itself. The `source:` prefix expresses the
software context (`npm:react`), while `version+lock.<payload>` remains a valid SemVer
version with build metadata. This aligns with the SemVer Extended / SemVer v3 direction
outlined in ["Spec-tacular - SemVer & Beyond"](https://gitnation.com/contents/spec-tacular-semver-and-beyond):
versions need context, build metadata should not be treated as meaningless decoration,
and tooling needs explicit language for version sets and package identity.

**Q: Should the lock syntax use SemVer build-metadata syntax (`+`)?**

**Yes — fully.** The lock is encoded as *conforming* SemVer build metadata so the
version component remains valid SemVer even when the full package identity includes a
source/context prefix. This is the single most important adoption decision in the spec,
and it rests on two facts:

1. **Build metadata is a viable transport, not support by itself.** SemVer §10 says
   build metadata is ignored for precedence. Measured against npm, pnpm, yarn (1 and 4),
   and bun (Appendix D): those tools tolerate exact versions carrying `+lock.<Base62>`
   build metadata. This is a transport finding only. It does **not** mean those package
   managers understand, validate, or honor Dependency Locks. Today the target supporting
   implementation is vlt; other tools can adopt the same format if they choose.
2. **Graceful degradation is the desired behavior, not a regression.** A lock is an
   *additive* feature layered on a still-valid pin. A tool that doesn't understand it
   losing nothing but the enhancement is exactly progressive enhancement (§9.3). The
   security guarantees that actually matter survive this (§6.6, §7.5).

The cost is the payload alphabet: SemVer build-metadata identifiers permit only
`[0-9A-Za-z-]`. We therefore use **Base62** (`0-9A-Za-z`) for the text armor, not
Base64URL — Base64URL's `_` is illegal in build metadata and would make npm reject the
whole version instead of stripping gracefully. The size cost of Base62 over Base64 is
~0.85% (§12).

**Q: Is there a version token in the specifier?**

**No.** Earlier drafts embedded `lock.v1`. We dropped it. Format identity lives in a
single **frame byte** at the front of the decoded payload (§5.2), readable *before*
decompression. Benefits:

- The specifier grammar never changes across format revisions.
- One fewer dot-separated identifier, smaller specifiers, simpler detection.
- Forward compatibility is still total: an unknown frame byte ⇒ `UninterpretableLock`
  ⇒ policy fallback (§9), detected by reading one byte.

The trade-off accepted: the *text armor itself* (Base62) is now a permanent invariant
— it cannot be renegotiated per-version, because you must Base62-decode to even read
the frame byte. This is acceptable: Base62 is already pinned by the "valid build
metadata" requirement, so there was no freedom to give up. All real evolution
(structure, compression) happens behind the frame byte.

**Q: How is a lock detected inside a version string?**

Build metadata is a dot-separated set of identifiers. The lock occupies a recognizable
**pair**: the reserved identifier `lock` immediately followed by a single payload
identifier. Detection *scans* the identifiers for `lock` rather than assuming the lock
owns the whole build-metadata region — so the lock coexists with other tools' build
metadata (`+git.abc1234`, `+build.42`). See §3.3–§3.4.

**Q: How should invalid / malformed locks be handled?**

Gracefully. A malformed lock marker is surfaced to the policy layer (§9) as
`MalformedLock`; under `prefer`/`ignore` it is a **warning + fallback to the bare
version**, never a manifest-rejecting hard error. Only `strict` makes it fatal. Fetch-time
artifact integrity failures still abort under the package manager's normal integrity
rules — see §6.6 for why that is the real security boundary.

**Q: How are unknown future formats handled?** Unknown frame byte ⇒ `UninterpretableLock`
⇒ policy fallback (§9). Detected pre-decompression.

### 3.2 ABNF grammar

The following ABNF (RFC 5234) defines a dependency specifier. The optional
`source-prefix` identifies the package ecosystem or source context (`npm:` in examples).
The `version` is an ordinary SemVer version; the lock lives entirely within standard
build metadata. Core SemVer productions follow [Semantic Versioning 2.0.0] and are
reproduced for completeness. Lock recognition is a *semantic* rule over the build
identifiers (§3.3), not a separate syntactic dialect.

```abnf
; ---------- Top level ----------
dependency-spec   = [ source-prefix ] pkg-name "@" version
source-prefix     = source-scheme ":"
source-scheme     = ALPHA *( ALPHA / DIGIT / "+" / "-" / "." )

; A normal SemVer version. Build metadata MAY carry a lock (and other identifiers).
version           = semver-core [ "-" pre-release ] [ "+" build ]

; ---------- Build metadata (standard SemVer) ----------
build             = build-id *( "." build-id )
build-id          = 1*( ALPHA / DIGIT / "-" )       ; SemVer build identifier

; ---------- Lock recognition (semantic, applied over `build` identifiers) ----------
; A lock is present iff exactly one build-id equals the reserved word "lock" and is
; immediately followed by a payload identifier:
;     ... "+" *( build-id "." ) "lock" "." lock-payload [ "." build-id ... ]
lock-marker       = %s"lock"                         ; case-sensitive reserved id
lock-payload      = 1*base62-char                    ; a single build-id, Base62 only
base62-char       = ALPHA / DIGIT                    ; 0-9 A-Z a-z  (no "-", no "_")

; ---------- Package name ----------
; Package-manager defined; this is a permissive default.
pkg-name          = [ scope "/" ] bare-name
scope             = "@" 1*name-char
bare-name         = 1*name-char
name-char         = ALPHA / DIGIT / "-" / "_" / "."

; ---------- SemVer core (RFC-style, abbreviated) ----------
semver-core       = numeric-id "." numeric-id "." numeric-id
pre-release       = pre-id *( "." pre-id )
pre-id            = alphanum-id / numeric-id
alphanum-id       = 1*( ALPHA / DIGIT / "-" )
numeric-id        = "0" / nonzero-digit *DIGIT
nonzero-digit     = %x31-39                          ; 1-9
DIGIT             = %x30-39
ALPHA             = %x41-5A / %x61-7A
```

Notes:

- `lock-payload` is a **single** build identifier — it contains no `.` (dots delimit
  identifiers) and no `_` (illegal in build metadata). Base62 guarantees both.
- The payload's internal structure (frame byte + Brotli of the canonical blob) is
  defined by §5, not by the grammar. The grammar treats it as one opaque Base62 token.
- `lock` is a **reserved build-metadata identifier** for this purpose. A project that
  already uses a bare `lock` identifier in build metadata for an unrelated reason
  would collide; this is the deliberate cost of riding standard build metadata.

### 3.3 Parsing / detection algorithm

```text
parse_specifier(s):
    source = None
    body = s

    at0 = last_index_of(s, "@")           # rightmost '@' separates name/version
    colon = index_of(s, ":")
    if colon >= 0 and colon < at0 and is_source_scheme(s[0:colon]):
        source = s[0:colon]
        body = s[colon+1:]

    at = last_index_of(body, "@")         # rightmost '@' (scoped names: @scope/x)
    if at < 0: return BareName(s)
    name = body[0 : at]; rest = body[at+1 : ]

    plus = index_of(rest, "+")            # build metadata begins at first '+'
    if plus < 0:
        return Spec(source, name, version=rest, build=[], lock=None)

    base  = rest[0 : plus]                # major.minor.patch[-prerelease]
    build = rest[plus+1 : ].split(".")    # dot-separated build identifiers

    # Scan for the reserved 'lock' identifier.
    lock_at = [i for i, id in enumerate(build) if id == "lock"]

    if len(lock_at) == 0:
        return Spec(source, name, version=base, build=build, lock=None)   # build meta, no lock
    if len(lock_at) > 1:
        return Spec(..., lock=Malformed("ambiguous: multiple 'lock' markers"))
    i = lock_at[0]
    if i + 1 >= len(build):
        return Spec(..., lock=Malformed("'lock' marker with no payload identifier"))

    payload = build[i + 1]
    if payload == "" or not is_base62(payload):
        return Spec(..., lock=Malformed("invalid Base62 lock payload"))

    # Preserve any other build identifiers (the lock pair is removed) so foreign
    # build metadata round-trips. Resolution matches on `base` (SemVer ignores
    # build metadata for precedence anyway).
    passthrough = build[:i] + build[i+2:]
    return Spec(source, name, version=base, build=passthrough, lock=Lock(payload))
```

Note that `parse_specifier` never raises on lock problems: a malformed lock is carried
as `Malformed(...)` and resolved by policy (§9), and the surrounding version always
parses as ordinary SemVer. This is what makes the feature non-breaking.

### 3.4 Disambiguation rules

1. If present, the source/context prefix is the first `source-scheme ":"` before the
   rightmost `@`. `npm:@scope/pkg@1.0.0+lock.X` therefore has source `npm`, name
   `@scope/pkg`, and version `1.0.0+lock.X`.
2. The name/version split uses the **rightmost** `@`. Build metadata begins at the
   **first** `+` inside the version component (standard SemVer).
3. The lock is the build identifier `lock` followed by exactly one payload identifier.
   Other build identifiers may appear before or after the pair and MUST be preserved.
4. **At most one** `lock` identifier may appear. Two or more ⇒ `MalformedLock`
   (ambiguous), handled by policy — not a silent "pick one."
5. `lock` is matched **case-sensitively** (lowercase). `Lock`, `LOCK`, etc. are
   ordinary build identifiers, not lock markers.
6. The payload must be a non-empty Base62 identifier. A `lock` marker that is last,
   empty, or non-Base62 ⇒ `MalformedLock`.

### 3.5 Error handling at the grammar layer

Because the lock is valid SemVer build metadata, the *version* always parses; lock
problems never reject the manifest. They are classified and deferred to policy (§9):

- **No lock present** (no `lock` identifier): `Spec.lock == None`. Resolve bare.
- **Malformed lock marker** (ambiguous, payloadless, or non-Base62 payload):
  `MalformedLock`. Under `prefer`/`ignore` ⇒ warn + resolve bare; under `strict` ⇒
  abort. This is a deliberate softening from earlier drafts: a corrupted lock is
  treated like an absent one for availability, because the genuine security boundary
  is the package manager's install-time integrity check, not lock-marker syntax (§6.6).
- **Decodable marker, invalid payload contents** (bad Base62 quantum, bad frame byte,
  bad Brotli, failing internal checks): a *validation* failure handled in §7, again
  policy-mediated.
- **Unknown frame byte** (future format): `UninterpretableLock`, §9 fallback.

---

## 4. Lock Payload Format (canonical binary blob)

This section defines the *canonical blob* — the decoded structure that sits behind the
frame byte and compression (§5). The blob is a compact, deterministic binary structure. It is **not** JSON. It is
designed for minimal size, deterministic (canonical) encoding/decoding, fast
validation, and trivial cross-language implementation (only LEB128 varints, length-
prefixed byte strings, and fixed enums are required).

> **Two on-the-wire layouts.** §4.2–§4.11 specify the original **format 1** byte
> layout (frame high-nibble `0x1`), which remains valid and decodable for
> back-compat. The **current** layout is **format 2** (frame high-nibble `0x2`,
> §4.12): a compact, columnar profile that reuses every enum and semantic rule below
> — source kinds (§4.5), digest algorithms (§4.6), conditions (§4.7), node flags
> (§4.8), edge types (§4.9) — but packs them ~20–35% smaller for copy/paste. Both
> formats encode the identical logical graph (§2); they differ only in byte layout,
> so a format-1 and a format-2 lock of the same graph decode to the same nodes and
> edges. Their *lock digests* differ, because the digest is taken over the canonical
> blob actually used (§7.2).

### 4.1 Primitive encodings

- **`uvarint`** — unsigned LEB128. 7 bits per byte, little-endian groups, high bit =
  continuation. Canonical form REQUIRED: the shortest encoding that represents the
  value (no trailing `0x80` padding). Decoders MUST reject non-canonical varints.
- **`bytes`** — `uvarint len` followed by `len` raw octets.
- **`str`** — `bytes` whose octets are UTF-8. Decoders MUST validate UTF-8 and
  reject overlong/invalid sequences. Strings are compared and sorted by raw octet
  value (bytewise), never by locale.
- **`u8`** — a single octet (used for small enums/flags).
- **Indices** — every reference into a table is a `uvarint` 0-based index. There is
  no NULL; "absent" is expressed via flag bits, never via a sentinel index.

All multi-byte numeric fields use varints; there are no fixed-width little/big-endian
integers anywhere except `u8`. This removes endianness from the format entirely.

### 4.2 Top-level layout (format 1)

```text
Blob :=
    Header
    StringTable
    SourceTable
    DigestTable
    ConditionTable
    NodeTable
    EdgeSection
    Trailer
```

Sections appear in exactly this order. There is no inter-section padding. This is the
**format-1** layout; the current **format-2** layout (§4.12) reuses the tables and
enums defined below but rearranges them columnar-style and drops the magic, trailer,
and version strings.

### 4.3 Header

```text
Header :=
    magic        : 2 bytes  = 0x4C 0x4B          ; "LK" — corruption sentinel only
    flags        : uvarint                       ; see below
    string_count : uvarint
    source_count : uvarint
    digest_count : uvarint
    cond_count   : uvarint
    node_count   : uvarint
    root_id      : uvarint                       ; node index of the root
```

The format **version** is **not** in the header — it is the frame byte that precedes
compression (§5.2). The 2-byte `magic` is only a post-decompression corruption/
mis-routing sentinel (it confirms we decompressed the thing we expected); it carries no
version semantics. `flags` (header):

| Bit | Name              | Meaning                                                   |
|-----|-------------------|-----------------------------------------------------------|
| 0   | `HAS_CONDITIONS`  | `ConditionTable` is non-empty / referenced                |
| 1   | `HAS_PEER_EDGES`  | At least one edge has type `peer`                          |
| 2   | `HAS_OPTIONAL`    | At least one node or edge is optional                      |
| 3   | `HAS_TRAILER_SUM` | `Trailer` carries an internal checksum (§4.10)            |
| 4–  | reserved          | MUST be 0 in this format version; decoders MUST reject if set |

Hint flags (0–2) are advisory accelerators; a validator MUST NOT trust them over
the actual table contents (a lie in a hint bit is itself a validation failure, §7).

### 4.4 String table

The single interned pool for all human-readable text: package names, version
strings, edge dependency names (for aliasing), source identifiers' display forms,
and condition tokens.

```text
StringTable := string_count * str        ; each entry is a length-prefixed UTF-8 str
```

**Canonical ordering (REQUIRED):** entries are sorted ascending by raw octet value
and de-duplicated. Because order is fixed by content, the index assigned to any
string is a pure function of the string set — a prerequisite for deterministic
encoding (§7.2). Decoders MUST verify strict ascending order and reject duplicates
or misordering.

### 4.5 Source table

A *source* is where a package artifact is fetched from: a registry, a VCS URL, a
tarball URL, etc. Sources are interned separately from strings so that nodes
reference them by small integer IDs and identical registries cost one entry.

```text
SourceTable := source_count * SourceEntry

SourceEntry :=
    kind     : u8            ; see enum
    ref      : uvarint       ; index into StringTable (URL/identifier text)
```

Source `kind` enum:

| Value | Kind        | `ref` semantics                                          |
|-------|-------------|----------------------------------------------------------|
| 0     | `default`   | The consumer's configured default registry; `ref` index ignored (MUST be 0) |
| 1     | `registry`  | Registry base URL (string)                               |
| 2     | `https`     | Direct tarball/artifact URL                              |
| 3     | `git`       | VCS URL (commit pin SHOULD be in the URL fragment)       |
| 4     | `file`      | Local path (discouraged in published locks; §9.x)        |
| 5–    | reserved    | MUST reject if encountered                               |

By convention, source ID `0` is the canonical "default registry" entry and SHOULD be
present whenever any node uses the default registry, so that the common case costs a
single shared ID. Encoders MUST place a `kind=0` entry first if used.

**Why encode registry URLs at all?** Because a lock that does not pin the source is
not reproducible across differently-configured environments. However, see the
security discussion (§10.6): consumers MAY *remap* sources via policy (e.g., force
all `registry` sources to a corporate mirror) before fetch, while still applying their
normal artifact-integrity checks after fetch.

### 4.6 Digest table

Digest entries are optional host-integrity metadata. They are present only when the
producing/consuming package manager chooses to carry artifact integrity through the lock
payload; they do not replace registry metadata, package metadata, or the consumer's native
lockfile integrity records. When present, digests are stored as **raw bytes**, not SRI
base64 strings, saving ~33% and avoiding base64 canonicalization issues.

```text
DigestTable := digest_count * DigestEntry

DigestEntry :=
    algo   : u8            ; algorithm enum
    digest : bytes         ; raw digest octets (length implied by algo, but length-prefixed for safety)
```

Algorithm enum:

| Value | Algorithm | Digest length | Status                          |
|-------|-----------|---------------|---------------------------------|
| 0     | reserved  | —             | MUST reject                     |
| 1     | `sha256`  | 32            | REQUIRED to implement           |
| 2     | `sha512`  | 64            | REQUIRED to implement           |
| 3     | `blake3`  | 32            | RECOMMENDED                     |
| 4     | `sha1`    | 20            | DEPRECATED; read-only, MUST NOT encode in new locks |
| 5–    | reserved  | —             | MUST reject                     |

Decoders MUST verify `len(digest)` matches the algorithm's fixed length and reject
otherwise. Digests are sorted ascending by `(algo, digest-bytes)` and de-duplicated
for determinism.

### 4.7 Condition table

Platform/runtime conditions gate optional or platform-specific nodes/edges (e.g.
`os=linux`, `cpu=arm64`, `libc=glibc`, `runtime>=18`). A condition is a small typed
predicate; multiple predicates are combined as a conjunction set referenced by ID.

```text
ConditionTable := cond_count * ConditionSet

ConditionSet :=
    pred_count : uvarint
    preds      : pred_count * Predicate

Predicate :=
    axis  : u8           ; condition axis enum
    op    : u8           ; comparison op enum
    value : uvarint      ; index into StringTable
```

Condition `axis` enum (extensible; unknown axes ⇒ the *node/edge* is treated as
**not satisfiable** under `strict`, see §7.7):

| Value | Axis      | Example values        |
|-------|-----------|-----------------------|
| 0     | `os`      | `linux`,`darwin`,`win32` |
| 1     | `cpu`     | `x64`,`arm64`,`ia32`  |
| 2     | `libc`    | `glibc`,`musl`        |
| 3     | `runtime` | `node`,`bun`,`deno`   |
| 4     | `engines` | semver range string   |
| 5–    | reserved  | —                     |

`op` enum: `0 = eq`, `1 = neq`, `2 = in` (value is a `,`-joined set), `3 = semver-range`.
A `ConditionSet` is satisfied iff **all** predicates hold for the installing
environment.

`ConditionSet` index `0` is reserved to mean **"always"** (the empty set) and MUST be
the first entry whenever any conditions exist; nodes/edges with no condition encode
index `0` implicitly via a cleared flag bit (so the common unconditional case costs
zero bytes — see §4.8).

### 4.8 Node table

A node is one resolved package instance. Nodes are emitted in **canonical sorted
order** (§7.2), which assigns each node its `node_id` (0-based, matching emission
order). `root_id` in the header points at one of them.

```text
NodeTable := node_count * NodeRecord

NodeRecord :=
    name_id   : uvarint     ; StringTable index
    ver_id    : uvarint     ; StringTable index (the *resolved* exact version)
    flags     : u8          ; node flags (below)
    [ source_id : uvarint ] ; present iff FLAG_HAS_SOURCE
    [ digest_id : uvarint ] ; present iff FLAG_HAS_INTEGRITY
    [ cond_id   : uvarint ] ; present iff FLAG_HAS_CONDITION
```

Node `flags` (`u8`):

| Bit | Name                | Meaning                                                       |
|-----|---------------------|---------------------------------------------------------------|
| 0   | `FLAG_HAS_SOURCE`   | `source_id` field present. If clear ⇒ source `0` (default).   |
| 1   | `FLAG_HAS_INTEGRITY`| `digest_id` field present as optional host-integrity metadata.|
| 2   | `FLAG_HAS_CONDITION`| `cond_id` field present. If clear ⇒ condition `0` ("always").|
| 3   | `FLAG_OPTIONAL`     | This instance is optional (failure to fetch is non-fatal).    |
| 4   | `FLAG_DEV_ONLY`     | Instance is reachable only via dev edges (informational).     |
| 5   | `FLAG_BUNDLED`      | Artifact is bundled inside its parent; no separate fetch.     |
| 6–7 | reserved            | MUST be 0.                                                     |

Optional fields are present **only** when their flag is set, so the steady-state
node (default registry, unconditional) costs `name_id + ver_id + flags` ≈ 3–5 bytes
pre-compression before any optional source, digest, or condition fields.

The **resolved version** (`ver_id`) is always an exact version, never a range. A lock
encodes the *result* of resolution, not constraints.

### 4.9 Edge section

Edges are stored grouped by source node, in ascending `from_id` order, with the
group for each node holding edges sorted by `(name_id, to_id, type)`. This grouping
delta-compresses well and gives O(node) random access.

```text
EdgeSection := node_count * EdgeGroup       ; one group per node, in node_id order

EdgeGroup :=
    edge_count : uvarint                    ; number of out-edges from this node
    edges      : edge_count * EdgeRecord

EdgeRecord :=
    name_id : uvarint      ; dependency name under which the target is required
                           ;   (supports aliases: name_id may differ from target node's name)
    to_id   : uvarint      ; target node_id (delta-encoded; see below)
    type    : u8           ; edge type enum
```

**Edge type** enum:

| Value | Type        | Meaning                                                     |
|-------|-------------|-------------------------------------------------------------|
| 0     | `prod`      | Normal runtime dependency.                                  |
| 1     | `dev`       | Development-only dependency (typically only on the root).   |
| 2     | `optional`  | Optional dependency (missing target is tolerated).          |
| 3     | `peer`      | Peer dependency *placement* — the concrete instance chosen. |
| 4     | `peer-opt`  | Optional peer dependency.                                   |
| 5–    | reserved    | MUST reject.                                                |

**`to_id` delta encoding:** within an `EdgeGroup`, the first edge stores `to_id`
as a zigzag varint relative to the group's `from_id` (`to_id - from_id`, zigzag so
back-edges are cheap); each subsequent edge stores `to_id` as an unsigned varint
delta from the previous edge's `to_id` (the group is pre-sorted by `name_id, to_id`,
but the encoder MAY re-derive a monotonically increasing `to_id` order for the delta
chain — see §7.2 for the exact canonical rule). This keeps the common case (edges
pointing to nearby, recently-emitted nodes) to 1 byte.

> **Determinism note:** the canonical sort key for edges is `(name_id, to_id, type)`,
> but the *delta chain* is computed over `to_id` in ascending order. The encoder
> emits edges in canonical `(name_id, to_id, type)` order and stores `to_id` deltas
> against the previous emitted edge regardless of sign using zigzag. Decoders simply
> accumulate. (See reference code §13.1.)

**Peer placement is fully captured.** Because each node is a concrete resolved
instance and each peer edge points at a specific `to_id`, the graph encodes *which*
instance satisfies a peer requirement in *each* context. If the same package must see
two different peer resolutions, it is represented as two distinct nodes with distinct
out-edges — i.e., the classic "virtual store" duplication is encoded explicitly.

### 4.10 Trailer

```text
Trailer :=
    [ checksum : 32 bytes ]   ; present iff Header.flags bit 3 (HAS_TRAILER_SUM)
    end_marker : 1 byte = 0x00
```

The optional `checksum` is a SHA-256 over **all preceding bytes of the blob** (Header
through EdgeSection). It is a fast, self-contained corruption check distinct from the
*lock digest* (§7.2), which is computed by the consumer over the canonical blob and
used for stronger identity/equality checks. `end_marker` MUST be `0x00`; any trailing
bytes after it are a validation error (no silent trailing data).

### 4.11 Worked micro-example (format 1, structure only)

A root `npm:left-pad@1.3.0` with one prod dep `npm:xyz@2.0.0`, both from the default
registry:

```text
Header:    magic "LK", flags=0, strings=4, sources=1, digests=0,
           conds=0, nodes=2, root_id=0
           (frame byte 0x10 sits ahead of compression, see §5)
Strings:   ["1.3.0", "2.0.0", "left-pad", "xyz"]      (sorted bytewise)
Sources:   [ {kind:0} ]                                 (default registry)
Digests:   []
Conds:     []
Nodes:     id0 = {name="left-pad", ver="1.3.0", flags=0}
           id1 = {name="xyz",      ver="2.0.0", flags=0}
Edges:     group(id0) = [ {name="xyz", to=id1 (Δ+1), prod} ]
           group(id1) = [ ]   (edge_count 0)
Trailer:   end 0x00
```

### 4.12 Format 2 — compact columnar layout (current)

**Format 2** (frame high-nibble `0x2`, §5.2) is the current canonical blob. It encodes
the same logical graph as format 1 and reuses, unchanged, the **source kind** (§4.5),
**digest algorithm** (§4.6), **condition** (§4.7), **node-flag** (§4.8), and
**edge-type** (§4.9) vocabularies. It changes only the byte layout, for size and
compressibility:

- **No `magic`.** The frame byte (§5.2) is the authoritative discriminator; the 2-byte
  `"LK"` sentinel is dropped.
- **No `Trailer`.** The framed payload length bounds the blob; integrity is the lock
  digest (§7.2) plus the frame. (`HAS_TRAILER_SUM` does not exist in format 2.)
- **Structural versions.** A resolved version is stored as `major`, `minor`, `patch`
  varints plus a small index into an **extra pool** for the rare pre-release/build
  tail — not as an interned version string.
- **Edge-name elision.** An edge's dependency name equals its target node's name in the
  common (non-aliased) case, so it is **not stored**; only genuinely aliased edges carry
  a name. vlt's lockfile keeps the name on every edge; format 2 reconstructs it from the
  target on decode, so the translation is lossless.
- **Columnar.** Per-node and per-edge fields are emitted as parallel runs (all
  name-ids, then all majors, … then all edge targets, then all edge types) so similar
  values — long runs of `0x00` type bytes, adjacent versions — cluster and Brotli does
  far better than on interleaved records.
- **`ALL_DEFAULT` fast path.** When every node uses the consumer's default registry and
  carries no lock-side integrity (the overwhelmingly common case), the `SourceTable`,
  `DigestTable`, and per-node source/digest fields are omitted entirely and a single
  header flag records the fact.

**Layout:**

```text
Blob2 :=
    flags        : u8             ; bit 0 = ALL_DEFAULT (no SourceTable/DigestTable; every
                                  ;   node is default-registry with no lock-side integrity)
                                  ; bits 1.. reserved, MUST be 0
    node_count   : uvarint
    edge_count   : uvarint
    root_id      : uvarint        ; node index of the root (retained for root-match, §7.4)

    name_count   : uvarint
    NameTable    : name_count * FrontCodedName   ; canonical bytewise order, deduped

    extra_count  : uvarint
    ExtraPool    : extra_count * str             ; pre-release/build tails & non-semver escapes

    ; ---- node columns (each of length node_count, in canonical node_id order) ----
    name_ids     : node_count * uvarint          ; index into NameTable
    majors       : node_count * uvarint
    minors       : node_count * uvarint
    patches      : node_count * uvarint
    extras       : node_count * uvarint          ; 0 = none, else (ExtraPool index + 1)

    ; ---- edges, CSR + columnar ----
    out_degrees  : node_count * uvarint          ; out-edge count per node, node_id order
    targets      : edge_count * uvarint          ; zigzag Δ within each group (see §4.9)
    types        : edge_count * u8               ; edge type; high bit (0x80) = HAS_ALIAS
    alias_ids    : (#aliased) * uvarint          ; NameTable index, one per HAS_ALIAS edge,
                                                 ;   in edge emission order

FrontCodedName :=
    shared : uvarint    ; bytes shared with the previous NameTable entry (prefix length)
    suffix : bytes      ; the remaining suffix (length-prefixed UTF-8)
```

**Canonical order (REQUIRED).** Nodes are sorted by `(name-bytes, version-bytes)` as in
§7.2, assigning `node_id`. The `NameTable` is the deduped set of node names sorted
bytewise and front-coded against the previous entry. Within each node's edge group,
edges are sorted by `(to_id, type, alias_id)`; targets are delta+zigzag coded against
the group's `from_id`, then the previous target, exactly as §4.9.

**Structural-version escape.** If a resolved version is not of the shape
`<num>.<num>.<num>[tail]`, the encoder stores `0,0,0` in the numeric columns and an
extra entry of `"="` followed by the verbatim version; the leading `=` marks a verbatim
version on decode. Otherwise, when the tail is non-empty, the extra entry is the exact
tail — `"-" pre`, `"+" build`, or `"-" pre "+" build` — appended to `major.minor.patch`
to reconstruct the string.

**Non-default profile.** When `ALL_DEFAULT` is clear, the lock carries optional per-node
**integrity** (`DigestTable`, §4.6) and/or **conditions** (`ConditionTable`, §4.7). The
byte layout extends `Blob2` as follows (only the additions to the `ALL_DEFAULT` layout
above are shown):

```text
    ...ExtraPool...                               ; also holds condition-value strings
    digest_count : uvarint
    DigestTable  : digest_count * DigestEntry     ; algo u8, len uvarint, raw bytes (§4.6)
    cond_count   : uvarint
    ConditionTable : cond_count * ConditionSet    ; set 0 = "always"; preds (axis,op,value) (§4.7)
    ...name_ids, majors, minors, patches, extras  ; version columns, unchanged
    flags        : node_count * u8                ; node flags (§4.8): bit1=integrity, bit2=condition
    digest_ids   : (#integrity nodes) * uvarint   ; node_id order, only where flag bit 1 is set
    cond_ids     : (#condition nodes) * uvarint    ; node_id order, only where flag bit 2 is set
    ...edge section                               ; unchanged
```

A `Predicate`'s `value` indexes the shared `ExtraPool` (the same pool that holds version
tails), so condition strings — `os`/`cpu`/`libc` values and `engines` ranges — cost
nothing extra beyond the pool entry. Digests are stored as raw, length-prefixed bytes and
deduplicated, so platform-sibling packages that share no digest still each carry their
own. **Integrity is advisory:** a consumer MAY use it as a pre-flight tamper-evidence
check, but its package manager still verifies every fetched artifact independently (§6.7,
§10). Source stays implicitly default — `FLAG_HAS_SOURCE` clear, no `SourceTable` — until
a non-default source appears. The reference encoder (`site/src/lock/encode.js`) emits this
profile whenever any node carries integrity or a platform condition, and the
`ALL_DEFAULT` fast path otherwise.

> **Size note.** Digest bytes are effectively random and do **not** compress, so embedding
> a sha512 per node adds ~64 raw bytes (~86 Base62 chars) each — often dwarfing the rest of
> the graph. Producers that prioritize a short, copy-pasteable payload MAY omit integrity
> (shipping the `ALL_DEFAULT` profile); conditions, by contrast, are small and compress
> well. The reference generator exposes this as a per-lock toggle.

**Worked micro-example.** The same graph as §4.11 (`left-pad@1.3.0` → `xyz@2.0.0`):

```text
flags        = 0x01            ; ALL_DEFAULT
node_count   = 2
edge_count   = 1
root_id      = 0               ; "left-pad" sorts before "xyz"
NameTable    = [ "left-pad" (shared 0), "xyz" (shared 0) ]
ExtraPool    = []              ; both versions are bare major.minor.patch
name_ids     = [ 0, 1 ]
majors       = [ 1, 2 ]
minors       = [ 3, 0 ]
patches      = [ 0, 0 ]
extras       = [ 0, 0 ]
out_degrees  = [ 1, 0 ]
targets      = [ zigzag(1-0)=2 ]   ; node0 → node1
types        = [ 0x00 ]            ; prod, no alias
alias_ids    = []
```

No magic, no trailer, no source/digest/condition tables — the whole blob is a handful
of bytes and, being below the Brotli break-even, ships uncompressed under codec `0x1`
(§5.3).

---

## 5. Encoding Pipeline & Compression

### 5.1 Pipeline

```txt
canonical binary blob  →  Brotli (or stored)  →  prepend frame byte  →  Base62  →  <payload>
```

The compression step is **codec auto-select** (§5.3): the encoder Brotli-compresses the
blob and keeps the result only if it is smaller than the blob itself, otherwise it
stores the blob verbatim. The chosen codec is recorded in the frame byte (§5.2).

Decode reverses it: `Base62⁻¹` → read frame byte → (if codec supported) inflate or take
the remainder verbatim → parse the canonical blob (§4).

```txt
frame = frame-byte (1 octet) || codec(canonical-blob)   ; codec ∈ { Brotli, stored }
<payload> = Base62(frame)
```

### 5.2 The frame byte (format + codec identity)

The first octet of the Base62-decoded `frame` identifies the format. It is read
**before decompression** so version routing never requires decoding the body:

```text
frame-byte (bit layout):
    bits 7..4 : format version    (0x1 = legacy interleaved; 0x2 = current columnar, §4.12)
    bits 3..0 : compression codec (0x0 = Brotli; 0x1 = none / stored)
current values:
    0x20  ; format 2, Brotli   (graphs where compression pays off)
    0x21  ; format 2, stored   (tiny graphs — codec auto-select, §5.3)
    0x10  ; format 1, Brotli   (legacy; still decodable)
```

Codec `0x1` ("none" / "stored") means the body after the frame byte **is** the canonical
blob, byte-for-byte, with no compression. It is selected when Brotli would not shrink the
blob — its fixed framing overhead exceeds the savings on very small graphs (e.g. a
single-package lock). The lock digest (§7.2) is unaffected: it is always taken over the
canonical blob, whether or not that blob was compressed for transport.

- A consumer that recognizes the **format version** and **codec** proceeds.
- An **unrecognized format version or codec** ⇒ `UninterpretableLock` (§7.8),
  surfaced to policy (§9). The body is *not* decompressed (you cannot safely
  decompress with an unknown codec). This is the entire forward-compatibility
  mechanism: a future format ships a new frame byte; old consumers fall back by policy.

This replaces the old in-specifier `lock.vN` token. The specifier no longer encodes a
version at all (§3.1); the frame byte is the sole, minimal discriminator.

### 5.3 Compression: codec auto-select & Brotli parameters (normative)

- **Codec auto-select.** An encoder MUST compute the Brotli-compressed body and emit it
  (codec `0x0`) only when it is strictly smaller than the raw canonical blob; otherwise
  it MUST store the blob verbatim (codec `0x1`). This avoids paying Brotli's fixed
  overhead on small graphs, where it would otherwise *grow* the payload. Decoders MUST
  implement both codecs.
- Quality: `11` (max) for publishing; decoders accept any quality.
- Window: `LGWIN = 24` maximum; decoders MUST support up to 24.
- No custom dictionary in this format version (a shared dictionary is reserved for a
  future format byte; see §5.8). Determinism of the *compressed* bytes is **not
  required** for correctness (the lock digest is over the *decompressed* canonical
  blob, §7.2), but encoders SHOULD pin Brotli quality/window so re-encoding an
  identical graph yields identical text where practical.

### 5.4 Base62 (normative)

- Alphabet: `0-9 A-Z a-z` (62 symbols), which is a strict subset of the SemVer
  build-metadata identifier alphabet `[0-9A-Za-z-]`. The payload is therefore always a
  legal single build identifier (no `.`, no `-`, no `_`).
- Encoding is **big-endian base conversion** of the `frame` octet string to Base62
  (leading-zero octets preserved as leading `0` digits so the transform is a bijection
  on octet strings). Decoders MUST reject any non-alphabet character.
- Decoders MUST reject inputs that do not decode to a whole number of octets
  (non-canonical Base62).
- **Why not Base64URL?** Base64URL's `_` is illegal in SemVer build metadata, which
  makes strict SemVer parsers (e.g. npm) reject the entire version rather than strip it
  gracefully. Base62 keeps the version valid everywhere at ~0.85% size cost (§12). The
  Base64URL/independent-extension form is retained only as the greenfield profile
  (Appendix C).

### 5.5 Decode bomb protections

Because the payload is attacker-controllable, decoding MUST be bounded (§10.5):

- A consumer MUST enforce a configurable **max decompressed size** (default 8 MiB)
  and abort Brotli inflation that exceeds it.
- A consumer MUST enforce a **max node count** (default 100 000) and **max edge
  count** (default 1 000 000) declared/derived from the header *before* allocating
  proportional structures; the header counts are cross-checked against actual data.
- A consumer SHOULD enforce a **max compression ratio** (default 100:1) and abort on
  suspicious expansion.
- A consumer SHOULD cap the **Base62 input length** (default 256 KiB of specifier
  text) before attempting base conversion; oversized closures belong in a sidecar
  (§8.5).

### 5.6 Why not JSON / why this format

JSON is rejected because it is non-deterministic (key order, whitespace, number
formatting, Unicode escaping), bulky, and slow to validate at scale. This format is:

- **Deterministic** by construction (canonical tables + sorts; §7.2).
- **Small** (interning + varints + edge deltas; optional raw digests when needed).
- **Fast** (single linear pass, no string parsing, no allocation surprises).
- **Portable** (only LEB128 + length-prefixed bytes + Base62; ~200 lines per language).

### 5.7 Format evolution (the frame byte is the version)

All forward/backward compatibility is expressed through the frame byte (§5.2):

- **Format 1 → Format 2** is exactly this mechanism in practice. Format 2 (§4.12) is a
  breaking layout change, so it ships under a new frame nibble (`0x2`). Format-1 locks
  (`0x1`) remain decodable indefinitely; producers emit format 2. The two are
  distinguished by one byte, with no specifier-grammar change.
- **Additive, backward-readable** changes (new enum values in reserved ranges, new
  optional tables appended before the Trailer behind new header flags) keep the same
  frame byte. A current decoder MUST reject *unknown header flag bits* (fail-closed)
  rather than skip unknown sections, because skipping would make the lock digest
  ambiguous. "Backward-readable" thus means older decoders reject *gracefully*, not
  silently ignore.
- **Breaking** changes (new structure, new compression) ship a **new frame byte**.
  Older consumers see an unknown format version/codec and fall back by policy (§9).

There is no separate "minor/major" notion in the specifier — there is only the frame
byte and the fail-closed header-flag rule.

### 5.8 Reserved: shared dictionary

A future frame byte MAY define a built-in Brotli dictionary seeded with the most common
package names/versions to cut small-payload size further. It is out of scope for the
current format to keep cross-language implementations dependency-free.

### 5.9 Unknown formats

A consumer MUST refuse to *interpret* a frame byte it does not implement, but MUST
still *parse the specifier* around it (the version remains valid SemVer). Forward
compatibility lives in the policy layer (§9), not the parser.

---

## 6. Graph Semantics

This section answers precisely *what is being locked*.

### 6.1 What the lock IS

A lock encodes a **resolved dependency graph**: a directed multigraph whose nodes are
*resolved package instances* and whose edges are *named, typed dependency
relationships* with concrete targets. It is the deterministic *output* of a resolver
for the subtree rooted at the specifier's package.

Formally, a lock is a tuple `G = (N, E, root, sources, conditions)` where:

- `N` = resolved package instances reachable from `root`.
- `E ⊆ N × Names × N × Types` = resolved edges.
- `root ∈ N`.
- Every `n ∈ N` carries `(source, name, exact-version, condition?)` plus any
  package-manager-specific resolution context needed to distinguish peer/source cases.

### 6.2 What the lock is NOT

- **Not a package graph** in the abstract "which packages depend on which" sense with
  ranges — all versions are resolved and exact.
- **Not a physical installation/layout graph.** It does **not** prescribe on-disk
  layout (hoisting, flattening, symlink topology, `node_modules` vs. virtual store).
  The lock fixes *identity and wiring* (which instance satisfies which edge); the
  consumer is free to realize that wiring with any layout that preserves it. This
  keeps the format package-manager agnostic: a flat-layout and a nested-layout
  installer can both honor the same lock.

> **Distinction restated:** the lock is *resolution-complete* but *layout-agnostic*.
> Two installers MUST produce module-resolution-equivalent results from the same
> lock, even if their directory structures differ.

### 6.3 Answers to the enumerated questions

- **Is this a package graph?** No — it is a *resolved* graph (exact versions).
- **Is this a resolved dependency graph?** Yes. ✅ This is the precise model.
- **Is this an installation graph?** No — layout is not encoded (§6.2).
- **Are peer dependency placements encoded?** Yes — as concrete `peer`/`peer-opt`
  edges to specific instances (§4.9). The lock captures the resolver's peer
  decisions, including context-dependent duplication.
- **Are platform-specific nodes encoded?** Yes — via the condition table and the
  per-node/edge condition reference (§4.7, §4.8). A node that applies only on
  `os=linux,cpu=arm64` carries that condition; consumers prune unsatisfied nodes per
  policy (§7.7).
- **Are overrides encoded?** **The effect is, the directive is not.** A lock encodes
  the *post-override* resolution — i.e., whatever instances the resolver actually
  chose. The original "override" *instruction* (a manifest-level policy) is **not**
  stored, because a lock is a result, not a configuration. (Authors who want override
  *intent* to travel must express it in their own manifest; the lock only guarantees
  the resolved outcome.) This is called out explicitly so consumers do not expect to
  recover override rules from a lock.
- **Are registry URLs encoded?** Yes — via the source table (§4.5), subject to
  consumer remapping by policy (§10.6).

### 6.4 Identity & equality

Two locks are **identical** iff their canonical blobs (§7.2) are byte-equal, i.e.
their lock digests match. Two locks are **semantically equivalent** iff they encode
the same `G` up to canonicalization (which, by construction, implies byte-equality).
Thus canonicalization makes semantic equality decidable by digest comparison — a
property heavily used in validation and caching.

### 6.5 Rooting and the specifier

The `root` node's `(source, name, version)` **MUST** match the specifier's source/context,
`name`, and base `version` exactly (§7.4). The lock describes the closure *rooted at that package*; it
does not describe siblings or the consumer's wider graph. When multiple top-level
dependencies each carry locks, the consumer merges their closures (§9.4).

### 6.6 A lock is a *seed*, not a parallel validator

A lock is consumed by **absorbing its subgraph into the consumer's native lockfile**
(`package-lock.json`, `pnpm-lock.yaml`, `bun.lockb`, `Cargo.lock`, …) and then letting
the host's *existing* resolution, metadata, and integrity pipeline take over. The spec does
not run a second, parallel integrity-enforcement system alongside the host's.

This has three consequences that shape the rest of the document:

1. **The format's job is interchange + self-validation.** The spec defines the wire
   format and how to validate a lock *against its own self-description* (canonical
   decode, root-matches-specifier, internal consistency — §7.2–§7.4).
2. **Faithful graph transfer is REQUIRED.** A conformant consumer that absorbs a lock MUST
   carry the resolved source/name/version/edge information into its native lockfile without
   replacing the package manager's own metadata or artifact-integrity records.
3. **Stripping/corruption is survivable; artifact substitution is not.** A lock that is
   absent, stripped by an unaware tool, or malformed simply degrades to ordinary resolution
   (a valid floor — §9). A fetched artifact that violates the package manager's normal
   integrity checks still fails closed. That, not lock-marker syntax, is the security
   boundary.

After first absorption the **host lockfile becomes the source of truth**; the inline
specifier string was only the transport.

### 6.7 Resolution order and package-manager policy

Dependency Locks are package-manager inputs, not package-manager mandates. A conforming
tool MAY support the format, MAY gate it behind policy, and MAY choose `strict`,
`prefer`, or `ignore` behavior (§9).

When a package manager **does** support and honor a lock:

1. The lock supplies the resolved dependency definitions for the subtree rooted at the
   specifier's package. It pins that dependency and effectively takes control of that
   dependency's transitive subgraph.
2. The lock's resolved edges are applied **before user-level configuration** such as
   overrides/resolutions, source remaps, registry policy, security policy, platform
   filters, or install mode.
3. User-level configuration remains authoritative. A package manager MAY remap,
   override, prune, reject, or ignore the locked result according to its own policy.
4. The lock MAY carry per-node artifact integrity (§4.6) as **advisory tamper-evidence**,
   but it does **not** replace package metadata such as published tarball integrity,
   advisory metadata, or the host lockfile's integrity records. A consumer MAY use the
   lock's integrity for a pre-flight check; the package manager's existing metadata and
   fetch pipeline still enforce artifact integrity independently.

This order keeps the format useful without making it a universal policy layer. It says
"this is the resolved subgraph the publisher generated and chose to distribute," while
leaving the consumer's package manager in charge of final lockfile generation and
installation semantics.

### 6.8 Inspiration: vlt's graph lockfile

The subgraph model in this spec is not a new invention: it is **modeled on vlt's graph
lockfile** ([vlt.sh](https://vlt.sh)), which already represents a resolved dependency
graph as an explicit **`nodes` + `edges`** structure rather than a flattened tree. A
Dependency Lock captures the same idea — scoped to one rooted subtree and stripped of the
project-level config — but in its **own small, self-contained format** (generic
`(source, name, version)` nodes and `(from, to, type)` edges) so that any package manager
can implement it without adopting vlt's specific Dependency-ID encoding. The
correspondence is deliberately close, so an aware tool (vlt in particular) can map a lock
to/from its native graph mechanically:

| vlt graph lockfile concept | This spec (§4) |
|----------------------------|----------------|
| **Node** keyed by a *Dependency ID* that encodes the **source/type** (registry, git, workspace, file, remote) together with package identity | A **node** is a resolved instance identified by `(source, name, version, resolution context)`; `source` carries the type/registry (§4.5) |
| Node carries **name**, resolved location, and flags | Node carries `name_id`, `ver_id`, `source_id` (resolved location), optional `digest_id`, and `flags` (§4.8) |
| **Edge** keyed by *(dependent, dependency-name)*, valued by *(type, spec, target node)* | An **edge** is `(from_id, name_id, to_id, type)` (§4.9); the original *range spec* is a publish-time input, not stored (a lock records the resolved result) |
| Graph is the **source-aware identity** unit (the same name+version from different sources are distinct) | Same: node identity includes `source` and resolution context, so duplicates across sources/peer-contexts are distinct nodes |

Three deliberate differences from a full native lockfile like vlt's:

1. **The lock omits the project-level `options`/config block.** A complete vlt lockfile
   carries a top-level `options` object (registries, project settings). A Dependency Lock
   is graph-only — `nodes` + `edges` for one subtree — and carries no configuration; that
   remains owned by the consuming package manager (§6.7).
2. **The lock is scoped to one rooted subtree, not the whole importer graph.** It contains
   only the closure reachable from the locked dependency, not the project's full set of
   importers and direct dependencies.
3. **The lock is source-/registry-aware but layout-agnostic.** Like vlt's graph it
   captures identity and wiring; unlike an installed `node_modules`/store it prescribes
   no physical layout (§6.2). (The original range spec stays in the consuming manifest;
   a lock records the resolved edge target, not the declared range — §6.2.)

This mapping is why vlt is a natural first-class consumer: absorbing a lock is largely
"decode the canonical graph → emit nodes/edges into the native graph lockfile" (§6.6).
The binary format (§4) is just a compact, deterministic, language-neutral serialization
of the same nodes-and-edges idea vlt's JSON lockfile expresses in text.

---

## 7. Validation

Validation is layered. A consumer MUST run layers in order and stop at the first
failure for a given lock (failures are classified for policy in §9).

### 7.1 Validation layers

1. **Specifier parse** (§3) — version + build-metadata scan, lock detection.
2. **Text decode** — Base62 canonical decode; read frame byte (§5.2); if the format
   version/codec is unknown ⇒ `UninterpretableLock` (stop); else bounded Brotli
   inflation (§5.5).
3. **Structural decode** — section walk: magic, counts, canonical varints, UTF-8,
   table ordering/dedup, index bounds, flag/reserved checks, trailer marker.
4. **Internal consistency** — DAG/closure checks, reachability, condition sanity,
   header hint-flag honesty.
5. **Identity** — lock digest computation; root matches specifier (§7.4).
6. **Host integrity (install-time)** — fetched artifacts satisfy the package manager's
   normal metadata/native-lockfile integrity checks (§7.5).

### 7.2 Canonical form & lock digest

A blob is **canonical** iff *all* of the following hold; a decoder MUST verify them
and a non-canonical blob is a **malformed lock**:

- All varints are in shortest form.
- `StringTable`, `DigestTable`, and (non-zero) `ConditionTable` and `SourceTable`
  entries are strictly ascending by their byte ordering and contain no duplicates.
- Source ID 0 (`default`) and Condition ID 0 (`always`), when used, are first.
- Nodes are sorted ascending by the tuple
  `(name-bytes, version-bytes, source_id, cond_id, optional-digest-bytes)`; this
  ordering defines `node_id`.
- Within each `EdgeGroup`, edges are sorted ascending by `(name_id, to_id, type)`.
- No unused table entries (every string/source/digest/condition is referenced at
  least once), no unreachable nodes (every node ≠ root is reachable from root).
- `Trailer.end_marker == 0x00`, no trailing bytes.

The bullets above describe the **format-1** blob. For **format 2** (§4.12) the
canonical rules are the analogous ones over its columnar layout: shortest-form varints;
`NameTable` strictly ascending bytewise, deduped, and front-coded against the previous
entry; nodes sorted by `(name-bytes, version-bytes)` (defining `node_id`); within each
edge group, edges sorted by `(to_id, type, alias_id)` with targets delta+zigzag coded;
every `NameTable`/`ExtraPool` entry referenced at least once; every non-root node
reachable from the root. Format 2 has no `magic` and no `Trailer`, so those checks do
not apply; the framed payload length bounds the blob.

The **lock digest** is `SHA-256(canonical_blob)` — computed over the *decompressed*
canonical bytes (not the frame byte, the compression, or the Base62 text), for whichever
format's blob is in hand. Because canonicalization is total within a format, identical
graphs ⇒ identical digests across implementations and languages. (A format-1 and a
format-2 blob of the same graph have different bytes and therefore different digests; a
producer commits to one format — currently format 2.) The lock digest is the stable
identifier for caching, equality, and audit logs.

> Encoders MUST emit canonical blobs. Decoders MUST verify canonicality, not merely
> tolerate it; otherwise two encoders could produce different digests for the same
> graph, breaking equality and caching guarantees.

### 7.3 Structural failures (malformed locks)

Any of the following is a **`MalformedLock`** error (note: an *unknown frame byte* is
`UninterpretableLock`, §5.2, not `MalformedLock` — it is a recognized-but-future
format, not corruption):

- Bad 2-byte `magic` (corruption sentinel) — format 1 only; format 2 carries no magic.
- Non-canonical varint; truncated section; index out of range.
- Invalid UTF-8; mis-sorted or duplicated table entry.
- Unknown enum value in a non-reserved-tolerant position; set reserved flag bit.
- Digest length mismatch for its algorithm.
- Header hint flag contradicts contents (e.g., `HAS_PEER_EDGES` set but no peer edge,
  or clear but a peer edge exists).
- Cycle among non-`dev`/non-`optional` prod edges where the resolver model forbids it
  (see §7.6); unreachable node; unreferenced table entry.
- Trailing bytes after `end_marker`; trailer checksum mismatch when present.

### 7.4 Root-matches-specifier

Given `Spec(source, name, version, Lock)`:

- Decode the lock; let `r = N[root_id]`.
- **REQUIRE** `r.source == source` (after configured source/context normalization),
  `r.name == name` (bytewise), and `r.version == version` (bytewise).
- If they differ ⇒ **`RootMismatch`**. This prevents a payload from one package being
  pasted under a different specifier (a primary anti-substitution control).

### 7.5 Host integrity validation (install-time)

For each node selected for installation (after condition pruning §7.7):

- Fetch the artifact from the resolved source, subject to user/source remap policy (§10.6).
- Verify the artifact using the package manager's normal integrity record for that
  artifact: registry metadata, native lockfile entry, checksum database, or equivalent.
- If the package manager reports a fetch-time integrity failure, surface
  **`IntegrityMismatch`** and abort according to the package manager's normal rules.
- If the node is optional and the fetch fails for availability/network reasons, the node
  MAY be skipped according to the package manager's normal optional-dependency policy.

This is the artifact boundary: the lock chooses graph wiring, while the installer enforces
artifact integrity through its existing mechanism.

### 7.6 Cycle policy

`prod` edges form the runtime graph. The format permits cycles **only** if the
consumer's resolver model permits them (some ecosystems allow runtime cycles, others
forbid them). The spec's default: cycles among `prod` edges are **allowed** (many
real ecosystems have them) but a validator MAY be configured to reject them. `dev`
and `optional` edges never participate in cycle *prohibition*. Regardless, the
*reachability* and *no-duplicate-instance* invariants always hold.

### 7.7 Condition handling

At install time the consumer evaluates each node/edge `cond_id` against the target
environment:

- Satisfied ⇒ node/edge is **active**.
- Unsatisfied ⇒ node/edge is **pruned** (not installed). Pruning a node prunes its
  exclusively-reachable subgraph.
- **Unknown condition axis/op** ⇒ the node is treated as *unsatisfiable* under
  `strict` (fail-closed: an unknown platform gate MUST NOT be assumed true) — but a
  pruned-and-unknown node is only an error if it was **required** (a non-optional prod
  edge target). An optional/unknown node is simply skipped. This prevents a newer
  lock's platform features from silently mis-installing on older consumers.

### 7.8 Failure taxonomy (for policy)

| Class                | Trigger                                            | Default severity |
|----------------------|----------------------------------------------------|------------------|
| `ParseError`         | host SemVer version itself is invalid (not lock-specific) | fatal      |
| `UninterpretableLock`| Unknown frame byte: future format/codec (§5.2)     | policy (§9): warn+fallback under prefer/ignore, abort under strict |
| `MalformedLock`      | §3.5 bad lock marker, or §7.3 structural/canonical failure | policy (§9): warn+fallback under prefer/ignore, abort under strict |
| `RootMismatch`       | §7.4                                               | policy (§9): warn+fallback under prefer/ignore, abort under strict |
| `IntegrityMismatch`  | §7.5 fetched artifact fails the package manager's normal integrity check | **always fatal** |
| `StaleLock`          | §7.9                                               | policy (§9)      |
| `IncompatibleLock`   | §7.10                                              | policy (§9)      |
| `ConditionUnknown`   | §7.7 unknown gate on a required node               | fatal under strict; warn+fallback under prefer |

**Design note (softened from earlier drafts).** Only a fetch-time `IntegrityMismatch`
reported by the host package manager's normal pipeline is unconditionally fatal — that is
the artifact boundary (§6.6). Every lock-format failure is recoverable by falling back to
ordinary resolution of the still-valid bare `source:name@version`, so under
`prefer`/`ignore` they warn and fall back rather than aborting. `strict` keeps the
hard-line "this exact closure or nothing" behavior for CI/reproducible builds. Rationale:
a manifest-tampering attacker can always craft a *valid* malicious lock, so aborting on a
*malformed* one buys little security while costing availability; the protection that
matters lives at fetch-time integrity.

### 7.9 Stale locks

A lock is **stale** when it no longer reflects the desired/declared world, e.g.:

- The lock's root version does not satisfy an updated top-level constraint elsewhere.
- A pinned source/registry no longer serves the artifact (availability, not integrity).
- The author has published a newer lock for the same `source:name@version` (locks are
  immutable per `(source:name@version, lock-digest)`, but a registry may advertise a
  *preferred* current lock; see §8).

Staleness is **not** corruption. Under `strict` it is an error (the user asked for
exactly this lock); under `prefer` the consumer MAY re-resolve; under `ignore` it is
moot. Consumers SHOULD report staleness even when tolerating it.

### 7.10 Incompatible locks

A lock is **incompatible** when it is well-formed and authentic but cannot be
satisfied in the current context, e.g.:

- Conflicting peer resolutions between two top-level locks that must share an instance
  (§9.4 conflict resolution).
- A required condition (e.g. `libc=glibc`) that the environment cannot meet.
- A frame byte newer than the consumer supports (overlaps `UninterpretableLock`, §5.2).

Resolution is policy-driven (§9). Incompatibility MUST be reported with the specific
conflicting nodes/edges to aid debugging.

---

## 8. Publishing

### 8.1 Generation

- **Must locks be generated automatically?** They SHOULD be tool-generated. A lock is
  the serialized output of a correct resolution; hand-authoring is error-prone. Tools
  MUST produce canonical blobs (§7.2).
- **May authors hand-author them?** Permitted but discouraged. Any hand-authored lock
  MUST still pass full validation (canonical form, root match, internal consistency). In
  practice authors will run a generator; manual editing is for tests/debugging.

### 8.2 Publish-time author responsibilities

When publishing `source:name@version`, an author MAY attach a lock describing the resolved
closure of that package's *own* dependencies (a "recommended resolution"). The author:

- MUST root the lock at `source:name@version` (matches §7.4).
- SHOULD pin sources explicitly or use `default` consistently.
- SHOULD NOT encode artifact integrity unless the consuming package manager has an
  explicit reason to carry host-integrity metadata through the payload.
- SHOULD regenerate the lock whenever the closure changes; the lock's digest then
  changes, giving a natural audit trail.

### 8.3 Registry behavior

- **Should registries validate locks?** Yes. On publish, a registry SHOULD run
  validation layers 1–5 (§7.1). A registry MAY additionally check any optional digest
  metadata it chooses to support, but Dependency Locks are not a substitute for the
  artifact's own integrity metadata.
- **Should registries index them?** Recommended. A registry SHOULD index lock digests
  and the `(source, name, version)→lock-digest` mapping so consumers and auditors can:
  - detect divergence (two different locks claiming the same root),
  - serve a "current preferred lock" pointer separate from immutable artifacts,
  - power vulnerability scanning over the embedded closure without unpacking tarballs.
- A registry MUST treat the lock as *advisory metadata*, never as a substitute for
  the artifact's own integrity. A consumer always re-verifies at fetch time (§7.5),
  via its native lockfile pipeline after absorption (§6.6).

> **Non-destructive stripping.** A tool that strips build metadata (e.g. npm) does so
> only in its *own* internal representation; it does not delete the lock from the
> registry-published manifest. A downstream lock-aware tool reading the same published
> manifest still sees the lock. Stripping is per-tool and local, never ecosystem-wide.

### 8.4 Immutability

A published `source:name@version` artifact is immutable; its integrity digest is fixed. A
lock attached to it is also content-addressed by its lock digest. If an author needs a
different closure, that is a different lock (different digest); registries SHOULD keep
history and expose the current preferred lock explicitly rather than mutating in place.

### 8.5 Manifest placement

A lock travels inside the dependency specifier as standard SemVer build metadata:

```json
{
  "dependencies": {
    "react": "npm:react@19.1.0+lock.<payload>"
  }
}
```

Because the version component is valid SemVer, an aware consumer reads the lock and
**absorbs the subgraph into its native lockfile** on first install (§6.6); an unaware
consumer treats `+lock.<payload>` as ordinary build metadata (preserving or stripping
it per its existing SemVer behavior) and resolves `npm:react@19.1.0` normally. Either
way nothing breaks.

Consumers MAY also accept locks in a sidecar field for very large payloads — and
SHOULD prefer the sidecar once a payload approaches manifest/parser size limits (§12).
The canonical, portable location is inline in the specifier so that a single string is
sufficient to transport a small/average closure.

---

## 9. Consumer Policy

The policy model governs how a consumer treats locks during install. It is selected
per-install (CLI flag, config, or env) and applies to *all* locks in the operation
unless overridden per-dependency.

```bash
install --dependency-locks=strict
install --dependency-locks=prefer    # default recommendation
install --dependency-locks=ignore
```

### 9.1 `strict`

- Every dependency that *carries* a lock MUST be installed exactly as the lock
  dictates. The resolved instances, versions, and sources MUST match, subject to
  package-manager policy such as allowed source remaps. The package manager's normal
  integrity checks MUST also pass.
- Any `MalformedLock`, `RootMismatch`, `IntegrityMismatch`, `StaleLock`,
  `IncompatibleLock`, `UninterpretableLock`, or `ConditionUnknown` on a required node
  is **fatal**; the install aborts.
- The consumer MUST NOT re-resolve a locked subtree. Determinism is absolute.
- Dependencies *without* locks are resolved normally (strict applies to locked ones).
- **Use case:** CI, reproducible builds, security-sensitive environments.

### 9.2 `prefer` (recommended default)

- Use the lock when it is valid, authentic, satisfiable, and interpretable; on success,
  absorb it into the native lockfile (§6.6).
- On **any lock-level failure** — `MalformedLock`, `RootMismatch`, `StaleLock`,
  `IncompatibleLock`, `UninterpretableLock`, or an unknown non-required condition —
  **warn and fall back** to normal resolution of the still-valid bare `source:name@version`.
  A malformed or foreign lock is treated like an absent one; the base pin is a correct
  floor, and re-resolving costs only the lock's *enhancement*, not correctness.
- The **only** unconditional abort is `IntegrityMismatch` at fetch time (§7.5): the
  registry/CDN served an artifact that fails the package manager's normal integrity check.
  That is artifact substitution, not staleness, and silent fallback there *would* be a
  security regression.
- **Use case:** day-to-day development; benefits from locks when present, degrades
  gracefully when they age or arrive corrupted, but never accepts a substituted artifact.

> **Why malformed→fallback is safe.** An attacker who can rewrite a manifest can write
> a perfectly *valid* malicious lock rooted at a package they control, so aborting on a
> *malformed* lock stops essentially no real attack while harming availability and
> adoption. The protection that survives is fetch-time integrity (above) plus the host
> lockfile's own guarantees after absorption.

### 9.3 `ignore`

- Treat all locks as if absent: the version still parses (it is valid SemVer), the lock
  payload is simply not consulted, and `source:name@version` resolves normally.
- Lock-level failures cannot arise (locks unused). A genuinely invalid *SemVer version*
  is still the host's normal `ParseError` — unrelated to locks.
- **Use case:** debugging, intentionally re-resolving, migrating off locks.

### 9.4 Conflict resolution across multiple locks

When several top-level dependencies carry locks, their closures are merged into the
consumer's overall graph. Conflicts arise when two locks resolve the *same* package to
*different* instances where the consumer's layout would require sharing one.

Resolution order:

1. **Disjoint instances allowed.** If the consumer's layout supports multiple
   instances of a package (nested/virtual store), keep both — no conflict. The lock's
   wiring is preserved per-subtree. This is the preferred outcome and the reason the
   format is layout-agnostic.
2. **Forced sharing (flat layout) — `strict`:** if the layout requires a single shared
   instance and two locks disagree, that is `IncompatibleLock` → **abort**, reporting
   the two conflicting instances and the requiring edges.
3. **Forced sharing — `prefer`:** attempt a resolver-mediated reconciliation:
   - Prefer an instance that satisfies *both* locks' source/version constraints if
     one exists.
   - Otherwise, the *direct* (closer-to-root) dependency's lock wins for the shared
     slot, the loser's subtree is re-resolved against the winner, and a warning is
     emitted. If re-resolution cannot satisfy the loser's integrity expectations,
     escalate to abort.
4. **`ignore`:** locks do not participate; the resolver's normal conflict rules apply.

Peer-dependency conflicts are a special case of the above: because peer placements are
explicit edges, a peer conflict is detected precisely (two locks place the same peer
name on different target instances for the same consumer node) and surfaced with both
target node identities.

### 9.5 Per-dependency overrides

A consumer MAY allow per-dependency policy (e.g., `--dependency-locks=strict` globally
but `ignore` for one package being actively developed). Implementations SHOULD provide
this granularity; the resolution rules above apply per affected subtree.

---

## 10. Security Analysis

The lock is **attacker-controllable input** the moment it appears in a manifest pulled
from anywhere. The threat model assumes the payload may be arbitrary bytes crafted to
exploit the consumer.

### 10.1 Supply-chain implications (net assessment)

Locks *improve* supply-chain integrity when handled correctly: they pin exact versions
and integrity for the whole closure, making silent transitive substitution detectable.
But they also *concentrate* risk into a single opaque string, so the controls below
are mandatory, not optional.

### 10.2 Malicious lock payloads

- **Threat:** crafted blob exploiting the decoder (OOB index, integer overflow,
  allocation explosion, non-canonical parsing ambiguity).
- **Mitigations:** strict canonical decoding (§7.2), bounds-checked indices, varint
  canonicality, fail-closed on reserved/unknown, hard size/count caps (§5.5), no
  `unsafe` array access in implementations, fuzz-tested decoders. The decoder MUST be
  written so that *no* byte sequence can cause anything worse than a clean
  `MalformedLock`.

### 10.3 Lock poisoning (substitution / tampering)

- **Threat:** an attacker edits a lock to point a node at a malicious artifact, or
  pastes a hostile lock under a benign specifier.
- **Mitigations:**
  - `RootMismatch` (§7.4) blocks pasting a foreign closure under a different source/name/version.
  - The package manager's normal integrity pipeline (§7.5) makes any substituted artifact
    fail its checksum/hash validation.
  - Registries SHOULD validate the lock's root identity and may additionally check any
    optional digest metadata they support (§8.3).
  - Because the lock digest is content-addressed, poisoning changes the digest, which
    audit tooling and lockfile diffs surface immediately.

### 10.4 Lock amplification attacks

- **Threat:** a tiny specifier expands (via Brotli + a dense graph) into an enormous
  in-memory graph or an enormous *install* (thousands of fetches), turning a small
  manifest into a resource bomb (a "billion laughs" analogue).
- **Mitigations:**
  - Decompression caps and compression-ratio caps (§5.5).
  - Node/edge count caps enforced against header-declared counts *before* allocation.
  - **Fetch fan-out cap:** the installer MUST bound concurrent and total fetches and
    SHOULD require interactive confirmation (or a policy allowance) above a threshold
    (e.g., a lock introducing >N new transitive packages).
  - Reachability pruning means only the root's actual closure installs; unreferenced
    nodes are rejected as non-canonical anyway (§7.2).

### 10.5 Denial-of-service

- **Threat:** CPU/memory exhaustion during decode/validate (decompression bombs,
  pathological graphs, hash flooding via huge string tables).
- **Mitigations:** all of §5.5 plus per-operation wall-clock and memory budgets;
  streaming/bounded Brotli; O(n) single-pass validation with pre-sized, capped
  allocations; reject before doing work proportional to attacker-chosen sizes.

### 10.6 Source/registry trust & remapping

- **Threat:** a lock pins `source` to an attacker-controlled registry/URL.
- **Mitigations:** integrity is verified *regardless of source*, so a malicious source
  can at most cause a fetch failure or an integrity mismatch, never a silent swap.
  Consumers MUST be able to **remap** sources via policy (e.g., force all `registry`
  fetches to a vetted mirror) and apply remap *before* fetch but verify integrity
  *after* — the digest is the source of truth, not the URL. `file:`/`git:` sources in
  *published* locks SHOULD be rejected by default (non-reproducible / local-leakage
  risk) unless explicitly allowed.

### 10.7 Stale, vulnerable dependency trees

- **Threat:** a lock pins exact versions forever, freezing in known-vulnerable
  transitive packages even after fixes ship ("eternal pin").
- **Mitigations:**
  - The lock digest + indexed closure (§8.3) let scanners flag vulnerable nodes
    *without* unpacking, across every dependent that embeds the lock.
  - `prefer` policy permits re-resolution when a lock is stale, enabling security
    updates without manual lock surgery.
  - Consumers SHOULD integrate advisory feeds: a lock whose closure intersects an
    advisory is reported as `StaleLock`-for-security and, under `prefer`, re-resolved
    to a patched closure.
  - Registries SHOULD support deprecating/superseding a published lock so a "preferred
    current lock" can advance even though the immutable old one still exists.

### 10.8 Privacy / information leakage

A lock encodes exact internal dependency topology and (for `file:`/`git:`) possibly
internal URLs. Authors SHOULD avoid embedding non-public sources; consumers SHOULD
treat lock contents as potentially sensitive in logs.

### 10.9 Cryptographic agility

Digest algorithms are enumerated (§4.6) with `sha256`/`sha512` mandatory and `blake3`
recommended; `sha1` is read-only/deprecated. A future minor can add algorithms via the
reserved range; consumers fail-closed on unknown algorithms, preventing downgrade.

---

## 11. Ecosystem Impact & Comparison

| Mechanism            | Scope            | Location         | Integrity | Granularity                | Portable as a string? |
|----------------------|------------------|------------------|-----------|----------------------------|-----------------------|
| **Dependency Locks** | resolved subgraph| inline specifier | host pipeline | per-dependency          | **Yes** (this spec)   |
| `npm-shrinkwrap.json`| whole project    | repo file (publishable) | per-pkg | whole tree              | No (file)             |
| `package-lock.json`  | whole project    | repo file (not published)| per-pkg| whole tree               | No (file)             |
| `pnpm-lock.yaml`     | whole project    | repo file        | per-pkg   | whole tree (virtual store) | No (file)             |
| `yarn.lock`          | whole project    | repo file        | per-pkg   | whole tree                 | No (file)             |
| `Cargo.lock`         | whole project    | repo file        | per-pkg (registry) | whole tree        | No (file)             |
| `Pipfile.lock`       | whole project    | repo file (JSON) | per-pkg (hashes)   | whole tree        | No (file)             |
| `go.sum`             | module checksums | repo file        | per-module/zip     | flat checksum list| No (file)             |
| Nix derivations      | exact build inputs| store/derivations| content-addressed | whole closure     | Indirectly (hashes)   |

### 11.1 Tradeoffs vs. project lockfiles (npm/pnpm/yarn/Cargo/Pipenv)

- **+** No separate file to lose/forget; the lock travels *with* the dependency, so a
  single specifier is a portable, reproducible fragment — composable per-dependency.
- **+** Per-dependency granularity: you can pin one dependency's closure without
  pinning the whole project, and different dependencies can carry locks independently.
- **+** Publishable by authors: a library can ship its *recommended resolution* inline,
  which file-based project lockfiles (except `npm-shrinkwrap`) cannot.
- **−** Opacity: a `package-lock.json` is human-diffable; a lock payload is binary +
  base64. Mitigated by tooling that renders/diffs the decoded graph and by the
  content-addressed digest for change detection.
- **−** Specifier bloat: manifests grow (size analysis §12). Mitigated by compression
  and by the option to keep locks in a sidecar for very large closures (§8.5).
- **−** Merge ergonomics: editing a manifest line with an embedded blob is unfriendly;
  tooling MUST own (re)generation. Manual edits are validation-gated.

### 11.2 vs. `go.sum`

`go.sum` is a *flat checksum ledger* with no graph wiring (Go computes the graph from
module requirements + MVS). Dependency Locks encode the *wiring* too (exact edges,
peer placements, conditions), which Go's model intentionally avoids. Locks are closer
to "`go.sum` + the resolved graph, scoped to one dependency, transportable as text."

### 11.3 vs. Nix derivations

Nix is the gold standard for reproducibility: content-addressed, exact build inputs,
whole-closure. Dependency Locks borrow the content-addressing/closure ideas but operate
at the *package-resolution* layer (not the *build* layer) and are deliberately
layout-/builder-agnostic and embeddable in a one-line specifier. Nix reproduces builds;
locks reproduce *resolutions*. They are complementary, not competitors.

### 11.4 Transport and implementation path

Dependency Locks are a **new concept**. The first intended supporting implementation is
vlt. Other package managers can adopt the format and semantics, but they should not be
described as supporting Dependency Locks merely because they tolerate the `+lock.<Base62>`
text in a version.

The measured behavior in Appendix D validates a narrower claim: **SemVer build metadata is
a practical transport**. Existing managers tested against exact versions carrying
`+lock.<Base62>` generally do not reject the version, and lockfiles already tend to keep a
separate "specifier" value from the resolved version plus integrity. That helps an aware
tool preserve or recover the inline payload, but it is not the same as decoding,
validating, or honoring the locked subgraph.

The implementation path is therefore:

1. **vlt support first.** vlt can decode the payload, validate it, use it as resolver
   input for the rooted subgraph (§6.7), and absorb the result into its graph lockfile.
2. **Registry/tooling support next.** Registries and generators can validate, index, and
   produce locks without requiring every installer to honor them.
3. **Other package managers opt in.** A package manager that adopts the format chooses
   its own policy surface (`strict`, `prefer`, `ignore`, source remapping, user override
   precedence, sidecar handling).
4. **Unaware tools remain unaware.** They may preserve, strip, or ignore build metadata
   according to existing behavior. They do not provide Dependency Lock support.

The one caveat is the precedence-equality quirk (§12.4): tools that must distinguish
*which* lock is in play should key on `(version, lock-digest)`.

---

## 12. Size Analysis

### 12.1 Per-node cost model (pre-compression, canonical blob)

Typical steady-state node (default registry, sha256 integrity, unconditional):

- `name_id` varint: 1–2 B
- `ver_id` varint: 1–2 B
- `flags` u8: 1 B
- `digest_id` varint: 1–2 B
- Shared, amortized: the actual name/version strings (interned once) and the 32-B
  digest (interned once). For a closure with `D` distinct packages and `V` distinct
  version strings: strings ≈ Σ len(name)+len(version) (one copy each), digests ≈ 33 B
  each (algo + 32 B + small length prefix).

Per-edge cost: `name_id` (1–2 B) + `to_id` delta (mostly 1 B) + `type` (1 B) ≈ 3–4 B.

So an `N`-node, `E`-edge closure ≈
`Strings(~Σ name+ver) + 33·D(digests) + ~5·N(node records) + ~3.5·E(edge records)`
bytes pre-compression. Brotli then exploits the heavy redundancy in names, version
strings, and digest-adjacent structure.

### 12.2 Estimates after `binary → brotli → frame byte → base62`

Assumptions: realistic npm-shaped graphs; ~12–16 B/node and ~3 B/edge post-Brotli
after interning when optional digest metadata is omitted. If raw digests are carried, they
are incompressible at ~33 B each and dominate larger graphs. **Base62 expansion is ≈ 34%**
(`8 / log2(62)` = 1.344 chars/byte) — only ~0.85% more than Base64URL's 1.333, i.e.
practically identical. Digest cost is the floor: `D` distinct artifacts cost ≥ `33·D`
incompressible bytes, so payloads scale roughly linearly in *distinct packages*.

| Profile            | Nodes (D) | Edges | Blob (pre-Brotli) | Brotli | **Base62 chars** |
|--------------------|-----------|-------|-------------------|--------|-------------------|
| Small library (0–2 deps) | 1–3   | 0–2   | ~120 B            | ~90 B  | **~121 chars**    |
| Average npm package      | ~60   | ~120  | ~4.5 KB           | ~2.3 KB| **~3.1 KB**       |
| Large framework          | ~600  | ~1.5k | ~42 KB            | ~22 KB | **~30 KB**        |
| Application              | ~3,000 | ~9k   | ~210 KB           | ~115 KB| **~156 KB**       |

Notes:

- The **small-library** case is dominated by fixed overhead (frame byte + magic +
  header + one digest); ~120 chars is the practical floor and is perfectly fine inline.
- For **average packages** (~3 KB) inline embedding is reasonable.
- For **large framework / application** closures (tens to ~150 KB of Base62), consumers
  SHOULD prefer the sidecar option (§8.5) or apply locks at smaller sub-roots rather
  than one giant root lock. Beyond ergonomics, very long build-metadata strings risk
  tripping length assumptions in some SemVer parsers (§5.5 caps input length), so the
  sidecar is the safe home for oversized payloads.
- Optional digest metadata, when carried, scales ~linearly with distinct-package count.
  Omit it unless the package manager needs to preserve host-integrity metadata through the
  payload; artifact integrity is normally enforced by the native lockfile/fetch pipeline.

### 12.3 Levers to reduce size

- Reuse `default` source (zero per-node source bytes).
- Keep version strings exact and short (they intern well).
- A future frame byte with a shared Brotli dictionary (§5.8) would meaningfully shrink
  small/average payloads (the names/versions, not the digests).

### 12.4 Caveat: SemVer build-metadata precedence-equality

SemVer §10 declares that two versions differing *only* in build metadata have equal
precedence. So `1.2.3+lock.A` and `1.2.3+lock.B` are "equal" to a precedence
comparator, and a cache or dedup keyed on the bare version could collapse two distinct
locks, or a lockfile keyed only by version could collide them. This is benign for
resolution (which matches on the base version anyway), but tools that must distinguish
*which* lock is in play SHOULD key on `(version, lock-digest)` (§7.2). This is the price
of riding standard build metadata, and it is small.

---

## 13. Reference Algorithms (Pseudocode)

The following is language-neutral pseudocode. It prioritizes clarity and the canonical
guarantees over micro-optimization. Error returns are shown as `fail(Class, detail)`.

### 13.1 `encode(graph) -> payload`

> The pseudocode below is the **format-1** encoder, kept as the readable reference for
> the table/enum semantics. The **format-2** encoder (current) follows the columnar
> layout of §4.12 — structural versions, edge-name elision, front-coded names, no
> magic/trailer — and the codec auto-select of §5.3. See the reference implementation in
> [`site/src/lock/encode.js`](./site/src/lock/encode.js) for a faithful format-2 encoder.

```text
encode(G):                          # G: resolver output (instances + edges + root)
    # 1. Intern strings (names, versions, edge names, source refs, condition values)
    strings = sorted_unique_bytewise(collect_all_strings(G))
    sidx    = index_map(strings)

    # 2. Intern sources, digests, conditions (each sorted+deduped canonically)
    sources = sorted_unique(collect_sources(G), by = (kind, sidx[ref]))
    ensure_default_first(sources)                       # source 0 == default if used
    soidx   = index_map(sources)

    digests = sorted_unique(collect_digests(G), by = (algo, bytes))
    didx    = index_map(digests)

    conds   = sorted_unique(collect_conditions(G), by = canonical_condset)
    ensure_always_first(conds)                          # cond 0 == "always" if used
    cidx    = index_map(conds)

    # 3. Canonical node order defines node_id
    nodes = sort(G.nodes, by = (name_bytes, ver_bytes, source_id, digest(algo,bytes), cond_id))
    nidx  = index_map(nodes)                            # node -> node_id
    root_id = nidx[G.root]

    # 4. Validate structural pre-conditions (reachability, no unused entries)
    assert reachable_closure(nodes, G.edges, root_id) == set(nodes)
    assert every_entry_referenced(strings, sources, digests, conds)

    # 5. Emit
    out = ByteWriter()
    write_header(out, magic="LK",                       # 2-byte corruption sentinel
                 flags = compute_hint_flags(G),
                 counts = (len strings, len sources, len digests, len conds, len nodes),
                 root_id)
    for s in strings:        write_str(out, s)
    for src in sources:      write_u8(out, src.kind); if src.kind != default: write_uvarint(out, sidx[src.ref])
    for d in digests:        write_u8(out, d.algo); write_bytes(out, d.bytes)
    for c in conds:          write_condset(out, c, sidx)

    for n in nodes:
        flags = node_flags(n)
        write_uvarint(out, sidx[n.name]); write_uvarint(out, sidx[n.version]); write_u8(out, flags)
        if flags.HAS_SOURCE:    write_uvarint(out, soidx[n.source])
        if flags.HAS_INTEGRITY: write_uvarint(out, didx[n.digest])
        if flags.HAS_CONDITION: write_uvarint(out, cidx[n.condition])

    for n in nodes:                                     # edge groups, in node_id order
        es = sort(out_edges(G, n), by = (sidx[e.name], nidx[e.to], e.type))
        write_uvarint(out, len es)
        prev = none
        for e in es:
            write_uvarint(out, sidx[e.name])
            t = nidx[e.to]
            if prev is none: write_zigzag(out, t - nidx[n])     # first: rel to from_id
            else:            write_uvarint(out, t - prev)       # nondecreasing delta
            prev = t
            write_u8(out, e.type)

    blob = out.bytes()
    if WANT_TRAILER_SUM: blob = with_trailer_checksum(blob)     # sets header flag bit 3
    append(blob, 0x00)                                          # end_marker

    # 6. Compress + frame + armor (§5)
    frame = byte(0x10) || brotli(blob, quality=11, lgwin=24)    # 0x10 = format 1, Brotli
    return base62(frame)
```

> Determinism: every table is content-sorted, every id is assigned by sorted order,
> and edge emission is fully ordered — so `encode` is a pure function of `G` up to the
> (irrelevant-to-digest) Brotli layer. `decode∘encode` round-trips; `digest = SHA-256(blob)`.

### 13.2 `decode(payload, limits) -> Lock`

```text
decode(payload, limits):
    frame = base62_decode_strict(payload)               # reject non-alphabet / non-canonical
    fb    = frame[0]                                     # frame byte (§5.2), pre-decompression
    version = fb >> 4;  codec = fb & 0x0F
    if version != 1 or codec != 0:                       # unknown future format/codec
        fail(UninterpretableLock, "frame=" + hex(fb))    # do NOT decompress
    blob = brotli_inflate_bounded(frame[1:],
              max_out = limits.max_decompressed,        # §5.5
              max_ratio = limits.max_ratio)
    r = ByteReader(blob)

    assert r.take(2) == "LK"                             else fail(MalformedLock,"magic")
    flags = r.uvarint()
    if flags has reserved bits set: fail(MalformedLock,"hdr-flags")
    (ns, ss, ds, cs, nn) = (r.uvarint() x5)
    if nn > limits.max_nodes: fail(MalformedLock,"node-cap")
    root_id = r.uvarint();  if root_id >= nn: fail(MalformedLock,"root-oob")

    strings = []
    for i in 0..ns:
        s = r.bytes(); assert valid_utf8(s)
        if i>0: assert s > strings[-1]                  # strict ascending, no dups
        strings.push(s)

    sources = read_sources(r, ss, ns)                   # bounds-check ref < ns; default-first
    digests = read_digests(r, ds)                       # algo known, len matches, sorted
    conds   = read_conds(r, cs, ns)                     # always-first; sorted

    nodes = []
    for i in 0..nn:
        name = r.uvarint(); ver = r.uvarint(); f = r.u8()
        check_index(name, ns); check_index(ver, ns)
        if f has reserved bits: fail(MalformedLock,"node-flags")
        src = f.HAS_SOURCE    ? checked(r.uvarint(), ss) : 0
        dig = f.HAS_INTEGRITY ? checked(r.uvarint(), ds) : NONE
        cnd = f.HAS_CONDITION ? checked(r.uvarint(), cs) : 0
        nodes.push(Node(name,ver,f,src,dig,cnd))
    assert_nodes_canonical_order(nodes, strings, sources, digests)   # §7.2

    edges = [[] for _ in nodes]; total_e = 0
    for from_id in 0..nn:
        ec = r.uvarint(); total_e += ec
        if total_e > limits.max_edges: fail(MalformedLock,"edge-cap")
        prev = NONE
        for j in 0..ec:
            name = checked(r.uvarint(), ns)
            to   = (prev==NONE) ? from_id + unzigzag(r) : prev + r.uvarint()
            prev = to; check_index(to, nn)
            type = r.u8(); if type > MAX_EDGE_TYPE: fail(MalformedLock,"edge-type")
            edges[from_id].push(Edge(name,to,type))
        assert_edges_canonical_order(edges[from_id], strings, nodes)

    if flags.HAS_TRAILER_SUM:
        assert sha256(blob[..trailer_start]) == read 32 bytes
    assert r.u8() == 0x00                                else fail(MalformedLock,"end-marker")
    assert r.at_end()                                   else fail(MalformedLock,"trailing")

    L = Lock(strings, sources, digests, conds, nodes, edges, root_id)
    assert_internal_consistency(L)                      # reachability, hint honesty, no-unused
    return L
```

### 13.3 `validate(spec, lock, env, policy) -> Result`

```text
validate(spec, L, env, policy):
    # Layer 5: identity / root match
    root = L.nodes[L.root_id]
    if root.source != spec.source or root.name != spec.name or root.version != spec.version:
        return fail(RootMismatch)

    # canonical digest (stable identity, used by caches/audit)
    L.digest = sha256(L.canonical_blob)

    # Conditions: prune for env; detect unknown gates on required nodes
    active = {}
    for id, n in enumerate(L.nodes):
        sat = eval_condition(L.conds[n.cond], env)      # returns SAT | UNSAT | UNKNOWN
        active[id] = sat
    for id reachable_via_required_prod_edges(L):
        if active[id] == UNKNOWN:  return fail(ConditionUnknown, id)   # fail-closed
        # UNSAT on a *required* node is also incompatible:
        if active[id] == UNSAT and is_required(L, id):
            return fail(IncompatibleLock, id)

    # Staleness / interpretability are evaluated by the caller's policy layer (§9).
    return ok(L)
```

### 13.4 `install(manifest, env, policy) -> InstalledGraph`

```text
install(manifest, env, policy):
    locked_subtrees = {}; plain = []

    # fallback(name, spec, reason): under strict -> abort; else warn + resolve bare.
    fallback(name, spec, e) =
        (policy == strict) ? abort(e) : (warn(e); plain.push(spec))

    for (name, specifier) in manifest.dependencies:
        spec = parse_specifier(name + "@" + specifier)          # §3.3 — never raises on locks
        if spec.lock == None:
            plain.push(spec); continue
        if spec.lock is Malformed:                              # §3.5 bad marker
            fallback(name, spec, MalformedLock(spec.lock.reason)); continue
        if policy == ignore:
            plain.push(spec); continue

        L = try decode(spec.lock.payload, limits)
            on UninterpretableLock e -> { fallback(name, spec, e); continue }  # future format
            on MalformedLock        e -> { fallback(name, spec, e); continue }  # corruption ⇒ treat as absent
        r = validate(spec, L, env, policy)
            on RootMismatch e        -> { fallback(name, spec, e); continue }   # not our package ⇒ bare
            on ConditionUnknown e    -> { (policy==strict) ? abort(e) : (warn(e); fallback(name,spec,e)); continue }
            on IncompatibleLock e    -> { fallback(name, spec, e); continue }   # prefer: re-resolve
        locked_subtrees[name] = L

    # Merge locked closures + resolve plain deps (normal resolver).
    # Aware tools persist merged closures into the native lockfile here (§6.6).
    # Artifact integrity remains the host package manager's normal responsibility.
    graph = new_graph()
    for (name, L) in locked_subtrees:
        merge_closure(graph, L, policy)                         # conflict rules §9.4
    resolve_plain(graph, plain, env)                            # normal resolution

    # Materialize: fetch + verify every active node
    for node in graph.active_nodes(env):                        # condition-pruned
        src = remap_source(node.source, policy)                 # §10.6 (remap before fetch)
        art = fetch(src, node.name, node.version,
                    fanout_budget = policy.max_fetches)         # §10.4 amplification cap
        if art == NOT_FOUND:
            if node.optional: continue
            (policy==strict) ? abort(StaleLock, node) : reresolve(node)
        if digest(node.algo, art) != node.digest:
            abort(IntegrityMismatch, node)                      # always fatal (§7.5)
        place(node, art)                                        # layout-agnostic (§6.2)

    return graph
```

---

## 14. Worked Examples

### 14.1 Minimal specifiers

```txt
npm:left-pad@1.3.0+lock.TEAxR0Vu0g               # tiny: single node, ~120 chars
npm:express@5.2.1+lock.UQ1Lk7m2...                # ~3 KB average-package payload
npm:@scope/pkg@2.4.0-rc.1+lock.S0kx9...          # scoped + prerelease base + lock
npm:express@5.2.1+git.9f3a1c.lock.UQ1Lk7m2...    # lock coexists with other build metadata
```

Detection rules illustrated:

- The `npm:` prefix identifies the source/context and is outside the SemVer version.
- The rightmost `@` splits `@scope/pkg` (name) from `2.4.0-rc.1+lock.S0kx9...`.
- The first `+` begins build metadata; everything is **valid SemVer**.
- The build identifiers are scanned: `lock` is found, the next identifier `S0kx9...`
  is the Base62 payload. In the last example, `git.9f3a1c` is preserved as foreign
  build metadata and the lock pair is extracted from the middle.
- There is no version token: the format is identified by the payload's frame byte after
  Base62-decode (§5.2).

### 14.2 Manifest with locks

```json
{
  "name": "my-app",
  "dependencies": {
    "express": "npm:express@5.2.1+lock.<payload>",
    "lodash":  "npm:lodash@4.18.1+lock.<payload>"
  }
}
```

Under `--dependency-locks=prefer`, both closures are decoded, validated, absorbed into
the native lockfile (§6.6), and materialized through the package manager's normal install
pipeline. A tampered `lodash` artifact still aborts with the package manager's normal
integrity failure; a merely *stale* or *malformed* `express` lock warns and re-resolves
the bare version.

A lock-unaware manager sees two source-qualified package identities with valid SemVer
versions and installs `npm:express@5.2.1` /
`npm:lodash@4.18.1` — no error, no lock benefit. Measured behavior (Appendix D): a plain
`install` of this hand-authored manifest **preserves** the `+lock.<payload>` strings in
both `package.json` and the lockfile on npm, pnpm, yarn, and bun; only an explicit
`npm add` / `pnpm add` would normalize them to a bare range.

### 14.3 Unknown future format

```txt
npm:react@19.1.0+lock.<payload-whose-frame-byte-is-0x20>
```

A consumer that implements format `1` Base62-decodes the payload, reads frame byte
`0x20` (format 2), recognizes it as unsupported, and classifies `UninterpretableLock`.
Under `prefer`/`ignore` it falls back to resolving `npm:react@19.1.0` (warning); under
`strict` it aborts. The surrounding package identity still has a valid SemVer version
component.

---

## 15. Deliverables Index

1. **Complete specification** — this document (§1–§15).
2. **Binary format definition** — §4 (layout), §5 (pipeline), §7.2 (canonical form).
3. **ABNF grammar** — §3.2, with parsing (§3.3) and disambiguation (§3.4).
4. **Validation rules** — §7 (layers, canonicality, failure taxonomy).
5. **Security analysis** — §10.
6. **Compatibility analysis** — §11.
7. **Example encoded dependency specifiers** — §4.11, §14.
8. **Reference implementation pseudocode** — §13 (`encode`/`decode`/`validate`/`install`).

---

## Appendix A — Enum Registry

These enums are shared by both wire formats; format 2 (§4.12) reuses them unchanged.

| Enum            | Values                                                             |
|-----------------|-------------------------------------------------------------------|
| Source kind     | 0 default, 1 registry, 2 https, 3 git, 4 file, 5+ reserved        |
| Digest algo     | 0 reserved, 1 sha256, 2 sha512, 3 blake3, 4 sha1(dep), 5+ reserved|
| Condition axis  | 0 os, 1 cpu, 2 libc, 3 runtime, 4 engines, 5+ reserved            |
| Condition op    | 0 eq, 1 neq, 2 in, 3 semver-range                                 |
| Edge type       | 0 prod, 1 dev, 2 optional, 3 peer, 4 peer-opt, 5+ reserved        |
| Node flags      | b0 source, b1 integrity, b2 condition, b3 optional, b4 dev, b5 bundled |
| Header flags    | b0 has-conditions, b1 has-peer, b2 has-optional, b3 trailer-sum   |

New values are added only in reserved ranges and only in ways that older decoders
**reject** (fail-closed), never silently ignore.

## Appendix B — Canonicalization Checklist (normative)

A blob is canonical iff: shortest varints; all tables strictly ascending and
deduped; default-source/always-condition first when used; nodes sorted by the §7.2
key; edges per group sorted by `(name_id,to_id,type)`; no unused table entry; no
unreachable node; trailer marker present; no trailing bytes. Decoders MUST verify all.

## Appendix C — Base64URL / Independent-Extension Profile (greenfield, optional)

The normative form (§3) rides standard SemVer build metadata with a Base62 payload so
it is non-breaking in existing ecosystems (npm/pnpm/bun). A **greenfield** package
manager that is *not* bound by SemVer parsing MAY instead use a denser, independent
specifier extension:

- Treat the lock as an independent extension rather than build metadata: split the
  specifier at the first `+`, match the prefix `lock.`, and take the remainder as the
  payload (the base version then forbids its own build metadata, to keep the split
  unambiguous).
- Encode `<payload>` in **Base64URL** (`A–Z a–z 0–9 - _`, no padding) instead of
  Base62. This is ~0.85% denser and uses trivial fixed 6-bit grouping (no base
  conversion), but its `_` makes the version **invalid SemVer**, so SemVer-strict tools
  (e.g. npm) reject it outright instead of degrading gracefully. Only choose this where
  no unaware-tool compatibility is required.
- Everything else (frame byte, binary blob, validation, policy) is **unchanged** —
  including the frame byte, so format evolution still works identically.

This profile is OPTIONAL and trades ecosystem compatibility for a marginal density win
and simpler armoring. The Base62 build-metadata form (§3) is the canonical, recommended
transport.

## Appendix D — Empirical Transport Compatibility (measured)

The adoption strategy (§3.1, §11.4) depends on existing package managers tolerating a
version component that carries `+lock.<Base62>` build metadata. This was measured directly
rather than assumed. The current spec examples use the more complete source-qualified form
`npm:<name>@<version>+lock.<payload>`; the matrix below measured the SemVer build-metadata
property specifically.

**Method.** On macOS, Node v24.16.0, against the public npm registry (2026-06-15), a
zero-dependency package `left-pad@1.3.0` was installed two ways per manager: (a) `add`
of `left-pad@1.3.0+lock.AbC123XyZ` into an empty project (the save-back path), and
(b) a *pre-authored* `package.json` already containing
`"left-pad": "1.3.0+lock.AbC123XyZ"` followed by a plain `install`. A multi-identifier
form `1.3.0+git.9f3a1c.lock.AbC123XyZ` was also exercised on npm. Resulting
`package.json`, lockfiles, and exit codes were inspected. Managers: npm 11.17.0,
pnpm 11.5.1, yarn 1.22.22 and yarn 4.10.3 (via corepack), bun 1.3.14.

**Results.** Every manager accepted the build-metadata version and installed
successfully (exit 0). No parser rejected the specifier. This is a measurement of
transport tolerance only; none of these package managers decoded, validated, or honored
the lock.

| Manager     | Accepts `+lock.X` | `add` save-back to `package.json` | Pre-authored manifest | Lockfile retains lock-bearing specifier | Resolved version | Integrity recorded |
|-------------|-------------------|-----------------------------------|-----------------------|------------------------------------------|------------------|--------------------|
| npm 11.17   | ✅ exit 0         | `^1.3.0` (lock dropped)           | **preserved**         | ✅ `packages."".dependencies`            | `1.3.0`          | sha512 ✅          |
| pnpm 11.5   | ✅ exit 0         | `1.3.0` (lock dropped)            | **preserved**         | ✅ explicit `specifier:` field           | `1.3.0`          | sha512 ✅          |
| yarn 1.22   | ✅ exit 0         | (preserves exact specs)           | **preserved**         | ✅ lockfile entry key                     | `1.3.0`          | sha512 ✅          |
| yarn 4.10   | ✅ exit 0         | **`1.3.0+lock.X` preserved**      | **preserved**         | ✅ descriptor key (`npm:1.3.0+lock.X`)   | `1.3.0`          | checksum ✅        |
| bun 1.3.14  | ✅ exit 0         | **`1.3.0+lock.X` preserved**      | **preserved**         | ✅ deps map                               | `1.3.0`          | sha512 ✅          |

**Representative lockfile fragments (pre-authored case):**

```jsonc
// npm package-lock.json — specifier kept in the dependency map, resolved version bare
"packages": {
  "": { "dependencies": { "left-pad": "1.3.0+lock.AbC123XyZ" } },
  "node_modules/left-pad": { "version": "1.3.0", "integrity": "sha512-XI5MPzV..." }
}
```

```yaml
# pnpm-lock.yaml — dedicated specifier vs. version fields (ideal for absorption, §6.6)
importers:
  .:
    dependencies:
      left-pad:
        specifier: 1.3.0+lock.AbC123XyZ
        version: 1.3.0
```

```jsonc
// yarn 4 yarn.lock — lock kept in the descriptor key, resolution bare
"left-pad@npm:1.3.0+lock.AbC123XyZ":
  version: 1.3.0
  resolution: "left-pad@npm:1.3.0"
  checksum: 10c0/3fb59c76...
```

**Conclusions for the spec.**

1. The foundational transport assumption holds: a Base62 lock in build metadata is
   non-breaking across the measured managers today.
2. The publishing/seed model (author embeds the lock in `package.json`) round-trips
   through the measured tools — both manifest and lockfile retain it in the pre-authored
   case.
3. Lockfiles already model "specifier (full) vs. resolved version (bare) + integrity,"
   which is precisely what §6.6 absorption requires; faithful transfer is mechanical.
4. The only divergence is `add`-time save normalization on npm/pnpm, which drops the
   lock as a side effect of rewriting to a range — acceptable progressive enhancement,
   and avoidable by a lock-aware save path.

> Caveat: only *exact-version + build metadata* was tested (the realistic lock case,
> since locks pin exact versions). Build metadata attached to a *range* (e.g.
> `^1.3.0+lock.X`) is unusual and not relied upon by this spec.

### D.1 Support vs. transport tolerance

The five managers above all *tolerate* build metadata — they ignore, strip, or preserve
it, but never reject the version. That tolerance is what makes graceful degradation work
(§9): an unaware tool still installs the bare `source:name@version` floor.

That should not be confused with support. A package manager supports Dependency Locks only
if it intentionally recognizes the `lock` marker, decodes the payload, validates the
rooted graph, applies the graph according to its resolver policy, and carries the result
into its native lockfile/integrity pipeline.

The spec therefore keeps two claims separate:

1. **Transport tolerance.** A manager does not reject a valid SemVer version containing
   `+lock.<payload>`. Ignoring or stripping it is still lock-unaware behavior.
2. **Semantic support.** A manager, initially vlt, implements the resolver semantics in
   §6.7 and policy model in §9.

Where a target manager rejects build metadata or where payloads exceed parser/manifest
size limits, the same canonical lock payload can be carried outside the version string in
a tool-specific sidecar (§8.5), while the dependency remains a plain exact pin.

---

*End of specification.*
