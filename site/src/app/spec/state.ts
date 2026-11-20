import { defineState } from "@affordances/next";
import { SITE_ENTITY, SITE_NAV } from "@/lib/agents";
import { specSections } from "@/lib/render-spec";
import { SPEC_VERSION } from "@/lib/site";

// The specification's graph: the document and its sections. readSection
// (actions.ts) returns any one of them as Markdown.
export default defineState(
  () => ({
    site: SITE_ENTITY,
    spec: {
      title: `Semantic Versions ${SPEC_VERSION}`,
      url: "/spec/",
      markdown: "/spec/SPEC.md",
      grammars: "/grammar/",
      note: "Normative. /spec/SPEC.md is the whole text; readSection returns one section.",
    },
    sections: specSections().map(({ id, title }) => ({ id, title, url: `/spec/#${id}` })),
  }),
  { nav: () => SITE_NAV },
);
