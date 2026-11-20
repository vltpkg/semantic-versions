import type { Metadata, Viewport } from "next";
import { HeroLanguages } from "@/components/benchmarks";
import { HeroArt, VersionSort } from "@/components/interactive";
import { YouTube } from "@/components/youtube";

export const metadata: Metadata = {
  title: "semver.xyz — Semantic Versions, a modern versioning specification",
  alternates: { canonical: "/" },
  description:
    "Semantic Versions is a living versioning specification and a proposal for Semantic Versioning 3.0.0: a spiritual successor to 2.0.0-rc.1 that restores build precedence and adds sets, ranges and comparators.",
  openGraph: {
    title: "semver.xyz — Semantic Versions",
    description:
      "A modern versioning spec, and a proposal for Semantic Versioning 3.0.0: restores build precedence and formally defines sets, ranges and comparators. Test the range grammar in your browser.",
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
        <HeroArt />
        <div className="reveal">
          <p className="status-pill">
            <span className="status-dot" aria-hidden="true" />
            Specification 1.0.0
          </p>
          <h1 className="hero-title">
            Versions are a <br />
            <span className="grad">
              communication <br />
              mechanism.
            </span>
          </h1>
          <p className="hero-sub">
            <strong>Semantic Versions</strong> is an open specification for how version numbers are{" "}
            <em>assigned, incremented, grouped, compared and matched</em>. A spiritual successor to{" "}
            <a href="https://semver.org/spec/v2.0.0-rc.1.html">Semantic Versioning 2.0.0-rc.1</a>.
          </p>
          <div className="code-window hero-code" data-copy="">
            <div className="code-bar">
              <span className="code-title">anatomy of a version</span>{" "}
              <button className="copy-btn" type="button" aria-label="Copy">
                Copy
              </button>
            </div>
            <pre className="code">
              <code>
                <span className="t-src">npm:</span>
                <span className="t-name">react</span>
                <span className="t-at">@</span>
                <span className="t-name">1</span>
                <span className="t-at">.</span>
                <span className="t-name">2</span>
                <span className="t-at">.</span>
                <span className="t-name">3</span>
                <span className="t-at">-</span>
                <span className="t-ver">beta.4</span>
                <span className="t-plus">+</span>
                <span className="t-pay">build.7</span>
                {"\n"}
                <span className="t-cmt"># source:name @ major.minor.patch-prerelease+build</span>
              </code>
            </pre>
          </div>
          <div className="hero-actions">
            <a className="btn btn-primary" href="/spec/">
              Read the spec
            </a>{" "}
            <a className="btn btn-ghost" href="/selector/">
              Try the range selector
            </a>{" "}
            <HeroLanguages />
          </div>
        </div>
      </section>
      {/* ───────────────────────── Manifesto ───────────────────────── */}
      <section className="wrap why">
        <div className="why-grid">
          <div className="section-head left reveal">
            <p className="eyebrow">Why a new spec</p>
            <h2 className="section-title big">Versioning should mirror how software actually changes.</h2>
            <p className="lead">
              Semantic Versioning 2.0.0 is more than a decade old, has not meaningfully changed in that time, and has no
              realistic path to a 3.0. The way we ship software has moved on. Package managers escaped the first circle
              of dependency hell by quietly bolting <em>sets, ranges and comparators</em> onto a spec that never defined
              them, each in its own dialect: <code>^1.2.3</code> in npm and Composer, <code>~&gt; 1.2</code> in Bundler,
              a bare <code>1.2.3</code> that means a caret in Cargo, <code>~=1.2</code> in pip, <code>[1.0,2.0)</code>{" "}
              in Maven and NuGet. That is how we landed in a deeper circle, where package managers read the same version
              differently and resolve to different graphs.
            </p>
            <p className="lead why-crit">
              A specification is a language, and it is only as good as the definitions it contains. Software changes
              over time and sometimes breaks; that is natural, and necessary for growth. A versioning spec exists to{" "}
              <strong>codify the signals that communicate change</strong>, so it should codify the ones we actually use.
            </p>
          </div>
          <figure className="why-viz reveal" aria-hidden="true">
            <VersionSort />
            <figcaption className="why-viz-tag" data-sort-tag="">
              precedence · live
            </figcaption>
          </figure>
        </div>
      </section>
      {/* ───────────────────────── What changed ───────────────────── */}
      <section className="wrap">
        <div className="section-head left reveal">
          <p className="eyebrow">What changed</p>
          <h2 className="section-title big">Corrected definitions, restored meaning, formal grammars.</h2>
        </div>
        <div className="grid features">
          <article className="card reveal">
            <span className="card-kicker">01</span> <h3>Patch, corrected</h3>
            <p>
              A patch is a fix for behaviour that was never intended, not a promise of backward compatibility (which is
              practically impossible to guarantee). The definition is amended so a fix stays a fix.
            </p>
          </article>
          <article className="card reveal">
            <span className="card-kicker">02</span> <h3>Builds get their precedence back</h3>
            <p>
              2.0.0-rc.2 turned <em>builds</em> into inert "build metadata," making every build of a version equivalent.
              Two artifacts with different hashes or architectures are distinct software, so builds order again.
            </p>
          </article>
          <article className="card reveal">
            <span className="card-kicker">03</span> <h3>Sets &amp; subsets</h3>
            <p>
              Precedence alone can't describe a collection of versions. This spec defines ordered, unordered, normal,
              prerelease and build sets: the vocabulary you need to manage more than one version at a time.
            </p>
          </article>
          <article className="card reveal">
            <span className="card-kicker">04</span> <h3>Ranges &amp; comparators</h3>
            <p>
              Comparators (<code>&gt;=1.2.7</code>), comparator sets, hyphen ranges, x-ranges, tilde and caret. The
              grammar tools already ship, defined so they desugar to primitive comparators in one deterministic way.
            </p>
          </article>
          <article className="card reveal">
            <span className="card-kicker">05</span>{" "}
            <h3>
              Approximate ranges (<code>~&gt;</code>)
            </h3>
            <p>
              The pessimistic operator, borrowed from the Ruby world, is defined explicitly rather than left to each
              tool's imagination.
            </p>
          </article>
          <article className="card reveal">
            <span className="card-kicker">06</span> <h3>A reference implementation &amp; BNF</h3>
            <p>
              Backus–Naur grammars for versions, ranges and comparators, plus a parser you can read, so anyone can build
              a compliant library.
            </p>
          </article>
        </div>
      </section>
      {/* ───────────────────────── The talk ───────────────────────── */}
      <section className="wrap home-talk">
        <div className="talk-grid">
          <div className="section-head left reveal">
            <p className="eyebrow">The talk</p>
            <h2 className="section-title big">Spec-tacular: SemVer &amp; Beyond.</h2>
            <p className="lead">
              The case for this work in 21 minutes: where the Semantic Versioning spec falls short, and what it takes to
              close the gaps. From DevOps.js Conf 2024.
            </p>
          </div>
          <figure className="talk reveal">
            <YouTube
              id="5x7jVqXzAAM"
              title="Spec-tacular: SemVer & Beyond (DevOps.js Conf 2024)"
              label="Play the talk “Spec-tacular: SemVer & Beyond” (21 minutes)"
            />
            <figcaption>Darcy Clarke · DevOps.js Conf 2024 · 21 min</figcaption>
          </figure>
        </div>
      </section>
      {/* ───────────────────────── Explore cards ──────────────────── */}
      <section className="wrap">
        <div className="grid features home-cards">
          <a className="card reveal" href="/spec/">
            <span className="card-kicker">SPEC</span> <h3>The specification</h3>
            <p>The full ruleset: versions, sets, ranges, comparators and precedence.</p>
            <div className="card-arrow">Read →</div>
          </a>{" "}
          <a className="card reveal" href="/proposal/">
            <span className="card-kicker">PROPOSAL</span> <h3>Semantic Versioning 3.0.0</h3>
            <p>
              The case for making this spec the next version of Semantic Versioning, and why it stands on its own
              regardless.
            </p>
            <div className="card-arrow">See the case →</div>
          </a>{" "}
          <a className="card reveal" href="/selector/">
            <span className="card-kicker">TRY IT</span> <h3>Range selector</h3>
            <p>Test what matches what against the range grammar, entirely in your browser.</p>
            <div className="card-arrow">Open →</div>
          </a>{" "}
          <a className="card reveal" href="/grammar/">
            <span className="card-kicker">GRAMMAR</span> <h3>BNF grammars</h3>
            <p>Formal Backus–Naur forms, ready to build a library from.</p>
            <div className="card-arrow">View →</div>
          </a>{" "}
          <a className="card reveal" href="/origin/">
            <span className="card-kicker">HISTORY</span> <h3>History</h3>
            <p>How builds were introduced, and how a later change made them meaningless.</p>
            <div className="card-arrow">Trace →</div>
          </a>{" "}
          <a className="card reveal" href="/extensions/variants/">
            <span className="card-kicker">EXTENSION</span> <h3>Build Variants</h3>
            <p>
              Target coordinates carried in the version: <code>napi:sharp@0.33.0+linux.x64.musl</code>
            </p>
            <div className="card-arrow">Explore →</div>
          </a>{" "}
          <a className="card reveal" href="/extensions/integrity/">
            <span className="card-kicker">EXTENSION</span> <h3>Package Integrity</h3>
            <p>
              A verifiable content digest carried in the version: <code>npm:react@18.2.0+sha512.…</code>
            </p>
            <div className="card-arrow">Explore →</div>
          </a>{" "}
          <a className="card reveal" href="/extensions/dependency-locks/">
            <span className="card-kicker">EXTENSION</span> <h3>Dependency Locks</h3>
            <p>Pinning a resolved subgraph whose nodes are variant- and integrity-qualified identities.</p>
            <div className="card-arrow">Explore →</div>
          </a>
        </div>
      </section>
      {/* ─────────────────── Status of this document ─────────────────── */}
      <section className="wrap">
        <div className="doc-status reveal">
          <p className="eyebrow">Status of this document</p>
          <p>
            Semantic Versions 1.0.0 is published and ready to build on. The reference parser (
            <code>semantic-versions</code>) and its ports to seven other languages track the specification and pass a
            shared conformance suite, and the work is being stewarded toward an open standards body. It is also written
            to become <a href="/proposal/">Semantic Versioning 3.0.0</a>, if there is enough interest in taking it
            upstream. Corrections and proposals are welcome{" "}
            <a href="https://github.com/vltpkg/semantic-versions">in the repository</a>.
          </p>
        </div>
      </section>
    </main>
  );
}
