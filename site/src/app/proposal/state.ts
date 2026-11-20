import { defineState } from "@affordances/next";
import { SITE_ENTITY, SITE_NAV, pageEntity } from "@/lib/agents";

export default defineState(
  () => ({
    site: SITE_ENTITY,
    page: pageEntity("/proposal/", "A path to Semantic Versioning 3.0.0", "The case for making this specification the next version of Semantic Versioning, with a clause-by-clause comparison against 2.0.0, and why it stands on its own regardless."),
  }),
  { description: "The case for Semantic Versioning 3.0.0, with a comparison against 2.0.0.", nav: () => SITE_NAV },
);
