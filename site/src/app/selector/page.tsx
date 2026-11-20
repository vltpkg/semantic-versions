import type { Metadata, Viewport } from "next";
import { Selector } from "@/components/selector";

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
          Type a range and see which versions it selects, resolved in your browser by the reference{" "}
          <code>semantic-versions</code> parser.
        </p>
      </section>
      <Selector />
    </main>
  );
}
