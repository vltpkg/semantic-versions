// Live Package Integrity computer. Pulls a package's published integrity from an
// npm-compatible registry, transcodes the SRI digest into a build-metadata-safe
// specifier (hex + Base62), and can re-download the artifact to verify the bytes
// with the Web Crypto API — all client-side.
import basex from "base-x";

const BASE62 = basex(
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz",
);

const SUBTLE_ALG = { sha256: "SHA-256", sha384: "SHA-384", sha512: "SHA-512" };

const $ = (id) => document.getElementById(id);
const registryInput = $("registry");
const pkgInput = $("pkg");
const echoEl = $("echo");
const resultEl = $("result");
const identityEl = $("identity");
const digestsEl = $("digests");
const verifyOut = $("verify-out");
const tarballNote = $("tarball-note");

const esc = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );

const toHex = (bytes) =>
  Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

function base64ToBytes(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function normalizeOrigin(value) {
  return (value || "").trim().replace(/\/+$/, "") || "https://registry.npmjs.org";
}

// Split "name", "name@version", "@scope/name" or "@scope/name@version".
function parseSpec(input) {
  const s = input.trim().replace(/^npm:/, "");
  const at = s.lastIndexOf("@");
  if (at > 0) {
    return { name: s.slice(0, at), version: s.slice(at + 1) };
  }
  return { name: s, version: null };
}

// Parse an npm SRI string ("sha512-<b64> sha256-<b64>") into digest records.
function parseIntegrity(sri) {
  const records = [];
  for (const token of String(sri).trim().split(/\s+/)) {
    const dash = token.indexOf("-");
    if (dash < 0) continue;
    const algo = token.slice(0, dash);
    if (!SUBTLE_ALG[algo]) continue;
    try {
      const bytes = base64ToBytes(token.slice(dash + 1));
      records.push({ algo, bytes, hex: toHex(bytes), b62: BASE62.encode(bytes) });
    } catch {
      /* skip malformed entry */
    }
  }
  return records;
}

let current = null; // { source, name, version, tarball, records }

function setEcho(html, invalid = false) {
  echoEl.className = `range-echo${invalid ? " invalid" : ""}`;
  echoEl.innerHTML = html;
}

function renderResult() {
  const { name, version, records } = current;
  const hexBuild = records.map((r) => `${r.algo}.${r.hex}`).join(".");
  const primary = `npm:${name}@${version}+${hexBuild}`;

  identityEl.innerHTML =
    `<span class="empty">npm:</span>${esc(name)}<span class="op">@</span>${esc(version)}` +
    `<span class="op">+</span>${records
      .map((r) => `${esc(r.algo)}<span class="op">.</span>${esc(r.hex)}`)
      .join('<span class="op">.</span>')}`;

  digestsEl.innerHTML = records
    .map((r) => {
      return (
        `<div><span class="op">${esc(r.algo)}</span> · hex &nbsp;${esc(r.hex)}</div>` +
        `<div style="opacity:.75"><span class="op">${esc(r.algo)}</span> · base62 &nbsp;${esc(r.b62)}</div>` +
        `<div style="opacity:.6"><span class="op">${esc(r.algo)}</span> · sri &nbsp;${esc(r.algo)}-${esc(btoa(String.fromCharCode(...r.bytes)))}</div>`
      );
    })
    .join('<br />');

  tarballNote.textContent = current.tarball
    ? "recomputes the hash of the published artifact in your browser"
    : "no tarball URL on this registry";
  verifyOut.innerHTML = "";
  resultEl.hidden = false;
  identityEl.title = primary;
}

async function compute() {
  const origin = normalizeOrigin(registryInput.value);
  const spec = parseSpec(pkgInput.value);
  if (!spec.name) {
    pkgInput.focus();
    return;
  }
  const btn = $("compute-btn");
  const prev = btn.textContent;
  btn.disabled = true;
  btn.textContent = "Computing…";
  resultEl.hidden = true;
  try {
    const url = `${origin}/${encodeURIComponent(spec.name).replace(/^%40/, "@").replace(/%2[fF]/g, "%2f")}`;
    const res = await fetch(url, {
      headers: { Accept: "application/vnd.npm.install-v1+json" },
    });
    if (res.status === 404) throw new Error("package not found on this origin");
    if (!res.ok) throw new Error(`registry responded ${res.status}`);
    const data = await res.json();

    const version = spec.version || (data["dist-tags"] && data["dist-tags"].latest);
    if (!version) throw new Error("could not determine a version");
    const manifest = data.versions && data.versions[version];
    if (!manifest) throw new Error(`version ${version} not found`);
    const dist = manifest.dist || {};
    if (!dist.integrity) throw new Error(`no integrity published for ${version}`);

    const records = parseIntegrity(dist.integrity);
    if (!records.length) throw new Error("no supported digest algorithms found");

    current = { source: "npm", name: spec.name, version, tarball: dist.tarball, records };
    setEcho(`Published integrity for <b>${esc(spec.name)}@${esc(version)}</b> transcoded below.`);
    renderResult();
  } catch (err) {
    setEcho(`<b>Could not compute:</b> ${esc(err.message)}`, true);
  } finally {
    btn.disabled = false;
    btn.textContent = prev;
  }
}

async function verify() {
  if (!current || !current.tarball) return;
  const btn = $("verify-btn");
  const prev = btn.textContent;
  btn.disabled = true;
  btn.textContent = "Downloading…";
  verifyOut.innerHTML = "";
  try {
    const res = await fetch(current.tarball);
    if (!res.ok) throw new Error(`tarball responded ${res.status}`);
    const buf = await res.arrayBuffer();
    const rows = [];
    for (const r of current.records) {
      const digest = new Uint8Array(await crypto.subtle.digest(SUBTLE_ALG[r.algo], buf));
      const ok = toHex(digest) === r.hex;
      rows.push(
        `<div class="vrow ${ok ? "match" : "invalid"}"><span class="vmark">${ok ? "✓" : "✕"}</span>` +
          `<span class="vver">${esc(r.algo)}</span>` +
          `<span class="vnote">${ok ? "matches published digest" : "MISMATCH · reject"}</span></div>`,
      );
    }
    verifyOut.innerHTML = rows.join("");
  } catch (err) {
    verifyOut.innerHTML = `<div class="vrow invalid"><span class="vmark">?</span><span class="vver">Verification unavailable</span><span class="vnote">${esc(err.message)}</span></div>`;
  } finally {
    btn.disabled = false;
    btn.textContent = prev;
  }
}

function init() {
  $("compute-btn").addEventListener("click", compute);
  $("verify-btn").addEventListener("click", verify);
  const onEnter = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      compute();
    }
  };
  pkgInput.addEventListener("keydown", onEnter);
  registryInput.addEventListener("keydown", onEnter);
}

init();
