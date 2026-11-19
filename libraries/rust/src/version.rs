use std::cmp::Ordering;
use std::fmt;
use std::hash::{Hash, Hasher};
use std::str::FromStr;

use crate::identifier::Identifiers;
use crate::{Error, MAX_LENGTH, MAX_SAFE_INTEGER};

/// A parsed Semantic Version, optionally scoped to a context
/// (`npm:react@18.2.0`).
///
/// Ordering follows the specification's precedence rules: pre-releases rank
/// below their release and builds rank above it (`1.0.0-rc < 1.0.0 <
/// 1.0.0+build`). The context never participates in precedence or equality.
///
/// A release is three integers; the pre-release, build and context of the
/// versions that have them live behind one pointer, so a `Version` is 32
/// bytes and plain releases parse without allocating.
#[derive(Clone)]
pub struct Version {
    /// Major version.
    pub major: u64,
    /// Minor version.
    pub minor: u64,
    /// Patch version.
    pub patch: u64,
    meta: Option<Box<Meta>>,
}

#[derive(Clone, Default)]
struct Meta {
    pre: Identifiers,
    build: Identifiers,
    context: Option<Box<str>>,
}

static EMPTY: Identifiers = Identifiers::empty();

impl fmt::Debug for Version {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("Version")
            .field("major", &self.major)
            .field("minor", &self.minor)
            .field("patch", &self.patch)
            .field("pre", self.pre())
            .field("build", self.build())
            .field("context", &self.context())
            .finish()
    }
}

/// Split an optional context off a reference: `npm:react@1.2.3` →
/// `(Some("npm:react"), "1.2.3")`. The context ends at the last `@` of the first
/// whitespace-delimited token; a leading `@` (a scoped npm name) is part of the
/// context, and an `@` at position 0 means there is no context.
pub fn split_reference(input: &str) -> (Option<&str>, std::borrow::Cow<'_, str>) {
    if !input.as_bytes().contains(&b'@') {
        return (None, std::borrow::Cow::Borrowed(input));
    }
    let first_space = input.find(|c: char| c.is_whitespace());
    let (head, tail) = match first_space {
        Some(i) => (&input[..i], &input[i..]),
        None => (input, ""),
    };
    match head.rfind('@') {
        Some(at) if at > 0 => {
            let rest = &head[at + 1..];
            let rest = if tail.is_empty() {
                std::borrow::Cow::Borrowed(rest)
            } else {
                std::borrow::Cow::Owned(format!("{rest}{tail}"))
            };
            (Some(&head[..at]), rest)
        }
        _ => (None, std::borrow::Cow::Borrowed(input)),
    }
}

impl Version {
    /// Create a normal version `major.minor.patch`.
    pub fn new(major: u64, minor: u64, patch: u64) -> Self {
        Version {
            major,
            minor,
            patch,
            meta: None,
        }
    }

    pub(crate) fn from_parts(
        major: u64,
        minor: u64,
        patch: u64,
        pre: Identifiers,
        build: Identifiers,
    ) -> Self {
        let meta = if pre.is_empty() && build.is_empty() {
            None
        } else {
            Some(Box::new(Meta {
                pre,
                build,
                context: None,
            }))
        };
        Version {
            major,
            minor,
            patch,
            meta,
        }
    }

    /// Pre-release identifiers (empty for a normal version).
    #[inline]
    pub fn pre(&self) -> &Identifiers {
        self.meta.as_ref().map_or(&EMPTY, |m| &m.pre)
    }

    /// Build identifiers, as written (empty when there is no build).
    #[inline]
    pub fn build(&self) -> &Identifiers {
        self.meta.as_ref().map_or(&EMPTY, |m| &m.build)
    }

    /// The identity this version belongs to, e.g. `npm:react`.
    #[inline]
    pub fn context(&self) -> Option<&str> {
        self.meta.as_ref().and_then(|m| m.context.as_deref())
    }

    fn meta_mut(&mut self) -> &mut Meta {
        self.meta.get_or_insert_with(Default::default)
    }

    /// This version with `pre` as its pre-release.
    pub fn with_pre(mut self, pre: Identifiers) -> Self {
        if !(pre.is_empty() && self.meta.is_none()) {
            self.meta_mut().pre = pre;
        }
        self
    }

    /// This version with `build` as its build.
    pub fn with_build(mut self, build: Identifiers) -> Self {
        if !(build.is_empty() && self.meta.is_none()) {
            self.meta_mut().build = build;
        }
        self
    }

    /// This version scoped to `context` (or to none).
    pub fn with_context(mut self, context: Option<&str>) -> Self {
        if !(context.is_none() && self.meta.is_none()) {
            self.meta_mut().context = context.map(Into::into);
        }
        self
    }

    /// Parse a version, optionally context-qualified (`npm:react@1.2.3`).
    /// There is no coercion: `v1.2.3` and `1.2` are errors.
    pub fn parse(input: &str) -> Result<Self, Error> {
        if input.len() > MAX_LENGTH {
            return Err(Error::TooLong);
        }
        // Fast path: a bare version (no context, no surrounding whitespace)
        // scans directly. Only when that fails do we look for a context or
        // whitespace to strip, so the common case pays for neither.
        if let Ok(v) = parse_core(input, input) {
            return Ok(v);
        }
        let (context, rest) = split_reference(input);
        Ok(parse_core(rest.trim(), input)?.with_context(context))
    }

    /// True if this is a pre-release.
    pub fn is_prerelease(&self) -> bool {
        !self.pre().is_empty()
    }

    /// The version with its build removed (context kept).
    pub fn without_build(&self) -> Version {
        self.clone().with_build(Identifiers::empty())
    }

    /// The context-qualified form, `context@version`, or the bare version.
    pub fn reference(&self) -> String {
        match self.context() {
            Some(c) => format!("{c}@{self}"),
            None => self.to_string(),
        }
    }

    #[inline]
    pub(crate) fn same_tuple(&self, other: &Version) -> bool {
        self.major == other.major && self.minor == other.minor && self.patch == other.patch
    }

    /// Precedence comparison that ignores builds (used by range comparators,
    /// where a build is a channel filter rather than part of the bound).
    #[inline]
    pub(crate) fn cmp_ignoring_build(&self, other: &Version) -> Ordering {
        match self.cmp_tuple(other) {
            Ordering::Equal => cmp_pre(self.pre(), other.pre()),
            o => o,
        }
    }

    #[inline]
    fn cmp_tuple(&self, other: &Version) -> Ordering {
        self.major
            .cmp(&other.major)
            .then(self.minor.cmp(&other.minor))
            .then(self.patch.cmp(&other.patch))
    }
}

#[inline]
fn cmp_pre(a: &Identifiers, b: &Identifiers) -> Ordering {
    match (a.is_empty(), b.is_empty()) {
        (true, true) => Ordering::Equal,
        (false, true) => Ordering::Less, // a pre-release ranks below its release
        (true, false) => Ordering::Greater,
        (false, false) => a.cmp_ids(b),
    }
}

#[inline]
fn cmp_build(a: &Identifiers, b: &Identifiers) -> Ordering {
    match (a.is_empty(), b.is_empty()) {
        (true, true) => Ordering::Equal,
        (false, true) => Ordering::Greater, // a build ranks above its release
        (true, false) => Ordering::Less,
        (false, false) => a.cmp_ids(b),
    }
}

impl Ord for Version {
    #[inline]
    fn cmp(&self, other: &Self) -> Ordering {
        match self.cmp_tuple(other) {
            Ordering::Equal => {}
            o => return o,
        }
        // The common case: two plain releases of the same tuple.
        if self.meta.is_none() && other.meta.is_none() {
            return Ordering::Equal;
        }
        cmp_pre(self.pre(), other.pre()).then_with(|| cmp_build(self.build(), other.build()))
    }
}

impl PartialOrd for Version {
    #[inline]
    fn partial_cmp(&self, other: &Self) -> Option<Ordering> {
        Some(self.cmp(other))
    }
}

impl PartialEq for Version {
    #[inline]
    fn eq(&self, other: &Self) -> bool {
        self.cmp(other) == Ordering::Equal
    }
}

impl Eq for Version {}

impl Hash for Version {
    fn hash<H: Hasher>(&self, state: &mut H) {
        self.major.hash(state);
        self.minor.hash(state);
        self.patch.hash(state);
        self.pre().hash(state);
        for id in self.build().iter() {
            match id {
                crate::Identifier::Numeric(n) => n.trim_start_matches('0').hash(state),
                crate::Identifier::AlphaNumeric(a) => a.hash(state),
            }
        }
    }
}

impl fmt::Display for Version {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}.{}.{}", self.major, self.minor, self.patch)?;
        if let Some(m) = &self.meta {
            if !m.pre.is_empty() {
                write!(f, "-{}", m.pre)?;
            }
            if !m.build.is_empty() {
                write!(f, "+{}", m.build)?;
            }
        }
        Ok(())
    }
}

impl FromStr for Version {
    type Err = Error;
    fn from_str(s: &str) -> Result<Self, Self::Err> {
        Version::parse(s)
    }
}

// ---------------------------------------------------------------- parsing

pub(crate) struct Cursor<'a> {
    pub s: &'a [u8],
    pub i: usize,
}

impl<'a> Cursor<'a> {
    pub fn new(s: &'a str) -> Self {
        Cursor {
            s: s.as_bytes(),
            i: 0,
        }
    }
    #[inline]
    pub fn peek(&self) -> Option<u8> {
        self.s.get(self.i).copied()
    }
    #[inline]
    pub fn eat(&mut self, c: u8) -> bool {
        if self.peek() == Some(c) {
            self.i += 1;
            true
        } else {
            false
        }
    }
    #[inline]
    pub fn done(&self) -> bool {
        self.i >= self.s.len()
    }
}

/// Byte classes for identifier scanning: 0 = not an identifier character,
/// 1 = letter or hyphen, 2 = digit.
const CLASS: [u8; 256] = {
    let mut t = [0u8; 256];
    let mut c = 0;
    while c < 256 {
        let b = c as u8;
        t[c] = if b.is_ascii_digit() {
            2
        } else if b.is_ascii_alphabetic() || b == b'-' {
            1
        } else {
            0
        };
        c += 1;
    }
    t
};

#[cold]
#[inline(never)]
pub(crate) fn invalid(input: &str) -> Error {
    Error::InvalidVersion(input.to_string())
}

#[cold]
#[inline(never)]
fn too_large(input: &str) -> Error {
    Error::TooLarge(input.to_string())
}

/// `0` or a non-zero digit followed by digits, at most `MAX_SAFE_INTEGER`.
#[inline(always)]
pub(crate) fn numeric(cur: &mut Cursor<'_>, input: &str) -> Result<u64, Error> {
    let s = cur.s;
    let start = cur.i;
    let mut i = start;
    let mut n: u64 = 0;
    while i < s.len() {
        let d = s[i].wrapping_sub(b'0');
        if d > 9 {
            break;
        }
        // At most 20 digits fit a u64; anything past 16 is rejected below.
        if i - start < 20 {
            n = n.wrapping_mul(10).wrapping_add(u64::from(d));
        }
        i += 1;
    }
    let len = i - start;
    if len == 0 || (len > 1 && s[start] == b'0') {
        return Err(invalid(input));
    }
    if len > 16 || n > MAX_SAFE_INTEGER {
        return Err(too_large(input));
    }
    cur.i = i;
    Ok(n)
}

/// Dot-separated identifiers starting at the cursor. With `pre`, all-digit
/// identifiers must have no leading zero and be below `MAX_SAFE_INTEGER`.
fn identifiers(cur: &mut Cursor<'_>, input: &str, pre: bool) -> Result<Identifiers, Error> {
    let s = cur.s;
    let start = cur.i;
    let mut i = start;
    loop {
        let id_start = i;
        let mut digits = true;
        while i < s.len() {
            let class = CLASS[s[i] as usize];
            if class == 0 {
                break;
            }
            digits &= class == 2;
            i += 1;
        }
        let len = i - id_start;
        if len == 0 {
            return Err(invalid(input));
        }
        if pre && digits {
            if len > 1 && s[id_start] == b'0' {
                return Err(invalid(input));
            }
            // The JavaScript reference requires num < MAX_SAFE_INTEGER.
            if len >= 16 {
                let n = s[id_start..i].iter().fold(0u64, |n, &c| {
                    n.saturating_mul(10).saturating_add(u64::from(c - b'0'))
                });
                if n >= MAX_SAFE_INTEGER {
                    return Err(too_large(input));
                }
            }
        }
        if i < s.len() && s[i] == b'.' {
            i += 1;
            continue;
        }
        break;
    }
    cur.i = i;
    // Only ASCII identifier characters were consumed.
    Ok(Identifiers::from_ascii(&s[start..i]))
}

pub(crate) fn pre_release(cur: &mut Cursor<'_>, input: &str) -> Result<Identifiers, Error> {
    identifiers(cur, input, true)
}

pub(crate) fn build(cur: &mut Cursor<'_>, input: &str) -> Result<Identifiers, Error> {
    identifiers(cur, input, false)
}

fn parse_core(s: &str, input: &str) -> Result<Version, Error> {
    let bad = || invalid(input);
    let mut cur = Cursor::new(s);
    let major = numeric(&mut cur, input)?;
    if !cur.eat(b'.') {
        return Err(bad());
    }
    let minor = numeric(&mut cur, input)?;
    if !cur.eat(b'.') {
        return Err(bad());
    }
    let patch = numeric(&mut cur, input)?;
    let pre = if cur.eat(b'-') {
        pre_release(&mut cur, input)?
    } else {
        Identifiers::empty()
    };
    let build = if cur.eat(b'+') {
        build(&mut cur, input)?
    } else {
        Identifiers::empty()
    };
    if !cur.done() {
        return Err(bad());
    }
    Ok(Version::from_parts(major, minor, patch, pre, build))
}
