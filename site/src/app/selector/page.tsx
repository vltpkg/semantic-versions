import type { Metadata, Viewport } from "next";
import { SelectorScript } from "@/components/interactive";

export const metadata: Metadata = {
  title: "Try it: test what matches what · semver.xyz",
  alternates: { canonical: "/selector/" },
  description:
    "A client-side range selector: type a range and a set of versions and see exactly what the Semantic Versions grammar matches, powered by the reference parser.",
};

export const viewport: Viewport = {
  colorScheme: "light",
  themeColor: "#ffffff",
};

export default function Page() {
  return (
    <main>
      <section className="page-hero reveal">
        <p className="eyebrow">Try it</p>
        <h1>Test what matches what.</h1>
        <p className="lead">
          Type a range and a list of versions. This resolves the range against the <strong>Semantic Versions</strong>{" "}
          grammar and shows exactly which versions satisfy it, entirely in your browser, powered by the reference{" "}
          <code>semantic-versions</code> parser. Start from a <em>sample set</em> to explore pre-release trains, build
          variants and contexts, or pull real versions from npm or any npm-compatible registry origin.
        </p>
      </section>
      <section className="selector">
        <div className="field reveal">
          <label htmlFor="range">Range</label>{" "}
          <input
            id="range"
            type="text"
            spellCheck="false"
            autoComplete="off"
            placeholder="^1.2.3   ·   ~>1.2   ·   1.2.7 || >=1.2.9 <2.0.0"
            defaultValue="^1.2.3"
          />{" "}
          <span className="hint">
            Comparators, hyphen ranges, x-ranges, tilde, caret, approximate (<code>~&gt;</code>), build channels (
            <code>+win</code>) and pre-release channels (<code>-rc</code>, <code>-*</code>, <code>*-*</code>). Prefix a{" "}
            <a href="/spec/#context">context</a> (<code>npm:react@^1.0.0</code>) to scope the match to one identity.
          </span>
        </div>
        <div className="chips reveal" id="examples" aria-label="Example ranges" />
        <div className="sel-toolbar sel-fetch reveal">
          <div className="sel-origin">
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
              aria-label="Package name"
              placeholder="package (e.g. debug or @scope/name)"
            />
          </div>
          <div className="sel-actions">
            <button className="btn btn-primary" id="load-npm" type="button">
              Fetch versions
            </button>{" "}
            <button className="btn btn-ghost" id="reset" type="button">
              Reset
            </button>
          </div>
        </div>
        <p className="hint fetch-note reveal">
          Fetches the package document directly from any npm-compatible registry origin (npm, Verdaccio, GitHub
          Packages, a private mirror, and so on), entirely client-side. Note that public registries don't publish{" "}
          <strong>build metadata</strong> and rarely carry long pre-release trains, so the <em>Build variants</em> and{" "}
          <em>Release train</em> sample sets above are the best way to explore those parts of the grammar.
        </p>
        <p className="range-echo reveal" id="echo" />
        <div className="sel-grid">
          <div className="reveal">
            <div className="field">
              <label htmlFor="versions">Candidate versions</label>{" "}
              <div className="chips" id="samples" aria-label="Sample version sets" />
              <p className="sample-note" id="sample-note" />
              <textarea id="versions" spellCheck="false" />{" "}
              <span className="hint">One per line (whitespace- or comma-separated also works).</span>
            </div>
          </div>
          <div className="reveal">
            <div className="field">
              <label>Desugared comparators</label> <div className="desugar" id="desugar" />
            </div>
            <div className="sel-summary-row">
              <div className="sel-summary" id="summary" />{" "}
              <label className="toggle">
                <input type="checkbox" id="matches-only" /> Matches only
              </label>
            </div>
            <div className="vlist" id="results" aria-live="polite" />
            <div className="vlist-more" id="results-more" />
          </div>
        </div>
      </section>
      <SelectorScript />
    </main>
  );
}
