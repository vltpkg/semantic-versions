import { PageActions } from "@/components/page-actions";
import type { Metadata, Viewport } from "next";
import { Bnf } from "@/components/bnf";
import { IntegrityScript } from "@/components/interactive";

export const metadata: Metadata = {
  title: "Package Integrity — verifiable digests in a version · semver.xyz",
  alternates: { canonical: "/extensions/integrity/" },
  description:
    "Package Integrity is a Semantic Versions extension that carries a content-addressable digest inside a source-qualified version, e.g. npm:react@18.2.0+sha512.<value>.",
};

export const viewport: Viewport = {
  colorScheme: "light",
  themeColor: "#ffffff",
};

export default function Page() {
  return (
    <main id="top">
      <section className="hero">
        <div className="reveal">
          <p className="eyebrow">Extension · Package Integrity</p>
          <h1 className="hero-title">
            Pin software to its <span className="grad">exact bytes.</span>
          </h1>
          <p className="hero-sub">
            <em>Package Integrity</em> carries a content-addressable digest <strong>inside</strong> a source-qualified
            version. Because Semantic Versions restores build precedence, an integrity-bearing build is a real,
            orderable version — not an inert annotation.
          </p>
          <div className="code-window hero-code" data-copy="">
            <div className="code-bar">
              <span className="code-title">integrity specifier</span>{" "}
              <button className="copy-btn" type="button" aria-label="Copy">
                Copy
              </button>
            </div>
            <pre className="code">
              <code>
                <span className="t-known">
                  <span className="t-src">npm:</span>
                  <span className="t-name">react</span>
                  <span className="t-at">@</span>
                  <span className="t-ver">18.2.0</span>
                </span>
                <span className="lock-new">
                  <span className="t-plus">+sha512.</span>
                  <span className="t-pay">d0a1e5c3…9f2b</span>
                </span>
              </code>
            </pre>
          </div>
          <p className="hero-annot">
            <code>npm:react@18.2.0</code> is the package you already install.{" "}
            <span className="annot-new">
              <code>+sha512.…</code> is the only new part
            </span>
            , a build-metadata-safe transcoding of the artifact's hash.
          </p>
          <div className="hero-actions">
            <a className="btn btn-primary" href="#compute">
              Compute an integrity
            </a>{" "}
            <a className="btn btn-ghost" href="#format">
              Read the format
            </a>
          </div>
        </div>
        <PageActions path="/extensions/integrity/" />
      </section>
      {/* ─────────────────────────── Why ─────────────────────────── */}
      <section className="wrap why">
        <div className="section-head left reveal">
          <p className="eyebrow">Why build metadata</p>
          <h2 className="section-title big">SRI can't live in a version. This can.</h2>
          <p className="lead">
            <a href="https://www.w3.org/TR/SRI/">Subresource Integrity</a> strings look like{" "}
            <code>sha512-&lt;base64&gt;</code>. They can't sit in a version because Base64 uses <code>+</code>,{" "}
            <code>/</code> and <code>=</code>, none of which are valid build-metadata characters (
            <code>[0-9A-Za-z-]</code>). Package Integrity defines a lossless, grammar-safe transcoding (canonical{" "}
            <strong>hex</strong>, or compact <strong>Base62</strong>) so the digest travels inside the version string
            itself.
          </p>
        </div>
      </section>
      {/* ─────────────────────────── Compute ─────────────────────────── */}
      <section id="compute" className="selector">
        <div className="section-head left reveal">
          <p className="eyebrow">Live</p>
          <h2 className="section-title big">Compute a source-qualified integrity.</h2>
          <p className="lead">
            Pull a package's published integrity from any npm-compatible registry and transcode it into a Package
            Integrity specifier, then optionally re-download the artifact and verify the bytes in your browser with the
            Web Crypto API.
          </p>
        </div>
        <div className="sel-toolbar sel-toolbar-spaced reveal">
          <input
            id="registry"
            type="text"
            spellCheck="false"
            autoComplete="off"
            aria-label="Registry origin"
            placeholder="https://registry.npmjs.org"
            defaultValue="https://registry.npmjs.org"
          />{" "}
          <input
            id="pkg"
            type="text"
            spellCheck="false"
            autoComplete="off"
            aria-label="Package identity"
            placeholder="react   ·   react@18.2.0   ·   @scope/name@1.0.0"
          />{" "}
          <button className="btn btn-primary" id="compute-btn" type="button">
            Compute integrity
          </button>
        </div>
        <p className="range-echo reveal" id="echo" />
        <div id="result" hidden>
          <div className="field reveal">
            <label>Source-qualified identity</label> <div className="desugar" id="identity" />
          </div>
          <div className="field reveal">
            <label>Digests</label> <div className="desugar" id="digests" />
          </div>
          <div className="sel-toolbar reveal">
            <button className="btn btn-ghost" id="verify-btn" type="button">
              Verify by downloading the tarball
            </button>{" "}
            <span className="hint" id="tarball-note" />
          </div>
          <div className="vlist reveal" id="verify-out" />
        </div>
      </section>
      {/* ─────────────────────────── Format ─────────────────────────── */}
      <div className="doc-layout" id="format">
        <aside className="toc reveal" aria-label="Table of contents">
          <div className="toc-title">Contents</div> <a href="#f-format">Format</a>{" "}
          <a href="#f-precedence">Precedence</a> <a href="#f-verify">Verification</a>{" "}
          <a href="#f-locks">vs. Dependency Locks</a> <a href="#f-grammar">Grammar</a>
        </aside>
        <article className="doc reveal">
          <h2 id="f-format">Format</h2>
          <p>A Package Integrity build is one or more integrity digests appended as build metadata:</p>
          <div className="doc-example">
            <code>&lt;version&gt;+&lt;algorithm&gt;.&lt;digest&gt; ( .&lt;algorithm&gt;.&lt;digest&gt; )*</code>
          </div>
          <ul>
            <li>
              <code>&lt;algorithm&gt;</code>: one of <code>sha256</code>, <code>sha384</code>, <code>sha512</code>. The
              set is extensible; consumers <strong>MUST</strong> ignore digests whose algorithm they don't recognise and{" "}
              <strong>MUST NOT</strong> treat that as a failure by itself.
            </li>
            <li>
              <code>&lt;digest&gt;</code>: the raw hash encoded as lowercase <strong>hex</strong> (canonical,{" "}
              <code>[0-9a-f]+</code>) or compact <strong>Base62</strong> (<code>[0-9A-Za-z]+</code>). Both are valid
              build identifiers.
            </li>
            <li>Algorithm and digest are two dot-separated build identifiers, so the pair tokenises trivially.</li>
            <li>
              Multiple digests <strong>MAY</strong> be present and <strong>SHOULD</strong> be ordered
              weakest-to-strongest.
            </li>
          </ul>
          <p>
            Canonical hex lengths: <code>sha256</code> → 64, <code>sha384</code> → 96, <code>sha512</code> → 128
            characters.
          </p>
          <h2 id="f-precedence">Precedence</h2>
          <p>
            Package Integrity relies on Semantic Versions <a href="/spec/#precedence">precedence</a>: build identifiers
            are compared, so a digest-bearing version is ordered and distinguishable rather than collapsed away.
            Integrity is <strong>advisory to precedence</strong> but <strong>authoritative to trust</strong>: the digest
            doesn't change what a version means, but a mismatch <strong>MUST</strong> cause the artifact to be rejected.
          </p>
          <h2 id="f-verify">Verification</h2>
          <ol>
            <li>
              Resolve <code>name@version</code> from the named source (<code>npm:</code> → the registry).
            </li>
            <li>Obtain the artifact (for npm, the version's tarball).</li>
            <li>
              Compute the digest of the artifact bytes with <code>&lt;algorithm&gt;</code>.
            </li>
            <li>
              Transcode and compare to <code>&lt;digest&gt;</code>. It satisfies the identity iff every listed algorithm
              the consumer supports matches, and at least one supported algorithm was present.
            </li>
            <li>
              A mismatch <strong>MUST</strong> be a fatal integrity error.
            </li>
          </ol>
          <p>
            The transcoding is lossless: npm's <code>sha512-&lt;base64&gt;</code> is the same bytes as{" "}
            <code>sha512.&lt;hex&gt;</code> here.
          </p>
          <h2 id="f-locks">vs. Dependency Locks</h2>
          <p>
            Package Integrity is the single-artifact, inline form for one identity, and it is the second of the three
            extensions: it takes the artifact a <a href="/extensions/variants/">Build Variant</a> names and pins its
            exact bytes (<code>1.0.0+linux.x64.musl.sha512.…</code>).{" "}
            <a href="/extensions/dependency-locks/">Dependency Locks</a> then build on both — a lock pins an entire
            resolved subgraph in which <em>each node</em> is written in exactly this form, so the digest notation you
            learn here is the notation a decoded lock uses. Reach for an inline digest where a full lock is unnecessary.
          </p>
          <h2 id="f-grammar">Grammar (BNF)</h2>
          <p>
            Building on <a href="/spec/VERSION.bnf">VERSION.bnf</a>'s <code>&lt;build&gt;</code>:
          </p>
          <div className="grammar-actions">
            <a className="btn btn-ghost" href="/spec/INTEGRITY.bnf" download="">
              Download INTEGRITY.bnf
            </a>
          </div>
          <Bnf copy>{`<integrity build> ::= <integrity> ( "." <integrity> )*
<integrity>       ::= <algorithm> "." <digest>
<algorithm>       ::= "sha256" | "sha384" | "sha512"
<digest>          ::= <hex digest> | <base62 digest>
<hex digest>      ::= <hex> <hex>+
<base62 digest>   ::= <base62 char> <base62 char>+
<hex>             ::= "0" … "9" | "a" … "f"
<base62 char>     ::= "0" … "9" | "A" … "Z" | "a" … "z"`}</Bnf>
        </article>
      </div>
      <IntegrityScript />
    </main>
  );
}
