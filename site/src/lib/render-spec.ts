/**
 * Renders the canonical specification, spec/SPEC.md, into the /spec/ page.
 *
 * spec/SPEC.md is the single source of truth: it reads correctly on GitHub
 * and is rendered here at build time. Edit the Markdown, never the page.
 *
 * - Heading ids follow GitHub's slug rules, so `#precedence` and friends
 *   resolve the same on github.com and on semver.xyz.
 * - The `# Title` line is dropped (the page hero carries it).
 * - Absolute https://semver.xyz/… links become root-relative.
 * - Tables get the site's table styling; the table of contents lists the
 *   `##` sections.
 */

import MarkdownIt from "markdown-it";
import { readRepoFile } from "@/lib/sources";
import { SITE } from "@/lib/site";

/** GitHub-compatible heading slug (github-slugger semantics, without the emoji table). */
function slug(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{M}\p{N}\p{Pc} -]/gu, "")
    .replace(/ /g, "-");
}

export type TocEntry = { id: string; label: string };

export function renderSpec(markdown: string): { html: string; toc: TocEntry[] } {
  const md = new MarkdownIt({ html: false, linkify: false, typographer: false });
  const seen = new Map<string, number>();
  const toc: TocEntry[] = [];

  // Assign ids to every heading and collect the `##` sections for the TOC.
  md.core.ruler.push("heading_ids", (state) => {
    const tokens = state.tokens;
    for (let i = 0; i < tokens.length; i++) {
      const open = tokens[i];
      if (!open || open.type !== "heading_open") continue;
      const inline = tokens[i + 1];
      const children = inline?.children ?? [];
      const text = children
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
        const label = children
          .filter((t) => t.type === "text")
          .map((t) => t.content)
          .join("")
          .trim();
        toc.push({ id, label: label || text });
      }
    }
  });

  // Root-relative links to our own site; external links open in a new tab.
  const linkOpen = md.renderer.rules.link_open ?? ((tokens, idx, options, _env, self) => self.renderToken(tokens, idx, options));
  md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
    const token = tokens[idx]!;
    const href = String(token.attrGet("href") ?? "");
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
  return { html: md.render(body), toc };
}

/** The specification, rendered for the page. */
export const renderSpecFile = () => renderSpec(readRepoFile("spec/SPEC.md"));

export type SpecSection = { id: string; title: string; markdown: string };

/**
 * The specification's `##` sections as Markdown, with the same ids the page
 * gives their headings, so an agent can read one section by its anchor.
 */
export function specSections(): SpecSection[] {
  const sections: SpecSection[] = [];
  const seen = new Map<string, number>();
  let fence = false;
  let current: SpecSection | null = null;
  for (const line of readRepoFile("spec/SPEC.md").split("\n")) {
    if (/^```/.test(line)) fence = !fence;
    const heading = !fence && /^## (.+)$/.exec(line);
    if (heading) {
      const title = heading[1]!.trim();
      const base = slug(title.replace(/`/g, ""));
      const n = seen.get(base) ?? 0;
      seen.set(base, n + 1);
      current = { id: n ? `${base}-${n}` : base, title, markdown: "" };
      sections.push(current);
    }
    if (current) current.markdown += `${line}\n`;
  }
  return sections.map((s) => ({ ...s, markdown: s.markdown.trim() }));
}
