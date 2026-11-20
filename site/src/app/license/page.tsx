import { PageActions } from "@/components/page-actions";
import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "License · semver.xyz",
  alternates: { canonical: "/license/" },
  description:
    "Semantic Versions is an open specification. The specification text is licensed under Creative Commons Attribution 3.0 (CC BY 3.0); the reference parser is licensed under Apache 2.0.",
};

export const viewport: Viewport = {
  colorScheme: "light",
  themeColor: "#ffffff",
};

export default function Page() {
  return (
    <main>
      <section className="page-hero reveal">
        <p className="eyebrow">License</p>
        <h1>
          An open <span className="grad">specification.</span>
        </h1>
        <p className="lead">
          Semantic Versions is free to read, quote, translate and build on. The specification text is a Creative Commons
          work, the same license the original Semantic Versioning spec has always used. The reference parser is
          separately licensed as open source.
        </p>
        <PageActions path="/license/" />
      </section>
      <section className="wrap">
        <div className="license-grid">
          <article className="license-card reveal">
            <span className="cc-badge" aria-hidden="true">
              <span className="cc-glyph">CC</span> <span className="cc-glyph">BY</span>
            </span>{" "}
            <p className="license-scope">Specification text</p>
            <h2>Creative Commons Attribution 3.0</h2>
            <p>
              The prose of this specification, its examples and its diagrams are licensed under{" "}
              <a href="https://creativecommons.org/licenses/by/3.0/" target="_blank" rel="noopener">
                CC BY 3.0
              </a>
              . You may copy, adapt and redistribute the text in any medium, including for commercial use, as long as
              you give appropriate credit. This is the same license used by{" "}
              <a href="https://semver.org/" target="_blank" rel="noopener">
                semver.org
              </a>
              , and it is deliberate: a versioning spec is only useful if everyone is free to implement and cite it.
            </p>
            <p className="license-attr">Suggested attribution: “Semantic Versions 1.0.0 (semver.xyz), CC BY 3.0.”</p>
            <div className="license-actions">
              <a
                className="btn btn-ghost"
                href="https://creativecommons.org/licenses/by/3.0/legalcode"
                target="_blank"
                rel="noopener"
              >
                Read the legal code
              </a>
            </div>
          </article>
          <article className="license-card reveal">
            <span className="cc-badge apache" aria-hidden="true">
              <span className="cc-glyph">A2</span>
            </span>{" "}
            <p className="license-scope">Reference parser</p>
            <h2>Apache License 2.0</h2>
            <p>
              The <code>semantic-versions</code> package, the range selector engine and the code samples in this
              repository are licensed under{" "}
              <a href="https://www.apache.org/licenses/LICENSE-2.0" target="_blank" rel="noopener">
                Apache 2.0
              </a>
              . You can use it in open or closed source projects; the license includes an explicit patent grant and asks
              only that you preserve notices.
            </p>
            <p className="license-attr">Source and full license text live in the repository.</p>
            <div className="license-actions">
              <a
                className="btn btn-ghost"
                href="https://github.com/vltpkg/semantic-versions"
                target="_blank"
                rel="noopener"
              >
                View the repository
              </a>
            </div>
          </article>
        </div>
        <div className="doc-status reveal">
          <p className="eyebrow">Why two licenses</p>
          <p>
            A specification and its implementation serve different audiences. The text is documentation, so a Creative
            Commons license fits: quote it, translate it, teach from it. The parser is software, so a standard
            open-source software license fits instead. Splitting them keeps both easy to adopt without one constraining
            the other.
          </p>
        </div>
      </section>
    </main>
  );
}
