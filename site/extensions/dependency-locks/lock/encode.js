// Faithful Dependency Lock encoder — format 2 (§4): a compact, columnar binary
// graph → SHA-256 lock digest (§7.2) → codec auto-select (Brotli or none, §5.3)
// → frame byte (§5.2) → Base62 (§5.4).
//
// Format 2 vs. the legacy format 1 (still decodable via the frame byte, §5.7):
//   • columnar layout (name-ids, version components, edges in separate runs) so
//     similar values cluster and Brotli does far better;
//   • structural versions — major/minor/patch as varints, rare prerelease/build
//     tails in a side pool — instead of interned version strings;
//   • edge-name elision — an edge's dependency name equals its target node's
//     name, so it's dropped except on genuinely aliased edges;
//   • front-coded name table (shared-prefix) — scoped names cluster;
//   • no 2-byte magic (the frame byte is the authoritative discriminator);
//   • codec auto-select: tiny graphs ship uncompressed to dodge Brotli overhead.
//
// Two profiles share this layout, picked by header bit 0 (§4.12):
//   • ALL_DEFAULT — every node is default-registry with no integrity/conditions;
//     the source/digest/condition tables and per-node flags are omitted.
//   • non-default — carries optional per-node artifact integrity (DigestTable,
//     §4.6) and platform/runtime conditions (ConditionTable, §4.7: os/cpu/libc/
//     engines), gated by a per-node flags column. Integrity is advisory: the
//     consuming package manager still verifies every artifact independently.
// The root node's identity is retained so the lock still binds to its specifier
// (root-match, §7.4); it costs only a few bytes.
import brotliPromise from "brotli-wasm";
import basex from "base-x";

const BASE62 = basex(
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"
);
const FORMAT = 0x2; // frame byte bits 7..4
const CODEC_BROTLI = 0x0;
const CODEC_NONE = 0x1; // frame byte bits 3..0

const FLAG_ALL_DEFAULT = 0x01; // header flags bit 0: no source/digest/condition tables
const FLAG_HAS_INTEGRITY = 0x02; // node flags bit 1 (§4.8): digest_id present
const FLAG_HAS_CONDITION = 0x04; // node flags bit 2 (§4.8): cond_id present

const TYPE_ENUM = { prod: 0, dev: 1, optional: 2, peer: 3, "peer-opt": 4 };
const EDGE_ALIAS_BIT = 0x80; // high bit of an edge's type byte: carries an alias name

// Digest algorithm enum (§4.6).
const ALGO = { sha256: 1, sha512: 2, sha1: 4 };
const ALGO_PREF = ["sha512", "sha256", "sha1"]; // strongest first

// Condition axis + op enums (§4.7).
const AXIS = { os: 0, cpu: 1, libc: 2, runtime: 3, engines: 4 };
const OP_EQ = 0;
const OP_NEQ = 1;
const OP_IN = 2;
const OP_SEMVER = 3;

const te = new TextEncoder();

function pushUvarint(out, value) {
  let n = value;
  while (n >= 0x80) {
    out.push((n % 128) | 0x80);
    n = Math.floor(n / 128);
  }
  out.push(n);
}

// zigzag so back-edges (negative deltas) stay cheap
function zigzag(n) {
  return n >= 0 ? n * 2 : -n * 2 - 1;
}

function cmpBytes(a, b) {
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    if (a[i] !== b[i]) return a[i] - b[i];
  }
  return a.length - b.length;
}

function b64ToBytes(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function bytesToHex(bytes) {
  let s = "";
  for (const b of bytes) s += b.toString(16).padStart(2, "0");
  return s;
}

// Parse an npm SRI string ("sha512-<b64> [sha256-<b64>]") into the strongest
// supported { algo, bytes }; null when absent/unsupported.
function parseIntegrity(sri) {
  if (!sri) return null;
  let best = null;
  for (const tok of String(sri).trim().split(/\s+/)) {
    const dash = tok.indexOf("-");
    if (dash < 0) continue;
    const algo = tok.slice(0, dash);
    if (!(algo in ALGO)) continue;
    if (!best || ALGO_PREF.indexOf(algo) < ALGO_PREF.indexOf(best.algo)) {
      best = { algo, b64: tok.slice(dash + 1) };
    }
  }
  if (!best) return null;
  return { algo: ALGO[best.algo], bytes: b64ToBytes(best.b64) };
}

// Build a condition predicate for a set-valued axis (os/cpu/libc), honoring
// npm's "!value" negation form.
function setPredicate(axis, values) {
  const list = [].concat(values).filter(Boolean);
  if (!list.length) return null;
  if (list.every((v) => v.startsWith("!"))) {
    return { axis, op: OP_NEQ, value: list.map((v) => v.slice(1)).join(",") };
  }
  const pos = list.filter((v) => !v.startsWith("!"));
  if (pos.length === 1) return { axis, op: OP_EQ, value: pos[0] };
  return { axis, op: OP_IN, value: pos.join(",") };
}

// The conjunction of platform/runtime predicates a node is gated by (empty = none).
function nodeConditionPreds(nd) {
  const preds = [];
  const os = setPredicate(AXIS.os, nd.os || []);
  const cpu = setPredicate(AXIS.cpu, nd.cpu || []);
  const libc = setPredicate(AXIS.libc, nd.libc || []);
  if (os) preds.push(os);
  if (cpu) preds.push(cpu);
  if (libc) preds.push(libc);
  if (nd.engines) preds.push({ axis: AXIS.engines, op: OP_SEMVER, value: nd.engines });
  return preds;
}

// Split a resolved version into structural parts. Returns null parts for the
// (rare) non-semver case, which the caller stashes verbatim in the extra pool.
function splitVersion(version) {
  const m = /^(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/.exec(version);
  if (!m) return { ok: false };
  // tail begins right after "major.minor.patch": "" | "-pre" | "+build" | "-pre+build"
  const coreLen = m[1].length + 1 + m[2].length + 1 + m[3].length;
  return {
    ok: true,
    major: Number(m[1]),
    minor: Number(m[2]),
    patch: Number(m[3]),
    tail: version.slice(coreLen),
  };
}

// Build the canonical format-2 binary blob (§4) from a resolved graph.
export function buildCanonicalBlob(graph) {
  const { nodes, edges, rootIndex } = graph;
  const n = nodes.length;

  // Canonical node order (§7.2): (name-bytes, version-bytes). Assigns node_id.
  const meta = nodes.map((nd, i) => ({
    i,
    name: nd.name,
    version: nd.version,
    nameBytes: te.encode(nd.name),
    verBytes: te.encode(nd.version),
  }));
  const order = [...meta].sort(
    (a, b) =>
      cmpBytes(a.nameBytes, b.nameBytes) || cmpBytes(a.verBytes, b.verBytes)
  );
  const oldToNew = new Array(n);
  order.forEach((m, id) => {
    oldToNew[m.i] = id;
  });
  const rootId = oldToNew[rootIndex];

  // Name table: unique names, canonically sorted, front-coded.
  const names = [...new Set(nodes.map((nd) => nd.name))].sort((a, b) =>
    cmpBytes(te.encode(a), te.encode(b))
  );
  const nameIndex = new Map(names.map((s, i) => [s, i]));

  // Shared string pool for the rare prerelease/build (or non-semver) version
  // tails *and* condition predicate values, referenced by index.
  const extras = new Map();
  const addExtra = (s) => {
    let id = extras.get(s);
    if (id === undefined) {
      id = extras.size;
      extras.set(s, id);
    }
    return id;
  };

  // Per-node version columns.
  const majors = [];
  const minors = [];
  const patches = [];
  const exs = [];
  for (const m of order) {
    const v = splitVersion(m.version);
    if (v.ok) {
      majors.push(v.major);
      minors.push(v.minor);
      patches.push(v.patch);
      exs.push(v.tail ? addExtra(v.tail) + 1 : 0);
    } else {
      majors.push(0);
      minors.push(0);
      patches.push(0);
      exs.push(addExtra("=" + m.version) + 1); // "=" marks a verbatim version
    }
  }

  // Per-node integrity (§4.6). Dedupe digests; sort by (algo, bytes).
  const digestKey = (d) => d.algo + ":" + bytesToHex(d.bytes);
  const digestMap = new Map();
  const nodeDigest = order.map((m) => {
    const d = parseIntegrity(nodes[m.i].integrity);
    if (d) digestMap.set(digestKey(d), d);
    return d;
  });
  const digestList = [...digestMap.values()].sort(
    (a, b) => a.algo - b.algo || cmpBytes(a.bytes, b.bytes)
  );
  const digestId = new Map(digestList.map((d, i) => [digestKey(d), i]));

  // Per-node conditions (§4.7). Set 0 is reserved "always" (the empty set) and
  // exists only when some node carries a condition.
  const nodeCondPreds = order.map((m) => nodeConditionPreds(nodes[m.i]));
  const condSets = [];
  const condMap = new Map();
  const condKey = (preds) =>
    preds.map((p) => `${p.axis},${p.op},${p.value}`).join("|");
  if (nodeCondPreds.some((p) => p.length)) {
    condSets.push([]); // index 0 = always
    condMap.set("", 0);
  }
  const nodeCondId = nodeCondPreds.map((preds) => {
    if (!preds.length) return -1;
    const k = condKey(preds);
    let id = condMap.get(k);
    if (id === undefined) {
      id = condSets.length;
      condSets.push(preds);
      condMap.set(k, id);
    }
    return id;
  });
  // Register condition value strings into the shared pool before it is emitted.
  for (const preds of condSets) for (const p of preds) addExtra(p.value);

  const extraList = [...extras.keys()];

  // Per-node flags; integrity is advisory metadata, conditions gate platform nodes.
  const flags = order.map(
    (m, i) =>
      (nodeDigest[i] ? FLAG_HAS_INTEGRITY : 0) |
      (nodeCondId[i] >= 0 ? FLAG_HAS_CONDITION : 0)
  );
  const allDefault = flags.every((f) => f === 0);

  // Edges grouped by from-node (CSR). Elide the name unless the edge is aliased
  // (its declared dependency name differs from the target node's name).
  const groups = order.map(() => []);
  for (const e of edges) {
    const from = oldToNew[e.from];
    const to = oldToNew[e.to];
    const aliased = e.name && e.name !== nodes[e.to].name;
    groups[from].push({
      to,
      type: TYPE_ENUM[e.type] ?? 0,
      aliasId: aliased ? nameIndex.get(e.name) : -1,
    });
  }
  for (const g of groups) {
    g.sort((a, b) => a.to - b.to || a.type - b.type || a.aliasId - b.aliasId);
  }

  const out = [];

  // Header (§4.3, format 2): no magic; flags; counts; root.
  out.push(allDefault ? FLAG_ALL_DEFAULT : 0x00);
  pushUvarint(out, n);
  pushUvarint(out, edges.length);
  pushUvarint(out, rootId);

  // Name table (front-coded): shared-prefix length, suffix length, suffix bytes.
  pushUvarint(out, names.length);
  let prevName = "";
  for (const s of names) {
    let shared = 0;
    const max = Math.min(prevName.length, s.length);
    while (shared < max && prevName[shared] === s[shared]) shared++;
    const suffix = te.encode(s.slice(shared));
    pushUvarint(out, shared);
    pushUvarint(out, suffix.length);
    for (const b of suffix) out.push(b);
    prevName = s;
  }

  // Extra pool (length-prefixed strings): version tails + condition values.
  pushUvarint(out, extraList.length);
  for (const s of extraList) {
    const b = te.encode(s);
    pushUvarint(out, b.length);
    for (const x of b) out.push(x);
  }

  // Non-default tables (§4.5–4.7) ride here when ALL_DEFAULT is clear.
  if (!allDefault) {
    // Digest table: algo, length-prefixed raw bytes (§4.6).
    pushUvarint(out, digestList.length);
    for (const d of digestList) {
      out.push(d.algo);
      pushUvarint(out, d.bytes.length);
      for (const b of d.bytes) out.push(b);
    }
    // Condition table: per set, a conjunction of (axis, op, value-index) preds.
    pushUvarint(out, condSets.length);
    for (const preds of condSets) {
      pushUvarint(out, preds.length);
      for (const p of preds) {
        out.push(p.axis);
        out.push(p.op);
        pushUvarint(out, extras.get(p.value));
      }
    }
  }

  // Node columns (each of length node_count), in canonical node_id order.
  for (const m of order) pushUvarint(out, nameIndex.get(m.name));
  for (const v of majors) pushUvarint(out, v);
  for (const v of minors) pushUvarint(out, v);
  for (const v of patches) pushUvarint(out, v);
  for (const v of exs) pushUvarint(out, v);

  // Per-node flags column + gated digest_id / cond_id columns (node_id order).
  if (!allDefault) {
    for (const f of flags) out.push(f);
    for (let i = 0; i < n; i++) {
      if (nodeDigest[i]) pushUvarint(out, digestId.get(digestKey(nodeDigest[i])));
    }
    for (let i = 0; i < n; i++) {
      if (nodeCondId[i] >= 0) pushUvarint(out, nodeCondId[i]);
    }
  }

  // Edge section (§4.9, columnar CSR): out-degrees, then targets, then types,
  // then alias name-ids for the flagged edges only.
  for (let f = 0; f < groups.length; f++) pushUvarint(out, groups[f].length);
  for (let f = 0; f < groups.length; f++) {
    let prev = f; // first delta is relative to from_id
    for (const ed of groups[f]) {
      pushUvarint(out, zigzag(ed.to - prev));
      prev = ed.to;
    }
  }
  const aliasIds = [];
  for (let f = 0; f < groups.length; f++) {
    for (const ed of groups[f]) {
      let typeByte = ed.type & 0x7f;
      if (ed.aliasId >= 0) {
        typeByte |= EDGE_ALIAS_BIT;
        aliasIds.push(ed.aliasId);
      }
      out.push(typeByte);
    }
  }
  for (const id of aliasIds) pushUvarint(out, id);

  return {
    blob: Uint8Array.from(out),
    digestCount: digestList.length,
    condCount: allDefault ? 0 : Math.max(0, condSets.length - 1),
    allDefault,
  };
}

// Full pipeline → { payload, digestHex, sizes, codec }.
export async function encodeLock(graph) {
  const { blob, digestCount, condCount } = buildCanonicalBlob(graph);

  // Lock digest (§7.2): SHA-256 over the decompressed canonical blob.
  const digestBuf = await crypto.subtle.digest("SHA-256", blob);
  const digestHex = [...new Uint8Array(digestBuf)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  const brotli = await brotliPromise;
  const compressed = brotli.compress(blob, { quality: 11, lgwin: 24 });

  // Codec auto-select (§5.3): skip Brotli when it doesn't pay off (tiny graphs).
  const useBrotli = compressed.length < blob.length;
  const body = useBrotli ? compressed : blob;
  const codec = useBrotli ? CODEC_BROTLI : CODEC_NONE;

  const frame = new Uint8Array(body.length + 1);
  frame[0] = (FORMAT << 4) | codec;
  frame.set(body, 1);

  const payload = BASE62.encode(frame);

  return {
    payload,
    digestHex,
    blobSize: blob.length,
    bodySize: body.length,
    codec: useBrotli ? "brotli" : "raw",
    payloadLen: payload.length,
    digestCount,
    condCount,
  };
}
