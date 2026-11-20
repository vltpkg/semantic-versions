/**
 * The machine-readable artifacts served from the site root:
 *
 *   /llms.txt        curated index, llms.txt (https://llmstxt.org/)
 *   /llms-full.txt   core spec + extension overviews, concatenated
 *   /sitemap.xml     the HTML pages
 *   /robots.txt      crawl policy
 *   /spec/SPEC.md    the canonical Markdown corpus, mirrored
 *   /extensions/**.md
 *   /parser.md
 *
 * Everything here is built from the canonical Markdown in the repository
 * (bundled by src/lib/sources.ts); the route handlers under src/app serve
 * the results.
 */

import { execFileSync } from "node:child_process";
import path from "node:path";
import { REPO, SITE } from "@/lib/site";
import { readRepoFile } from "@/lib/sources";

const BLOB = `${REPO}/blob/main`;

export type Doc = {
  /** Repository-relative source. */
  src: string;
  /** Where it is published on the site. */
  url: string;
  section: "Specification" | "Extensions" | "Libraries" | "Optional";
  title: string;
  note: string;
  /** Concatenated into llms-full.txt. */
  full: boolean;
};

/**
 * The canonical Markdown corpus. `full` marks the documents concatenated into
 * llms-full.txt — dependency-locks-spec.md is deliberately excluded because
 * it is ~20k words, two thirds of the whole corpus, and would crowd out
 * everything else in an agent's context. It stays one fetch away instead.
 */
export const DOCS: Doc[] = [
  {
    src: "spec/SPEC.md",
    url: "/spec/SPEC.md",
    section: "Specification",
    title: "Semantic Versions 1.0.0",
    note: "The core specification: versions, precedence, sets, ranges, comparators, operators and channels. Normative; https://semver.xyz/spec/ is rendered from this file.",
    full: true,
  },
  {
    src: "extensions/variants/variants.md",
    url: "/extensions/variants/variants.md",
    section: "Extensions",
    title: "Build Variants",
    note: "Encodes os/arch/abi/feature coordinates as build metadata, e.g. `1.0.0+linux.x64.musl`, so one version can address a target matrix.",
    full: true,
  },
  {
    src: "extensions/integrity/integrity.md",
    url: "/extensions/integrity/integrity.md",
    section: "Extensions",
    title: "Package Integrity",
    note: "Carries a content-addressable digest inside the version, e.g. `1.0.0+sha512.<hex>`, pinning exact bytes.",
    full: true,
  },
  {
    src: "extensions/dependency-locks/dependency-locks.md",
    url: "/extensions/dependency-locks/dependency-locks.md",
    section: "Extensions",
    title: "Dependency Locks",
    note: "Attaches a resolved transitive subgraph to a version as `+lock.<payload>`. Start here; the full spec is under Optional.",
    full: true,
  },
  {
    src: "libraries/javascript/README.md",
    url: "/parser.md",
    section: "Libraries",
    title: "semantic-versions (npm)",
    note: "The reference parser: parse, validate, compare and range-match, with build metadata participating in precedence.",
    full: false,
  },
  {
    src: "extensions/dependency-locks/dependency-locks-spec.md",
    url: "/extensions/dependency-locks/dependency-locks-spec.md",
    section: "Optional",
    title: "Dependency Locks — full specification",
    note: "~20k words. Binary format, canonical encoding, validation, threat model, and a measured fidelity audit against real npm/pnpm/yarn/vlt/uv lockfiles. Fetch only when you need the wire format.",
    full: false,
  },
];

export const GRAMMARS: [file: string, note: string][] = [
  ["VERSION.bnf", "Grammar for a single version."],
  ["RANGE.bnf", "Grammar for ranges."],
  ["COMPARATOR.bnf", "Grammar for comparators."],
  ["REFERENCE.bnf", "Grammar for source-qualified references."],
  ["VARIANTS.bnf", "Grammar for Build Variants coordinates."],
  ["INTEGRITY.bnf", "Grammar for Package Integrity digests."],
];

/** The HTML pages, for the sitemap and the llms.txt page list. */
export const PAGES: [url: string, title: string][] = [
  ["/", "Semantic Versions"],
  ["/spec/", "Specification"],
  ["/proposal/", "Proposal: Semantic Versioning 3.0.0"],
  ["/grammar/", "BNF grammars"],
  ["/selector/", "Range selector (interactive)"],
  ["/origin/", "History: a short history of Semantic Versioning"],
  ["/faq/", "FAQ"],
  ["/libraries/", "Libraries: implementations for JavaScript, Rust, Python, Go, Ruby, Java, .NET and PHP, with benchmarks"],
  ["/extensions/", "Extensions index"],
  ["/extensions/variants/", "Build Variants"],
  ["/extensions/integrity/", "Package Integrity"],
  ["/extensions/dependency-locks/", "Dependency Locks"],
  ["/license/", "License"],
  ["/agents/", "For agents: llms.txt, Markdown twins, the Affordances graph and MCP"],
];

const bySrc = new Map(DOCS.map((d) => [d.src, d]));

/**
 * Rewrites a repo-relative Markdown link so it still resolves once the file
 * is served from the site root. Three destinations are possible: another
 * document in the corpus, a static asset of the site, or a source file that
 * is never published and has to point back at GitHub.
 */
const rewriteTarget = (target: string, fromSrc: string): string | null => {
  if (/^(https?:|mailto:|#)/.test(target)) return null;
  const [rawPath, frag = ""] = target.split(/(#.*)$/);
  if (!rawPath) return null;
  const resolved = path.posix.normalize(path.posix.join(path.posix.dirname(fromSrc), rawPath)).replace(/^\.\//, "");
  const doc = bySrc.get(resolved);
  if (doc) return `${SITE}${doc.url}${frag}`;
  if (resolved.startsWith("site/public/")) return `${SITE}/${resolved.slice("site/public/".length)}${frag}`;
  return `${BLOB}/${resolved}${frag}`;
};

const rewriteLinks = (md: string, fromSrc: string): string =>
  md.replace(/\]\(([^)\s]+)\)/g, (whole, target: string) => {
    const next = rewriteTarget(target, fromSrc);
    return next ? `](${next})` : whole;
  });

/** A corpus document, with its links rewritten for the site. */
export const renderDoc = (doc: Doc): string => rewriteLinks(readRepoFile(doc.src), doc.src);

export const docByUrl = (url: string): Doc | undefined => DOCS.find((d) => d.url === url);

// ── llms.txt ───────────────────────────────────────────────────────────────

export function llmsTxt(): string {
  const sections = ["Specification", "Extensions", "Libraries", "Optional"] as const;
  const lines = [
    "# Semantic Versions",
    "",
    "> A living versioning specification, and a proposal for Semantic Versioning 3.0.0. It restores build metadata to version precedence, defines grammars for ranges, comparators and sets, and layers three extensions that encode build variants, artifact integrity and whole resolved dependency graphs inside a version string.",
    "",
    "A version here is source-qualified and its build metadata is meaningful, not inert: `npm:sharp@0.33.0+linux.x64.musl.sha512.a91c…` names a registry, a package, a SemVer core, a target platform and the exact bytes.",
    "",
    "The Markdown linked below is normative. https://semver.xyz/spec/ is rendered directly from the core specification, so the two never differ. The extension pages are separately authored presentations of their Markdown; where an extension page and its Markdown disagree, the Markdown governs.",
    "",
    "Every page of the site is also available as Markdown: add `.md` to its path (https://semver.xyz/faq.md), or request the page with an `Accept: text/markdown` header. Every page also answers with an Affordances graph (https://www.affordances.sh) when requested with `Accept: application/vnd.affordances+json`: what it shows, actions to call, and where to go next. The range selector's actions (`select`, `desugar`, `parse`, `compare`, `bump`) run the reference parser, the spec's `readSection` returns one section as Markdown, and the grammars' `readGrammar` returns a BNF. The site index is at https://semver.xyz/.well-known/affordances.json. The site is also an MCP server at https://semver.xyz/mcp (streamable HTTP, no auth: `claude mcp add --transport http semver https://semver.xyz/mcp`), with the same two tools `npx @affordances/mcp https://semver.xyz` gives. See https://semver.xyz/agents/.",
    "",
  ];
  for (const section of sections) {
    const docs = DOCS.filter((d) => d.section === section);
    const extras: string[] = [];
    if (section === "Specification") extras.push(...GRAMMARS.map(([f, note]) => `- [${f}](${SITE}/spec/${f}): ${note}`));
    if (section === "Libraries")
      extras.push(
        `- [All libraries](${SITE}/libraries/): Implementations for JavaScript, Rust, Python, Go, Ruby, Java, .NET and PHP that pass the same conformance suite, with install commands and benchmarks against each language's existing libraries.`,
      );
    if (section === "Optional")
      extras.push(
        `- [llms-full.txt](${SITE}/llms-full.txt): The core specification and all three extension overviews concatenated into one file, for a single-fetch read.`,
        `- [Source repository](${REPO}): Specification sources, the reference parser, and the site.`,
      );
    if (!docs.length && !extras.length) continue;
    lines.push(`## ${section}`, "");
    for (const d of docs) lines.push(`- [${d.title}](${SITE}${d.url}): ${d.note}`);
    lines.push(...extras, "");
  }
  lines.push("## Pages", "", ...PAGES.map(([url, title]) => `- [${title}](${SITE}${url === "/" ? "/index.md" : `${url.slice(0, -1)}.md`})`), "");
  return lines.join("\n");
}

// ── llms-full.txt ──────────────────────────────────────────────────────────

export function llmsFullTxt(): string {
  const full = DOCS.filter((d) => d.full);
  return [
    "# Semantic Versions — full text",
    "",
    "> The core specification and the three extension overviews, concatenated. Generated from the canonical Markdown; see https://semver.xyz/llms.txt for the index.",
    "",
    `> Not included: the full Dependency Locks specification (~20k words, binary format and validation rules), at ${SITE}/extensions/dependency-locks/dependency-locks-spec.md`,
    "",
    ...full.flatMap((d) => ["", "---", "", `<!-- source: ${d.src} · published: ${SITE}${d.url} -->`, "", renderDoc(d).trim(), ""]),
  ].join("\n");
}

// ── sitemap.xml ────────────────────────────────────────────────────────────

/** The date a page's source last changed, from git where available (at build time, in the repository). */
export const lastModified = (url: string): string => {
  const src = `src/app${url === "/" ? "" : url.slice(0, -1)}/page.tsx`;
  try {
    const out = execFileSync("git", ["log", "-1", "--format=%cs", "--", src], { cwd: process.cwd(), encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
    if (out) return out;
  } catch {
    /* not a git checkout, a shallow one, or the file is untracked */
  }
  return new Date().toISOString().slice(0, 10);
};
