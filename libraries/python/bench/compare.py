"""Benchmarks semantic-versions against node-semver (npm's rules) and semver
(python-semver) on real-world inputs, and scores all three against the shared
conformance suite. Writes ../../../benchmarks/results/python.json.

    pip install -e . node-semver semver
    python bench/compare.py            (from libraries/python)
    python bench/compare.py --quick    (fast run, does not write results)
"""

import datetime
import functools
import importlib.metadata
import json
import pathlib
import platform
import subprocess
import sys
import time

ROOT = pathlib.Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "libraries" / "python" / "src"))

import nodesemver  # noqa: E402
import semver  # noqa: E402

import semantic_versions as sv  # noqa: E402

QUICK = "--quick" in sys.argv


def measure(ops, fn):
    """Median nanoseconds per operation of fn, which performs ops operations."""
    sample, samples = (0.06, 5) if QUICK else (0.25, 15)
    end = time.perf_counter() + 0.2
    while time.perf_counter() < end:
        fn()
    results = []
    for _ in range(samples):
        start = time.perf_counter_ns()
        calls = 0
        while True:
            fn()
            calls += 1
            elapsed = time.perf_counter_ns() - start
            if elapsed >= sample * 1e9:
                break
        results.append(elapsed / (calls * ops))
    results.sort()
    return results[len(results) // 2]


def attempt(fn, *args):
    try:
        return fn(*args)
    except Exception:  # noqa: BLE001 - adapters normalize every failure
        return None


# ------------------------------------------------------------------ adapters


def ns_parse(s):
    return nodesemver.make_semver(s, False)


def ns_normalized(s):
    v = ns_parse(s)
    # node-semver's .version drops the build; rebuild it so it is scored on
    # what it parsed rather than on formatting.
    return v.version + ("+" + ".".join(str(b) for b in v.build) if v.build else "")


def ns_satisfies(v, r):
    rng = nodesemver.make_range(r, False)
    ver = attempt(ns_parse, v)
    return False if ver is None else rng.test(ver)


def ns_desugar(r):
    out = nodesemver.valid_range(r, False)
    return None if out is None else (out or "*")


def ps_satisfies(_v, _r):
    raise ValueError("python-semver has no npm-style ranges")


LIBS = [
    {
        "name": "semantic-versions",
        "version": sv.__version__,
        "parse": sv.Version.parse,
        "normalized": lambda s: str(sv.Version.parse(s)),
        "context": lambda s: sv.Version.parse(s).context,
        "compare": sv.compare,
        "satisfies": lambda v, r: sv.satisfies(v, r),
        "range": sv.Range,
        "desugar": sv.valid_range,
    },
    {
        "name": "node-semver",
        "version": importlib.metadata.version("node-semver"),
        "parse": ns_parse,
        "normalized": ns_normalized,
        "context": lambda s: None,
        "compare": lambda a, b: nodesemver.compare(a, b, False),
        "satisfies": ns_satisfies,
        "range": lambda r: nodesemver.make_range(r, False),
        "desugar": ns_desugar,
    },
    {
        "name": "semver",
        "version": importlib.metadata.version("semver"),
        "parse": semver.Version.parse,
        "normalized": lambda s: str(semver.Version.parse(s)),
        "context": lambda s: None,
        "compare": lambda a, b: semver.Version.parse(a).compare(b),
        "satisfies": None,
        "range": None,
        "desugar": None,
    },
]


def cases(name):
    return json.loads((ROOT / "conformance" / f"{name}.json").read_text())["cases"]


def conformance(lib):
    by = {}

    def tally(cat, ok):
        e = by.setdefault(cat, {"passed": 0, "total": 0})
        e["total"] += 1
        e["passed"] += bool(ok)

    for c in cases("versions"):
        if c["valid"]:
            ok = attempt(lib["normalized"], c["input"]) == c["version"]
            if "context" in c:
                ok = ok and attempt(lib["context"], c["input"]) == c["context"]
        else:
            ok = attempt(lib["parse"], c["input"]) is None
        tally(c["category"], ok)
    for c in cases("precedence"):
        got = attempt(lib["compare"], c["a"], c["b"])
        tally(c["category"], got is not None and (got > 0) - (got < 0) == c["expected"])
    if lib["satisfies"]:
        for c in cases("ranges"):
            tally(c["category"], bool(attempt(lib["satisfies"], c["version"], c["range"])) == c["expected"])
    if lib["desugar"]:
        for c in cases("desugar"):
            got = attempt(lib["desugar"], c["input"])
            tally(c["category"], got == c["output"] or got in c.get("accept", []))
    return dict(sorted(by.items()))


def main():
    corpus = json.loads((ROOT / "benchmarks" / "corpus.json").read_text())
    versions = corpus["versions"]
    all_ranges = corpus["ranges"]
    packages = corpus["packages"]
    ranges = [r for r in all_ranges if attempt(sv.Range, r) and attempt(nodesemver.make_range, r, False)]
    comparable = set(ranges)
    resolutions = [(n, r) for n, r in corpus["resolutions"] if r in comparable]
    pairs = sum(len(packages[n]) for n, _ in resolutions)
    tasks = []

    def row(id, label, description, results):
        for name, ns in results.items():
            print(f"{id:<10} {name:<18} {ns:>10.1f} ns/op", file=sys.stderr)
        tasks.append(
            {
                "id": id,
                "label": label,
                "description": description,
                "results": {
                    n: {"nsPerOp": round(ns, 1), "opsPerSec": round(1e9 / ns)} for n, ns in results.items()
                },
            }
        )

    def loop(fn, items):
        def run():
            for x in items:
                fn(x)

        return run

    # parse
    row(
        "parse",
        "Parse a version",
        f"{len(versions)} published versions",
        {
            "semantic-versions": measure(len(versions), loop(lambda s: attempt(sv.Version.parse, s), versions)),
            "node-semver": measure(len(versions), loop(lambda s: attempt(ns_parse, s), versions)),
            "semver": measure(len(versions), loop(lambda s: attempt(semver.Version.parse, s), versions)),
        },
    )

    # sort parsed versions (parsed outside the timing; a fresh list each time)
    svs = [v for v in (attempt(sv.Version.parse, s) for s in versions) if v]
    nss = [v for v in (attempt(ns_parse, s) for s in versions) if v]
    pss = [v for v in (attempt(semver.Version.parse, s) for s in versions) if v]
    ns_key = functools.cmp_to_key(lambda a, b: a.compare(b))
    row(
        "sort",
        "Sort versions",
        f"{len(versions)} parsed versions by precedence (per version)",
        {
            "semantic-versions": measure(len(svs), lambda: sorted(svs)),
            "node-semver": measure(len(nss), lambda: sorted(nss, key=ns_key)),
            "semver": measure(len(pss), lambda: sorted(pss)),
        },
    )

    # range parsing
    row(
        "range",
        "Parse a range",
        f"{len(ranges)} real dependency ranges",
        {
            "semantic-versions": measure(len(ranges), loop(sv.Range, ranges)),
            "node-semver": measure(len(ranges), loop(lambda r: nodesemver.make_range(r, False), ranges)),
        },
    )

    # satisfies: both sides parsed once; time the membership test only
    sv_pairs = [(sv.Range(r), [v for v in map(lambda s: attempt(sv.Version.parse, s), packages[n]) if v]) for n, r in resolutions]
    ns_pairs = [(nodesemver.make_range(r, False), [v for v in map(lambda s: attempt(ns_parse, s), packages[n]) if v]) for n, r in resolutions]

    def test_all(pairs_):
        def run():
            for rng, vs in pairs_:
                test = rng.test
                for v in vs:
                    test(v)

        return run

    row(
        "satisfies",
        "range.test(version)",
        f"{pairs} version × range checks",
        {
            "semantic-versions": measure(pairs, test_all(sv_pairs)),
            "node-semver": measure(pairs, test_all(ns_pairs)),
        },
    )

    # resolve: parse the range, then find the highest matching parsed version
    sv_pkgs = {n: [v for v in map(lambda s: attempt(sv.Version.parse, s), vs) if v] for n, vs in packages.items()}
    ns_pkgs = {n: [v for v in map(lambda s: attempt(ns_parse, s), vs) if v] for n, vs in packages.items()}

    def resolve_sv():
        for n, r in resolutions:
            rng = sv.Range(r)
            max((v for v in sv_pkgs[n] if rng.test(v)), default=None)

    def resolve_ns():
        for n, r in resolutions:
            rng = nodesemver.make_range(r, False)
            max((v for v in ns_pkgs[n] if rng.test(v)), key=ns_key, default=None)

    row(
        "resolve",
        "Resolve a range",
        f"{len(resolutions)} max-satisfying lookups against a package's versions",
        {
            "semantic-versions": measure(len(resolutions), resolve_sv),
            "node-semver": measure(len(resolutions), resolve_ns),
        },
    )

    out = {
        "language": "Python",
        "subject": "semantic-versions",
        "baseline": "node-semver",
        "environment": {
            "runtime": f"{platform.python_implementation()} {platform.python_version()}",
            "cpu": cpu_model(),
            "platform": f"{platform.system().lower()} {platform.machine()}",
            "date": datetime.date.today().isoformat(),
        },
        "libraries": {l["name"]: {"version": l["version"]} for l in LIBS},
        "corpus": {
            "versions": len(versions),
            "ranges": len(all_ranges),
            "comparableRanges": len(ranges),
            "fetched": corpus["fetched"],
        },
        "coverage": {
            l["name"]: {
                "versions": sum(1 for v in versions if attempt(l["parse"], v) is not None),
                "ranges": sum(1 for r in all_ranges if l["range"] and attempt(l["range"], r) is not None),
            }
            for l in LIBS
        },
        "tasks": tasks,
        "conformance": {l["name"]: conformance(l) for l in LIBS},
        "notes": {
            "semver": "python-semver has no npm-style ranges (only single comparisons such as >=1.2.3), so it is compared on versions only.",
        },
    }
    if not QUICK:
        (ROOT / "benchmarks" / "results" / "python.json").write_text(json.dumps(out, indent=2) + "\n")
    print(json.dumps({"conformance": out["conformance"], "coverage": out["coverage"]}, indent=2))


def cpu_model():
    try:
        for line in pathlib.Path("/proc/cpuinfo").read_text().splitlines():
            if line.startswith("model name"):
                return line.split(":", 1)[1].strip()
    except OSError:
        pass
    try:
        return subprocess.check_output(["sysctl", "-n", "machdep.cpu.brand_string"], text=True).strip()
    except Exception:  # noqa: BLE001
        return platform.processor() or "unknown"


if __name__ == "__main__":
    main()
