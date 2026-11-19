#!/usr/bin/env node
/**
 * Generates the machine-readable artifacts served from the site root:
 *
 *   /llms.txt        curated index, llms.txt v2 (https://llmstxt.org/)
 *   /llms-full.txt   core spec + extension overviews, concatenated
 *   /sitemap.xml     the HTML pages
 *   /robots.txt      crawl policy
 *   /spec/SPEC.md    the canonical Markdown corpus, mirrored
 *   /extensions/**.md
 *   /parser.md
 *
 * Runs before `vite dev` and `vite build`. Everything written here is
 * gitignored and regenerated: edit the canonical Markdown in the repo, never
 * the copies under site/public/.
 */

import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "../..");
const OUT = path.resolve(REPO, "site/public");

const SITE = "https://semver.xyz";
const BLOB = "https://github.com/vltpkg/semantic-versions/blob/main";

/**
 * The canonical Markdown corpus. `src` is repo-relative; `url` is where it is
 * published. `full` marks the documents concatenated into llms-full.txt —
 * dependency-locks-spec.md is deliberately excluded because it is ~20k words,
 * two thirds of the whole corpus, and would crowd out everything else in an
 * agent's context. It stays one fetch away instead.
 */
const DOCS = [
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

const GRAMMARS = [
  ["VERSION.bnf", "Grammar for a single version."],
  ["RANGE.bnf", "Grammar for ranges."],
  ["COMPARATOR.bnf", "Grammar for comparators."],
  ["REFERENCE.bnf", "Grammar for source-qualified references."],
  ["VARIANTS.bnf", "Grammar for Build Variants coordinates."],
  ["INTEGRITY.bnf", "Grammar for Package Integrity digests."],
];

const PAGES = [
  ["/", "Semantic Versions"],
  ["/spec/", "Specification"],
  ["/proposal/", "Proposal: Semantic Versioning 3.0.0"],
  ["/grammar/", "BNF grammars"],
  ["/selector/", "Range selector (interactive)"],
  ["/origin/", "History: how build metadata lost its meaning"],
  ["/faq/", "FAQ"],
  ["/libraries/", "Libraries: implementations for JavaScript, Rust, Python, Go, Ruby, Java, .NET and PHP, with benchmarks"],
  ["/extensions/", "Extensions index"],
  ["/extensions/variants/", "Build Variants"],
  ["/extensions/integrity/", "Package Integrity"],
  ["/extensions/dependency-locks/", "Dependency Locks"],
  ["/license/", "License"],
];

const bySrc = new Map(DOCS.map((d) => [d.src, d]));

/**
 * Rewrites a repo-relative Markdown link so it still resolves once the file is
 * served from the site root. Three destinations are possible: another document
 * in the corpus, a static asset already under site/public/, or a source file
 * that is never published and has to point back at GitHub.
 */
const rewriteTarget = (target, fromSrc) => {
  if (/^(https?:|mailto:|#)/.test(target)) return null;
  const [rawPath, frag = ""] = target.split(/(#.*)$/);
  if (!rawPath) return null;
  const resolved = path.posix
    .normalize(path.posix.join(path.posix.dirname(fromSrc), rawPath))
    .replace(/^\.\//, "");
  const doc = bySrc.get(resolved);
  if (doc) return `${SITE}${doc.url}${frag}`;
  if (resolved.startsWith("site/public/"))
    return `${SITE}/${resolved.slice("site/public/".length)}${frag}`;
  return `${BLOB}/${resolved}${frag}`;
};

const rewriteLinks = (md, fromSrc) =>
  md.replace(/\]\(([^)\s]+)\)/g, (whole, target) => {
    const next = rewriteTarget(target, fromSrc);
    return next ? `](${next})` : whole;
  });

const read = (src) => readFileSync(path.join(REPO, src), "utf8");

const write = (rel, body) => {
  const dest = path.join(OUT, rel);
  mkdirSync(path.dirname(dest), { recursive: true });
  writeFileSync(dest, body);
  return body.length;
};

const lastModified = (src) => {
  try {
    const out = execFileSync("git", ["log", "-1", "--format=%cs", "--", src], {
      cwd: REPO,
      encoding: "utf8",
    }).trim();
    if (out) return out;
  } catch {
    /* not a git checkout, or the file is untracked */
  }
  return new Date().toISOString().slice(0, 10);
};

// ── the Markdown corpus ────────────────────────────────────────────────────
const rendered = new Map();
for (const doc of DOCS) {
  const body = rewriteLinks(read(doc.src), doc.src);
  rendered.set(doc.src, body);
  write(doc.url, body);
}

// ── llms.txt ───────────────────────────────────────────────────────────────
const sections = ["Specification", "Extensions", "Libraries", "Optional"];
const lines = [
  "# Semantic Versions",
  "",
  "> A living versioning specification, and a proposal for Semantic Versioning 3.0.0. It restores build metadata to version precedence, defines grammars for ranges, comparators and sets, and layers three extensions that encode build variants, artifact integrity and whole resolved dependency graphs inside a version string.",
  "",
  "A version here is source-qualified and its build metadata is meaningful, not inert: `npm:sharp@0.33.0+linux.x64.musl.sha512.a91c…` names a registry, a package, a SemVer core, a target platform and the exact bytes.",
  "",
  "The Markdown linked below is normative. https://semver.xyz/spec/ is rendered directly from the core specification, so the two never differ. The extension pages are separately authored presentations of their Markdown; where an extension page and its Markdown disagree, the Markdown governs.",
  "",
];
for (const section of sections) {
  const docs = DOCS.filter((d) => d.section === section);
  const extras = [];
  if (section === "Specification")
    extras.push(
      ...GRAMMARS.map(([f, note]) => `- [${f}](${SITE}/spec/${f}): ${note}`),
    );
  if (section === "Libraries")
    extras.push(
      `- [All libraries](${SITE}/libraries/): Implementations for JavaScript, Rust, Python, Go, Ruby, Java, .NET and PHP that pass the same conformance suite, with install commands and benchmarks against each language's existing libraries.`,
    );
  if (section === "Optional")
    extras.push(
      `- [llms-full.txt](${SITE}/llms-full.txt): The core specification and all three extension overviews concatenated into one file, for a single-fetch read.`,
      `- [Source repository](https://github.com/vltpkg/semantic-versions): Specification sources, the reference parser, and the site.`,
    );
  if (!docs.length && !extras.length) continue;
  lines.push(`## ${section}`, "");
  for (const d of docs) lines.push(`- [${d.title}](${SITE}${d.url}): ${d.note}`);
  lines.push(...extras, "");
}
write("llms.txt", lines.join("\n"));

// ── llms-full.txt ──────────────────────────────────────────────────────────
const full = DOCS.filter((d) => d.full);
const fullBody = [
  "# Semantic Versions — full text",
  "",
  "> The core specification and the three extension overviews, concatenated. Generated from the canonical Markdown; see https://semver.xyz/llms.txt for the index.",
  "",
  `> Not included: the full Dependency Locks specification (~20k words, binary format and validation rules), at ${SITE}/extensions/dependency-locks/dependency-locks-spec.md`,
  "",
  ...full.flatMap((d) => [
    "",
    "---",
    "",
    `<!-- source: ${d.src} · published: ${SITE}${d.url} -->`,
    "",
    rendered.get(d.src).trim(),
    "",
  ]),
].join("\n");
write("llms-full.txt", fullBody);

// ── sitemap.xml ────────────────────────────────────────────────────────────
const pageSrc = (url) =>
  `site${url === "/" ? "/index.html" : `${url}index.html`}`;
write(
  "sitemap.xml",
  [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...PAGES.map(([url]) =>
      [
        "  <url>",
        `    <loc>${SITE}${url}</loc>`,
        `    <lastmod>${lastModified(pageSrc(url))}</lastmod>`,
        "  </url>",
      ].join("\n"),
    ),
    "</urlset>",
    "",
  ].join("\n"),
);

// ── robots.txt ─────────────────────────────────────────────────────────────
write(
  "robots.txt",
  [
    "# semver.xyz is an open specification. Crawling, indexing and training are all",
    "# welcome — the point of the document is to be read.",
    "User-agent: *",
    "Allow: /",
    "",
    `Sitemap: ${SITE}/sitemap.xml`,
    "",
    "# Markdown versions of the specification, for agents:",
    `#   ${SITE}/llms.txt`,
    `#   ${SITE}/llms-full.txt`,
    "",
  ].join("\n"),
);

const report = [
  ...DOCS.map((d) => d.url),
  "llms.txt",
  "llms-full.txt",
  "sitemap.xml",
  "robots.txt",
];
console.log(`ai-artifacts: wrote ${report.length} files to site/public/`);
