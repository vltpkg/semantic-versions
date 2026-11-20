import { defineState } from "@affordances/next";
import { SITE_ENTITY, SITE_NAV, pageEntity } from "@/lib/agents";
import { EXAMPLES, SAMPLE_IDS, SAMPLE_SETS } from "@/lib/selector";

// The range selector, for agents: the page runs the reference parser in the
// browser; the actions (actions.ts) run the same parser here, so an agent can
// test what matches what without a browser.
export default defineState(
  () => ({
    site: SITE_ENTITY,
    page: pageEntity("/selector/", "Range selector", "Test which versions a range selects, see how the range desugars to comparators, and compare versions, with the reference parser."),
    examples: EXAMPLES,
    samples: SAMPLE_IDS.map((id) => {
      const { label, note, versions, examples } = SAMPLE_SETS[id];
      return { id, label, note, versions, examples };
    }),
  }),
  { description: "The range selector: test, desugar, parse, order and bump versions with the reference parser.", nav: () => SITE_NAV },
);
