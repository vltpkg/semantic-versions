import type { Metadata, Viewport } from "next";
import { SpecBody, SpecToc } from "@/components/spec";

export const metadata: Metadata = {
  title: "Specification — Semantic Versions 1.0.0 · semver.xyz",
  alternates: { canonical: "/spec/" },
  description: "The Semantic Versions specification: versions, sets, ranges, comparators, operators and precedence.",
};

export const viewport: Viewport = {
  colorScheme: "light",
  themeColor: "#ffffff",
};

export default function Page() {
  return (
    <main>
      <section className="page-hero reveal">
        <p className="eyebrow">Specification</p>
        <h1>
          Semantic Versions <span className="grad">1.0.0</span>
        </h1>
        <p className="spec-source">
          Rendered from{" "}
          <a href="https://github.com/vltpkg/semantic-versions/blob/main/spec/SPEC.md" target="_blank" rel="noopener">
            <code>spec/SPEC.md</code>
          </a>{" "}
          · <a href="/spec/SPEC.md">Markdown</a> ·{" "}
          <a href="https://github.com/vltpkg/semantic-versions/edit/main/spec/SPEC.md" target="_blank" rel="noopener">
            Suggest an edit
          </a>
        </p>
      </section>
      <div className="doc-layout">
        <aside className="toc reveal" aria-label="Table of contents">
          <div className="toc-title">Contents</div>
          <SpecToc />
        </aside>
        <article className="doc reveal">
          <SpecBody />
        </article>
      </div>
    </main>
  );
}
