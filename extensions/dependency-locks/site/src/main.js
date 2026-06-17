// Scroll-reveal: fade sections in as they enter the viewport.
const io = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        entry.target.classList.add("in");
        io.unobserve(entry.target);
      }
    }
  },
  { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
);
document.querySelectorAll(".reveal").forEach((el) => io.observe(el));

// Copy buttons: copy the code text from each code window.
document.querySelectorAll("[data-copy]").forEach((win) => {
  const btn = win.querySelector(".copy-btn");
  const code = win.querySelector("code");
  if (!btn || !code) return;
  btn.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(code.innerText.trim());
      const prev = btn.textContent;
      btn.textContent = "Copied";
      btn.classList.add("copied");
      setTimeout(() => {
        btn.textContent = prev;
        btn.classList.remove("copied");
      }, 1400);
    } catch {
      btn.textContent = "Press ⌘C";
    }
  });
});

// ─────────────────────── Live lock generator ───────────────────────
const escapeHtml = (s) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]
  );

// Truncate an SRI string for the decoded preview ("sha512-<b64>" → "sha512-abc…").
function shortIntegrity(sri) {
  const tok = String(sri).trim().split(/\s+/)[0];
  const dash = tok.indexOf("-");
  if (dash < 0) return tok;
  return `${tok.slice(0, dash)}-${tok.slice(dash + 1, dash + 13)}…`;
}

// Platform/runtime conditions a node is gated by, as bracket annotations.
function condBrackets(n) {
  const p = [];
  if (n.os) p.push(`os=${[].concat(n.os).join(",")}`);
  if (n.cpu) p.push(`cpu=${[].concat(n.cpu).join(",")}`);
  if (n.libc) p.push(`libc=${[].concat(n.libc).join(",")}`);
  if (n.engines) p.push(`engines=${n.engines}`);
  return p.length ? ` [${p.join(" ")}]` : "";
}

// Decoded view: a compact INI-style rendering. Each node is one origin-qualified
// id (e.g. npm:debug@4.4.3), optionally with #integrity and [platform] conditions;
// edges are "from -> to = type". This is a presentation of the same graph the
// binary blob encodes, not the wire format itself.
function buildDecodedText(graph) {
  const NODE_LIMIT = 24;
  const EDGE_LIMIT = 24;
  const { nodes, edges, rootIndex } = graph;
  const lines = ["format = 2", `root = ${rootIndex}`, "", "[nodes]"];

  const shownNodes = nodes.slice(0, NODE_LIMIT);
  shownNodes.forEach((n, i) => {
    const integ = n.integrity ? `#${shortIntegrity(n.integrity)}` : "";
    lines.push(`${i} = npm:${n.name}@${n.version}${integ}${condBrackets(n)}`);
  });
  if (nodes.length > NODE_LIMIT) {
    lines.push(`; + ${nodes.length - NODE_LIMIT} more nodes`);
  }

  lines.push("", "[edges]");
  const shownEdges = edges.slice(0, EDGE_LIMIT);
  shownEdges.forEach((e) => {
    // Edge name normally equals the target's package name; show it only when aliased.
    const alias = e.name && e.name !== nodes[e.to].name ? ` (${e.name})` : "";
    lines.push(`${e.from} -> ${e.to} = ${e.type}${alias}`);
  });
  if (edges.length > EDGE_LIMIT) {
    lines.push(`; + ${edges.length - EDGE_LIMIT} more edges`);
  }
  return lines.join("\n");
}

const genForm = document.getElementById("gen-form");
if (genForm) {
  const input = document.getElementById("gen-input");
  const genBtn = document.getElementById("gen-btn");
  const statusEl = document.getElementById("gen-status");
  const resultEl = document.getElementById("gen-result");
  const payloadEl = document.getElementById("gen-payload");
  const decodedEl = document.getElementById("gen-decoded");
  const metaEl = document.getElementById("gen-meta");
  const titleEl = document.getElementById("gen-title");
  const warnEl = document.getElementById("gen-warnings");
  const integrityToggle = document.getElementById("gen-integrity");

  const setStatus = (text, isError = false) => {
    statusEl.textContent = text;
    statusEl.classList.toggle("gen-error", isError);
    statusEl.hidden = false;
  };

  let lastGraph = null; // cache the resolved graph so the toggle re-encodes only

  // Encode + render a resolved graph. Integrity is dropped before encoding when
  // the toggle is off, so its (incompressible) bytes leave the payload entirely.
  const render = async (graph) => {
    const { encodeLock } = await import("./lock/encode.js");
    const withIntegrity = !integrityToggle || integrityToggle.checked;
    const g = withIntegrity
      ? graph
      : { ...graph, nodes: graph.nodes.map(({ integrity, ...rest }) => rest) };

    setStatus(`Encoding ${graph.nodes.length} packages…`);
    const enc = await encodeLock(g);

    titleEl.textContent = `npm:${graph.name}@${graph.version}`;
    payloadEl.textContent = `npm:${graph.name}@${graph.version}+lock.${enc.payload}`;
    decodedEl.textContent = buildDecodedText(g);

    metaEl.innerHTML = [
      `<span><b>${graph.nodes.length}</b> nodes</span>`,
      `<span><b>${graph.edges.length}</b> edges</span>`,
      withIntegrity
        ? `<span>integrity <b>${enc.digestCount}</b></span>`
        : `<span>integrity <b>off</b></span>`,
      enc.condCount ? `<span>conds <b>${enc.condCount}</b></span>` : "",
      `<span>${enc.codec} <b>${enc.bodySize}</b> B</span>`,
      `<span>payload <b>${enc.payloadLen}</b> chars</span>`,
      `<span>digest <b title="sha256:${enc.digestHex}">sha256:${enc.digestHex.slice(0, 12)}…</b></span>`,
    ]
      .filter(Boolean)
      .join("");

    const notes = [...graph.warnings];
    if (graph.edges.length === 0) {
      notes.unshift(
        `${graph.name}@${graph.version} declares no registry dependencies — the lock just pins the package itself (there's no subgraph to capture).`
      );
    }
    if (notes.length) {
      const shown = notes.slice(0, 12);
      warnEl.innerHTML =
        `<strong>${notes.length} note${notes.length > 1 ? "s" : ""}</strong>` +
        `<ul>${shown.map((w) => `<li>${escapeHtml(w)}</li>`).join("")}` +
        (notes.length > 12 ? `<li>+ ${notes.length - 12} more</li>` : "") +
        `</ul>`;
      warnEl.hidden = false;
    } else {
      warnEl.hidden = true;
    }

    statusEl.hidden = true;
    resultEl.hidden = false;
  };

  genForm.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const value = input.value.trim();
    if (!value) return;

    genBtn.disabled = true;
    resultEl.hidden = true;
    setStatus(`Resolving ${value}…`);

    try {
      const { resolveGraph } = await import("./lock/resolver.js");
      lastGraph = await resolveGraph(value, {
        onProgress: (n) => setStatus(`Resolving ${value}… ${n} packages`),
      });
      await render(lastGraph);
    } catch (err) {
      setStatus(`Error: ${err.message}`, true);
    } finally {
      genBtn.disabled = false;
    }
  });

  // Flipping integrity re-encodes the already-resolved graph (no refetch).
  if (integrityToggle) {
    integrityToggle.addEventListener("change", async () => {
      if (!lastGraph) return;
      try {
        await render(lastGraph);
      } catch (err) {
        setStatus(`Error: ${err.message}`, true);
      }
    });
  }
}
