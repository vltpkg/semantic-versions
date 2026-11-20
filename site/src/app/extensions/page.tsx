import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "Extensions: building on Semantic Versions · semver.xyz",
  alternates: { canonical: "/extensions/" },
  description:
    "Extensions to Semantic Versions: Build Variants, Package Integrity and Dependency Locks. Practical formats built on source-qualified versions and restored build precedence.",
};

export const viewport: Viewport = {
  colorScheme: "light",
  themeColor: "#ffffff",
};

export default function Page() {
  return (
    <main>
      <section className="page-hero reveal">
        <p className="eyebrow">Extensions</p>
        <h1>
          Built on <span className="grad">source-qualified versions.</span>
        </h1>
        <p className="lead">
          Extensions use the version string itself (a source, a version, and now-meaningful build metadata) to carry
          more than a number. Each one is optional, composable, and grounded in the <a href="/spec/">core spec</a>.
        </p>
        <p className="lead">
          They are listed in the order they build on each other. <strong>Build Variants</strong> names <em>which</em>{" "}
          artifact; <strong>Package Integrity</strong> pins <em>which bytes</em>; <strong>Dependency Locks</strong> pin
          a whole resolved graph whose every node is one of those identities. Read them in order and each one is a term
          in the next.
        </p>
      </section>
      <section className="wrap">
        <div className="ext-grid">
          <a className="ext-card reveal" href="/extensions/variants/">
            <div className="ext-card-top">
              <span className="ext-badge">Extension 1</span>{" "}
              <span className="ext-arrow" aria-hidden="true">
                →
              </span>
            </div>
            <h3>Build Variants</h3>
            <p>
              Encode os, arch, abi and feature targets as build metadata, so one release addresses a whole family of
              artifacts, and a range can select a coherent platform subset.
            </p>{" "}
            <code className="ext-spec">
              <span className="t-src">napi:</span>sharp<span className="op">@</span>0.33.0
              <span className="add">+linux.x64.musl</span>
            </code>
          </a>{" "}
          <a className="ext-card reveal" href="/extensions/integrity/">
            <div className="ext-card-top">
              <span className="ext-badge">Extension 2</span>{" "}
              <span className="ext-arrow" aria-hidden="true">
                →
              </span>
            </div>
            <h3>Package Integrity</h3>
            <p>
              Carry a verifiable content digest inside the version itself, so software can be pinned and checked against
              its exact bytes, with no side file.
            </p>{" "}
            <code className="ext-spec">
              <span className="t-src">npm:</span>react<span className="op">@</span>18.2.0
              <span className="add">+sha512.</span>…
            </code>
          </a>{" "}
          <a className="ext-card reveal" href="/extensions/dependency-locks/">
            <div className="ext-card-top">
              <span className="ext-badge">Extension 3</span>{" "}
              <span className="ext-arrow" aria-hidden="true">
                →
              </span>
            </div>
            <h3>Dependency Locks</h3>
            <p>
              Pin a resolved transitive subgraph ahead of time: a portable, shareable resolution seed that any aware
              tool can honour, override, or reject before generating its own lockfile. Its nodes are variant- and
              integrity-qualified identities.
            </p>{" "}
            <code className="ext-spec">
              <span className="t-src">npm:</span>express<span className="op">@</span>5.2.1
              <span className="add">+lock.</span>…
            </code>
          </a>
        </div>
      </section>
    </main>
  );
}
