"use server";

import { AffordancesError, defineAction } from "@affordances/next";
import { Range, Version, diff, increment, sort, splitReference, validRange } from "semantic-versions";
import { z } from "zod";
import selector from "./state";

// The range selector's actions: the reference parser, run here for agents.
// Each is pure and read-only; the page runs the same code in the browser.

const versionList = z
  .array(z.string().min(1))
  .min(1)
  .max(5000)
  .describe("Versions, optionally context-qualified (npm:react@18.2.0)");

const parseRange = (range: string) => {
  try {
    return new Range(range);
  } catch {
    throw new AffordancesError("invalid_input", `${JSON.stringify(range)} is not a valid range`);
  }
};

const describeRange = (raw: string, range: Range) => {
  const canonical = validRange(raw) || "*";
  return {
    range: raw,
    context: range.context,
    desugared: range.context ? `${range.context}@${canonical}` : canonical,
    // One comparator set per `||` branch; an empty comparator is `*`.
    sets: range.set.map((comps) => comps.map((c) => c.value || "*")),
  };
};

export const select = defineAction({
  name: "select",
  description:
    "Test which of some versions a range selects, as the page does: the range desugared to comparators, the versions that match, and why the rest do not (invalid, or outside the range's context). Pre-releases match only when the range opts in (^1.0.0-rc, 1.0.0-*, *-*); build metadata is a channel (^1.0.0+win admits +win.* builds only).",
  input: z.object({
    range: z.string().describe("A range, e.g. ^1.2.3, ~>1.2, >=1.0.0 <2.0.0, 1.x || 2.x, npm:react@^18"),
    versions: versionList,
  }),
  output: z.object({
    range: z.string(),
    desugared: z.string(),
    context: z.string().nullable(),
    sets: z.array(z.array(z.string())),
    matches: z.array(z.string()),
    highest: z.string().nullable(),
    misses: z.array(z.string()),
    otherContext: z.array(z.string()),
    invalid: z.array(z.string()),
  }),
  state: selector,
  expose: "public",
  readOnly: true,
  run: ({ range: raw, versions }) => {
    const range = parseRange(raw);
    const matches: string[] = [];
    const misses: string[] = [];
    const otherContext: string[] = [];
    const invalid: string[] = [];
    let highest: Version | null = null;
    for (const v of versions) {
      let version: Version;
      try {
        version = new Version(v);
      } catch {
        invalid.push(v);
        continue;
      }
      if (range.context && version.context !== range.context) {
        otherContext.push(v);
        continue;
      }
      if (range.test(version)) {
        matches.push(v);
        if (!highest || version.compare(highest) > 0) highest = version;
      } else misses.push(v);
    }
    return { ...describeRange(raw, range), matches, highest: highest ? highest.reference : null, misses, otherContext, invalid };
  },
});

export const desugar = defineAction({
  name: "desugar",
  description: "Desugar a range to its primitive comparators, as the specification defines (^, ~, ~>, x-ranges and hyphen ranges become >=, <, = comparators).",
  input: z.object({ range: z.string().describe("A range, e.g. ^1.2.3 or ~>1.2") }),
  output: z.object({ range: z.string(), desugared: z.string(), context: z.string().nullable(), sets: z.array(z.array(z.string())) }),
  state: selector,
  expose: "public",
  readOnly: true,
  run: ({ range }) => describeRange(range, parseRange(range)),
});

export const parse = defineAction({
  name: "parse",
  description: "Parse a version (optionally context-qualified, e.g. npm:react@18.2.0-rc.1+build.7) into its parts, or report why it is invalid.",
  input: z.object({ version: z.string().min(1) }),
  output: z.object({
    valid: z.boolean(),
    reason: z.string().optional(),
    context: z.string().nullable().optional(),
    version: z.string().optional(),
    major: z.number().optional(),
    minor: z.number().optional(),
    patch: z.number().optional(),
    prerelease: z.array(z.union([z.string(), z.number()])).optional(),
    build: z.array(z.string()).optional(),
  }),
  state: selector,
  expose: "public",
  readOnly: true,
  run: ({ version: raw }) => {
    try {
      const v = new Version(raw);
      return { valid: true, context: v.context, version: v.version, major: v.major, minor: v.minor, patch: v.patch, prerelease: v.prerelease, build: v.build };
    } catch (error) {
      return { valid: false, reason: error instanceof Error ? error.message : String(error) };
    }
  },
});

export const compare = defineAction({
  name: "compare",
  description:
    "Order versions by precedence, lowest first, as the specification defines it: pre-releases below their release, and a build above its plain release (1.0.0 < 1.0.0+build.7). Equal versions are grouped.",
  input: z.object({ versions: versionList }),
  output: z.object({
    sorted: z.array(z.string()),
    order: z.string().describe("The sorted versions joined by < and =, e.g. 1.0.0-rc.1 < 1.0.0 = 1.0.0 < 1.0.0+build"),
    invalid: z.array(z.string()),
  }),
  state: selector,
  expose: "public",
  readOnly: true,
  run: ({ versions }) => {
    const parsed: Version[] = [];
    const invalid: string[] = [];
    for (const v of versions) {
      try {
        parsed.push(new Version(v));
      } catch {
        invalid.push(v);
      }
    }
    const sorted = sort(parsed) as Version[];
    let order = "";
    sorted.forEach((v, i) => {
      const prev = sorted[i - 1];
      order += (prev ? (v.compare(prev) === 0 ? " = " : " < ") : "") + v.reference;
    });
    return { sorted: sorted.map((v) => v.reference), order, invalid };
  },
});

export const bump = defineAction({
  name: "bump",
  description: "Increment a version by a release type (major, minor, patch, premajor, preminor, prepatch, prerelease), with an optional pre-release identifier, and name what changed between two versions.",
  input: z.object({
    version: z.string().min(1),
    release: z.enum(["major", "minor", "patch", "premajor", "preminor", "prepatch", "prerelease"]),
    identifier: z.string().optional().describe("The pre-release identifier for pre* releases, e.g. rc"),
  }),
  output: z.object({ from: z.string(), to: z.string(), diff: z.string().nullable() }),
  state: selector,
  expose: "public",
  readOnly: true,
  run: ({ version, release, identifier }) => {
    const { rest } = splitReference(version);
    const to = increment(rest, release, identifier);
    if (!to) throw new AffordancesError("invalid_input", `${JSON.stringify(version)} is not a valid version`);
    return { from: rest, to, diff: diff(rest, to) };
  },
});
