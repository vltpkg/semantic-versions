/**
 * What every page tells an agent about the site, and the links an agent can
 * follow from anywhere. Each route's state.ts adds what that page shows.
 */
import { REPO, SPEC_VERSION } from "@/lib/site";

/** A link an agent can follow from a page (@affordances/protocol's NavItem). */
export type NavItem = { to: string; label?: string; when?: string };

export const SITE_ENTITY = {
  name: "Semantic Versions",
  version: SPEC_VERSION,
  summary:
    "An open specification for how version numbers are assigned, incremented, grouped, compared and matched: Semantic Versioning 2.0.0-rc.1's build precedence restored, and sets, ranges and comparators defined formally. Reference implementations in eight languages pass one conformance suite.",
  specification: "/spec/SPEC.md",
  llms: "/llms.txt",
  agents: "/agents/",
  repository: REPO,
};

/** Where to go from any page. */
export const SITE_NAV: NavItem[] = [
  { to: "/spec/", label: "The specification" },
  { to: "/selector/", label: "Test ranges and versions" },
  { to: "/grammar/", label: "BNF grammars" },
  { to: "/libraries/", label: "Libraries in eight languages" },
  { to: "/extensions/", label: "Extensions" },
  { to: "/faq/", label: "FAQ" },
  { to: "/agents/", label: "For agents" },
];

/** One page's own entry: its title, what it is, and where its Markdown is. */
export const pageEntity = (path: string, title: string, summary: string) => ({
  title,
  url: path,
  summary,
  markdown: `${path.replace(/\/$/, "") || "/index"}.md`,
});
