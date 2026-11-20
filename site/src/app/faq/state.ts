import { defineState } from "@affordances/next";
import { SITE_ENTITY, SITE_NAV, pageEntity } from "@/lib/agents";

export default defineState(
  () => ({
    site: SITE_ENTITY,
    page: pageEntity("/faq/", "FAQ", "Why some things changed from Semantic Versioning 2.0.0, why others deliberately did not, and how the spec fits alongside the rest of the ecosystem."),
  }),
  { description: "Frequently asked questions about the specification.", nav: () => SITE_NAV },
);
