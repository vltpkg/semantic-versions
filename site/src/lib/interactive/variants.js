// Live "variant matrix": a grid of releases × deployment targets, each cell a
// concrete artifact (`version+coordinate`). A build channel typed above selects a
// subset, resolved by the reference `semantic-versions` parser — the same engine
// a compliant tool would use. This is the core Build Channels rule applied to the
// os·arch·abi coordinates the Build Variants extension defines.
import { Range, Version, validRange } from "semantic-versions";

const RELEASES = ["1.0.0", "1.1.0", "1.2.0", "2.0.0"];

// Columns are ordered coarse→fine coordinates. `build: null` is the plain,
// build-less release — included so you can see a channel exclude it.
const VARIANTS = [
  { build: "linux.x64.glibc", label: "linux · x64 · glibc" },
  { build: "linux.x64.musl", label: "linux · x64 · musl" },
  { build: "linux.arm64.glibc", label: "linux · arm64" },
  { build: "darwin.arm64", label: "darwin · arm64" },
  { build: "win32.x64", label: "win32 · x64" },
  { build: null, label: "no build" },
];

const EXAMPLES = [
  "^1.0.0+linux",
  "^1.0.0+linux.x64",
  "^1.0.0+linux.x64.musl",
  ">=1.1.0+darwin.arm64",
  "1.2.0+win32.x64",
  "^1.0.0",
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
  const channelInput = $("channel");
  const examplesEl = $("channel-examples");
  const echoEl = $("echo");
  const summaryEl = $("summary");
  const tableEl = $("matrix-table");
  const legendEl = $("legend");

  const esc = (s) =>
    String(s).replace(
      /[&<>"']/g,
      (c) =>
        ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
    );

  const artifact = (version, build) => (build ? `${version}+${build}` : version);

  function buildTable(testFn) {
    let total = 0;
    let selected = 0;

    const head =
      "<thead><tr><th class='vmx-corner'></th>" +
      VARIANTS.map(
        (v) =>
          `<th class="${v.build ? "" : "vmx-plain"}"><span>${esc(v.label)}</span></th>`,
      ).join("") +
      "</tr></thead>";

    const body =
      "<tbody>" +
      RELEASES.map((ver) => {
        const cells = VARIANTS.map((v) => {
          const spec = artifact(ver, v.build);
          total++;
          const ok = testFn(spec);
          if (ok) selected++;
          const coord = v.build ? v.build : "∅";
          return (
            `<td class="vmx-cell ${ok ? "on" : "off"} ${v.build ? "" : "is-plain"}" title="${esc(spec)}">` +
            `<span class="vmx-coord">${esc(coord)}</span>` +
            `<span class="vmx-check" aria-hidden="true">${ok ? "✓" : ""}</span>` +
            `</td>`
          );
        }).join("");
        return `<tr><th class="vmx-row" scope="row">${esc(ver)}</th>${cells}</tr>`;
      }).join("") +
      "</tbody>";

    tableEl.innerHTML = head + body;
    return { total, selected };
  }

  function render() {
    const value = channelInput.value.trim();

    let range = null;
    let invalid = false;
    try {
      range = new Range(value || "*");
    } catch {
      invalid = true;
    }

    if (invalid) {
      echoEl.className = "range-echo invalid";
      echoEl.innerHTML = "<b>Invalid channel.</b> Nothing selected.";
    } else {
      const canonical = validRange(value) || "*";
      echoEl.className = "range-echo";
      echoEl.innerHTML = `<b>${esc(value || "*")}</b> desugars to <b>${esc(canonical)}</b>`;
    }

    const testFn = (spec) => {
      if (invalid) return false;
      try {
        return range.test(new Version(spec));
      } catch {
        return false;
      }
    };

    const { total, selected } = buildTable(testFn);

    summaryEl.innerHTML = `<b>${selected}</b> of <b>${total}</b> artifacts selected`;
    legendEl.textContent = selected
      ? "Green cells are in the selected subset. A shorter channel selects a broader subset; a build-less range (^1.0.0, *) also selects the plain release."
      : "No artifacts match this channel. Try a broader one, e.g. ^1.0.0+linux.";
  }

  function mountExamples() {
    examplesEl.innerHTML = EXAMPLES.map(
      (e) =>
        `<button class="chip" type="button" data-channel="${esc(e)}">${esc(e)}</button>`,
    ).join("");
    on(examplesEl, "click", (ev) => {
      const btn = ev.target.closest(".chip");
      if (!btn) return;
      channelInput.value = btn.dataset.channel;
      syncActive();
      render();
    });
  }

  function syncActive() {
    const cur = channelInput.value.trim();
    examplesEl.querySelectorAll(".chip").forEach((el) => {
      el.classList.toggle("active", el.dataset.channel === cur);
    });
  }

  function init() {
    mountExamples();
    on(channelInput, "input", () => {
      syncActive();
      render();
    });
    syncActive();
    render();
  }

  init();
  return () => controller.abort();
}

