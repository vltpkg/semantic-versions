import type { Metadata, Viewport } from "next";
import { CasesCount, LanguagesCount, LibrariesOverview, LibraryCards, LibrarySections } from "@/components/benchmarks";

export const metadata: Metadata = {
  title: "Libraries — implementations and benchmarks · semver.xyz",
  alternates: { canonical: "/libraries/" },
  description:
    "Semantic Versions for JavaScript, Rust, Python, Go, Ruby, Java, .NET and PHP: every implementation passes the shared conformance suite and is benchmarked against the libraries it replaces.",
  openGraph: {
    title: "Libraries — Semantic Versions",
    description:
      "semantic-versions in eight languages: conformant to the spec, extensions included, and faster than the libraries they replace.",
    type: "website",
  },
};

export const viewport: Viewport = {
  colorScheme: "light",
  themeColor: "#ffffff",
};

export default function Page() {
  return (
    <main>
      <section className="page-hero reveal">
        <p className="eyebrow">Libraries</p>
        <h1>
          Implementations, <span className="grad">measured.</span>
        </h1>
        <p className="lead">
          The JavaScript reference implementation and its ports to Rust, Python, Go, Ruby, Java, .NET and PHP. All{" "}
          <LanguagesCount /> pass the same{" "}
          <a href="https://github.com/vltpkg/semantic-versions/tree/main/conformance" target="_blank" rel="noopener">
            <CasesCount />
            -case conformance suite
          </a>
          , give identical answers on every version and range in the benchmark corpus, and are timed against the
          libraries they replace on real versions and ranges from the npm registry.
        </p>
      </section>
      <section className="wrap">
        <div className="section-head left reveal">
          <p className="eyebrow">At a glance</p>
        </div>
        <div className="reveal">
          <LibrariesOverview />
        </div>
        <p className="bench-meta reveal">
          Conformance counts the cases each library passes in the shared suite (libraries that do not expose a desugared
          range are scored on the 413 cases that do not need one); speed is the range of speed-ups over the compared
          library across the operations below. Each language is measured in its own runtime on the same machine, so
          compare numbers within a language, not across languages. Method and raw results:{" "}
          <a href="https://github.com/vltpkg/semantic-versions/tree/main/benchmarks" target="_blank" rel="noopener">
            <code>benchmarks/</code>
          </a>
          .
        </p>
      </section>
      <section className="wrap" id="install">
        <div className="section-head left reveal">
          <p className="eyebrow">Install</p>
        </div>
        <div className="tool-grid">
          <LibraryCards />
        </div>
      </section>
      <LibrarySections />
      <section className="wrap">
        <div className="doc-status reveal">
          <p className="eyebrow">Other languages</p>
          <p>
            Missing yours? Everything needed to build one is published: the <a href="/spec/">specification</a>, the{" "}
            <a href="/grammar/">BNF grammars</a>, and the{" "}
            <a href="https://github.com/vltpkg/semantic-versions/tree/main/conformance" target="_blank" rel="noopener">
              conformance suite
            </a>{" "}
            as plain JSON. An implementation that passes every case behaves like the ones above.{" "}
            <a href="https://github.com/vltpkg/semantic-versions/issues" target="_blank" rel="noopener">
              Open an issue
            </a>{" "}
            and it can be listed here.
          </p>
        </div>
      </section>
    </main>
  );
}
