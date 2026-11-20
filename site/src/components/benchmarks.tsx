import parse from "html-react-parser";
import { benchmarks } from "@/lib/benchmarks";

/*
 * The benchmark and conformance figures, rendered at build time by the same
 * renderer that writes the READMEs (benchmarks/render.mjs), so the numbers
 * are presented identically everywhere.
 */

/** The row of language marks beside the home page's calls to action. */
export const HeroLanguages = () => <>{parse(benchmarks().hero)}</>;

/** How many implementations are listed. */
export const LanguagesCount = () => <>{benchmarks().languages}</>;

/** How many cases the shared conformance suite has. */
export const CasesCount = () => <>{benchmarks().cases}</>;

/** The at-a-glance comparison table. */
export const LibrariesOverview = () => <>{parse(benchmarks().overview)}</>;

/** The install cards, one per language. */
export const LibraryCards = () => <>{parse(benchmarks().cards)}</>;

/** One section per language: headline, method, speed and conformance tables. */
export const LibrarySections = () => <>{parse(benchmarks().sections)}</>;
