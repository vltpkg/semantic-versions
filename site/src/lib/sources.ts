/**
 * The repository's canonical texts and results, bundled as strings and JSON
 * (next.config.ts gives *.md and *.bnf to raw-loader). Everything the site
 * renders, serves as text or answers agents with comes from here, so the
 * published site never reads a file at request time and never drifts from
 * the repository.
 */
import SPEC from "../../../spec/SPEC.md";
import dependencyLocks from "../../../extensions/dependency-locks/dependency-locks.md";
import dependencyLocksSpec from "../../../extensions/dependency-locks/dependency-locks-spec.md";
import integrity from "../../../extensions/integrity/integrity.md";
import variants from "../../../extensions/variants/variants.md";
import parserReadme from "../../../libraries/javascript/README.md";
import COMPARATOR from "../../public/spec/COMPARATOR.bnf";
import INTEGRITY from "../../public/spec/INTEGRITY.bnf";
import RANGE from "../../public/spec/RANGE.bnf";
import REFERENCE from "../../public/spec/REFERENCE.bnf";
import VARIANTS from "../../public/spec/VARIANTS.bnf";
import VERSION from "../../public/spec/VERSION.bnf";
import dotnet from "../../../benchmarks/results/dotnet.json";
import go from "../../../benchmarks/results/go.json";
import java from "../../../benchmarks/results/java.json";
import javascript from "../../../benchmarks/results/javascript.json";
import php from "../../../benchmarks/results/php.json";
import python from "../../../benchmarks/results/python.json";
import ruby from "../../../benchmarks/results/ruby.json";
import rust from "../../../benchmarks/results/rust.json";

/** The Markdown corpus, by repository path. */
export const MARKDOWN: Record<string, string> = {
  "spec/SPEC.md": SPEC,
  "extensions/variants/variants.md": variants,
  "extensions/integrity/integrity.md": integrity,
  "extensions/dependency-locks/dependency-locks.md": dependencyLocks,
  "extensions/dependency-locks/dependency-locks-spec.md": dependencyLocksSpec,
  "libraries/javascript/README.md": parserReadme,
};

/** The BNF grammars, by file name, as served from /spec/. */
export const GRAMMAR_TEXT: Record<string, string> = {
  "VERSION.bnf": VERSION,
  "RANGE.bnf": RANGE,
  "COMPARATOR.bnf": COMPARATOR,
  "REFERENCE.bnf": REFERENCE,
  "VARIANTS.bnf": VARIANTS,
  "INTEGRITY.bnf": INTEGRITY,
};

/** benchmarks/results/<language>.json, by the language id in benchmarks/languages.mjs. */
export const RESULTS: Record<string, Record<string, unknown>> = { javascript, rust, python, go, ruby, java, dotnet, php };

export const readRepoFile = (rel: string): string => {
  const text = MARKDOWN[rel];
  if (text === undefined) throw new Error(`${rel} is not bundled; add it to src/lib/sources.ts`);
  return text;
};
