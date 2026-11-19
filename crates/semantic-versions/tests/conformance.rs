//! Runs the shared conformance suite in `conformance/` (the same cases the
//! JavaScript reference parser runs) against this crate.

use std::cmp::Ordering;
use std::path::PathBuf;

use semantic_versions::{valid_range, Range, Version};
use serde_json::Value;

fn cases(name: &str) -> Vec<Value> {
    let path = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("../../conformance")
        .join(format!("{name}.json"));
    let text = std::fs::read_to_string(&path).unwrap_or_else(|e| panic!("{}: {e}", path.display()));
    let doc: Value = serde_json::from_str(&text).unwrap();
    doc["cases"].as_array().unwrap().clone()
}

fn s(v: &Value, k: &str) -> String {
    v[k].as_str().unwrap().to_string()
}

#[test]
fn versions() {
    let mut failures = Vec::new();
    for c in cases("versions") {
        let input = s(&c, "input");
        let parsed = Version::parse(&input);
        let ok = if c["valid"].as_bool().unwrap() {
            match &parsed {
                Ok(v) => {
                    v.to_string() == s(&c, "version")
                        && c["context"]
                            .as_str()
                            .map_or(true, |ctx| v.context() == Some(ctx))
                }
                Err(_) => false,
            }
        } else {
            parsed.is_err()
        };
        if !ok {
            failures.push(format!("{input:?} => {parsed:?}"));
        }
    }
    assert!(
        failures.is_empty(),
        "{} failures:\n{}",
        failures.len(),
        failures.join("\n")
    );
}

#[test]
fn precedence() {
    let mut failures = Vec::new();
    for c in cases("precedence") {
        let (a, b) = (s(&c, "a"), s(&c, "b"));
        let expected = match c["expected"].as_i64().unwrap() {
            -1 => Ordering::Less,
            0 => Ordering::Equal,
            _ => Ordering::Greater,
        };
        let got = Version::parse(&a)
            .unwrap()
            .cmp(&Version::parse(&b).unwrap());
        if got != expected {
            failures.push(format!("{a} vs {b}: expected {expected:?}, got {got:?}"));
        }
    }
    assert!(
        failures.is_empty(),
        "{} failures:\n{}",
        failures.len(),
        failures.join("\n")
    );
}

#[test]
fn ranges() {
    let mut failures = Vec::new();
    for c in cases("ranges") {
        let (range, version) = (s(&c, "range"), s(&c, "version"));
        let expected = c["expected"].as_bool().unwrap();
        let got = semantic_versions::satisfies(&version, &range);
        if got != expected {
            failures.push(format!(
                "[{}] {version} in {range:?}: expected {expected}, got {got} ({:?})",
                s(&c, "category"),
                Range::parse(&range).map(|r| r.to_string())
            ));
        }
    }
    assert!(
        failures.is_empty(),
        "{} failures:\n{}",
        failures.len(),
        failures.join("\n")
    );
}

#[test]
fn desugar() {
    let mut failures = Vec::new();
    for c in cases("desugar") {
        let input = s(&c, "input");
        let output = s(&c, "output");
        let accept: Vec<String> = c["accept"]
            .as_array()
            .map(|a| a.iter().map(|x| x.as_str().unwrap().to_string()).collect())
            .unwrap_or_default();
        let got = valid_range(&input);
        if got.as_deref() != Some(output.as_str())
            && !got.as_ref().is_some_and(|g| accept.contains(g))
        {
            failures.push(format!("{input:?}: expected {output:?}, got {got:?}"));
        }
    }
    assert!(
        failures.is_empty(),
        "{} failures:\n{}",
        failures.len(),
        failures.join("\n")
    );
}
