//! # semantic-versions
//!
//! The Rust reference implementation of [Semantic Versions](https://semver.xyz):
//! parse, validate, compare and range-match versions.
//!
//! It follows the specification at <https://semver.xyz/spec/> and its published
//! [BNF grammars](https://semver.xyz/grammar/), and passes the same shared
//! conformance suite as the JavaScript reference parser (`semantic-versions` on
//! npm). Where it differs from Semantic Versioning 2.0.0 and from `node-semver`:
//!
//! - **Builds participate in precedence**: `1.0.0 < 1.0.0+build.1`.
//! - **Pre-release channels**: `^1.0.0-rc` admits `1.0.0-rc.1`, never
//!   `1.0.0-beta`; `X.Y.Z-*` and `*-*` opt in explicitly.
//! - **Build channels**: `^1.0.0+win` admits `1.4.2+win.x64` only.
//! - **Contexts**: `npm:react@18.2.0` and `npm:react@^18` scope a version or
//!   range to an identity.
//!
//! ```
//! use semantic_versions::{satisfies, valid_range, Version, Range};
//!
//! let v: Version = "1.2.3-beta.4+build.7".parse().unwrap();
//! assert_eq!(v.major, 1);
//! assert!(Version::parse("1.0.0").unwrap() < Version::parse("1.0.0+build.1").unwrap());
//!
//! assert!(satisfies("1.4.0", "^1.2.3"));
//! assert!(satisfies("1.0.0-rc.1", "^1.0.0-rc"));
//! assert!(!satisfies("1.0.0-beta", "^1.0.0-rc"));
//! assert!(satisfies("1.4.2+win.x64", "^1.0.0+win"));
//! assert_eq!(valid_range("~>1.2").as_deref(), Some(">=1.2.0 <2.0.0-0"));
//!
//! let r = Range::parse("npm:react@^18").unwrap();
//! assert!(r.test(&"npm:react@18.2.0".parse().unwrap()));
//! assert!(!r.test(&"18.2.0".parse().unwrap()));
//! ```

#![forbid(unsafe_code)]
#![warn(missing_docs)]

mod error;
mod identifier;
mod range;
mod version;

pub use error::Error;
pub use identifier::{Identifier, Identifiers};
pub use range::{Comparator, Op, Range};
pub use version::{split_reference, Version};

// Compile and run the README's example as a doctest.
#[cfg(doctest)]
#[doc = include_str!("../README.md")]
struct ReadmeDoctests;

use std::cmp::Ordering;

/// Maximum length of a version or range string, matching the JavaScript reference.
pub const MAX_LENGTH: usize = 256;
/// Largest numeric identifier accepted (JavaScript's `Number.MAX_SAFE_INTEGER`),
/// so both reference implementations accept exactly the same inputs.
pub const MAX_SAFE_INTEGER: u64 = 9_007_199_254_740_991;

/// Parse a version (optionally context-qualified, e.g. `npm:react@1.2.3`).
pub fn parse(version: &str) -> Result<Version, Error> {
    Version::parse(version)
}

/// The normalized version string, or `None` if `version` is not a valid version.
/// The context, if any, is not part of the normalized string.
pub fn valid(version: &str) -> Option<String> {
    Version::parse(version).ok().map(|v| v.to_string())
}

/// The desugared range (primitive comparators), or `None` if invalid. An
/// unbounded range is `"*"`.
pub fn valid_range(range: &str) -> Option<String> {
    Range::parse(range).ok().map(|r| {
        let s = r.to_string();
        if s.is_empty() {
            "*".to_string()
        } else {
            s
        }
    })
}

/// Compare two versions by precedence. Errors if either is invalid.
pub fn compare(a: &str, b: &str) -> Result<Ordering, Error> {
    Ok(Version::parse(a)?.cmp(&Version::parse(b)?))
}

/// True if `version` satisfies `range`. Invalid input never satisfies.
pub fn satisfies(version: &str, range: &str) -> bool {
    if version == range {
        // Mirrors the JavaScript reference: an identical string trivially matches.
        return Version::parse(version).is_ok();
    }
    let Ok(range) = Range::parse(range) else {
        return false;
    };
    let Ok(version) = Version::parse(version) else {
        return false;
    };
    range.test(&version)
}

/// The highest version in `versions` that satisfies `range`.
pub fn max_satisfying<'a, I>(versions: I, range: &str) -> Option<&'a str>
where
    I: IntoIterator<Item = &'a str>,
{
    let range = Range::parse(range).ok()?;
    let mut best: Option<(&'a str, Version)> = None;
    for s in versions {
        let Ok(v) = Version::parse(s) else { continue };
        if !range.test(&v) {
            continue;
        }
        match &best {
            Some((_, b)) if *b >= v => {}
            _ => best = Some((s, v)),
        }
    }
    best.map(|(s, _)| s)
}

/// The lowest version in `versions` that satisfies `range`.
pub fn min_satisfying<'a, I>(versions: I, range: &str) -> Option<&'a str>
where
    I: IntoIterator<Item = &'a str>,
{
    let range = Range::parse(range).ok()?;
    let mut best: Option<(&'a str, Version)> = None;
    for s in versions {
        let Ok(v) = Version::parse(s) else { continue };
        if !range.test(&v) {
            continue;
        }
        match &best {
            Some((_, b)) if *b <= v => {}
            _ => best = Some((s, v)),
        }
    }
    best.map(|(s, _)| s)
}

/// Sort versions ascending by precedence.
pub fn sort(versions: &mut [Version]) {
    versions.sort();
}

/// Sort versions descending by precedence.
pub fn rsort(versions: &mut [Version]) {
    versions.sort_by(|a, b| b.cmp(a));
}
