import { defineState } from "@affordances/next";
import { SITE_ENTITY, SITE_NAV } from "@/lib/agents";
import { EXTENSIONS, extension } from "@/lib/extensions";

// This extension's graph: what it is, where its normative Markdown is, and the others.
export default defineState(
  () => ({
    site: SITE_ENTITY,
    extension: { ...extension("variants"), note: "The Markdown is normative; the page is a presentation of it." },
    extensions: EXTENSIONS.map(({ id, title, url }) => ({ id, title, url })),
  }),
  { description: "The Build Variants extension: os, arch, abi and feature coordinates in build metadata.", nav: () => [{ to: "/extensions/", label: "All extensions" }, ...SITE_NAV] },
);
