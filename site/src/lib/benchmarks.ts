/**
 * Benchmark and conformance results (benchmarks/results/<language>.json) for
 * every implementation in benchmarks/languages.mjs, rendered with the same
 * renderer the READMEs use so the numbers are presented identically
 * everywhere.
 */
import { ICONS } from "../../../benchmarks/icons.mjs";
import { LANGUAGES } from "../../../benchmarks/languages.mjs";
import { conformanceTotal, heroLanguagesHtml, overviewHtml, speedRange, toolCardsHtml, toolSectionsHtml } from "../../../benchmarks/render.mjs";
import { RESULTS } from "@/lib/sources";

export type Language = (typeof LANGUAGES)[number];

/** The implementations that have results, in the order benchmarks/languages.mjs lists them. */
export const listed = () => LANGUAGES.filter((l) => RESULTS[l.id]);

export function benchmarks() {
  const languages = listed();
  const first = languages[0];
  const cases = first ? (conformanceTotal(RESULTS[first.id]).total as number) : 0;
  return {
    languages: languages.length,
    cases,
    hero: heroLanguagesHtml(LANGUAGES, ICONS) as string,
    cards: toolCardsHtml(LANGUAGES, RESULTS, ICONS) as string,
    overview: overviewHtml(LANGUAGES, RESULTS, ICONS) as string,
    sections: toolSectionsHtml(LANGUAGES, RESULTS, ICONS) as string,
  };
}

/** One implementation, as the libraries page's graph describes it. */
export const libraryEntity = (l: Language) => {
  const res = RESULTS[l.id];
  const pass = res ? conformanceTotal(res) : null;
  return {
    id: l.id,
    language: l.name,
    package: l.package,
    registry: l.registry,
    install: l.install,
    source: `https://github.com/vltpkg/semantic-versions/tree/main/${l.source}`,
    links: Object.fromEntries(l.links as [string, string][]),
    conformance: pass ? `${pass.passed}/${pass.total}` : null,
    comparedWith: res ? (res.baseline as string) : null,
    speed: res ? (speedRange(res) as string) : null,
    url: `/libraries/#${l.id}`,
  };
};
