# Dependency Locks

**The dependency pinning you already rely on — captured ahead of time as a shareable,
distributable value.**

A *Dependency Lock* takes the lock-in a lockfile gives you and captures it ahead of time as a
portable value. A maintainer or consumer resolves one dependency's subgraph *once*; that value
can be shared, transported, copied, and distributed alongside the version. An aware tool then
pins that part of the project graph to the locked subgraph — the same pinning as before, just
precomputed and shareable rather than produced locally in place.

```txt
npm:express@5.2.1+lock.<payload>
```

Today a dependency is usually treated as `name + version`, with the source/context and
resolved graph decided later by the consuming installer. A Dependency Lock makes a
dependency `source + name + version + resolved dependency closure`, inline.

> This is the short, readable overview. The complete normative specification — binary
> layout, ABNF grammar, parsing, validation layers, reference algorithms, security
> analysis, size analysis, and measured transport compatibility — lives in
> [`dependency-locks-spec.md`](./dependency-locks-spec.md).

This specification is **package-manager agnostic**. The examples use `npm:` as the source
prefix because it is the clearest complete identity for packages from the npm ecosystem.

### Why now

`npm-shrinkwrap.json` was the one widely-deployed way to **publish** a locked dependency
tree with a package, and npm is removing it in its next major (**v12**). The demand never
went away. When a tool like the Pi coding agent ships as a global `npm install`, its authors
want to guarantee the exact transitive graph they tested — shrinkwrap was how they did it.
Developers are now asking for a `--locked`-style install, declarative build systems like Nix
leaned on shrinkwrap, and CLI authors still ship generated shrinkwraps to harden their supply
chain.

Often it is the **maintainer** — the person who built the tool, library, or package manager
and writes the "install it like this" instructions — who wants this guarantee. The goal is to
let them say *"append this string; we've tested this subgraph"* and have an aware tool respect
it, **without taking the final say away from the person installing**.

But shrinkwrap also earned real criticism. In a *published* package it is widely considered
**hostile to consumers**: it freezes the whole tree, actively prevents deduping, and blocks
consumers from updating through security and bugfix releases — while bypassing normal install
rules (it can install unsigned code from any host, override any transitive dependency, and
slip past SCA tools). Hand-maintained shrinkwraps also go stale and silently pin consumers to
old, vulnerable versions.

#### Resolution cascades

Think of it like the CSS cascade. A web author ships styles, the browser applies its own
defaults, and the end user's stylesheet can override both — later layers, closer to the user,
win. Dependency resolution works the same way:

1. **Maintainer's lock** — a distributed, pinned, *tested* subgraph.
2. **Package manager** — vlt honors it by default; a lock-unaware tool ignores it and installs
   the bare version.
3. **User configuration** — overrides, source remaps, security policy, and install mode have
   the final say, and can reject the lock outright.

The maintainer gets a new ability to express a tested resolution; the consumer is always the
last layer. That is what keeps a lock from repeating shrinkwrap's mistakes:

- **An input, not a mandate.** A lock is a *seed*. The consumer's tool can honor, override,
  re-resolve, or reject it; package-manager config stays authoritative. The consumer is never
  blocked from patching through a security fix.
- **Integrity is not bypassed.** A lock MAY carry each artifact's integrity as *advisory
  tamper-evidence*, but every artifact still passes the package manager's normal metadata
  and fetch-integrity pipeline — there is no "install unsigned code from any host" path,
  and no HTTP-URL RCE foot-gun.
- **Scoped, so dedupe still works.** A lock pins one dependency's subgraph rather than the
  whole project, so the installer can still flatten and dedupe across the rest of the tree.
- **Degrades to the bare version.** A stale, malformed, future-format, or rejected lock falls
  back to the plain `source:name@version` and re-resolves, instead of trapping the consumer.
- **Portable, not a sidecar.** The lock rides inside the dependency value across tools and
  registries, and node identity carries its source so the same `name@version` from different
  registries stays distinct.
- **Canonical and auditable.** A deterministic binary graph with a single digest for equality,
  caching, and tamper-evidence, instead of a large JSON tree to review and diff.

**References / signals.** The removal of shrinkwrap and the resulting gap are being discussed
across the ecosystem — e.g. requests for a `--locked` install
([@mitsuhiko](https://x.com/mitsuhiko/status/2066181882589442283)), shrinkwrap's value to
declarative systems like Nix
([@jjpcodes](https://x.com/jjpcodes/status/2066064711016165654)), and CLIs shipping generated
shrinkwraps for supply-chain hardening
([Pi Changelog](https://x.com/PiChangelog/status/2057127185324876278)). The downsides above are
drawn from Socket's
[security analysis of npm shrinkwrap](https://socket.dev/blog/understanding-the-security-concerns-of-npm-shrinkwrap)
and the OpenSSF discussion on why publishing a shrinkwrap is
[hostile in a published package](https://github.com/ossf/package-manager-best-practices/issues/10).

---

## At a glance

| | |
|---|---|
| **Package identity** | `source:name@version`, e.g. `npm:express@5.2.1` |
| **Where it lives** | Inline in the version, as standard SemVer build metadata: `source:name@version+lock.<payload>` |
| **What it encodes** | A resolved dependency graph: nodes (package instances) + typed edges |
| **Who creates it** | Maintainers or tooling generate it from a resolved dependency closure |
| **Payload** | A compact, deterministic binary graph → Brotli → frame byte → Base62 |
| **Identity** | `SHA-256` over the canonical graph (the *lock digest*) |
| **Semantics** | If honored, supplies resolved dependency targets for one rooted subgraph before user-level config is applied |
| **Integrity** | MAY carry advisory artifact integrity (tamper-evidence); does not replace host lockfile/fetch integrity, which still applies |
| **Support** | New concept; intended for vlt first, portable for other package managers that choose to adopt it |

---

## 1. The specifier

1.1. A lock is **standard SemVer build metadata**: the reserved identifier `lock`
followed by a single payload identifier. The version component remains valid SemVer even
when the full package identity includes a source prefix such as `npm:`.

```txt
npm:left-pad@1.3.0+lock.AbC123XyZ
npm:@scope/pkg@2.4.0-rc.1+lock.S0kx9
npm:express@5.2.1+git.9f3a1c.lock.UQ1Lk7m2     # coexists with other build metadata
```

1.2. The optional `source:` prefix identifies the package ecosystem or source context.
The lock marker remains inside the SemVer build metadata; `npm:` is not part of the
SemVer version.

1.3. **Detection:** split build metadata on `.`; find the `lock` identifier; the next
identifier is the payload. Other build-metadata identifiers may appear and are preserved.

1.4. The payload alphabet is **Base62** (`0-9A-Za-z`) — a subset of legal build metadata,
so the version never becomes invalid. (Base64URL’s `_` would; see the full spec for why
Base62 is the default.)

1.5. **There is no version number in the lock marker.** The format is identified by a single
*frame byte* at the front of the decoded payload, so the format can evolve without ever
changing the specifier grammar.

1.6. A malformed lock is **never a hard parse error**. The package identity still parses;
the lock is handled by policy (§5), degrading to the bare `source:name@version`.

1.7. This shape aligns with the broader **SemVer Extended / SemVer v3** direction
described in ["Spec-tacular - SemVer & Beyond"](https://gitnation.com/contents/spec-tacular-semver-and-beyond):
a version belongs to a software context (`npm:react`), and build metadata can carry
useful machine-readable distinctions instead of being treated as disposable decoration.

---

## 2. What a lock means

2.1. A lock encodes a **resolved dependency graph** — the deterministic *output* of a
resolver for the subtree rooted at the dependency. This makes the dependency value a
distributable resolution seed that can be applied before the consumer generates a native
lockfile. Rather than define a new model, a lock **reuses
[vlt](https://vlt.sh)’s graph lockfile structure** (`nodes` + `edges`), scoped to one
rooted subtree and **without the project-level `options`/config block** a full lockfile
carries:

- **Nodes** are resolved package *instances*, identified by `(source, name, version,
  resolution context)`. The same name+version from different sources or peer contexts are
  distinct nodes.
- **Edges** are typed, named relationships to a specific target instance: `prod`, `dev`,
  `optional`, `peer`, `peer-opt`. Aliases are supported (the edge name may differ from the
  target’s name).

2.2. A lock **is**:

- A resolved graph with **exact** versions (never ranges).
- Source-/registry-aware, while leaving package metadata and artifact integrity to the
  package manager's normal pipeline.
- Inclusive of **peer placements** and **platform-conditional** nodes.

2.3. A lock **is not**:

- A physical install layout. It fixes *which instance satisfies which edge*, not on-disk
  hoisting/flattening. Any layout that preserves the wiring is conformant.
- A set of constraints, overrides, or the original range specs — only the resolved result.
- A carrier for configuration. It omits the `options`/config block (registries, settings)
  that a full vlt lockfile holds; that stays with the consuming package manager.

2.4. A lock is a **seed for the consumer’s native lockfile**, not a parallel validator.
The maintainer-generated value travels with the dependency; an aware consumer absorbs the
subgraph into its own lockfile later and then relies on its existing install, metadata, and
integrity pipeline.

2.5. A lock **controls only the dependency’s rooted transitive subgraph**. If a package
manager supports Dependency Locks and chooses to honor one, the lock supplies the resolved
dependency definitions for that subtree before user-level configuration is applied. User
policy still wins: overrides, resolutions, registry remaps, security policy, platform
filters, and install mode can modify, reject, or ignore the locked result.

2.6. A lock **MAY carry per-node artifact integrity** (a digest per resolved package) as
*advisory tamper-evidence*, but it **does not replace package metadata** such as published
tarball integrity. The package manager’s normal metadata, lockfile, and fetch pipeline
remain responsible for enforcing artifact integrity; the lock’s digests are an optional
pre-flight check, not the security boundary.

---

## 3. The payload

3.1. Pipeline: **canonical binary graph → Brotli → frame byte → Base62**.

3.2. The binary graph is compact and **deterministic** — interned string/source tables,
varints, delta-encoded edges; **not JSON**. Identical graphs always
produce identical bytes, hence an identical **lock digest** (`SHA-256` of the canonical
graph). That makes equality, caching, and audit trivial.

3.3. Compression and text armor are an **internal detail** behind the frame byte; future
formats may change them. An unknown frame byte is detected by reading one byte and falls
back by policy.

*(Full binary layout, varint rules, and canonical form: see the spec, §4–§5.)*

---

## 4. Validation

4.1. A lock **MUST** decode to **canonical form**; anything else is a malformed lock.

4.2. The graph’s **root node MUST match** the specifier’s `source`, `name`, and `version`.

4.3. At install time, every fetched artifact **MUST satisfy** the package manager’s normal
metadata, native lockfile, and fetch-integrity checks.

4.4. Failure classes: `UninterpretableLock` (unknown future format), `MalformedLock`,
`RootMismatch`, `IntegrityMismatch`, `StaleLock`, `IncompatibleLock`. **Only a fetch-time
integrity failure from the package manager’s normal integrity pipeline is unconditionally
fatal** — that is the real security boundary. Lock-format failures can fall back to the
still-valid bare version.

---

## 5. Consumer policy

```bash
install --dependency-locks=strict     # exactly as locked, or fail
install --dependency-locks=prefer      # default
install --dependency-locks=ignore      # resolve normally; locks unused
```

- **`strict`** — install precisely the locked closure; any lock problem aborts. For CI and
  reproducible builds.
- **`prefer`** (default) — use valid locks; on any lock-format problem, **warn and fall
  back** to normal resolution of `source:name@version`. Fetch-time integrity failures
  still abort under the package manager's normal rules.
- **`ignore`** — locks are not consulted; the version still resolves normally.

---

## 6. Publishing

6.1. Authors **MAY** embed a lock describing their package’s own resolved closure; tools
**SHOULD** generate it (a lock is the serialized output of a correct resolution).

6.2. Registries **SHOULD** validate and index locks. A consumer never mutates the
registry-published manifest, so the lock survives downstream even if a local tool strips
build metadata.

6.3. Aware consumers absorb the subgraph into their native lockfile without replacing the
package manager's normal metadata or artifact integrity records.

---

## 7. Security (summary)

- **Tamper-evidence:** root-match blocks pasting a foreign closure under a different name;
  the content-addressed lock digest surfaces graph changes; normal package-manager
  integrity checks catch substituted artifacts.
- **Bounded decoding:** fail-closed canonical parsing plus size, node/edge, ratio, and
  fetch-fan-out caps defend against malicious payloads, amplification, and DoS.
- **The boundary that matters is fetch-time integrity.** Stale, malformed, or
  foreign-format locks degrade safely to the bare pin; a substituted *artifact* still fails
  the package manager's normal integrity checks.

*(Full threat model and mitigations: spec §10.)*

---

## 8. Support and compatibility

Dependency Locks are a **new format**, not an already-supported ecosystem feature. vlt is
the first implementation and ships support alongside this specification. Other package
managers can adopt the same format and semantics if they choose.

Measured against real tools (spec, Appendix D), existing managers generally tolerate an
exact SemVer version carrying `+lock.<payload>` build metadata. That is only a **transport
compatibility** finding. It does **not** mean npm, pnpm, yarn, or bun understand, validate,
or honor Dependency Locks.

The one true incompatibility is a parser that **rejects** build metadata rather than
ignoring it — then even the bare version can fail. Where a parser can’t be updated, a
**sidecar** can carry the same graph outside the version string.

---

## 9. Example

```json
{
  "name": "my-app",
  "dependencies": {
    "express": "npm:express@5.2.1+lock.<payload>",
    "lodash":  "npm:lodash@4.18.1+lock.<payload>"
  }
}
```

Under the default `prefer` policy each closure is decoded, validated, and absorbed into the
native lockfile. Artifact integrity remains the package manager's job; a stale or malformed
lock warns and re-resolves the bare version. A lock-unaware tool simply installs
`npm:express@5.2.1` / `npm:lodash@4.18.1`.

---

## Read next

- **[Full specification & internals](./dependency-locks-spec.md)** — binary format, ABNF
  grammar, parsing/detection, validation layers, conflict resolution, reference pseudocode
  (`encode`/`decode`/`validate`/`install`), security analysis, size analysis, and the
  measured transport-compatibility appendix.
