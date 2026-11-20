"use client";

import {
  type CSSProperties,
  type FormEvent,
  useDeferredValue,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  DEFAULT_REGISTRY,
  EXAMPLES,
  type Example,
  SAMPLE_IDS,
  SAMPLE_SETS,
  type SampleId,
  type Status,
  evaluate,
  normalizeOrigin,
  packageExamples,
  packumentUrl,
  parseCandidates,
  parseVersionList,
  readQuery,
  sortDescending,
  writeQuery,
} from "@/lib/selector";

/*
 * The range selector, as one bench. The range sits on top and stays in view
 * while the page scrolls, with how many versions it selects beside it. Under
 * it: where the versions come from (a sample set, a package on a registry, or
 * the visitor's own list) and the versions themselves, each marked as selected
 * or not. A version the range's bounds admit but one of the grammar's own rules
 * keeps out says which rule.
 *
 * The reference parser runs here on every keystroke; the page's actions
 * (app/selector/actions.ts) run it for agents. The range and the source of the
 * versions are kept in the address, so a link reopens the same test. The page's
 * Markdown twin gets the test it opens on; the controls are left out of it
 * (data-affordances-md="skip").
 */

type Source = SampleId | "registry" | "custom";

type Fetched = { pkg: string; versions: string[]; examples: Example[] };

const SOURCES: { id: Source; label: string }[] = [
  ...SAMPLE_IDS.map((id) => ({ id, label: SAMPLE_SETS[id].label })),
  { id: "registry", label: "Registry" },
  { id: "custom", label: "Your own" },
];

const START = SAMPLE_SETS.mixed.start;
const REGISTRY_KEY = "semver-xyz.registry";
// A registry lookup can return thousands of versions: show the first few and
// let the list grow with the page on request, rather than scroll inside a box.
const PREVIEW_ROWS = 50;
// A list of a size to be taken in at once is set in two columns where there is
// room. A handful of rows, more than a screenful or two, or versions too long
// to sit side by side (a canary with a hash and a date) make one column.
const TWO_COLUMNS = { from: 8, to: 100, characters: 28 };

// Why a version the bounds admit was still left out.
const WHY: Partial<Record<Status, { label: string; title: string }>> = {
  prerelease: {
    label: "pre-release",
    title: "Inside the range's bounds, but the range does not opt in to this pre-release.",
  },
  build: { label: "build channel", title: "Inside the range's bounds, but outside its build channel." },
  context: { label: "other context", title: "A different identity from the one the range is scoped to." },
  invalid: { label: "not a version", title: "This does not parse as a version." },
};

const count = (n: number) => n.toLocaleString("en");

const host = (origin: string) => normalizeOrigin(origin).replace(/^https?:\/\//, "");

/** A comparator set, with its operators dimmed. */
function Comparators({ set }: { set: string[] }) {
  return set.map((comp, i) => {
    const [, op = "", version = comp] = comp.match(/^(<=|>=|<|>|=)?(.*)$/) ?? [];
    return (
      <span key={i}>
        {i > 0 && " "}
        <span className="op">{op}</span>
        {version}
      </span>
    );
  });
}

export function Selector() {
  const [range, setRange] = useState(START);
  const [source, setSource] = useState<Source>("mixed");
  const [custom, setCustom] = useState("");
  // The examples offered beside a list of one's own: those of the versions it started from.
  const [borrowed, setBorrowed] = useState<Example[]>(SAMPLE_SETS.mixed.examples);
  const [pkg, setPkg] = useState("");
  const [origin, setOrigin] = useState(DEFAULT_REGISTRY);
  const [editOrigin, setEditOrigin] = useState(false);
  const [fetched, setFetched] = useState<Fetched | null>(null);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState("");
  const [matchesOnly, setMatchesOnly] = useState(false);
  // The list "Show all" was asked for: a different list starts short again.
  const [expanded, setExpanded] = useState<readonly string[] | null>(null);
  const [ready, setReady] = useState(false);

  // A range the visitor typed is theirs to keep; one the page offered follows the versions.
  const typed = useRef(false);
  // The source on screen, for a fetch that answers after the visitor has moved on.
  const shown = useRef<Source>(source);
  const request = useRef<AbortController | null>(null);
  const pkgInput = useRef<HTMLInputElement>(null);

  const versions = useMemo<readonly string[]>(
    () =>
      source === "registry"
        ? (fetched?.versions ?? [])
        : source === "custom"
          ? parseVersionList(custom)
          : SAMPLE_SETS[source].versions,
    [source, fetched, custom],
  );
  const candidates = useMemo(() => parseCandidates(versions), [versions]);
  // Typing stays immediate on a list of thousands; the marks follow.
  const tested = useDeferredValue(range);
  const result = useMemo(() => evaluate(tested, candidates), [tested, candidates]);

  const examples: Example[] =
    source === "registry"
      ? (fetched?.examples ?? SAMPLE_SETS.mixed.examples)
      : source === "custom"
        ? borrowed
        : SAMPLE_SETS[source].examples;

  const offer = (next: string) => {
    typed.current = false;
    setRange(next);
  };

  const choose = (next: Source) => {
    if (next === source) return;
    // Start a list of one's own from the versions on screen.
    if (next === "custom" && !custom.trim()) {
      setCustom(versions.join("\n"));
      setBorrowed(examples);
    }
    setSource(next);
    if (typed.current) return;
    if (next === "registry") {
      if (fetched?.examples[0]) setRange(fetched.examples[0].range);
    } else if (next !== "custom") setRange(SAMPLE_SETS[next].start);
  };

  const load = async (name: string, from: string) => {
    const wanted = name.trim();
    if (!wanted) {
      pkgInput.current?.focus();
      return;
    }
    const base = normalizeOrigin(from);
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setFetching(true);
    setError("");
    try {
      const res = await fetch(packumentUrl(base, wanted), {
        // The abbreviated document: install-relevant fields only, much smaller.
        headers: { Accept: "application/vnd.npm.install-v1+json" },
        signal: controller.signal,
      }).catch((cause: unknown) => {
        if (controller.signal.aborted) throw cause;
        throw new Error("the registry could not be reached from the browser");
      });
      if (res.status === 404) throw new Error("no such package there");
      if (!res.ok) throw new Error(`the registry answered ${res.status}`);
      const data = (await res.json()) as { versions?: Record<string, unknown> };
      const found = sortDescending(Object.keys(data.versions ?? {}));
      if (!found.length) throw new Error("it has no versions");
      // Qualify each version with its context (source and name), so a scoped
      // range like `npm:react@^18.0.0` resolves against them as a contextual set.
      const qualified = found.map((v) => `npm:${wanted}@${v}`);
      const offered = packageExamples(wanted, parseCandidates(qualified));
      setFetched({ pkg: wanted, versions: qualified, examples: offered });
      if (!typed.current && shown.current === "registry" && offered[0]) setRange(offered[0].range);
      try {
        // Remember only a registry the visitor chose, so a later default applies.
        if (base === DEFAULT_REGISTRY) localStorage.removeItem(REGISTRY_KEY);
        else localStorage.setItem(REGISTRY_KEY, base);
      } catch {
        /* storage may be unavailable; non-fatal */
      }
    } catch (cause) {
      if (controller.signal.aborted) return;
      const reason = cause instanceof Error ? cause.message : String(cause);
      setError(`Could not load ${wanted} from ${host(base)}: ${reason}.`);
    } finally {
      if (request.current === controller) setFetching(false);
    }
  };

  // Open on what the address names, before the first paint shows the default.
  useLayoutEffect(() => {
    const shared = readQuery(window.location.search);
    let saved = DEFAULT_REGISTRY;
    try {
      saved = localStorage.getItem(REGISTRY_KEY) || DEFAULT_REGISTRY;
    } catch {
      /* storage may be unavailable; non-fatal */
    }
    setOrigin(saved);
    if (shared.range !== undefined) {
      // A link's range is its sender's own, unless it is one the page offers anyway.
      typed.current = !!shared.pkg || !EXAMPLES.includes(shared.range);
      setRange(shared.range);
    }
    if (shared.pkg) {
      shown.current = "registry";
      setSource("registry");
      setPkg(shared.pkg);
      void load(shared.pkg, saved);
    } else if (shared.versions) {
      setSource("custom");
      setCustom(shared.versions.join("\n"));
    } else if (shared.set) {
      setSource(shared.set);
      if (shared.range === undefined) setRange(SAMPLE_SETS[shared.set].start);
    }
    setReady(true);
    return () => request.current?.abort();
    // Read once, on arrival.
  }, []);

  useEffect(() => {
    shown.current = source;
  }, [source]);

  // Keep the address on what is on screen. The page as it first loads has none.
  useEffect(() => {
    // A package still on its way keeps the address it was asked for by.
    if (!ready || fetching) return;
    const timer = setTimeout(() => {
      // A link opens a source on the range it starts from, so only another range needs saying.
      const start =
        source === "registry"
          ? fetched?.examples[0]?.range
          : source === "custom"
            ? undefined
            : SAMPLE_SETS[source].start;
      const query = writeQuery({
        range: range === (start ?? START) && (source !== "custom" || !versions.length) ? undefined : range,
        set: source !== "registry" && source !== "custom" && source !== "mixed" ? source : undefined,
        pkg: source === "registry" ? fetched?.pkg : undefined,
        versions: source === "custom" ? [...versions] : undefined,
      });
      if (query === window.location.search) return;
      const { pathname, hash } = window.location;
      window.history.replaceState(window.history.state, "", `${pathname}${query}${hash}`);
    }, 250);
    return () => clearTimeout(timer);
  }, [ready, fetching, range, source, fetched, versions]);

  const rows = candidates.map((c, i) => ({ ...c, i, status: result.statuses[i] ?? "miss" }));
  const listed = matchesOnly ? rows.filter((r) => r.status === "match") : rows;
  const showAll = expanded === versions;
  const visible = showAll ? listed : listed.slice(0, PREVIEW_ROWS);
  // How many rows the first of two columns holds; zero when the list is one column.
  const column =
    visible.length >= TWO_COLUMNS.from &&
    visible.length <= TWO_COLUMNS.to &&
    visible.every((row) => row.raw.length <= TWO_COLUMNS.characters)
      ? Math.ceil(visible.length / 2)
      : 0;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    void load(pkg, origin);
  };

  const sizes: Partial<Record<Source, number>> = {
    registry: fetched?.versions.length,
    custom: source === "custom" ? versions.length : parseVersionList(custom).length,
  };

  return (
    <section className="try" aria-label="Range selector">
      <div className="try-bench">
        <div className="try-range">
          <div className="try-range-row">
            <label className="try-label" htmlFor="range">
              Range
            </label>{" "}
            <output className={`try-count${result.matched ? "" : " none"}`} htmlFor="range">
              <span className="try-dot" aria-hidden="true" />
              {result.total ? (
                <span>
                  <b>{count(result.matched)}</b> of <b>{count(result.total)}</b>{" "}
                  {result.matched === 1 ? "matches" : "match"}
                </span>
              ) : (
                <span>No versions</span>
              )}
            </output>
          </div>
          <input
            className="try-input"
            id="range"
            type="text"
            value={range}
            onChange={(e) => {
              typed.current = true;
              setRange(e.target.value);
            }}
            placeholder={START}
            spellCheck={false}
            autoComplete="off"
            autoCapitalize="off"
            autoCorrect="off"
            aria-invalid={!result.valid}
            aria-describedby="range-desugared"
          />
          <div className="try-range-row">
            <p className={`try-desugar${result.valid ? "" : " bad"}`} id="range-desugared">
              {result.valid ? (
                <>
                  {/* The range in words: a field has no text in the page's Markdown twin, and this
                      line is how a screen reader describes the field. */}
                  <span className="sr-only">{tested.trim() || "*"} </span>
                  <span className="try-desugar-label">desugars to</span>{" "}
                  <span className="try-desugar-sets">
                    {result.sets.map((set, i) => (
                      <span key={i}>
                        {i > 0 && <span className="op">|| </span>}
                        {i === 0 && result.context && <span className="ctx">{result.context}@</span>}
                        <Comparators set={set} />
                      </span>
                    ))}
                  </span>
                </>
              ) : (
                "Not a valid range"
              )}
            </p>
            <label className="try-toggle" data-affordances-md="skip">
              <input type="checkbox" checked={matchesOnly} onChange={(e) => setMatchesOnly(e.target.checked)} /> Matches
              only
            </label>
          </div>
        </div>

        <div className="try-examples" role="group" aria-label="Example ranges">
          {examples.map((example) => (
            <button
              className={`chip${example.range === range.trim() ? " active" : ""}`}
              type="button"
              key={example.range}
              title={example.gloss}
              aria-pressed={example.range === range.trim()}
              onClick={() => offer(example.range)}
            >
              {example.range}
            </button>
          ))}
        </div>

        <div className="try-body">
          <div className="try-side">
            <p className="try-label" id="try-versions">
              Versions
            </p>
            <div className="try-sources" role="radiogroup" aria-labelledby="try-versions" data-affordances-md="skip">
              {SOURCES.map(({ id, label }) => {
                const size = id === "registry" || id === "custom" ? sizes[id] : SAMPLE_SETS[id].versions.length;
                return (
                  <label className="try-source" key={id}>
                    <input type="radio" name="try-source" checked={source === id} onChange={() => choose(id)} />
                    <span>{label}</span>
                    {size ? <span className="try-source-size">{count(size)}</span> : null}
                  </label>
                );
              })}
            </div>

            <div className="try-about">
              {source === "registry" ? (
                <>
                  <form className="try-fetch" onSubmit={submit}>
                    <input
                      className="try-field"
                      id="pkg"
                      ref={pkgInput}
                      type="text"
                      value={pkg}
                      onChange={(e) => setPkg(e.target.value)}
                      placeholder="e.g. react"
                      aria-label="Package name"
                      spellCheck={false}
                      autoComplete="off"
                      autoCapitalize="off"
                      autoCorrect="off"
                    />
                    <button className="btn btn-primary" type="submit" disabled={fetching}>
                      {fetching ? "Fetching" : "Fetch"}
                    </button>
                    {editOrigin && (
                      <input
                        className="try-field try-origin-field"
                        id="registry"
                        type="text"
                        value={origin}
                        onChange={(e) => setOrigin(e.target.value)}
                        placeholder={DEFAULT_REGISTRY}
                        aria-label="Registry origin"
                        spellCheck={false}
                        autoComplete="off"
                        autoCapitalize="off"
                        autoCorrect="off"
                      />
                    )}
                  </form>
                  {editOrigin ? (
                    <p>Any npm-compatible registry your browser can reach.</p>
                  ) : (
                    <p>
                      From <code>{host(origin)}</code>{" "}
                      <button className="try-link" type="button" onClick={() => setEditOrigin(true)}>
                        Change
                      </button>
                    </p>
                  )}
                  {error && (
                    <p className="try-error" role="alert">
                      {error}
                    </p>
                  )}
                </>
              ) : source === "custom" ? (
                <>
                  <textarea
                    className="try-field"
                    id="versions"
                    value={custom}
                    onChange={(e) => setCustom(e.target.value)}
                    placeholder={"1.0.0\n1.1.0\n2.0.0-rc.1"}
                    aria-label="Your versions"
                    spellCheck={false}
                    autoComplete="off"
                    autoCapitalize="off"
                    autoCorrect="off"
                  />
                  <p>One per line, or separated by commas.</p>
                </>
              ) : (
                <>
                  <p>{SAMPLE_SETS[source].note}</p>
                  <p>
                    <a href={SAMPLE_SETS[source].spec.href}>{SAMPLE_SETS[source].spec.label} in the spec</a>
                  </p>
                </>
              )}
            </div>
          </div>

          <div className="try-results">
            {visible.length ? (
              <ol
                className={`try-list${column ? " short" : ""}`}
                style={column ? ({ "--rows": column } as CSSProperties) : undefined}
              >
                {visible.map((row, n) => {
                  const why = WHY[row.status];
                  const edge = !column ? "" : n === column - 1 ? " foot" : n === column ? " head" : "";
                  return (
                    <li className={`try-row ${row.status}${edge}`} key={row.i}>
                      <span className="try-mark" aria-hidden="true">
                        ✓
                      </span>
                      <span className="try-version">
                        {row.context && <span className="ctx">{row.context}@</span>}
                        {row.rest}
                      </span>{" "}
                      {row.status === "match" && <span className="sr-only">matches</span>}
                      {why && (
                        <span className="try-why" title={why.title}>
                          {why.label}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ol>
            ) : (
              <p className="try-empty">
                {rows.length
                  ? "No versions match this range."
                  : source === "registry"
                    ? fetching
                      ? "Fetching versions"
                      : "Fetch a package to test its versions."
                    : "Add some versions to test."}
              </p>
            )}
            {listed.length > PREVIEW_ROWS && (
              <button
                className="btn btn-ghost try-more"
                type="button"
                onClick={() => setExpanded(showAll ? null : versions)}
              >
                {showAll ? `Show the first ${PREVIEW_ROWS}` : `Show all ${count(listed.length)}`}
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
