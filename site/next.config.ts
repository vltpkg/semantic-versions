import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { md } from "@affordances/md/next";
import { withAffordances } from "@affordances/next/config";
import type { NextConfig } from "next";

/**
 * The repository root, one level up. The site bundles the specification
 * (spec/SPEC.md), the extension Markdown, the grammars and the benchmark
 * results from there, and vlt installs into a content-addressed store at the
 * workspace root that `next` itself resolves through, so Turbopack's
 * filesystem root has to be the repository, not this directory.
 */
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const nextConfig: NextConfig = {
  // Every page is a directory URL (/spec/, /faq/), as the static site was, and
  // each page's metadata names that form as canonical. The redirect that would
  // normally enforce it is off because @affordances/md fetches a page at its
  // bare path (/faq) to convert it, and a redirect there would loop its
  // Markdown twin (/faq.md); both forms answer directly instead.
  trailingSlash: true,
  skipTrailingSlashRedirect: true,
  turbopack: {
    root: repoRoot,
    // The canonical Markdown and the BNF grammars are imported as strings
    // (src/lib/sources.ts), so they ship inside the bundle and the graph can
    // answer from them at request time.
    rules: {
      "*.md": { loaders: ["raw-loader"], as: "*.js" },
      "*.bnf": { loaders: ["raw-loader"], as: "*.js" },
    },
  },
  outputFileTracingRoot: repoRoot,
  // The grammars are plain text to read in the browser, not downloads.
  headers: async () => [
    { source: "/spec/:file(.*\\.bnf)", headers: [{ key: "content-type", value: "text/plain; charset=utf-8" }] },
  ],
  // The Tools page was renamed Libraries; keep old links working.
  redirects: async () => [
    { source: "/tools", destination: "/libraries/", permanent: true },
    { source: "/tools/:path*", destination: "/libraries/:path*", permanent: true },
  ],
};

/*
 * Affordances (https://www.affordances.sh): every page answers agents with a
 * graph of what it shows and what can be done there (its state.ts and
 * actions.ts), at its own URL with `Accept: application/vnd.affordances+json`,
 * and the md plugin serves every page as Markdown (`/faq.md`, `/faq/index.md`,
 * or `Accept: text/markdown`), converted from the page's own rendered HTML.
 * The normative Markdown (spec/SPEC.md and the extensions') is served as itself
 * beside the pages, and llms.txt points there first.
 */
export default withAffordances(nextConfig, { name: "Semantic Versions", plugins: [md()] });
