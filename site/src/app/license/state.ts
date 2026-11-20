import { defineState } from "@affordances/next";
import { SITE_ENTITY, SITE_NAV, pageEntity } from "@/lib/agents";

export default defineState(
  () => ({
    site: SITE_ENTITY,
    page: pageEntity("/license/", "License", "The specification and extension texts are CC BY 3.0; the code (every library, the benchmarks and the site) is Apache 2.0."),
  }),
  { nav: () => SITE_NAV },
);
