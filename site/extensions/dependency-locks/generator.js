// Live Dependency Lock generator. Reveal + copy behaviour is handled by the
// shared shell (/src/shell.js); this module only wires the in-browser generator.
// The heavy codec/resolver modules are imported on demand so the rest of the
// page (and the build) stay light.

const escapeHtml = (s) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );

function shortIntegrity(sri) {
  const tok = String(sri).trim().split(/\s+/)[0];
  const dash = tok.indexOf("-");
  if (dash < 0) return tok;
  return `${tok.slice(0, dash)}-${tok.slice(dash + 1, dash + 13)}…`;
}

function condBrackets(n) {
  const p = [];
  if (n.os) p.push(`os=${[].concat(n.os).join(",")}`);
  if (n.cpu) p.push(`cpu=${[].concat(n.cpu).join(",")}`);
  if (n.libc) p.push(`libc=${[].concat(n.libc).join(",")}`);
  if (n.engines) p.push(`engines=${n.engines}`);
  return p.length ? ` [${p.join(" ")}]` : "";
}

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

  let lastGraph = null;

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
        `${graph.name}@${graph.version} declares no registry dependencies, so the lock just pins the package itself (there's no subgraph to capture).`,
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
