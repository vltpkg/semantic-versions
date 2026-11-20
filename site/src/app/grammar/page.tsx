import { PageActions } from "@/components/page-actions";
import type { Metadata, Viewport } from "next";
import { Bnf } from "@/components/bnf";

export const metadata: Metadata = {
  title: "BNF grammar — versions, ranges & comparators · semver.xyz",
  alternates: { canonical: "/grammar/" },
  description:
    "Backus-Naur Form grammars for Semantic Versions, ranges and comparators: everything needed to build a compliant library.",
};

export const viewport: Viewport = {
  colorScheme: "light",
  themeColor: "#ffffff",
};

export default function Page() {
  return (
    <main>
      <section className="page-hero reveal">
        <p className="eyebrow">Grammar</p>
        <h1>
          Build a library <span className="grad">from the grammar.</span>
        </h1>
        <p className="lead">
          Formal Backus–Naur forms for versions, ranges and comparators. Each is downloadable as a <code>.bnf</code>{" "}
          file, and mirrored by the reference{" "}
          <a href="https://github.com/vltpkg/semantic-versions/tree/main/libraries/javascript">semantic-versions</a>{" "}
          parser. A{" "}
          <a href="https://regex101.com/r/vkijKf/1/" target="_blank" rel="noopener">
            regular expression
          </a>{" "}
          is also available for quick validation.
        </p>
        <PageActions path="/grammar/" />
      </section>
      <div className="doc-layout">
        <aside className="toc reveal" aria-label="Table of contents">
          <div className="toc-title">Grammars</div> <a href="#versions">Versions</a>{" "}
          <a href="#references">References &amp; context</a> <a href="#ranges">Ranges</a>{" "}
          <a href="#comparators">Comparators</a> <a href="#implementation">Reference parser</a>
        </aside>
        <article className="doc reveal">
          <h2 id="versions">Versions</h2>
          <p>A valid version is a version core with optional pre-release and build labels.</p>
          <div className="grammar-actions">
            <a className="btn btn-ghost" href="/spec/VERSION.bnf" download="">
              Download VERSION.bnf
            </a>
          </div>
          <Bnf copy>{`<valid semver> ::= <version core>
                 | <version core> "-" <pre-release>
                 | <version core> "+" <build>
                 | <version core> "-" <pre-release> "+" <build>

<version core> ::= <major> "." <minor> "." <patch>

<major> ::= <numeric identifier>
<minor> ::= <numeric identifier>
<patch> ::= <numeric identifier>

<pre-release> ::= <dot-separated pre-release identifiers>

<dot-separated pre-release identifiers> ::= <pre-release identifier>
                                          | <pre-release identifier> "." <dot-separated pre-release identifiers>

<build> ::= <dot-separated build identifiers>

<dot-separated build identifiers> ::= <build identifier>
                                    | <build identifier> "." <dot-separated build identifiers>

<pre-release identifier> ::= <alphanumeric identifier>
                           | <numeric identifier>

<build identifier> ::= <alphanumeric identifier>
                     | <digits>

<numeric identifier> ::= "0"
                       | <positive digit>
                       | <positive digit> <digits>

<positive digit> ::= "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9"`}</Bnf>
          <p className="caption left">
            The full leaf definitions (identifier characters, letters, digits) are in the downloadable file.
          </p>
          <h2 id="references">References &amp; context</h2>
          <p>
            A version rarely travels alone. A <strong>reference</strong> pairs a version (or a range) with the{" "}
            <a href="/spec/#context">context</a> it belongs to: the identity of a package, module, image, crate or
            service. The context is optional and, when present, is separated from the version by <code>@</code>. An
            ecosystem qualifies a context with a <strong>source</strong> (<code>source:name</code>), so the same grammar
            names artifacts anywhere: <code>npm:react@18.2.0</code>, <code>pypi:flask@3.0.0</code>,{" "}
            <code>gem:rails@7.1.3</code>, <code>golang:golang.org/x/text@0.14.0</code>. A context never contains
            whitespace and a version never contains <code>@</code>, so the split is unambiguous.
          </p>
          <div className="grammar-actions">
            <a className="btn btn-ghost" href="/spec/REFERENCE.bnf" download="">
              Download REFERENCE.bnf
            </a>
          </div>
          <Bnf copy>{`<reference>       ::= <valid semver>
                  | <context> "@" <valid semver>

<range reference> ::= <range set>
                  | <context> "@" <range set>

<context>         ::= <name>
                  | <source> ":" <name>

<source>          ::= <lowercase letter> ( <lowercase letter> | <digit> | "-" ) *

<name>            ::= <name path>
                  | "@" <name path>                ; scoped, e.g. @scope/pkg

<name path>       ::= <name segment> ( "/" <name segment> ) *

<name segment>    ::= <name character> +

<name character>  ::= <letter> | <digit> | "-" | "." | "_"`}</Bnf>
          <p className="caption left">
            Context is identity, not precedence: it never changes how versions order. It scopes a range to a{" "}
            <a href="/spec/#contextual-sets">Contextual Set</a>, so <code>npm:react@^1.2.3</code> admits only versions
            of <code>npm:react</code>.
          </p>
          <h2 id="ranges">Ranges</h2>
          <p>
            A range-set is one or more comparator sets joined by <code>||</code>. Hyphen, x-range, tilde, caret and
            approximate forms desugar to primitive comparators.
          </p>
          <p>
            This grammar descends from the range grammar Isaac Z. Schlueter published with{" "}
            <a href="https://github.com/npm/node-semver#range-grammar" target="_blank" rel="noopener">
              node-semver
            </a>{" "}
            for npm, and which he proposed adding to Semantic Versioning in{" "}
            <a href="https://github.com/semver/semver/pull/584" target="_blank" rel="noopener">
              semver/semver#584
            </a>
            . Semantic Versions makes it normative and extends it with the approximate operator <code>~&gt;</code>,
            pre-release wildcards (<code>X.Y.Z-*</code>, <code>*-*</code>), build channels and contexts.
          </p>
          <div className="grammar-actions">
            <a className="btn btn-ghost" href="/spec/RANGE.bnf" download="">
              Download RANGE.bnf
            </a>
          </div>
          <Bnf copy>{`<range set>    ::= <range> ( <logical or> <range> ) *

<logical or>   ::= ( " " ) * "||" ( " " ) *

<range>        ::= <hyphen>
                 | <simple> ( " " <simple> ) *
                 | ""

<hyphen>       ::= <partial> " - " <partial>

<simple>       ::= <primitive>
                 | <partial>
                 | <tilde>
                 | <approximate>
                 | <caret>

<primitive>    ::= <operator> <partial>

<operator>     ::= "<" | ">" | ">=" | "<=" | "="

<tilde>        ::= "~" <partial>

<approximate>  ::= "~>" <partial>

<caret>        ::= "^" <partial>

<partial>      ::= <xr> [ "." <xr> [ "." <xr> <qualifier> ? ] ]

<xr>           ::= "x" | "X" | "*" | <numeric identifier>

<qualifier>    ::= ( "-" <pre-release> ) ? ( "+" <build> ) ?`}</Bnf>
          <h2 id="comparators">Comparators</h2>
          <p>
            A comparator is an operator and a version; a comparator set is the intersection of whitespace-joined
            comparators.
          </p>
          <div className="grammar-actions">
            <a className="btn btn-ghost" href="/spec/COMPARATOR.bnf" download="">
              Download COMPARATOR.bnf
            </a>
          </div>
          <Bnf copy>{`<comparator set> ::= <comparator> ( <whitespace> <comparator> ) *

<comparator>     ::= <operator> <partial>
                   | <partial>

<operator>       ::= "<" | ">" | ">=" | "<=" | "="

<whitespace>     ::= ( " " ) +

<partial>        ::= <xr> [ "." <xr> [ "." <xr> <qualifier> ? ] ]

<xr>             ::= "x" | "X" | "*" | <numeric identifier>

<qualifier>      ::= ( "-" <pre-release> ) ? ( "+" <build> ) ?`}</Bnf>
          <h2 id="implementation">Reference parser</h2>
          <p>
            The <code>semantic-versions</code> package implements this grammar. It exposes <code>Version</code>,{" "}
            <code>Range</code>, <code>satisfies</code>, <code>compare</code>, <code>valid</code>,{" "}
            <code>validRange</code> and the usual comparison helpers, and is the engine behind the{" "}
            <a href="/selector/">range selector</a>.
          </p>
          <div className="code-window" data-copy="">
            <div className="code-bar">
              <span className="code-title">semantic-versions</span>{" "}
              <button className="copy-btn" type="button" aria-label="Copy">
                Copy
              </button>
            </div>
            <pre className="code">
              <code>
                <span className="t-cmt">import</span>
                {" { "}
                <span className="t-key">Range</span>
                {", "}
                <span className="t-key">satisfies</span>
                {", "}
                <span className="t-key">validRange</span>
                {" } "}
                <span className="t-cmt">from</span> <span className="t-str">"semantic-versions"</span>
                {"\n"}
                {"\n"}
                validRange(<span className="t-str">{'"~>1.2"'}</span>
                {")            "}
                <span className="t-cmt">{'// ">=1.2.0 <1.3.0-0"'}</span>
                {"\n"}
                satisfies(<span className="t-str">"1.4.0"</span>
                {", "}
                <span className="t-str">"^1.2.3"</span>
                {")  "}
                <span className="t-cmt">// true</span>
                {"\n"}
                <span className="t-cmt">new</span>
                {" Range("}
                <span className="t-str">{'"1.2.7 || >=1.2.9 <2.0.0"'}</span>).test(
                <span className="t-str">"1.4.6"</span>
                {")  "}
                <span className="t-cmt">// true</span>
              </code>
            </pre>
          </div>
        </article>
      </div>
    </main>
  );
}
