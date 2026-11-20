import { defineState } from "@affordances/next";
import { SITE_ENTITY, SITE_NAV } from "@/lib/agents";
import { EXTENSIONS, extension } from "@/lib/extensions";

// This extension's graph: what it is, where its normative Markdown is, and the others.
export default defineState(
  () => ({
    site: SITE_ENTITY,
    extension: { ...extension("dependency-locks"), note: "The Markdown is normative; the page is a presentation of it." },
    extensions: EXTENSIONS.map(({ id, title, url }) => ({ id, title, url })),
  }),
  { nav: () => [{ to: "/extensions/", label: "All extensions" }, ...SITE_NAV] },
);
