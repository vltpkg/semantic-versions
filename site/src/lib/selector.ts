import { Comparator, Range, Version, splitReference } from "semantic-versions";

/*
 * The range selector's data and logic, shared by the page
 * (components/selector.tsx) and its graph (app/selector/state.ts). Everything
 * here runs on the reference `semantic-versions` parser, the same code a
 * compliant library would use.
 */

export type Example = {
  range: string;
  /** What the range selects, in a few words. */
  gloss: string;
};

export type SampleSet = {
  label: string;
  /** One line on what the set shows. */
  note: string;
  /** The part of the specification the set exercises. */
  spec: { label: string; href: string };
  versions: string[];
  /** Ranges worth trying against these versions. */
  examples: Example[];
  /** The example a visitor starts from. */
  start: string;
};

// Curated sample sets. Public registries never publish build metadata and rarely
// expose long pre-release trains, so these hand-built sets are how you actually
// exercise the parts of the grammar that make Semantic Versions different. Each
// carries the ranges that show what it is for.
export const SAMPLE_SETS = {
  mixed: {
    label: "Mixed",
    note: "Releases, pre-releases and one build.",
    spec: { label: "Ranges", href: "/spec/#ranges" },
    versions: [
      "0.9.8",
      "1.0.0-alpha",
      "1.0.0-alpha.1",
      "1.0.0-beta",
      "1.0.0-rc.1",
      "1.0.0",
      "1.0.1",
      "1.1.0",
      "1.2.0",
      "1.2.3",
      "1.2.3+build.7",
      "1.4.2",
      "1.9.0",
      "2.0.0-rc.1",
      "2.0.0",
      "2.1.0",
      "3.0.0",
    ],
    start: "^1.2.3",
    examples: [
      { range: "^1.2.3", gloss: "Caret: from 1.2.3 up to, not including, 2.0.0" },
      { range: "~>1.2", gloss: "Approximate: from 1.2.0 up to, not including, 2.0.0" },
      { range: "1.2.x", gloss: "X-range: any patch of 1.2" },
      { range: "1.0.0 - 2.0.0", gloss: "Hyphen: 1.0.0 through 2.0.0" },
      { range: "1.2.x || >=2.0.0", gloss: "Either set: any patch of 1.2, or 2.0.0 and up" },
      { range: "*", gloss: "Any stable version" },
    ],
  },
  prerelease: {
    label: "Release train",
    note: "Pre-releases stay out until a range names their channel.",
    spec: { label: "Pre-release channels", href: "/spec/#pre-release-channels" },
    versions: [
      "0.9.0",
      "1.0.0-alpha.1",
      "1.0.0-alpha.2",
      "1.0.0-beta.1",
      "1.0.0-beta.2",
      "1.0.0-rc.1",
      "1.0.0-rc.2",
      "1.0.0",
      "1.0.1",
      "1.1.0-rc.1",
      "1.1.0",
      "1.2.0",
      "2.0.0-alpha.1",
      "2.0.0-rc.1",
      "2.0.0",
    ],
    start: "^1.0.0-rc",
    examples: [
      { range: "^1.0.0", gloss: "Stable versions only" },
      { range: "^1.0.0-rc", gloss: "The rc channel of 1.0.0" },
      { range: "^1.0.0-*", gloss: "Any pre-release of 1.0.0" },
      { range: "*-*", gloss: "Every pre-release, of every version" },
    ],
  },
  build: {
    label: "Build variants",
    note: "A build on a range is a channel filter.",
    spec: { label: "Build channels", href: "/spec/#build-channels" },
    versions: [
      "1.0.0",
      "1.0.0+linux.x64",
      "1.0.0+linux.arm64",
      "1.0.0+darwin.arm64",
      "1.0.0+win.x64",
      "1.0.0+sha.a1b2c3d4",
      "1.1.0",
      "1.1.0+linux.x64",
      "1.1.0+darwin.arm64",
      "1.1.0+win.x64",
      "2.0.0+linux.x64",
    ],
    start: "^1.0.0+win",
    examples: [
      { range: "^1.0.0", gloss: "Every variant" },
      { range: "^1.0.0+win", gloss: "The win channel" },
      { range: ">=1.1.0+linux.x64", gloss: "linux.x64 builds, from 1.1.0" },
      { range: "1.0.0+linux.x64", gloss: "Exactly this build" },
    ],
  },
  contexts: {
    label: "Contexts",
    note: "Two identities that share version numbers.",
    spec: { label: "Contextual sets", href: "/spec/#contextual-sets" },
    versions: [
      "npm:react@1.0.0",
      "npm:react@1.2.0",
      "npm:react@1.4.2",
      "npm:react@1.9.0",
      "npm:react@2.0.0",
      "cargo:serde@1.0.0",
      "cargo:serde@1.2.0",
      "cargo:serde@1.4.2",
      "cargo:serde@2.0.0",
    ],
    start: "npm:react@^1.0.0",
    examples: [
      { range: "^1.0.0", gloss: "Unscoped: matches in both contexts" },
      { range: "npm:react@^1.0.0", gloss: "Scoped to npm:react" },
      { range: "cargo:serde@^1.0.0", gloss: "Scoped to cargo:serde" },
    ],
  },
} satisfies Record<string, SampleSet>;

export type SampleId = keyof typeof SAMPLE_SETS;

export const SAMPLE_IDS = Object.keys(SAMPLE_SETS) as SampleId[];

export const isSampleId = (id: string | null | undefined): id is SampleId => !!id && Object.hasOwn(SAMPLE_SETS, id);

/** Every example range, once, in the order the sets list them. */
export const EXAMPLES = [...new Set(SAMPLE_IDS.flatMap((id) => SAMPLE_SETS[id].examples.map((e) => e.range)))];

/** Versions from free text: one per line, or separated by spaces or commas. */
export const parseVersionList = (text: string) => text.split(/[\s,]+/).filter(Boolean);

export type Candidate = {
  raw: string;
  /** Null when the text is not a version. */
  version: Version | null;
  /** The `source:name` a version is qualified with, shown dimmed before it. */
  context: string | null;
  rest: string;
};

/** Read each candidate once, so a new range only has to be tested against them. */
export const parseCandidates = (versions: readonly string[]): Candidate[] =>
  versions.map((raw) => {
    try {
      const version = new Version(raw);
      const { context, rest } = splitReference(raw);
      return { raw, version, context, rest };
    } catch {
      return { raw, version: null, context: null, rest: raw };
    }
  });

/**
 * Where a candidate stands against a range. A version inside the range's
 * bounds that still misses says which rule kept it out, because those are the
 * rules that set this grammar apart: a pre-release the range did not opt in
 * to, or a build outside its channel.
 */
export type Status = "match" | "miss" | "prerelease" | "build" | "context" | "invalid";

export type Evaluation = {
  /** False when the range does not parse; nothing matches then. */
  valid: boolean;
  context: string | null;
  /** The desugared range: one comparator set per `||` branch, `*` for an empty comparator. */
  sets: string[][];
  /** One status per candidate, in order. */
  statuses: Status[];
  matched: number;
  /** How many candidates are versions at all. */
  total: number;
};

// A comparator with a build channel tests two things, its bound and the
// channel. This is the bound alone, so the two can be told apart.
const boundOf = (c: Comparator) => (c.ANY || !c.channel.length ? c : new Comparator(c.operator + c.core.version));

export function evaluate(text: string, candidates: readonly Candidate[]): Evaluation {
  let range: Range;
  try {
    range = new Range(text.trim());
  } catch {
    const statuses = candidates.map((c): Status => (c.version ? "miss" : "invalid"));
    const total = statuses.filter((s) => s === "miss").length;
    return { valid: false, context: null, sets: [], statuses, matched: 0, total };
  }

  const bounds = range.set.map((set) => set.map(boundOf));
  let matched = 0;
  let total = 0;
  const statuses = candidates.map(({ version }): Status => {
    if (!version) return "invalid";
    total++;
    if (range.context && version.context !== range.context) return "context";
    if (range.test(version)) {
      matched++;
      return "match";
    }
    // The parser takes a comparator set in three steps: the bounds, the build
    // channels, then the pre-release channels. Report the furthest step any
    // set let this version reach.
    let reached: Status = "miss";
    for (const [i, set] of range.set.entries()) {
      if (!bounds[i]?.every((c) => c.test(version))) continue;
      if (set.every((c) => c.test(version))) return "prerelease";
      reached = "build";
    }
    return reached;
  });

  return {
    valid: true,
    context: range.context,
    sets: range.set.map((set) => set.map((c) => c.value || "*")),
    statuses,
    matched,
    total,
  };
}

/** Newest first, by the parser's precedence. Anything it cannot compare keeps its place. */
export const sortDescending = (versions: string[]) =>
  versions.slice().sort((a, b) => {
    try {
      return new Version(b).compare(new Version(a));
    } catch {
      return 0;
    }
  });

export const DEFAULT_REGISTRY = "https://registry.npmjs.org";

export const normalizeOrigin = (value: string) => value.trim().replace(/\/+$/, "") || DEFAULT_REGISTRY;

/** A package's document on an npm-compatible registry, a scoped name encoded as registries expect ("@scope%2fname"). */
export const packumentUrl = (origin: string, pkg: string) =>
  `${origin}/${encodeURIComponent(pkg).replace(/^%40/, "@").replace(/%2[fF]/g, "%2f")}`;

/**
 * Ranges worth trying against a package's own versions (newest first), anchored
 * on its newest stable release. A package with pre-releases only leads with the
 * range that admits them.
 */
export function packageExamples(pkg: string, candidates: readonly Candidate[]): Example[] {
  const everything = { range: "*-*", gloss: "Every version, pre-releases included" };
  const newest = candidates.find((c) => c.version && !c.version.prerelease.length)?.version;
  if (!newest) return [everything, { range: `npm:${pkg}@*-*`, gloss: `The same, scoped to npm:${pkg}` }];
  const line = newest.major > 0 ? `${newest.major}` : `0.${newest.minor}`;
  const caret = newest.major > 0 ? `^${newest.major}.0.0` : `^0.${newest.minor}.0`;
  return [
    { range: caret, gloss: `Every stable ${line}.x` },
    { range: "*", gloss: "Every stable version" },
    everything,
    { range: `npm:${pkg}@${caret}`, gloss: `The same, scoped to npm:${pkg}` },
  ];
}

/*
 * What the page keeps in its address, so a link reopens what its sender saw:
 * the range, and where the versions came from. A registry origin is never part
 * of it; a link fetches from the reader's own.
 */
export type Shared = { range?: string; set?: SampleId; pkg?: string; versions?: string[] };

/** The longest version list a link carries; a longer one stays on the page it was typed into. */
const SHARED_VERSIONS_MAX = 1500;

const decode = (value: string) => {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
};

// A `+` is read as itself, not as a space, so a hand-written link can carry a
// build (`?range=^1.0.0+win`).
export function readQuery(search: string): Shared {
  const shared: Shared = {};
  for (const pair of search.replace(/^\?/, "").split("&")) {
    const at = pair.indexOf("=");
    const value = at > 0 ? decode(pair.slice(at + 1)) : null;
    if (value === null) continue;
    const key = pair.slice(0, at);
    if (key === "range") shared.range = value;
    else if (key === "set" && isSampleId(value)) shared.set = value;
    else if (key === "pkg" && value.trim()) shared.pkg = value.trim();
    else if (key === "versions" && parseVersionList(value).length) shared.versions = parseVersionList(value);
  }
  return shared;
}

// Leave the characters a reference is made of readable in the address bar.
const encode = (value: string) => encodeURIComponent(value).replace(/%(3A|40|2C)/gi, decodeURIComponent);

export function writeQuery({ range, set, pkg, versions }: Shared): string {
  const pairs: string[] = [];
  if (range !== undefined) pairs.push(`range=${encode(range)}`);
  if (pkg) pairs.push(`pkg=${encode(pkg)}`);
  else if (versions?.length) {
    const list = versions.join(",");
    if (list.length <= SHARED_VERSIONS_MAX) pairs.push(`versions=${encode(list)}`);
  } else if (set) pairs.push(`set=${set}`);
  return pairs.length ? `?${pairs.join("&")}` : "";
}
