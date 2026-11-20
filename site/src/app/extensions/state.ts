import { defineState } from "@affordances/next";
import { SITE_ENTITY, SITE_NAV, pageEntity } from "@/lib/agents";
import { EXTENSIONS } from "@/lib/extensions";

// The extensions index: what is defined on top of the specification.
export default defineState(
  () => ({
    site: SITE_ENTITY,
    page: pageEntity("/extensions/", "Extensions", "Three extensions that encode build variants, artifact integrity and whole resolved dependency graphs inside a version string, in layering order."),
    extensions: EXTENSIONS,
  }),
  { description: "The extensions index: Build Variants, Package Integrity and Dependency Locks.", nav: () => [...EXTENSIONS.map((e) => ({ to: e.url, label: e.title })), ...SITE_NAV] },
);
