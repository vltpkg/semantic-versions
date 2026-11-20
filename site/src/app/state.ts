import { defineState } from "@affordances/next";
import { SITE_ENTITY, SITE_NAV } from "@/lib/agents";

// The home page, for agents: what Semantic Versions is and where to go next.
export default defineState(
  () => ({
    site: SITE_ENTITY,
    start: [
      { title: "The specification", url: "/spec/", markdown: "/spec/SPEC.md" },
      { title: "Test a range against versions", url: "/selector/" },
      { title: "Libraries and install commands", url: "/libraries/" },
      { title: "For agents", url: "/agents/" },
      { title: "llms.txt", url: "/llms.txt" },
    ],
  }),
  { nav: () => SITE_NAV },
);
