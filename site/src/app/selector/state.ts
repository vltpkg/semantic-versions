import { defineState } from "@affordances/next";
import { SITE_ENTITY, SITE_NAV, pageEntity } from "@/lib/agents";
import { EXAMPLES, SAMPLE_SETS } from "@/lib/interactive/selector";

// The range selector, for agents: the page runs the reference parser in the
// browser; the actions (actions.ts) run the same parser here, so an agent can
// test what matches what without a browser.
export default defineState(
  () => ({
    site: SITE_ENTITY,
    page: pageEntity("/selector/", "Range selector", "Test which versions a range selects, see how the range desugars to comparators, and compare versions, with the reference parser."),
    examples: EXAMPLES,
    samples: Object.entries(SAMPLE_SETS).map(([id, s]) => ({ id, label: s.label, note: s.note, versions: s.versions })),
  }),
  { description: "The range selector: test, desugar, parse, order and bump versions with the reference parser.", nav: () => SITE_NAV },
);
