// In-browser npm subgraph resolver. Walks the public registry's CORS-enabled
// packument API and builds a vlt-style node/edge graph. Registry sources only —
// git/file/workspace/tarball specifiers are skipped and reported.
import semver from "semver";

const REGISTRY = "https://registry.npmjs.org";
// Abbreviated ("corgi") packument: only install-relevant fields, much smaller.
const ACCEPT = "application/vnd.npm.install-v1+json";

function fetchPackument(name, cache) {
  if (cache.has(name)) return cache.get(name);
  const p = (async () => {
    const url = `${REGISTRY}/${name.replace(/\//g, "%2f")}`;
    const res = await fetch(url, { headers: { Accept: ACCEPT } });
    if (res.status === 404) throw new Error(`not found on registry`);
    if (!res.ok) throw new Error(`registry responded ${res.status}`);
    return res.json();
  })();
  cache.set(name, p);
  return p;
}

// A specifier is non-registry if it names a transport/protocol or a repo path.
// Valid semver ranges and dist-tags never contain ":" or "/".
function isNonRegistry(spec) {
  if (!spec) return false;
  const s = spec.trim();
  return s.includes(":") || s.includes("/");
}

function resolveVersion(packument, range) {
  const tags = packument["dist-tags"] || {};
  let r = range == null || range === "" ? "latest" : range;
  if (tags[r]) return tags[r];
  const versions = Object.keys(packument.versions || {});
  return (
    semver.maxSatisfying(versions, r, { includePrerelease: false }) ||
    semver.maxSatisfying(versions, r, { includePrerelease: true }) ||
    null
  );
}

// Pull the metadata the lock can carry from a packument version record (corgi
// format): artifact integrity (dist.integrity) and platform/runtime conditions
// (os / cpu / libc / engines.node).
function metaFrom(rec) {
  const m = {};
  const integ = rec && rec.dist && rec.dist.integrity;
  if (integ) m.integrity = integ;
  if (rec && rec.os) m.os = [].concat(rec.os);
  if (rec && rec.cpu) m.cpu = [].concat(rec.cpu);
  if (rec && rec.libc) m.libc = [].concat(rec.libc);
  const eng = rec && rec.engines && rec.engines.node;
  if (eng) m.engines = eng;
  return m;
}

function parseSpec(input) {
  const value = input.trim();
  if (!value) throw new Error("enter a package name");
  let name = value;
  let range;
  if (value[0] === "@") {
    const at = value.indexOf("@", 1);
    if (at !== -1) {
      name = value.slice(0, at);
      range = value.slice(at + 1);
    }
  } else {
    const at = value.indexOf("@");
    if (at > 0) {
      name = value.slice(0, at);
      range = value.slice(at + 1);
    }
  }
  return { name, range };
}

export async function resolveGraph(input, { maxNodes = 600, onProgress } = {}) {
  const { name, range } = parseSpec(input);
  const cache = new Map();
  const warnings = [];
  const nodeMap = new Map(); // "name@version" -> index
  const nodes = [];
  const edges = [];
  let capped = false;

  const getNode = (n, v, rec) => {
    const key = `${n}@${v}`;
    let idx = nodeMap.get(key);
    if (idx === undefined) {
      idx = nodes.length;
      nodes.push({ name: n, version: v, ...metaFrom(rec) });
      nodeMap.set(key, idx);
    }
    return idx;
  };

  const rootPack = await fetchPackument(name, cache);
  const rootVersion = resolveVersion(rootPack, range);
  if (!rootVersion) {
    throw new Error(`no version of ${name} satisfies "${range ?? "latest"}"`);
  }

  const rootIndex = getNode(name, rootVersion, (rootPack.versions || {})[rootVersion]);
  const queue = [{ idx: rootIndex, name, version: rootVersion }];
  const enqueued = new Set([`${name}@${rootVersion}`]);

  while (queue.length) {
    if (nodes.length > maxNodes) {
      capped = true;
      break;
    }
    const cur = queue.shift();
    onProgress?.(nodes.length);

    let pack;
    try {
      pack = await fetchPackument(cur.name, cache);
    } catch (e) {
      warnings.push(`could not fetch ${cur.name}: ${e.message}`);
      continue;
    }
    const rec = (pack.versions || {})[cur.version];
    if (!rec) continue;

    const deps = rec.dependencies || {};
    const opt = rec.optionalDependencies || {};
    const names = new Set([...Object.keys(deps), ...Object.keys(opt)]);

    for (const depName of names) {
      const isOptional = depName in opt;
      const spec = isOptional ? opt[depName] : deps[depName];

      if (isNonRegistry(spec)) {
        warnings.push(`skipped non-registry dependency: ${depName}@${spec}`);
        continue;
      }

      let depPack;
      try {
        depPack = await fetchPackument(depName, cache);
      } catch (e) {
        warnings.push(`skipped ${depName} (${e.message})`);
        continue;
      }
      const depVersion = resolveVersion(depPack, spec);
      if (!depVersion) {
        warnings.push(`skipped ${depName}@${spec} (no matching version)`);
        continue;
      }

      const toIdx = getNode(depName, depVersion, depPack.versions[depVersion]);
      edges.push({
        from: cur.idx,
        to: toIdx,
        name: depName,
        spec,
        type: isOptional ? "optional" : "prod",
      });

      const key = `${depName}@${depVersion}`;
      if (!enqueued.has(key)) {
        enqueued.add(key);
        queue.push({ idx: toIdx, name: depName, version: depVersion });
      }
    }

    // Peer dependencies: record the resolved peer *placement* (which instance
    // satisfies the peer) as a peer / peer-opt edge. Peers are normally supplied
    // by the consumer, so the target is captured as a leaf — we don't recurse into
    // its subtree — which keeps the lock bounded.
    const peers = rec.peerDependencies || {};
    const peerMeta = rec.peerDependenciesMeta || {};
    for (const peerName of Object.keys(peers)) {
      const spec = peers[peerName];
      if (isNonRegistry(spec)) {
        warnings.push(`skipped non-registry peer dependency: ${peerName}@${spec}`);
        continue;
      }
      let peerPack;
      try {
        peerPack = await fetchPackument(peerName, cache);
      } catch (e) {
        warnings.push(`skipped peer ${peerName} (${e.message})`);
        continue;
      }
      const peerVersion = resolveVersion(peerPack, spec);
      if (!peerVersion) {
        warnings.push(`skipped peer ${peerName}@${spec} (no matching version)`);
        continue;
      }
      const toIdx = getNode(peerName, peerVersion, peerPack.versions[peerVersion]);
      const optional = !!(peerMeta[peerName] && peerMeta[peerName].optional);
      edges.push({
        from: cur.idx,
        to: toIdx,
        name: peerName,
        spec,
        type: optional ? "peer-opt" : "peer",
      });
    }
  }

  if (capped) {
    warnings.push(
      `graph capped at ${maxNodes} packages; deeper dependencies were omitted`
    );
  }

  return { name, version: rootVersion, rootIndex, nodes, edges, warnings };
}
