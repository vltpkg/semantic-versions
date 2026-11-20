import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { withMd } from "@affordances/md/next";
import type { NextConfig } from "next";

/**
 * The repository root, one level up. The site reads the specification
 * (spec/SPEC.md), the extension Markdown and the benchmark results from there
 * at build time, and vlt installs into a content-addressed store at the
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
  turbopack: { root: repoRoot },
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
 * Every page's Markdown twin (`/faq.md`, `/faq/index.md`, or the page's URL
 * with `Accept: text/markdown`) is @affordances/md's: its rewrites send each
 * to app/api/affordances/md, which converts the page's own rendered HTML. The
 * normative Markdown (spec/SPEC.md and the extensions') is served as itself
 * beside the pages, and llms.txt points there first.
 */
export default withMd(nextConfig);
