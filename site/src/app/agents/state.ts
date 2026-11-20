import { defineState } from "@affordances/next";
import { SITE_ENTITY, SITE_NAV, pageEntity } from "@/lib/agents";

export default defineState(
  () => ({
    site: SITE_ENTITY,
    page: pageEntity("/agents/", "For agents", "How to read and use semver.xyz without a browser: llms.txt, every page as Markdown, the Affordances graph and its actions, and MCP."),
  }),
  { nav: () => SITE_NAV },
);
