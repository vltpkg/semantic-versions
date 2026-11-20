import { PageActions } from "@/components/page-actions";
import type { Metadata, Viewport } from "next";
import { Bnf } from "@/components/bnf";
import { VariantsScript } from "@/components/interactive";

export const metadata: Metadata = {
  title: "Build Variants: platform and arch subsets in a version · semver.xyz",
  alternates: { canonical: "/extensions/variants/" },
  description:
    "Build Variants is a Semantic Versions extension that encodes os/arch/abi/feature coordinates as build metadata, e.g. npm:esbuild@0.21.0+darwin.arm64, so ranges can select a coherent subset of platform builds.",
};

export const viewport: Viewport = {
  colorScheme: "light dark",
  themeColor: "#ffffff",
};

export default function Page() {
  return (
    <main id="top">
      <section className="hero">
        <div className="reveal">
          <p className="eyebrow">Extension · Build Variants</p>
          <h1 className="hero-title">
            One version, <span className="grad">every target.</span>
          </h1>
          <p className="hero-sub">
            <em>Build Variants</em> encodes deployment-target coordinates (os, arch, abi and features) as build
            metadata, so a single release addresses a whole family of artifacts. Because Semantic Versions restores
            build precedence, each variant is a real, orderable version, and a{" "}
            <a href="/spec/#build-channels">build channel</a> can select a coherent <strong>subset</strong> that no
            numeric range can express.
          </p>
          <div className="code-window hero-code" data-copy="">
            <div className="code-bar">
              <span className="code-title">variant specifier</span>{" "}
              <button className="copy-btn" type="button" aria-label="Copy">
                Copy
              </button>
            </div>
            <pre className="code">
              <code>
                <span className="t-known">
                  <span className="t-src">napi:</span>
                  <span className="t-name">sharp</span>
                  <span className="t-at">@</span>
                  <span className="t-ver">0.33.0</span>
                </span>
                <span className="lock-new">
                  <span className="t-plus">+linux.x64.musl</span>
                </span>
              </code>
            </pre>
          </div>
          <p className="hero-annot">
            <code>napi:sharp@0.33.0</code> is the release.{" "}
            <span className="annot-new">
              <code>+linux.x64.musl</code> is the target
            </span>
            , an os·arch·abi coordinate, ordered coarse→fine so ranges can drill down.
          </p>
          <div className="hero-actions">
            <a className="btn btn-primary" href="#matrix">
              Select a subset
            </a>{" "}
            <a className="btn btn-ghost" href="#coordinates">
              Read the format
            </a>
          </div>
        </div>
        <PageActions path="/extensions/variants/" />
      </section>
      {/* ─────────────────────────── Why ─────────────────────────── */}
      <section className="wrap why">
        <div className="section-head left reveal">
          <p className="eyebrow">Why build metadata</p>
          <h2 className="section-title big">A target isn't a pre-release, or a new package.</h2>
          <p className="lead">
            A platform build is a <em>finished sibling</em> of a release, not a step toward it, so it{" "}
            <a href="/spec/#precedence">ranks above</a> the plain release, never below it like a pre-release. And it
            needn't fork the identity: instead of scattering software across <code>pkg-linux-x64</code>,{" "}
            <code>pkg-darwin-arm64</code>, … wired together with <code>optionalDependencies</code> and <code>os</code>/
            <code>cpu</code>/<code>libc</code> filters, Build Variants keeps <strong>one name, one version</strong>, and
            moves target selection back into the range grammar.
          </p>
        </div>
      </section>
      {/* ─────────────────────────── Live matrix ─────────────────────────── */}
      <section id="matrix" className="selector">
        <div className="section-head left reveal">
          <p className="eyebrow">Live</p>
          <h2 className="section-title big">Range over a variant subset.</h2>
          <p className="lead">
            Every cell is a concrete artifact: a release built for one target. Type a <strong>build channel</strong> and
            watch the selected subset light up. Shorter channels are broader subsets; the plain release column has no
            build, so a channel excludes it. This runs entirely in your browser on the reference{" "}
            <code>semantic-versions</code> parser.
          </p>
        </div>
        <div className="field field-spaced reveal">
          <label htmlFor="channel">Build channel</label>{" "}
          <input
            id="channel"
            type="text"
            spellCheck="false"
            autoComplete="off"
            placeholder="^1.0.0+linux.x64   ·   >=1.1.0+darwin.arm64   ·   1.2.0+win32.x64"
            defaultValue="^1.0.0+linux.x64"
          />{" "}
          <div className="chips" id="channel-examples" aria-label="Example channels" />
        </div>
        <p className="range-echo reveal" id="echo" />
        <p className="vmx-summary reveal" id="summary" />
        <div className="vmx-wrap reveal">
          <table className="vmx" id="matrix-table" aria-label="Version × variant matrix" />
        </div>
        <p className="hint reveal" id="legend" />
      </section>
      {/* ─────────────────────────── Format ─────────────────────────── */}
      <div className="doc-layout" id="coordinates">
        <aside className="toc reveal" aria-label="Table of contents">
          <div className="toc-title">Contents</div> <a href="#f-coords">Coordinates</a>{" "}
          <a href="#f-select">Selection</a> <a href="#f-target">Target matching</a>{" "}
          <a href="#f-relationship">Other schemes</a> <a href="#f-compose">Composability</a>{" "}
          <a href="#f-grammar">Grammar</a>
        </aside>
        <article className="doc reveal">
          <h2 id="f-coords">Coordinates</h2>
          <p>A Build Variant is build metadata whose identifiers name target axes, ordered coarse→fine:</p>
          <div className="doc-example">
            <code>
              &lt;version&gt;+&lt;os&gt;[.&lt;arch&gt;[.&lt;abi&gt;[.&lt;floor&gt;]]][.&lt;qualifier&gt;]*
              <br />
              &lt;version&gt;+wasm32[.&lt;qualifier&gt;]*
            </code>
          </div>
          <ul>
            <li>
              The <strong>fixed axes</strong> appear in order (<strong>os</strong>, then <strong>arch</strong>, then{" "}
              <strong>abi</strong>) and each <strong>MAY</strong> be omitted only if every later fixed axis is too. A
              variant is therefore always a <em>prefix</em> of the axis sequence: <code>linux</code>,{" "}
              <code>linux.x64</code>, <code>linux.x64.musl</code> are valid; <code>x64</code> alone (arch without os) is
              not. An omitted axis is no constraint: <code>linux.x64</code> with no abi runs on glibc and musl alike.
            </li>
            <li>
              An abi of <code>glibc</code> or <code>musl</code> <strong>MAY</strong> carry a{" "}
              <strong>version floor</strong>, the lowest version of that C library the build runs on:{" "}
              <code>linux.x64.glibc.2.28</code> runs on glibc 2.28 or later (the <code>manylinux</code> rule).
            </li>
            <li>
              <strong>Qualifiers</strong> follow the fixed axes, in any order: <strong>floors</strong> (
              <code>osv.11.0</code> for the OS version on <code>darwin</code> and <code>win32</code>,{" "}
              <code>napi.8</code> for the N-API version an addon needs), <strong>exact tags</strong> (
              <code>node.127</code>, <code>electron.123</code>: the <code>NODE_MODULE_VERSION</code> an addon was built
              against; a variant carries <code>napi</code> or one of these, not both), and <strong>feature tags</strong>{" "}
              (<code>avx2</code>, <code>cuda</code>, <code>neon</code>), which <strong>SHOULD</strong> be sorted for a
              canonical form.
            </li>
            <li>
              <code>wasm32</code> stands alone as the whole platform: a WebAssembly build is not tied to an operating
              system.
            </li>
            <li>
              Each value is its own dot-separated build identifier, so a variant slots straight into the existing{" "}
              <a href="/spec/VERSION.bnf">
                <code>&lt;build&gt;</code>
              </a>{" "}
              grammar, and floors are numeric identifiers that compare numerically under the core precedence rules with
              nothing added.
            </li>
          </ul>
          <p>
            Registered vocabularies (extensible; aligned with runtime values like Node's <code>process.platform</code> /{" "}
            <code>process.arch</code>, and with the platform fields of pnpm and npm's <code>variants</code> proposal):
          </p>
          <div className="table-wrap">
            <table className="compat">
              <thead>
                <tr>
                  <th>Axis or key</th>
                  <th>Values</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>
                    <code>os</code>
                  </td>
                  <td>
                    <code>linux</code> · <code>darwin</code> · <code>win32</code> · <code>freebsd</code> ·{" "}
                    <code>openbsd</code> · <code>android</code> · <code>sunos</code> · <code>aix</code>
                  </td>
                </tr>
                <tr>
                  <td>
                    <code>arch</code>
                  </td>
                  <td>
                    <code>x64</code> · <code>arm64</code> · <code>arm</code> (ARMv7) · <code>ia32</code> ·{" "}
                    <code>ppc64</code> · <code>s390x</code> · <code>riscv64</code> · <code>loong64</code>
                  </td>
                </tr>
                <tr>
                  <td>
                    <code>abi</code>
                  </td>
                  <td>
                    <code>glibc[.M.m]</code> · <code>musl[.M.m]</code> · <code>msvc</code>
                  </td>
                </tr>
                <tr>
                  <td>platform</td>
                  <td>
                    <code>wasm32</code>, in place of the fixed axes
                  </td>
                </tr>
                <tr>
                  <td>floors</td>
                  <td>
                    <code>osv.M[.m]</code> · <code>napi.N</code>
                  </td>
                </tr>
                <tr>
                  <td>exact tags</td>
                  <td>
                    <code>node.N</code> · <code>electron.N</code>
                  </td>
                </tr>
                <tr>
                  <td>features</td>
                  <td>any other lowercase identifier</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p>
            Consumers <strong>MUST</strong> ignore axis, key or feature identifiers they don't recognise and{" "}
            <strong>MUST NOT</strong> treat that as a match failure on its own; an unknown coordinate simply doesn't
            narrow selection.
          </p>
          <h2 id="f-select">Selection</h2>
          <p>
            Selection is just the core <a href="/spec/#build-channels">Build Channels</a> rule applied to coordinates: a{" "}
            <code>+</code>-channel is orthogonal to the numeric comparison and admits only versions whose build
            coordinates <em>begin with</em> the channel's. Because coordinates are ordered coarse→fine, a shorter
            channel is a broader subset.
          </p>
          <ul>
            <li>
              <code>^1.0.0+linux</code>: every linux variant in the 1.x line.
            </li>
            <li>
              <code>^1.0.0+linux.x64</code>: narrows to linux/x64, both glibc and musl.
            </li>
            <li>
              <code>^1.0.0+linux.x64.musl</code>: just the musl build.
            </li>
            <li>
              <code>&gt;=1.1.0+darwin.arm64</code>: the Apple-silicon build at or above 1.1.0.
            </li>
            <li>
              <code>1.2.0+win32.x64</code>: one exact artifact.
            </li>
            <li>
              <code>^1.0.0</code>: no channel, so every variant <em>and</em> the plain release.
            </li>
          </ul>
          <p>
            A channel narrows a range to the variants a <em>specifier</em> asks for. Members of a subset still order by
            precedence, so “the latest linux/x64 build of 1.x” is well-defined: the highest release, and within it the
            highest build. Precedence among siblings of one release is lexical, though, and says nothing about which
            sibling suits a machine. That is the job of target matching, below.
          </p>
          <blockquote>
            Prefix matching means a coarse channel also admits deeper refinements: <code>+linux.x64</code> matches{" "}
            <code>linux.x64.musl</code>. To distinguish siblings that share a prefix, make the distinguishing axis
            explicit: model libc as <code>linux.x64.glibc</code> vs <code>linux.x64.musl</code> rather than leaving
            glibc implicit.
          </blockquote>
          <h2 id="f-target">Target matching</h2>
          <p>
            A <strong>target</strong> is what a client installs for: by default the host, described in the same
            vocabulary as a coordinate (<code>process.platform</code>, <code>process.arch</code>, the C library and its
            version, the OS version, the N-API version and <code>NODE_MODULE_VERSION</code>, and whatever features the
            client can detect). A target can also be configured, for a container image or a cross-compile; any value it
            does not state is <strong>unknown</strong>.
          </p>
          <p>
            A variant <strong>applies to</strong> a target when every coordinate it states is satisfied:
          </p>
          <ol>
            <li>
              Each fixed axis it states equals the target's. An omitted axis is no constraint. <code>wasm32</code>{" "}
              applies to every target.
            </li>
            <li>
              Each floor it states (a C-library version, <code>osv</code>, <code>napi</code>) is at or below the
              target's value for that key, compared numerically. A floor on a key the target leaves unknown is{" "}
              <strong>not</strong> satisfied: linking a build the host may not run is worse than falling through to a
              broader variant.
            </li>
            <li>
              Each exact tag it states (<code>node</code>, <code>electron</code>) equals the target's.
            </li>
            <li>
              Each feature tag the client recognises is one the target has; a feature tag the client does not recognise
              is ignored.
            </li>
          </ol>
          <p>The build-less release applies to every target, as the fallback.</p>
          <p>
            To <strong>resolve</strong> a range for a target, a client takes the highest release in the range that has
            at least one applicable member, then the most <strong>specific</strong> applicable member of that release:
          </p>
          <ol>
            <li>a variant that states more fixed axes before one that states fewer;</li>
            <li>then a higher floor before a lower one, and any floor before none;</li>
            <li>
              then an exact <code>node</code>/<code>electron</code> tag before a <code>napi</code> floor before neither;
            </li>
            <li>then a variant that states more matched feature tags;</li>
            <li>
              then a native variant (one with an <code>os</code>) before <code>wasm32</code>, and <code>wasm32</code>{" "}
              before the build-less release.
            </li>
          </ol>
          <p>
            So for a glibc 2.31 host with N-API 9, <code>1.4.0+linux.x64.glibc.2.28.napi.8</code> wins over{" "}
            <code>1.4.0+linux.x64.glibc.2.17.napi.8</code>, which wins over <code>1.4.0+linux.x64</code>, which wins
            over <code>1.4.0+wasm32</code> and <code>1.4.0</code>. Specificity is computed from the coordinates, so a
            publisher never has to order anything by hand, and two clients given the same target select the same
            artifact.
          </p>
          <h2 id="f-relationship">Relationship to other schemes</h2>
          <ul>
            <li>
              <strong>
                npm <code>os</code>/<code>cpu</code>/<code>libc</code> + optional-dependency fanout.
              </strong>{" "}
              The same target matrix, expressed in one version instead of across many packages, and now rangeable. A
              resolver can still map a selected variant onto whatever artifact layout a registry uses.
            </li>
            <li>
              <strong>pnpm's platform variants.</strong> pnpm describes a platform build with <code>os</code>,{" "}
              <code>cpu</code>, <code>libc</code>, <code>libcVersion</code>, <code>osVersion</code>, <code>napi</code>{" "}
              and <code>nodeAbi</code>, ranks the archives of one version by how specific their platform is, and writes
              the result into its lockfile. That is the same vocabulary as the coordinates above, and the specificity
              order in <a href="#f-target">target matching</a> is pnpm's rank computed from the coordinate. Build
              Variants differs in putting the coordinate in the version, where it survives outside a lockfile.
            </li>
            <li>
              <strong>
                npm's <code>variants</code> field (
                <a href="https://github.com/npm/rfcs/pull/928" target="_blank" rel="noopener">
                  npm/rfcs#928
                </a>
                ).
              </strong>{" "}
              The RFC lists, on a package, the separate packages that replace it per target, using pnpm's fields; it is
              the projection of this extension onto registries that hold one artifact per version, and the RFC itself
              names <em>several archives per version</em> as its future shape. An entry maps onto a coordinate and back:
              <div className="table-wrap">
                <table className="compat compat-prose">
                  <thead>
                    <tr>
                      <th>
                        <code>variants</code> entry
                      </th>
                      <th>Coordinate</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>
                        <code>os</code>, <code>cpu</code>, <code>libc</code> (one value each)
                      </td>
                      <td>the fixed axes, in order</td>
                    </tr>
                    <tr>
                      <td>
                        <code>libcVersion: "2.28"</code>
                      </td>
                      <td>
                        <code>glibc.2.28</code> on the abi axis (the RFC's floor implies glibc)
                      </td>
                    </tr>
                    <tr>
                      <td>
                        <code>osVersion: "11.0"</code>
                      </td>
                      <td>
                        <code>osv.11.0</code>
                      </td>
                    </tr>
                    <tr>
                      <td>
                        <code>napi: 8</code>
                      </td>
                      <td>
                        <code>napi.8</code>
                      </td>
                    </tr>
                    <tr>
                      <td>
                        <code>nodeAbi: "node-127"</code> / <code>"electron-123"</code>
                      </td>
                      <td>
                        <code>node.127</code> / <code>electron.123</code>
                      </td>
                    </tr>
                    <tr>
                      <td>
                        an omitted <code>libc</code>
                      </td>
                      <td>an omitted abi</td>
                    </tr>
                    <tr>
                      <td>
                        a cross product (<code>os: ["darwin"], cpu: ["arm64", "x64"]</code>)
                      </td>
                      <td>
                        one coordinate per cell, or the common prefix (<code>darwin</code>) when one artifact serves
                        them all
                      </td>
                    </tr>
                    <tr>
                      <td>
                        a <code>!value</code> exclusion
                      </td>
                      <td>
                        no counterpart: a coordinate says what an artifact <em>is</em>, so an exclusion becomes an
                        omitted axis or several coordinates
                      </td>
                    </tr>
                    <tr>
                      <td>
                        <code>engines.node</code>
                      </td>
                      <td>no counterpart: a requirement on the consumer, which stays a manifest field</td>
                    </tr>
                    <tr>
                      <td>the unconditional fallback entry</td>
                      <td>
                        <code>wasm32</code>, or the build-less release
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              The RFC's author order (“narrower first, higher floors first, <code>nodeAbi</code> before{" "}
              <code>napi</code>, native before the fallback”) is the specificity order here, so a tool can generate a
              correctly ordered <code>variants</code> list from a set of coordinates.
            </li>
            <li>
              <strong>OCI / Docker multi-arch manifests.</strong> A manifest list selects by <code>os</code>/
              <code>architecture</code>/<code>variant</code>; Build Variants lifts that tuple into the version grammar,
              so the same selection works in a specifier or lockfile, not only at pull time.
            </li>
            <li>
              <strong>
                <a href="https://github.com/package-url/purl-spec">Package-URL</a> qualifiers.
              </strong>{" "}
              PURL carries target facts in <code>?arch=…&amp;os=…</code> qualifiers, outside the version and outside
              precedence. Build Variants keeps them <em>in</em> the version, where they order and where ranges select
              them, while staying round-trippable to PURL qualifiers for interchange.
            </li>
          </ul>
          <h2 id="f-compose">Composability</h2>
          <p>
            Variant coordinates are ordinary build identifiers, so they compose with other build-metadata extensions.
            Build Variants is the <em>first</em> of the three extensions for a reason: it answers{" "}
            <em>which artifact</em>, and the other two build on that answer. A variant precedes an integrity digest —{" "}
            <code>1.0.0+linux.x64.musl.sha512.…</code> pins the exact bytes of one target — and a{" "}
            <a href="/extensions/dependency-locks/">Dependency Lock</a> pins a whole graph whose every node is an
            identity of exactly that shape. See <a href="/extensions/integrity/">Package Integrity</a> for the digest
            half.
          </p>
          <h2 id="f-grammar">Grammar (BNF)</h2>
          <p>
            Building on <a href="/spec/VERSION.bnf">VERSION.bnf</a>'s <code>&lt;build&gt;</code>:
          </p>
          <div className="grammar-actions">
            <a className="btn btn-ghost" href="/spec/VARIANTS.bnf" download="">
              Download VARIANTS.bnf
            </a>
          </div>
          <Bnf copy>{`<variant build> ::= <platform> ( "." <qualifier> )*
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
<feature>       ::= <build identifier>`}</Bnf>
        </article>
      </div>
      <VariantsScript />
    </main>
  );
}
