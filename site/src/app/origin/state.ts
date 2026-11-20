import { defineState } from "@affordances/next";
import { SITE_ENTITY, SITE_NAV, pageEntity } from "@/lib/agents";

export default defineState(
  () => ({
    site: SITE_ENTITY,
    page: pageEntity("/origin/", "A short history of Semantic Versioning", "How Semantic Versioning came to be, how builds were introduced in 2.0.0-rc.1, and how 2.0.0-rc.2 made them inert."),
  }),
  { description: "A short history of Semantic Versioning and of build metadata.", nav: () => SITE_NAV },
);
