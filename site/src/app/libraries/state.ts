import { defineState } from "@affordances/next";
import { SITE_ENTITY, SITE_NAV, pageEntity } from "@/lib/agents";
import { benchmarks, libraryEntity, listed } from "@/lib/benchmarks";

// The libraries page: every implementation with its package, install command,
// conformance score and speed against the library it replaces.
export default defineState(
  () => {
    const { cases } = benchmarks();
    return {
      site: SITE_ENTITY,
      page: pageEntity("/libraries/", "Libraries", `Implementations for ${listed().length} languages that pass the same ${cases}-case conformance suite, with install commands and benchmarks against each language's existing library.`),
      conformance: { cases, suite: "https://github.com/vltpkg/semantic-versions/tree/main/conformance" },
      libraries: listed().map(libraryEntity),
    };
  },
  { description: "Implementations in eight languages, with install commands, conformance and benchmarks.", nav: () => SITE_NAV },
);
