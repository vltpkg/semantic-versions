/**
 * Benchmark and conformance results (benchmarks/results/<language>.json) for
 * every implementation in benchmarks/languages.mjs, rendered with the same
 * renderer the READMEs use so the numbers are presented identically
 * everywhere. Read at build time.
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { ICONS } from "../../../benchmarks/icons.mjs";
import { LANGUAGES } from "../../../benchmarks/languages.mjs";
import { conformanceTotal, heroLanguagesHtml, overviewHtml, toolCardsHtml, toolSectionsHtml } from "../../../benchmarks/render.mjs";
import { REPO_ROOT } from "@/lib/repo";

type Results = Record<string, unknown>;

function load(): Record<string, Results> {
  const results: Record<string, Results> = {};
  for (const l of LANGUAGES) {
    const file = resolve(/* turbopackIgnore: true */ REPO_ROOT, "benchmarks/results", `${l.id}.json`);
    if (existsSync(file)) results[l.id] = JSON.parse(readFileSync(file, "utf8")) as Results;
  }
  return results;
}

export function benchmarks() {
  const results = load();
  const listed = LANGUAGES.filter((l) => results[l.id]);
  const first = listed[0];
  const cases = first ? (conformanceTotal(results[first.id]).total as number) : 0;
  return {
    languages: listed.length,
    cases,
    hero: heroLanguagesHtml(LANGUAGES, ICONS) as string,
    cards: toolCardsHtml(LANGUAGES, results, ICONS) as string,
    overview: overviewHtml(LANGUAGES, results, ICONS) as string,
    sections: toolSectionsHtml(LANGUAGES, results, ICONS) as string,
  };
}
