import { defineState } from "@affordances/next";
import { SITE_ENTITY, SITE_NAV, pageEntity } from "@/lib/agents";
import { GRAMMARS } from "@/lib/corpus";

// The grammars page: every BNF, with its download; readGrammar returns the text.
export default defineState(
  () => ({
    site: SITE_ENTITY,
    page: pageEntity("/grammar/", "BNF grammars", "Backus–Naur forms for versions, ranges, comparators, references and the extensions, with the reference parser's regular expressions."),
    grammars: GRAMMARS.map(([file, note]) => ({ file, note, url: `/spec/${file}` })),
  }),
  { description: "The BNF grammars; readGrammar returns one.", nav: () => SITE_NAV },
);
