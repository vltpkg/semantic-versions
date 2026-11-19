//! Benchmarks `semantic-versions` against `semver` (Cargo's flavour) and
//! `nodejs-semver` (npm's) on real-world inputs, and scores all three against
//! the shared conformance suite. Writes ../../benchmarks/results/rust.json.
//!
//!     cargo bench --bench compare            (from libraries/rust)
//!     cargo bench --bench compare -- --quick

use std::cmp::Ordering;
use std::collections::BTreeMap;
use std::hint::black_box;
use std::path::PathBuf;
use std::time::{Duration, Instant};

use serde_json::{json, Value};

fn root(p: &str) -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("../..")
        .join(p)
}

fn read(p: &str) -> Value {
    serde_json::from_str(&std::fs::read_to_string(root(p)).unwrap()).unwrap()
}

fn strings(v: &Value) -> Vec<String> {
    v.as_array()
        .unwrap()
        .iter()
        .map(|x| x.as_str().unwrap().to_string())
        .collect()
}

/// Median nanoseconds per operation of `f`, which performs `ops` operations.
fn measure(quick: bool, ops: usize, mut f: impl FnMut()) -> f64 {
    let (sample, samples) = if quick {
        (Duration::from_millis(60), 5)
    } else {
        (Duration::from_millis(250), 15)
    };
    let warm = Instant::now();
    while warm.elapsed() < Duration::from_millis(200) {
        f();
    }
    let mut results = Vec::with_capacity(samples);
    for _ in 0..samples {
        let start = Instant::now();
        let mut calls = 0u64;
        while start.elapsed() < sample {
            f();
            calls += 1;
        }
        results.push(start.elapsed().as_nanos() as f64 / (calls as f64 * ops as f64));
    }
    results.sort_by(|a, b| a.partial_cmp(b).unwrap());
    results[results.len() / 2]
}

// ----------------------------------------------------------------- adapters

struct Lib {
    name: &'static str,
    version: &'static str,
    parse_ok: fn(&str) -> bool,
    normalized: fn(&str) -> Option<String>,
    context: fn(&str) -> Option<String>,
    cmp: fn(&str, &str) -> Option<Ordering>,
    satisfies: fn(&str, &str) -> Option<bool>,
    range_ok: fn(&str) -> bool,
    desugar: Option<fn(&str) -> Option<String>>,
}

fn libs() -> Vec<Lib> {
    vec![
        Lib {
            name: "semantic-versions",
            version: env!("CARGO_PKG_VERSION"),
            parse_ok: |s| semantic_versions::Version::parse(s).is_ok(),
            normalized: semantic_versions::valid,
            context: |s| {
                semantic_versions::Version::parse(s)
                    .ok()
                    .and_then(|v| v.context().map(str::to_string))
            },
            cmp: |a, b| {
                Some(
                    semantic_versions::Version::parse(a)
                        .ok()?
                        .cmp(&semantic_versions::Version::parse(b).ok()?),
                )
            },
            satisfies: |v, r| Some(semantic_versions::satisfies(v, r)),
            range_ok: |r| semantic_versions::Range::parse(r).is_ok(),
            desugar: Some(semantic_versions::valid_range),
        },
        Lib {
            name: "semver",
            version: "1",
            parse_ok: |s| semver::Version::parse(s).is_ok(),
            normalized: |s| semver::Version::parse(s).ok().map(|v| v.to_string()),
            context: |_| None,
            cmp: |a, b| {
                Some(
                    semver::Version::parse(a)
                        .ok()?
                        .cmp(&semver::Version::parse(b).ok()?),
                )
            },
            satisfies: |v, r| {
                let req = semver::VersionReq::parse(r).ok()?;
                Some(
                    semver::Version::parse(v)
                        .map(|v| req.matches(&v))
                        .unwrap_or(false),
                )
            },
            range_ok: |r| semver::VersionReq::parse(r).is_ok(),
            desugar: None,
        },
        Lib {
            name: "nodejs-semver",
            version: "7",
            parse_ok: |s| nodejs_semver::Version::parse(s).is_ok(),
            normalized: |s| nodejs_semver::Version::parse(s).ok().map(|v| v.to_string()),
            context: |_| None,
            cmp: |a, b| {
                Some(
                    nodejs_semver::Version::parse(a)
                        .ok()?
                        .cmp(&nodejs_semver::Version::parse(b).ok()?),
                )
            },
            satisfies: |v, r| {
                let range = nodejs_semver::Range::parse(r).ok()?;
                Some(
                    nodejs_semver::Version::parse(v)
                        .map(|v| range.satisfies(&v))
                        .unwrap_or(false),
                )
            },
            range_ok: |r| nodejs_semver::Range::parse(r).is_ok(),
            desugar: Some(|r| nodejs_semver::Range::parse(r).ok().map(|r| r.to_string())),
        },
    ]
}

fn conformance(lib: &Lib) -> BTreeMap<String, (u32, u32)> {
    let mut by: BTreeMap<String, (u32, u32)> = BTreeMap::new();
    let mut tally = |cat: &str, ok: bool| {
        let e = by.entry(cat.to_string()).or_default();
        e.1 += 1;
        if ok {
            e.0 += 1;
        }
    };
    let cases = |n: &str| {
        read(&format!("conformance/{n}.json"))["cases"]
            .as_array()
            .unwrap()
            .clone()
    };
    for c in cases("versions") {
        let input = c["input"].as_str().unwrap();
        let ok = if c["valid"].as_bool().unwrap() {
            (lib.normalized)(input).as_deref() == c["version"].as_str()
                && c["context"]
                    .as_str()
                    .map_or(true, |ctx| (lib.context)(input).as_deref() == Some(ctx))
        } else {
            !(lib.parse_ok)(input)
        };
        tally(c["category"].as_str().unwrap(), ok);
    }
    for c in cases("precedence") {
        let expected = match c["expected"].as_i64().unwrap() {
            -1 => Ordering::Less,
            0 => Ordering::Equal,
            _ => Ordering::Greater,
        };
        let got = (lib.cmp)(c["a"].as_str().unwrap(), c["b"].as_str().unwrap());
        tally(c["category"].as_str().unwrap(), got == Some(expected));
    }
    for c in cases("ranges") {
        let got = (lib.satisfies)(c["version"].as_str().unwrap(), c["range"].as_str().unwrap())
            .unwrap_or(false);
        tally(
            c["category"].as_str().unwrap(),
            got == c["expected"].as_bool().unwrap(),
        );
    }
    if let Some(desugar) = lib.desugar {
        for c in cases("desugar") {
            let got = desugar(c["input"].as_str().unwrap());
            let accept: Vec<&str> = c["accept"]
                .as_array()
                .map(|a| a.iter().map(|x| x.as_str().unwrap()).collect())
                .unwrap_or_default();
            let ok = got.as_deref() == c["output"].as_str()
                || got.as_deref().is_some_and(|g| accept.contains(&g));
            tally(c["category"].as_str().unwrap(), ok);
        }
    }
    by
}

fn main() {
    let quick = std::env::args().any(|a| a == "--quick");
    let corpus = read("benchmarks/corpus.json");
    let versions = strings(&corpus["versions"]);
    let all_ranges = strings(&corpus["ranges"]);
    let libs = libs();

    // Ranges accepted by both npm-syntax libraries; Cargo's `semver` uses a
    // different requirement syntax, so it is compared on versions only.
    let ranges: Vec<String> = all_ranges
        .iter()
        .filter(|r| {
            semantic_versions::Range::parse(r).is_ok() && nodejs_semver::Range::parse(r).is_ok()
        })
        .cloned()
        .collect();
    let packages: BTreeMap<String, Vec<String>> = corpus["packages"]
        .as_object()
        .unwrap()
        .iter()
        .map(|(k, v)| (k.clone(), strings(v)))
        .collect();
    let resolutions: Vec<(String, String)> = corpus["resolutions"]
        .as_array()
        .unwrap()
        .iter()
        .map(|r| {
            (
                r[0].as_str().unwrap().to_string(),
                r[1].as_str().unwrap().to_string(),
            )
        })
        .filter(|(_, r)| ranges.contains(r))
        .collect();
    let pairs: usize = resolutions.iter().map(|(n, _)| packages[n].len()).sum();

    let mut tasks = Vec::new();
    let mut row = |id: &str, label: &str, description: String, results: Vec<(&str, f64)>| {
        for (name, ns) in &results {
            eprintln!("{id:<10} {name:<18} {ns:>9.1} ns/op");
        }
        let results: serde_json::Map<String, Value> = results
            .into_iter()
            .map(|(n, ns)| (n.to_string(), json!({ "nsPerOp": (ns * 10.0).round() / 10.0, "opsPerSec": (1e9 / ns).round() })))
            .collect();
        tasks.push(
            json!({ "id": id, "label": label, "description": description, "results": results }),
        );
    };

    // parse
    row(
        "parse",
        "Parse a version",
        format!("{} published versions", versions.len()),
        vec![
            (
                "semantic-versions",
                measure(quick, versions.len(), || {
                    for v in &versions {
                        black_box(semantic_versions::Version::parse(black_box(v)).is_ok());
                    }
                }),
            ),
            (
                "semver",
                measure(quick, versions.len(), || {
                    for v in &versions {
                        black_box(semver::Version::parse(black_box(v)).is_ok());
                    }
                }),
            ),
            (
                "nodejs-semver",
                measure(quick, versions.len(), || {
                    for v in &versions {
                        black_box(nodejs_semver::Version::parse(black_box(v)).is_ok());
                    }
                }),
            ),
        ],
    );

    // sort (parsed once, outside the timing)
    let sv: Vec<_> = versions
        .iter()
        .filter_map(|v| semantic_versions::Version::parse(v).ok())
        .collect();
    let cs: Vec<_> = versions
        .iter()
        .filter_map(|v| semver::Version::parse(v).ok())
        .collect();
    let ns: Vec<_> = versions
        .iter()
        .filter_map(|v| nodejs_semver::Version::parse(v).ok())
        .collect();
    row(
        "sort",
        "Sort versions",
        format!(
            "{} parsed versions by precedence (per version)",
            versions.len()
        ),
        vec![
            (
                "semantic-versions",
                measure(quick, sv.len(), || {
                    let mut l = sv.clone();
                    l.sort();
                    black_box(l);
                }),
            ),
            (
                "semver",
                measure(quick, cs.len(), || {
                    let mut l = cs.clone();
                    l.sort();
                    black_box(l);
                }),
            ),
            (
                "nodejs-semver",
                measure(quick, ns.len(), || {
                    let mut l = ns.clone();
                    l.sort();
                    black_box(l);
                }),
            ),
        ],
    );

    // range parsing
    row(
        "range",
        "Parse a range",
        format!("{} real dependency ranges", ranges.len()),
        vec![
            (
                "semantic-versions",
                measure(quick, ranges.len(), || {
                    for r in &ranges {
                        black_box(semantic_versions::Range::parse(black_box(r)).is_ok());
                    }
                }),
            ),
            (
                "nodejs-semver",
                measure(quick, ranges.len(), || {
                    for r in &ranges {
                        black_box(nodejs_semver::Range::parse(black_box(r)).is_ok());
                    }
                }),
            ),
        ],
    );

    // satisfies: both sides parsed once; time the membership test only
    let sv_pairs: Vec<(semantic_versions::Range, Vec<semantic_versions::Version>)> = resolutions
        .iter()
        .map(|(n, r)| {
            (
                semantic_versions::Range::parse(r).unwrap(),
                packages[n].iter().filter_map(|v| v.parse().ok()).collect(),
            )
        })
        .collect();
    let ns_pairs: Vec<(nodejs_semver::Range, Vec<nodejs_semver::Version>)> = resolutions
        .iter()
        .map(|(n, r)| {
            (
                nodejs_semver::Range::parse(r).unwrap(),
                packages[n]
                    .iter()
                    .filter_map(|v| nodejs_semver::Version::parse(v).ok())
                    .collect(),
            )
        })
        .collect();
    row(
        "satisfies",
        "Range::test(version)",
        format!("{pairs} version × range checks"),
        vec![
            (
                "semantic-versions",
                measure(quick, pairs, || {
                    for (r, vs) in &sv_pairs {
                        for v in vs {
                            black_box(r.test(black_box(v)));
                        }
                    }
                }),
            ),
            (
                "nodejs-semver",
                measure(quick, pairs, || {
                    for (r, vs) in &ns_pairs {
                        for v in vs {
                            black_box(r.satisfies(black_box(v)));
                        }
                    }
                }),
            ),
        ],
    );

    // resolve: parse the range, find the highest matching parsed version
    let sv_pkgs: BTreeMap<&str, Vec<semantic_versions::Version>> = packages
        .iter()
        .map(|(k, v)| {
            (
                k.as_str(),
                v.iter().filter_map(|x| x.parse().ok()).collect(),
            )
        })
        .collect();
    let ns_pkgs: BTreeMap<&str, Vec<nodejs_semver::Version>> = packages
        .iter()
        .map(|(k, v)| {
            (
                k.as_str(),
                v.iter()
                    .filter_map(|x| nodejs_semver::Version::parse(x).ok())
                    .collect(),
            )
        })
        .collect();
    row(
        "resolve",
        "Resolve a range",
        format!(
            "{} max-satisfying lookups against a package's versions",
            resolutions.len()
        ),
        vec![
            (
                "semantic-versions",
                measure(quick, resolutions.len(), || {
                    for (n, r) in &resolutions {
                        let range = semantic_versions::Range::parse(r).unwrap();
                        black_box(sv_pkgs[n.as_str()].iter().filter(|v| range.test(v)).max());
                    }
                }),
            ),
            (
                "nodejs-semver",
                measure(quick, resolutions.len(), || {
                    for (n, r) in &resolutions {
                        let range = nodejs_semver::Range::parse(r).unwrap();
                        black_box(
                            ns_pkgs[n.as_str()]
                                .iter()
                                .filter(|v| range.satisfies(v))
                                .max(),
                        );
                    }
                }),
            ),
        ],
    );

    let conformance: serde_json::Map<String, Value> = libs
        .iter()
        .map(|l| {
            let by: serde_json::Map<String, Value> = conformance(l)
                .into_iter()
                .map(|(k, (p, t))| (k, json!({ "passed": p, "total": t })))
                .collect();
            (l.name.to_string(), Value::Object(by))
        })
        .collect();
    let coverage: serde_json::Map<String, Value> = libs
        .iter()
        .map(|l| {
            (
                l.name.to_string(),
                json!({
                    "versions": versions.iter().filter(|v| (l.parse_ok)(v)).count(),
                    "ranges": all_ranges.iter().filter(|r| (l.range_ok)(r)).count(),
                }),
            )
        })
        .collect();

    let out = json!({
        "language": "Rust",
        "subject": "semantic-versions",
        "baseline": "nodejs-semver",
        "environment": {
            "runtime": rustc_version(),
            "cpu": cpu_model(),
            "platform": format!("{} {}", std::env::consts::OS, std::env::consts::ARCH),
            "date": today(),
        },
        "libraries": libs.iter().map(|l| (l.name.to_string(), json!({ "version": lib_version(l.name, l.version) }))).collect::<serde_json::Map<_, _>>(),
        "corpus": { "versions": versions.len(), "ranges": all_ranges.len(), "comparableRanges": ranges.len(), "fetched": corpus["fetched"] },
        "coverage": coverage,
        "tasks": tasks,
        "conformance": conformance,
        "notes": {
            "semver": "Cargo's requirement syntax (bare versions mean ^, comparators are comma-separated, no || or hyphen ranges), so it is compared on versions only.",
        },
    });
    if !quick {
        std::fs::write(
            root("benchmarks/results/rust.json"),
            serde_json::to_string_pretty(&out).unwrap() + "\n",
        )
        .unwrap();
    }
    println!(
        "{}",
        serde_json::to_string_pretty(
            &json!({ "conformance": out["conformance"], "coverage": out["coverage"] })
        )
        .unwrap()
    );
}

fn rustc_version() -> String {
    std::process::Command::new("rustc")
        .arg("--version")
        .output()
        .ok()
        .and_then(|o| String::from_utf8(o.stdout).ok())
        .map(|s| s.split_whitespace().take(2).collect::<Vec<_>>().join(" "))
        .unwrap_or_else(|| "rustc".into())
}

fn cpu_model() -> String {
    std::fs::read_to_string("/proc/cpuinfo")
        .ok()
        .and_then(|s| {
            s.lines()
                .find(|l| l.starts_with("model name"))
                .map(|l| l.split(':').nth(1).unwrap_or("").trim().to_string())
        })
        .or_else(|| {
            std::process::Command::new("sysctl")
                .args(["-n", "machdep.cpu.brand_string"])
                .output()
                .ok()
                .and_then(|o| String::from_utf8(o.stdout).ok())
                .map(|s| s.trim().to_string())
        })
        .unwrap_or_else(|| "unknown".into())
}

fn today() -> String {
    std::process::Command::new("date")
        .arg("+%Y-%m-%d")
        .output()
        .ok()
        .and_then(|o| String::from_utf8(o.stdout).ok())
        .map(|s| s.trim().to_string())
        .unwrap_or_default()
}

/// Resolved dependency versions, read from Cargo.lock when available.
fn lib_version(name: &str, fallback: &str) -> String {
    let lock =
        std::fs::read_to_string(PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("Cargo.lock"))
            .unwrap_or_default();
    let mut lines = lock.lines();
    while let Some(l) = lines.next() {
        if l == format!("name = \"{name}\"") {
            if let Some(v) = lines.next().and_then(|v| v.strip_prefix("version = \"")) {
                return v.trim_end_matches('"').to_string();
            }
        }
    }
    fallback.to_string()
}
