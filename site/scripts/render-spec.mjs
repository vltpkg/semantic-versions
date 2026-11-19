/**
 * Renders the canonical specification, spec/SPEC.md, into the /spec/ page.
 *
 * spec/SPEC.md is the single source of truth: it reads correctly on GitHub and
 * is rendered here at build (and dev) time by the `spec-markdown` Vite plugin
 * in vite.config.js. Edit the Markdown, never the generated HTML.
 *
 * - Heading ids follow GitHub's slug rules, so `#precedence` and friends
 *   resolve the same on github.com and on semver.xyz.
 * - The `# Title` line is dropped (the page hero carries it).
 * - Absolute https://semver.xyz/… links become root-relative.
 * - Tables get the site's table styling; the table of contents lists the
 *   `##` sections.
 */

import { readFileSync } from "node:fs";
import MarkdownIt from "markdown-it";

const SITE = "https://semver.xyz";

/** GitHub-compatible heading slug (github-slugger semantics, without the emoji table). */
function slug(text) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{M}\p{N}\p{Pc} -]/gu, "")
    .replace(/ /g, "-");
}

const escapeHtml = (s) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function renderSpec(markdown) {
  const md = new MarkdownIt({ html: false, linkify: false, typographer: false });
  const seen = new Map();
  const toc = [];

  // Assign ids to every heading and collect the `##` sections for the TOC.
  md.core.ruler.push("heading_ids", (state) => {
    const tokens = state.tokens;
    for (let i = 0; i < tokens.length; i++) {
      const open = tokens[i];
      if (open.type !== "heading_open") continue;
      const inline = tokens[i + 1];
      const text = inline.children
        .filter((t) => t.type === "text" || t.type === "code_inline")
        .map((t) => t.content)
        .join("");
      const base = slug(text);
      const n = seen.get(base) ?? 0;
      seen.set(base, n + 1);
      const id = n ? `${base}-${n}` : base;
      open.attrSet("id", id);
      if (open.tag === "h2") {
        // TOC labels drop trailing code (e.g. the `^1.0.0-rc` in a heading).
        const label = inline.children
          .filter((t) => t.type === "text")
          .map((t) => t.content)
          .join("")
          .trim();
        toc.push({ id, label: label || text });
      }
    }
  });

  // Root-relative links to our own site; external links open in a new tab.
  const linkOpen =
    md.renderer.rules.link_open ?? ((t, i, o, e, self) => self.renderToken(t, i, o));
  md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
    const token = tokens[idx];
    const href = token.attrGet("href") ?? "";
    if (href.startsWith(SITE)) {
      token.attrSet("href", href.slice(SITE.length) || "/");
    } else if (/^https?:\/\//.test(href)) {
      token.attrSet("target", "_blank");
      token.attrSet("rel", "noopener");
    }
    return linkOpen(tokens, idx, options, env, self);
  };

  md.renderer.rules.table_open = () => '<div class="doc-table-wrap">\n<table class="doc-table">\n';
  md.renderer.rules.table_close = () => "</table>\n</div>\n";

  // The page hero owns the title, so drop the leading `# …` line.
  const body = markdown.replace(/^#\s+[^\n]*\n+/, "");
  const html = md.render(body);

  const tocHtml = toc
    .map(({ id, label }) => `<a href="#${id}">${escapeHtml(label)}</a>`)
    .join("\n          ");

  return { html, toc: tocHtml };
}

export function renderSpecFile(path) {
  return renderSpec(readFileSync(path, "utf8"));
}
