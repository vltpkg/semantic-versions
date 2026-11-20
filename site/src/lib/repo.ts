import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * The repository, one level up from the site. The site is built from its
 * canonical sources: spec/SPEC.md, the extension Markdown, the libraries'
 * READMEs and benchmarks/results. Everything is read at build time, so the
 * published site never reads a file at request time.
 */
export const REPO_ROOT = resolve(process.cwd(), "..");

// Every read happens while prerendering, so nothing here needs tracing into
// the server bundle (which would otherwise pull in the whole repository).
export const readRepoFile = (rel: string): string => readFileSync(resolve(/* turbopackIgnore: true */ REPO_ROOT, rel), "utf8");
