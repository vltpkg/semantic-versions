// Pure client-side range selector. Everything here runs against the reference
// `semantic-versions` parser — the same code a compliant library would use.
import { Range, Version, validRange, splitReference } from "semantic-versions";

// Curated sample sets. Public registries never publish build metadata and rarely
// expose long pre-release trains, so these hand-built sets are how you actually
// exercise the parts of the grammar that make Semantic Versions different.
const SAMPLE_SETS = {
  mixed: {
    label: "Mixed",
    note: "A little of everything: releases, a pre-release and one build.",
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
  },
  prerelease: {
    label: "Release train",
    note: "A full pre-release train. Pre-releases opt in through the range itself. Try ^1.0.0-rc (the rc channel only), ^1.0.0-* (any pre-release of 1.0.0), or *-* (every pre-release). A plain ^1.0.0 stays stable-only.",
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
  },
  build: {
    label: "Build variants",
    note: "Platform, arch and hash builds of the same release. Build metadata is a channel filter here. Try ^1.0.0+win (the win channel), >=1.1.0+linux.x64, or 1.0.0+linux.x64 (exact). A build-less range like ^1.0.0 includes every variant.",
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
  },
  contexts: {
    label: "Contexts",
    note: "Two identities that share version numbers. A bare range like ^1.0.0 matches across both. A scoped range like npm:react@^1.0.0 forms a Contextual Set: only npm:react versions qualify, cargo:serde falls outside it.",
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
  },
};

const DEFAULT_SET = "mixed";

// Example ranges chosen to actually resolve meaningfully against the sample sets:
// pre-release trains, exact build pins and build-variant comparators included.
const EXAMPLES = [
  "^1.2.3",
  "~>1.2",
  "1.2.x",
  "1.0.0 - 2.0.0",
  "^1.0.0-rc",
  "^1.0.0-*",
  "*-*",
  "^1.0.0+win",
  ">=1.1.0+linux.x64",
  "1.0.0+linux.x64",
  "npm:react@^1.0.0",
  "*",
];

/**
 * Wires the page once its elements exist and returns a function that
 * detaches every listener again.
 */
export function mount() {
  const controller = new AbortController();
  const on = (el, type, fn) => el.addEventListener(type, fn, { signal: controller.signal });
  const $ = (id) => document.getElementById(id);
  const rangeInput = $("range");
  const versionsInput = $("versions");
  const echoEl = $("echo");
  const desugarEl = $("desugar");
  const summaryEl = $("summary");
  const resultsEl = $("results");
  const moreEl = $("results-more");
  const matchesOnlyInput = $("matches-only");
  const examplesEl = $("examples");
  const samplesEl = $("samples");
  const sampleNoteEl = $("sample-note");
  const pkgInput = $("pkg");
  const registryInput = $("registry");

  const esc = (s) =>
    String(s).replace(
      /[&<>"']/g,
      (c) =>
        ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
    );

  function parseVersionList(text) {
    return text
      .split(/[\s,]+/)
      .map((v) => v.trim())
      .filter(Boolean);
  }

  // Render one comparator set as readable, operator-highlighted text.
  function renderSet(comps) {
    return comps
      .map((c) => {
        if (!c.value) return '<span class="empty">*</span>';
        const m = c.value.match(/^(<=|>=|<|>|=)?(.*)$/);
        const op = m && m[1] ? `<span class="op">${esc(m[1])}</span>` : "";
        return `${op}${esc(m ? m[2] : c.value)}`;
      })
      .join(" ");
  }

  // A registry lookup can return thousands of versions. Rather than scrolling
  // inside a fixed-height box, the list grows with the page: long lists show the
  // first PREVIEW_ROWS rows and a "Show all" control, and "Matches only" hides
  // the misses.
  const PREVIEW_ROWS = 50;
  const VERSIONS_MAX_PX = 560;
  let showAll = false;
  let lastVersionsText = null;

  const count = (n) => n.toLocaleString("en");

  // Size the versions textarea to its content, up to a cap; past that it scrolls.
  function fitVersions() {
    versionsInput.style.height = "auto";
    versionsInput.style.height = `${Math.min(versionsInput.scrollHeight + 2, VERSIONS_MAX_PX)}px`;
  }

  function render() {
    const rangeStr = rangeInput.value.trim();
    const versions = parseVersionList(versionsInput.value);
    if (versionsInput.value !== lastVersionsText) {
      lastVersionsText = versionsInput.value;
      showAll = false;
      fitVersions();
    }

    let range = null;
    let invalidRange = false;
    try {
      range = new Range(rangeStr);
    } catch {
      invalidRange = true;
    }

    // A context on the range scopes it to a Contextual Set (see below).
    const rangeContext = invalidRange ? null : range.context;

    // Range echo + desugared comparators.
    if (invalidRange) {
      echoEl.className = "range-echo invalid";
      echoEl.innerHTML = `<b>Invalid range.</b> Nothing to match.`;
      desugarEl.innerHTML = '<span class="empty">—</span>';
    } else {
      const canonical = validRange(rangeStr) || "*";
      const shown = rangeContext ? `${rangeContext}@${canonical}` : canonical;
      echoEl.className = "range-echo";
      echoEl.innerHTML =
        `<b>${esc(rangeStr || "*")}</b> desugars to <b>${esc(shown)}</b>` +
        (rangeContext
          ? ` <span class="echo-scope">scoped to <b>${esc(rangeContext)}</b></span>`
          : "");
      desugarEl.innerHTML = range.set
        .map((comps) => renderSet(comps))
        .join('<br /><span class="op">||</span> ');
    }

    // Per-version results.
    let matched = 0;
    let valid = 0;
    let contextMiss = 0;
    const rows = versions.map((raw) => {
      let version;
      try {
        version = new Version(raw);
      } catch {
        return { ok: false, html: `<div class="vrow invalid"><span class="vmark">?</span><span class="vver">${esc(raw)}</span><span class="vnote">invalid version</span></div>` };
      }
      valid++;
      const { context, rest } = splitReference(raw);
      const label = context
        ? `<span class="vver"><span class="vctx">${esc(context)}@</span>${esc(rest)}</span>`
        : `<span class="vver">${esc(raw)}</span>`;

      // A context-scoped range admits only versions that share its context. A
      // version of a different context (or none) is outside the set regardless of
      // its number — shown distinctly from an ordinary numeric miss.
      if (rangeContext && version.context !== rangeContext) {
        contextMiss++;
        return { ok: false, html: `<div class="vrow context-miss"><span class="vmark">≠</span>${label}<span class="vnote">other context</span></div>` };
      }

      const ok = !invalidRange && range.test(version);
      if (ok) matched++;
      const cls = ok ? "match" : "nomatch";
      const mark = ok ? "✓" : "";
      return { ok, html: `<div class="vrow ${cls}"><span class="vmark">${mark}</span>${label}</div>` };
    });

    const matchesOnly = matchesOnlyInput.checked;
    const shown = matchesOnly ? rows.filter((r) => r.ok) : rows;
    const limit = showAll ? shown.length : Math.min(shown.length, PREVIEW_ROWS);
    const noun = matchesOnly ? "matches" : "versions";
    if (!rows.length) {
      resultsEl.innerHTML =
        '<div class="vrow invalid"><span class="vmark">?</span><span class="vver">Add some versions on the left.</span></div>';
    } else if (!shown.length) {
      resultsEl.innerHTML =
        '<div class="vrow nomatch"><span class="vmark"></span><span class="vver">No versions match this range.</span></div>';
    } else {
      resultsEl.innerHTML = shown.slice(0, limit).map((r) => r.html).join("");
    }
    if (limit < shown.length) {
      moreEl.innerHTML = `<button class="btn btn-ghost" type="button" data-more="all">Show all ${count(shown.length)} ${noun} <span class="vlist-more-n">${count(shown.length - limit)} more</span></button>`;
    } else if (showAll && shown.length > PREVIEW_ROWS) {
      moreEl.innerHTML = `<button class="btn btn-ghost" type="button" data-more="less">Show the first ${PREVIEW_ROWS}</button>`;
    } else {
      moreEl.innerHTML = "";
    }

    // Whether the range itself admits any pre-release, and how: a declared channel
    // (a comparator carrying a pre-release, or an `X.Y.Z-*` tuple wildcard) or the
    // universal `*-*`. This is range-driven — there is no separate toggle. A bare
    // `<` ceiling like `<2.0.0-0` carries a `-0` only to exclude a whole tuple, so
    // it is not itself a pre-release opt-in.
    const admitsPre =
      !invalidRange &&
      range.set.some(
        (s) =>
          s.universalPre ||
          (s.anyPreTuples && s.anyPreTuples.size) ||
          s.some((c) => c.isPre && c.operator !== "<"),
      );

    summaryEl.innerHTML = [
      `<span><b>${count(matched)}</b> of <b>${count(valid)}</b> match</span>`,
      contextMiss > 0
        ? `<span><b>${contextMiss}</b> other context</span>`
        : "",
      versions.length - valid > 0
        ? `<span><b>${versions.length - valid}</b> invalid</span>`
        : "",
      `<span>pre-releases <b>${admitsPre ? "via channel" : "excluded"}</b></span>`,
    ]
      .filter(Boolean)
      .join("");
  }

  function mountExamples() {
    examplesEl.innerHTML = EXAMPLES.map(
      (e) => `<button class="chip" type="button" data-range="${esc(e)}">${esc(e)}</button>`,
    ).join("");
    on(examplesEl, "click", (ev) => {
      const btn = ev.target.closest(".chip");
      if (!btn) return;
      rangeInput.value = btn.dataset.range;
      render();
    });
  }

  function loadSample(key) {
    const set = SAMPLE_SETS[key];
    if (!set) return;
    versionsInput.value = set.versions.join("\n");
    if (sampleNoteEl) sampleNoteEl.textContent = set.note || "";
    samplesEl.querySelectorAll(".chip").forEach((el) => {
      el.classList.toggle("active", el.dataset.sample === key);
    });
    render();
  }

  function mountSamples() {
    samplesEl.innerHTML =
      '<span class="chips-lead">Sample sets</span>' +
      Object.entries(SAMPLE_SETS)
        .map(
          ([key, s]) =>
            `<button class="chip" type="button" data-sample="${esc(key)}">${esc(s.label)}</button>`,
        )
        .join("");
    on(samplesEl, "click", (ev) => {
      const btn = ev.target.closest(".chip");
      if (!btn) return;
      loadSample(btn.dataset.sample);
    });
  }

  async function loadFromNpm() {
    const pkg = pkgInput.value.trim();
    if (!pkg) {
      pkgInput.focus();
      return;
    }
    const origin = normalizeOrigin(registryInput.value);
    const btn = $("load-npm");
    const prev = btn.textContent;
    btn.disabled = true;
    btn.textContent = "Fetching…";
    try {
      // npm-compatible packument endpoint. Scoped names are URL-encoded per the
      // registry convention ("@scope/name" -> "@scope%2fname").
      const url = `${origin}/${encodeURIComponent(pkg).replace(/^%40/, "@").replace(/%2[fF]/g, "%2f")}`;
      const res = await fetch(url, {
        // Abbreviated ("corgi") packument: install-relevant fields only, much smaller.
        headers: { Accept: "application/vnd.npm.install-v1+json" },
      });
      if (res.status === 404) throw new Error("package not found on this origin");
      if (!res.ok) throw new Error(`registry responded ${res.status}`);
      const data = await res.json();
      const versions = sortDescending(Object.keys(data.versions || {}));
      if (!versions.length) throw new Error("no versions found");
      // Qualify each version with its context (source + name), so a scoped range
      // like `npm:react@^18.0.0` resolves against them as a Contextual Set.
      const context = `npm:${pkg}`;
      versionsInput.value = versions.map((v) => `${context}@${v}`).join("\n");
      samplesEl.querySelectorAll(".chip.active").forEach((el) => el.classList.remove("active"));
      if (sampleNoteEl) {
        sampleNoteEl.textContent =
          `Loaded from the registry, qualified as ${context}. Scope a range to it (e.g. ${context}@^1.0.0) to see a Contextual Set. Public registries don't publish build metadata, so use the Build variants sample for build-scoped selection.`;
      }
      try {
        // Remember only a registry the visitor chose, so a later default applies.
        if (origin === DEFAULT_REGISTRY) localStorage.removeItem("semver-xyz.registry");
        else localStorage.setItem("semver-xyz.registry", origin);
      } catch {
        /* storage may be unavailable; non-fatal */
      }
      render();
    } catch (err) {
      echoEl.className = "range-echo invalid";
      echoEl.innerHTML = `<b>Could not load ${esc(pkg)} from ${esc(origin)}:</b> ${esc(err.message)}`;
    } finally {
      btn.disabled = false;
      btn.textContent = prev;
    }
  }

  // vlt's public mirror of the npm registry: same packuments, served with CORS.
  const DEFAULT_REGISTRY = "https://registry.vlt.io/upstream/npm";
  // The previous default. A saved origin equal to it was never a real choice.
  const PREVIOUS_DEFAULT = "https://registry.npmjs.org";

  function normalizeOrigin(value) {
    const trimmed = (value || "").trim().replace(/\/+$/, "");
    return trimmed || DEFAULT_REGISTRY;
  }

  // Newest first, using the reference parser's precedence. Anything the parser
  // can't compare is kept in place rather than dropped.
  function sortDescending(versions) {
    return versions.slice().sort((a, b) => {
      try {
        return new Version(b).compare(new Version(a));
      } catch {
        return 0;
      }
    });
  }

  function init() {
    mountExamples();
    mountSamples();
    loadSample(DEFAULT_SET);

    try {
      const saved = localStorage.getItem("semver-xyz.registry");
      if (saved && saved !== PREVIOUS_DEFAULT) registryInput.value = saved;
      else registryInput.value = DEFAULT_REGISTRY;
    } catch {
      /* storage may be unavailable; non-fatal */
    }

    on(rangeInput, "input", render);
    on(matchesOnlyInput, "change", render);
    on(moreEl, "click", (ev) => {
      const btn = ev.target.closest("[data-more]");
      if (!btn) return;
      showAll = btn.dataset.more === "all";
      render();
      // Collapsing shortens the page; bring the list back into view.
      if (!showAll) summaryEl.scrollIntoView({ block: "nearest" });
    });
    on(versionsInput, "input", () => {
      // Manual edits detach from any preset sample.
      samplesEl.querySelectorAll(".chip.active").forEach((el) => el.classList.remove("active"));
      if (sampleNoteEl) sampleNoteEl.textContent = "";
      render();
    });
    on($("load-npm"), "click", loadFromNpm);
    const submitOnEnter = (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        loadFromNpm();
      }
    };
    on(pkgInput, "keydown", submitOnEnter);
    on(registryInput, "keydown", submitOnEnter);
    on($("reset"), "click", () => {
      rangeInput.value = "^1.2.3";
      loadSample(DEFAULT_SET);
    });
    render();
  }

  init();
  return () => controller.abort();
}

