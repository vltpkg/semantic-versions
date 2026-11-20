import { PageActions } from "@/components/page-actions";
import type { Metadata, Viewport } from "next";
import { LockGeneratorScript } from "@/components/interactive";

export const metadata: Metadata = {
  title: "Dependency Locks: a package format extension · semver.xyz",
  alternates: { canonical: "/extensions/dependency-locks/" },
  description:
    "Dependency Locks is a package format specification for attaching a resolved transitive subgraph to a source-qualified package identity. Reference implementation planned in vlt.",
  openGraph: {
    title: "Dependency Locks by vlt",
    description:
      "A package format specification for attaching resolved dependency subgraphs to package identities like npm:express@5.2.1. Reference implementation planned in vlt.",
    type: "website",
  },
};

export const viewport: Viewport = {
  colorScheme: "light",
  themeColor: "#ffffff",
};

export default function Page() {
  return (
    <main id="top">
      {/* ─────────────────────────── Hero ─────────────────────────── */}
      <section className="hero">
        <div className="reveal">
          <p className="eyebrow">Package format specification</p>
          <h1 className="hero-title">Pin a dependency's subgraph ahead of time.</h1>
          <p className="hero-sub">
            A <em>Dependency Lock</em> captures one dependency's resolved subgraph as a portable, shareable value.
            Resolve it once; any aware tool pins that slice of the graph to it.
          </p>
          <div className="code-window hero-code" data-copy="">
            <div className="code-bar">
              <span className="code-title">specifier grammar</span>{" "}
              <button className="copy-btn" type="button" aria-label="Copy">
                Copy
              </button>
            </div>
            <pre className="code code-oneline">
              <code>
                <span className="t-known">
                  <span className="t-src">npm:</span>
                  <span className="t-name">express</span>
                  <span className="t-at">@</span>
                  <span className="t-ver">5.2.1</span>
                </span>
                <span className="lock-new">
                  <span className="t-plus">+lock.</span>
                  <span className="t-pay" id="payload">
                    163pGWiielRlPY5wPsWb7DtsYkTwvpFTO8OPltrZZ7s6pBrPgoOZ…
                  </span>
                </span>
              </code>
            </pre>
          </div>
          <p className="hero-annot">
            <code>npm:express@5.2.1</code> is the package you already install.{" "}
            <span className="annot-new">
              <code>+lock.…</code> is the only new part
            </span>
            : a pinned, shareable copy of the resolved subgraph, computed ahead of time.
          </p>
          <div className="hero-actions">
            <a className="btn btn-primary" href="#format">
              Read the format
            </a>{" "}
            <a
              className="btn btn-ghost"
              href="https://github.com/vltpkg/semantic-versions/blob/main/extensions/dependency-locks/dependency-locks.md"
              target="_blank"
              rel="noopener"
            >
              Open the spec
            </a>
          </div>
          <p className="hero-note">
            A specification from vlt. Support is planned in the vlt client and hasn't shipped yet, so this is not a
            claim of package-manager support today.
          </p>
        </div>
        <PageActions path="/extensions/dependency-locks/" />
      </section>
      {/* ───────────────────────── Why ───────────────────────────── */}
      <section className="wrap why">
        <div className="section-head left reveal">
          <p className="eyebrow">Why this exists</p>
          <h2 className="section-title big">Maintainers still want to pin what they ship.</h2>
          <p className="lead">
            <code>npm-shrinkwrap.json</code> was the one widely-deployed way to <em>publish</em> a locked dependency
            tree with a package, and npm is removing it in its next major (<strong>v12</strong>). The demand never went
            away. When a tool like the Pi coding agent ships as a global <code>npm install</code>, its authors want to
            guarantee the exact transitive graph they tested, and shrinkwrap was how they did it. People are now asking
            for a <code>--locked</code>-style install, declarative builds like Nix leaned on shrinkwrap, and CLI authors
            still ship generated shrinkwraps to harden their supply chain.
          </p>
          <p className="lead why-crit">
            But shrinkwrap earned its bad reputation: in a published package it is <em>hostile to consumers</em>: it
            freezes the whole tree, blocks deduping, and stops people from patching through security fixes, while
            quietly bypassing normal install rules. A maintainer wants to say{" "}
            <em>“append this string; we've tested this subgraph”</em> and have it respected, without taking the final
            say away from the person installing. A Dependency Lock is that: a tested resolution the maintainer
            distributes, applied as one layer the consumer still overrides.
          </p>
        </div>
        <div className="rules-grid reveal">
          <div className="rule">
            <span className="rule-label">An input, not a mandate</span>{" "}
            <p>
              Shrinkwrap froze the consumer's tree and blocked security updates. A lock is a seed: the consumer's tool
              can honor, override, re-resolve, or reject it, and package-manager config stays authoritative.
            </p>
          </div>
          <div className="rule">
            <span className="rule-label">Integrity isn't bypassed</span>{" "}
            <p>
              Shrinkwrap could pull unsigned code from any host and slip past SCA tools. A lock can pin each artifact's
              integrity as tamper-evidence, and your package manager still independently verifies every artifact through
              its normal metadata and fetch checks.
            </p>
          </div>
          <div className="rule">
            <span className="rule-label">Scoped, so dedupe still works</span>{" "}
            <p>
              Shrinkwrap pinned the entire project and prevented deduping. A lock pins one dependency's subgraph, so the
              installer can still flatten and dedupe across the rest of the tree.
            </p>
          </div>
          <div className="rule">
            <span className="rule-label">Degrades to the bare version</span>{" "}
            <p>
              A stale, hand-maintained shrinkwrap quietly trapped you on old, vulnerable versions. A stale, malformed,
              or rejected lock falls back to the plain version and re-resolves.
            </p>
          </div>
          <div className="rule">
            <span className="rule-label">Portable, not a sidecar</span>{" "}
            <p>
              Shrinkwrap was an npm-specific file dropped next to the package. A lock rides inside the dependency value
              across tools and registries, and node identity carries its source so the same <code>name@version</code>{" "}
              from different registries stays distinct.
            </p>
          </div>
          <div className="rule">
            <span className="rule-label">Canonical and auditable</span>{" "}
            <p>
              A large JSON tree is hard to review and diff. A lock is a deterministic binary graph with a single digest
              for equality, caching, and tamper-evidence.
            </p>
          </div>
        </div>
      </section>
      {/* ───────────────────────── Problem ───────────────────────── */}
      <section className="band">
        <div className="wrap split reveal">
          <div>
            <h2 className="section-title">This is a distributable resolution seed.</h2>
            <p className="lead">
              Dependency Locks define how maintainers can publish not just a package version, but the resolved
              dependency subgraph rooted at that version. Aware tools can use it before generating their native
              lockfile.
            </p>
          </div>
          <div>
            <h2 className="section-title">The graph is the payload.</h2>
            <p className="lead">
              That subgraph is just a plain graph (resolved package instances and typed edges) narrowed to one rooted
              dependency. It fixes that dependency's transitive choices, not the whole project graph, install layout, or
              config.
            </p>
          </div>
        </div>
      </section>
      {/* ───────────────────────── Features ──────────────────────── */}
      <section className="wrap">
        <div className="grid features">
          <article className="card reveal">
            <span className="card-kicker">01</span> <h3>Nothing extra to commit</h3>
            <p>
              The resolved subgraph travels inside the dependency value itself, so there is no separate lockfile to
              generate, share, or keep in sync.
            </p>
          </article>
          <article className="card reveal">
            <span className="card-kicker">02</span> <h3>Same graph, same bytes</h3>
            <p>
              An identical subgraph always encodes to the same bytes and the same <code>SHA-256</code>, so two locks are
              equal by comparing one hash.
            </p>
          </article>
          <article className="card reveal">
            <span className="card-kicker">03</span> <h3>Scoped to one dependency</h3>
            <p>
              It pins a single dependency's transitive closure rather than the whole project, so each dependency can
              carry its own pinned subgraph.
            </p>
          </article>
          <article className="card reveal">
            <span className="card-kicker">04</span> <h3>Works with today's tools</h3>
            <p>
              The marker rides in standard SemVer build metadata, so a tool that doesn't understand it still installs
              the plain <code>npm:express@5.2.1</code>.
            </p>
          </article>
          <article className="card reveal">
            <span className="card-kicker">05</span> <h3>The tool stays in charge</h3>
            <p>
              A consumer can honor, ignore, override, remap sources, or reject the lock under its own configuration; it
              is an input, not a mandate.
            </p>
          </article>
          <article className="card reveal">
            <span className="card-kicker">06</span> <h3>Integrity rides along</h3>
            <p>
              A lock can carry each artifact's integrity hash as advisory tamper-evidence; it never replaces
              verification. Your package manager still independently checks every artifact it fetches.
            </p>
          </article>
        </div>
      </section>
      {/* ───────────────────── Semantics ───────────────────── */}
      <section className="wrap">
        <div className="section-head left reveal">
          <p className="eyebrow">Resolution semantics</p>
          <h2 className="section-title big">A lock pins a dependency's subgraph before lockfile generation.</h2>
          <p className="lead">
            If a package manager supports Dependency Locks and chooses to honor one, the lock supplies the resolved
            dependency definitions for that rooted subtree before the consumer's native lockfile is generated. It is
            then still subject to user-level configuration, policy, registries, overrides, and the package manager's own
            installation model.
          </p>
        </div>
        <div className="cascade reveal">
          <p className="cascade-cap">Resolution cascades, like CSS: the layer closest to the consumer wins.</p>
          <ol className="cascade-layers">
            <li>
              <span className="cascade-n">1</span>{" "}
              <div>
                <strong>Maintainer's lock</strong>{" "}
                <span>“Append this string; we've tested this subgraph.” A distributed, pinned resolution.</span>
              </div>
            </li>
            <li>
              <span className="cascade-n">2</span>{" "}
              <div>
                <strong>Package manager</strong>{" "}
                <span>
                  vlt is where support is planned first. Until it ships, every tool is lock-unaware and installs the
                  bare version.
                </span>
              </div>
            </li>
            <li>
              <span className="cascade-n">3</span>{" "}
              <div>
                <strong>User configuration</strong>{" "}
                <span>
                  Overrides, source remaps, security policy, and install mode have the final say, and can reject it
                  outright.
                </span>
              </div>
            </li>
          </ol>
        </div>
        <div className="rules-grid reveal">
          <div className="rule">
            <span className="rule-label">Scope</span>{" "}
            <p>
              Applies to the transitive/subgraph rooted at a specific dependency, not to unrelated siblings in the
              project graph.
            </p>
          </div>
          <div className="rule">
            <span className="rule-label">Override point</span>{" "}
            <p>When honored, supplies resolved dependency targets before user-level configuration is applied.</p>
          </div>
          <div className="rule">
            <span className="rule-label">User policy</span>{" "}
            <p>
              Package-manager config remains authoritative: overrides, source remaps, security policy, and install modes
              can still change or reject the result.
            </p>
          </div>
          <div className="rule">
            <span className="rule-label">Integrity</span>{" "}
            <p>
              A lock may carry artifact integrity as advisory tamper-evidence; it doesn't replace verification. The
              package manager still independently enforces integrity through its normal lockfile and fetch pipeline.
            </p>
          </div>
        </div>
      </section>
      {/* ──────────────────────── How it works ───────────────────── */}
      <section id="format" className="wrap">
        <div className="section-head left reveal">
          <p className="eyebrow">The format</p>
          <h2 className="section-title big">A small nodes-and-edges graph, scoped to one subtree.</h2>
          <p className="lead">
            The payload is its own compact graph format: just resolved <code>nodes</code> and typed <code>edges</code>{" "}
            for one rooted subtree, no config. It's modeled on{" "}
            <a href="https://www.vlt.io" target="_blank" rel="noopener">
              vlt
            </a>
            's lockfile graph and maps cleanly to and from it, but it's deliberately generic. Each node is one
            origin-qualified id like <code>npm:react@1.2.3</code>, with no tool-specific encoding, so any package
            manager can implement it. The version stays ordinary SemVer; <code>npm:</code> just supplies the origin.
          </p>
        </div>
        <div className="pipeline reveal">
          <div className="pipe-step">
            <span className="pipe-num">1</span> <h4>Capture the subgraph</h4>
            <p>
              Resolve one rooted subtree into a plain graph of <code>nodes</code> and typed <code>edges</code>, plus
              optional per-node integrity and platform conditions, with no config. It maps cleanly onto vlt's graph.
            </p>
          </div>
          <div className="pipe-arrow">→</div>
          <div className="pipe-step">
            <span className="pipe-num">2</span> <h4>Encode canonically</h4>
            <p>
              Serialize that graph to a deterministic binary blob: a columnar layout with structural versions, varints,
              and delta-encoded edges. Not JSON.
            </p>
          </div>
          <div className="pipe-arrow">→</div>
          <div className="pipe-step">
            <span className="pipe-num">3</span> <h4>Compress &amp; frame</h4>
            <p>
              Brotli when it pays off (tiny graphs ship uncompressed), then prepend a one-byte frame that identifies the
              format and codec.
            </p>
          </div>
          <div className="pipe-arrow">→</div>
          <div className="pipe-step">
            <span className="pipe-num">4</span> <h4>Armor as Base62</h4>
            <p>
              Base62 keeps the version legal SemVer. That helps with transport, but does not mean the package manager
              supports the lock semantics.
            </p>
          </div>
        </div>
        <div className="pipeline-flow reveal">
          <code>npm:name@version</code>
          <span>+</span>
          <code>canonical graph</code>
          <span>→</span>
          <code>Brotli</code>
          <span>→</span>
          <code>frame byte</code>
          <span>→</span>
          <code>Base62</code>
          <span>→</span>
          <code className="hl">npm:name@version+lock.&lt;payload&gt;</code>
        </div>
        <div className="section-head left reveal decoded-head">
          <p className="eyebrow">Decoded payload</p>
          <h2 className="section-title">Decoded, it's a small nodes-and-edges graph.</h2>
          <p className="lead">
            The <code>+lock.&lt;payload&gt;</code> blob is compact binary built for transport. Decode it and you get a
            plain graph: each <code>node</code> is an origin-qualified id like <code>npm:lightningcss@1.32.0</code>,
            optionally carrying its artifact integrity as <a href="/extensions/integrity/">Package Integrity</a> build
            metadata (<code>+sha512.…</code>) and platform conditions (<code>[os=… cpu=…]</code>); each{" "}
            <code>edge</code> is just <code>from -&gt; to = type</code> (<code>prod</code>, <code>optional</code>,{" "}
            <code>peer</code>). Nothing tool-specific; it maps one-to-one onto vlt's lockfile graph, but anyone can read
            or emit it.
          </p>
          <p className="lead">
            Note that a node id is <em>exactly</em> a version written in the two extensions beneath this one: a{" "}
            <a href="/extensions/variants/">Build Variant</a>'s coordinates (where the node is target-specific) followed
            by a Package Integrity digest, in that order. There is no lock-specific spelling of a package identity to
            learn — a decoded node is just a source-qualified version you could paste into a manifest on its own.
          </p>
        </div>
        <div className="code-window reveal" data-copy="">
          <div className="code-bar">
            <span className="code-title">decoded · npm:lightningcss@1.32.0 subtree</span>{" "}
            <button className="copy-btn" type="button" aria-label="Copy">
              Copy
            </button>
          </div>
          <pre className="code">
            <code>
              <span className="t-key">format</span>
              {" = "}
              <span className="t-edge">2</span>
              {"\n"}
              <span className="t-key">root</span>
              {" = "}
              <span className="t-edge">0</span>
              {"\n"}
              {"\n"}
              <span className="t-cmt">[nodes]</span>
              {"\n"}
              <span className="t-edge">0</span>
              {" = "}
              <span className="t-str">
                npm:lightningcss@1.32.0<span className="add">+sha512.357601ce29cd…</span>
              </span>{" "}
              <span className="t-cmt">{"[engines=>=12]"}</span>
              {"\n"}
              <span className="t-edge">1</span>
              {" = "}
              <span className="t-str">
                npm:detect-libc@2.1.2<span className="add">+sha512.06d8f604e38e…</span>
              </span>{" "}
              <span className="t-cmt">{"[engines=>=8]"}</span>
              {"\n"}
              <span className="t-edge">2</span>
              {" = "}
              <span className="t-str">
                npm:lightningcss-darwin-arm64@1.32.0<span className="add">+sha512.473786f49bb9…</span>
              </span>{" "}
              <span className="t-cmt">[os=darwin cpu=arm64]</span>
              {"\n"}
              <span className="t-edge">3</span>
              {" = "}
              <span className="t-str">
                npm:lightningcss-linux-x64-gnu@1.32.0<span className="add">+sha512.57b42be76221…</span>
              </span>{" "}
              <span className="t-cmt">[os=linux cpu=x64 libc=glibc]</span>
              {"\n"}
              {"\n"}
              <span className="t-cmt">[edges]</span>
              {"\n"}
              <span className="t-edge">0</span>
              {" -> "}
              <span className="t-edge">1</span>
              {" = "}
              <span className="t-str">prod</span>
              {"\n"}
              <span className="t-edge">0</span>
              {" -> "}
              <span className="t-edge">2</span>
              {" = "}
              <span className="t-str">optional</span>
              {"\n"}
              <span className="t-edge">0</span>
              {" -> "}
              <span className="t-edge">3</span>
              {" = "}
              <span className="t-str">optional</span>
            </code>
          </pre>
        </div>
        <p className="caption reveal">
          A deliberately small, generic shape: origin-qualified node ids, an optional{" "}
          <code>+&lt;algorithm&gt;.&lt;digest&gt;</code> integrity build and <code>[platform]</code> conditions, and{" "}
          <code>from -&gt; to = type</code> edges, nothing tool-specific. Where a node is target-specific its{" "}
          <a href="/extensions/variants/">variant</a> coordinates precede the digest, exactly as in a standalone version
          — <code>npm:sharp@0.33.0+linux.x64.musl.sha512.a91c…</code>. Integrity is advisory tamper-evidence; your
          package manager still verifies every artifact. The graph translates one-to-one to vlt's lockfile graph (and
          back), but is simple enough for any package manager to implement. The lock digest is taken over the canonical
          encoding of exactly this graph, so the same subtree always yields the same lock.
        </p>
      </section>
      {/* ─────────────────────── Generate (live) ─────────────────── */}
      <section id="generate" className="wrap">
        <div className="section-head left reveal">
          <p className="eyebrow">Try it</p>
          <h2 className="section-title big">Generate a lock in your browser.</h2>
          <p className="lead">
            Type any public npm package. This resolves its registry subgraph live against{" "}
            <code>registry.npmjs.org</code>, then runs the real pipeline (canonical binary → SHA-256 digest → Brotli (or
            stored) → frame byte → Base62) and hands back a copy-pasteable <code>+lock.&lt;payload&gt;</code>. No
            server: it all runs here. Non-registry dependencies (git, <code>file:</code>, <code>workspace:</code>) are
            skipped and listed below.
          </p>
        </div>
        <form id="gen-form" className="gen-form reveal" autoComplete="off">
          <input
            id="gen-input"
            type="text"
            spellCheck="false"
            placeholder="debug · ms@2.1.3 · @babel/core"
            defaultValue="debug"
            aria-label="npm package name and optional version range"
          />{" "}
          <button type="submit" className="btn btn-primary" id="gen-btn">
            Generate
          </button>
        </form>{" "}
        <label className="gen-toggle reveal" htmlFor="gen-integrity">
          <input type="checkbox" id="gen-integrity" defaultChecked />{" "}
          <span>Embed artifact integrity (sha512 per node)</span>{" "}
          <small>Tamper-evidence, but hashes don't compress, so toggle off for a smaller payload.</small>
        </label>{" "}
        <p id="gen-status" className="gen-status" hidden />
        <div id="gen-result" className="gen-result" hidden>
          <div className="code-window" data-copy="">
            <div className="code-bar">
              <span className="code-title" id="gen-title">
                generated lock
              </span>{" "}
              <button className="copy-btn" type="button" aria-label="Copy">
                Copy
              </button>
            </div>
            <pre className="code">
              <code id="gen-payload">{``}</code>
            </pre>
          </div>
          <div className="gen-meta" id="gen-meta" />
          <div className="code-window" data-copy="">
            <div className="code-bar">
              <span className="code-title">decoded graph</span>{" "}
              <button className="copy-btn" type="button" aria-label="Copy">
                Copy
              </button>
            </div>
            <pre className="code">
              <code id="gen-decoded">{``}</code>
            </pre>
          </div>
          <div id="gen-warnings" className="gen-warnings" hidden />
        </div>
      </section>
      {/* ─────────────────────── Example manifest ────────────────── */}
      <section className="wrap">
        <div className="section-head reveal">
          <p className="eyebrow">Manifest example</p>
          <h2 className="section-title big">A dependency value can carry the locked subgraph.</h2>
        </div>
        <div className="code-window reveal" data-copy="">
          <div className="code-bar">
            <span className="code-title">package.json</span>{" "}
            <button className="copy-btn" type="button" aria-label="Copy">
              Copy
            </button>
          </div>
          <pre className="code">
            <code>
              {"{"}
              {"\n"}
              {"  "}
              <span className="t-key">"name"</span>
              {": "}
              <span className="t-str">"my-app"</span>,{"\n"}
              {"  "}
              <span className="t-key">"dependencies"</span>
              {": {"}
              {"\n"}
              {"    "}
              <span className="t-key">"express"</span>
              {": "}
              <span className="t-str">{'"npm:express@5.2.1+lock.<payload>"'}</span>,{"\n"}
              {"    "}
              <span className="t-key">"lodash"</span>
              {":  "}
              <span className="t-str">{'"npm:lodash@4.18.1+lock.<payload>"'}</span>
              {"\n"}
              {"  }"}
              {"\n"}
              {"}"}
            </code>
          </pre>
        </div>
        <p className="caption reveal">
          An aware package manager running <code>prefer</code> can decode, validate, and absorb each closure into its
          native lockfile. A lock-unaware tool simply installs <code>npm:express@5.2.1</code> /{" "}
          <code>npm:lodash@4.18.1</code>.
        </p>
      </section>
      {/* ────────────────────── Support ────────────────────── */}
      <section id="support" className="wrap">
        <div className="section-head left reveal">
          <p className="eyebrow">Support status</p>
          <h2 className="section-title big">Planned in vlt first. Portable by specification.</h2>
          <p className="lead">
            Dependency Locks are a new idea, and no mainstream package manager honors them yet. npm, pnpm, yarn and bun
            will not decode or act on the lock. The only compatibility we claim is at the transport layer: an exact
            SemVer version can carry the lock as build metadata without breaking tools that already parse versions.
          </p>
        </div>
        <div className="support-list reveal">
          <div className="support-row">
            <span className="support-term">vlt</span>{" "}
            <p>
              Reference implementation, planned. Support hasn't shipped yet; once it lands, vlt will decode, validate,
              and use the locked subgraph during resolution.
            </p>
          </div>
          <div className="support-row">
            <span className="support-term">Other package managers</span>{" "}
            <p>
              May adopt the format later. Until one does, it stays lock-unaware, not lock-compatible: it installs the
              plain version and ignores the lock.
            </p>
          </div>
          <div className="support-row">
            <span className="support-term">Existing SemVer parsers</span>{" "}
            <p>
              Mostly relevant to transport. Accepting <code>+lock.&lt;payload&gt;</code> is not the same as honoring
              Dependency Locks.
            </p>
          </div>
          <div className="support-row">
            <span className="support-term">Size ceiling</span>{" "}
            <p>
              <code>node-semver</code> caps a version string at <strong>256 characters</strong>, leaving about 245 for
              the payload. Measured, that holds roughly ten nodes without integrity, or two or three with{" "}
              <code>sha512</code>. Past the cap npm silently reclassifies the specifier as a range and drops the lock
              from resolution, so an oversized inline lock goes quietly inert rather than erroring.
            </p>
          </div>
          <div className="support-row">
            <span className="support-term">Ecosystem scope</span>{" "}
            <p>
              Riding inside the version is an <strong>npm-ecosystem mechanism</strong>. Python cannot use it at any
              length: PEP 440 treats the <code>+…</code> slot as a <em>local version identifier</em>, lowercases it
              (destroying a Base62 payload), requires resolvers to ignore it when matching specifiers, and PyPI refuses
              to accept it at all. There the graph model still applies — the sidecar does not.
            </p>
          </div>
          <div className="support-row">
            <span className="support-term">Sidecar path</span>{" "}
            <p>
              Carries the identical canonical payload outside the version string, with no length ceiling. For package
              managers that reject build metadata, for ecosystems where the inline form is unavailable, and for any
              closure past the cap above, which in practice means most real packages.
            </p>
          </div>
        </div>
      </section>
      {/* ───────────────────────── Security ──────────────────────── */}
      <section id="security" className="band">
        <div className="wrap">
          <div className="section-head left reveal">
            <p className="eyebrow">Security model</p>
            <h2 className="section-title big">Fail closed at the artifact boundary.</h2>
          </div>
          <div className="grid sec-grid">
            <article className="card reveal">
              <h3>Tamper-evident</h3>
              <p>
                Each node can pin its artifact integrity, and root-match blocks pasting a foreign closure under another
                name. The host package manager's integrity pipeline still independently catches substituted artifacts.
              </p>
            </article>
            <article className="card reveal">
              <h3>Bounded decoding</h3>
              <p>
                Canonical parsing plus size, node, edge, ratio, and fetch fan-out caps defend against malicious payloads
                and amplification.
              </p>
            </article>
            <article className="card reveal">
              <h3>The right boundary</h3>
              <p>
                Stale, malformed, or future-format locks degrade to the still-valid bare version. Artifact substitution
                still fails the normal integrity boundary.
              </p>
            </article>
          </div>
        </div>
      </section>
      <LockGeneratorScript />
    </main>
  );
}
