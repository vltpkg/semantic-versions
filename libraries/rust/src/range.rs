use std::fmt;
use std::str::FromStr;

use crate::identifier::Identifiers;
use crate::version::{build, numeric, pre_release, split_reference, Cursor, Version};
use crate::{Error, MAX_LENGTH};

/// A comparator operator. `Eq` is written without an operator (`1.2.3`).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum Op {
    /// `<`
    Lt,
    /// `<=`
    Lte,
    /// `>`
    Gt,
    /// `>=`
    Gte,
    /// `=` (written as a bare version)
    Eq,
}

impl Op {
    fn as_str(self) -> &'static str {
        match self {
            Op::Lt => "<",
            Op::Lte => "<=",
            Op::Gt => ">",
            Op::Gte => ">=",
            Op::Eq => "",
        }
    }
}

/// A primitive comparator: an operator and a version, or "any" (matches every
/// version). A build on the comparator's version is a **build channel**: a
/// prefix filter on the candidate's build, orthogonal to the numeric bound. A
/// pre-release on it declares a **pre-release channel** for its tuple.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Comparator {
    /// The operator.
    pub op: Op,
    /// The bound, or `None` for the "any" comparator.
    pub version: Option<Version>,
}

impl Comparator {
    fn any() -> Self {
        Comparator {
            op: Op::Eq,
            version: None,
        }
    }

    fn new(op: Op, version: Version) -> Self {
        // `>=0.0.0` bounds nothing: it is the "any" comparator.
        if op == Op::Gte
            && version.major == 0
            && version.minor == 0
            && version.patch == 0
            && version.pre().is_empty()
            && version.build().is_empty()
        {
            return Comparator::any();
        }
        Comparator {
            op,
            version: Some(version),
        }
    }

    /// True for the comparator that matches every version.
    pub fn is_any(&self) -> bool {
        self.version.is_none()
    }

    fn is_null(&self) -> bool {
        matches!(&self.version, Some(v) if self.op == Op::Lt
            && v.major == 0 && v.minor == 0 && v.patch == 0
            && v.pre().as_str() == "0" && v.build().is_empty())
    }

    /// True if `version` passes the numeric bound and, when the comparator
    /// declares a build channel, carries a build in that channel.
    #[inline]
    pub fn test(&self, version: &Version) -> bool {
        let Some(bound) = &self.version else {
            return true;
        };
        let ord = version.cmp_ignoring_build(bound);
        let numeric = match self.op {
            Op::Lt => ord.is_lt(),
            Op::Lte => ord.is_le(),
            Op::Gt => ord.is_gt(),
            Op::Gte => ord.is_ge(),
            Op::Eq => ord.is_eq(),
        };
        if !numeric {
            return false;
        }
        let channel = bound.build();
        channel.is_empty() || version.build().starts_with(channel)
    }
}

impl fmt::Display for Comparator {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match &self.version {
            None => Ok(()),
            Some(v) => write!(f, "{}{}", self.op.as_str(), v),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct Set {
    comparators: Vec<Comparator>,
    /// `*-*`: pre-releases on every tuple are admitted.
    universal_pre: bool,
    /// `X.Y.Z-*`: any pre-release of these tuples is admitted.
    any_pre: Vec<(u64, u64, u64)>,
}

impl Set {
    #[inline]
    fn test(&self, v: &Version) -> bool {
        if !self.comparators.iter().all(|c| c.test(v)) {
            return false;
        }
        // Stable versions are unaffected by pre-release channels.
        if v.pre().is_empty() || self.universal_pre {
            return true;
        }
        if self
            .any_pre
            .iter()
            .any(|&(a, b, c)| a == v.major && b == v.minor && c == v.patch)
        {
            return true;
        }
        // A pre-release is admitted only by a comparator that declares a channel
        // on the same tuple whose identifiers it begins with.
        self.comparators.iter().any(|c| match &c.version {
            Some(b) if !b.pre().is_empty() && b.same_tuple(v) => v.pre().starts_with(b.pre()),
            _ => false,
        })
    }
}

/// A parsed range: one or more comparator sets joined by `||`, optionally
/// scoped to a context (`npm:react@^18`).
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Range {
    context: Option<Box<str>>,
    sets: Vec<Set>,
}

impl Range {
    /// Parse a range. Advanced syntax (hyphen, x-ranges, `~`, `~>`, `^`, `-*`,
    /// `*-*`) desugars to primitive comparators exactly as in the specification.
    pub fn parse(input: &str) -> Result<Self, Error> {
        if input.len() > MAX_LENGTH {
            return Err(Error::TooLong);
        }
        let (context, body) = split_reference(input);
        let mut sets = Vec::new();
        for part in body.split("||") {
            sets.push(parse_set(part.trim(), input)?);
        }
        if sets.len() > 1 {
            // Drop sets that can match nothing (unless that is all there is),
            // and collapse to "any" if any set matches everything.
            let first = sets[0].clone();
            sets.retain(|s| !s.comparators.first().is_some_and(Comparator::is_null));
            if sets.is_empty() {
                sets.push(first);
            } else if sets.len() > 1 {
                if let Some(any) = sets
                    .iter()
                    .find(|s| s.comparators.len() == 1 && s.comparators[0].is_any())
                {
                    sets = vec![any.clone()];
                }
            }
        }
        Ok(Range {
            context: context.map(Into::into),
            sets,
        })
    }

    /// The context this range is scoped to, if any.
    pub fn context(&self) -> Option<&str> {
        self.context.as_deref()
    }

    /// The desugared comparator sets.
    pub fn comparator_sets(&self) -> impl Iterator<Item = &[Comparator]> {
        self.sets.iter().map(|s| s.comparators.as_slice())
    }

    /// True if `version` satisfies the range. A context-scoped range only
    /// admits versions of the same context.
    #[inline]
    pub fn test(&self, version: &Version) -> bool {
        if let Some(c) = &self.context {
            if version.context() != Some(&**c) {
                return false;
            }
        }
        self.sets.iter().any(|s| s.test(version))
    }

    /// Alias of [`Range::test`].
    pub fn satisfies(&self, version: &Version) -> bool {
        self.test(version)
    }
}

impl fmt::Display for Range {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        for (i, set) in self.sets.iter().enumerate() {
            if i > 0 {
                f.write_str("||")?;
            }
            let mut first = true;
            for c in &set.comparators {
                if c.is_any() {
                    continue;
                }
                if !first {
                    f.write_str(" ")?;
                }
                first = false;
                write!(f, "{c}")?;
            }
        }
        Ok(())
    }
}

impl FromStr for Range {
    type Err = Error;
    fn from_str(s: &str) -> Result<Self, Self::Err> {
        Range::parse(s)
    }
}

// --------------------------------------------------------------- desugaring

/// One component of a partial version: a number or a wildcard (`x`, `X`, `*`,
/// or absent).
#[derive(Clone, Copy)]
enum Xr {
    X,
    N(u64),
}

impl Xr {
    fn n(self) -> u64 {
        match self {
            Xr::N(n) => n,
            Xr::X => 0,
        }
    }
    fn is_x(self) -> bool {
        matches!(self, Xr::X)
    }
}

struct Partial {
    major: Xr,
    minor: Xr,
    patch: Xr,
    pre: Identifiers,
    build: Identifiers,
}

fn xr(cur: &mut Cursor<'_>, input: &str) -> Result<Xr, Error> {
    match cur.peek() {
        Some(b'x' | b'X' | b'*') => {
            cur.i += 1;
            Ok(Xr::X)
        }
        Some(c) if c.is_ascii_digit() => Ok(Xr::N(numeric(cur, input)?)),
        _ => Err(Error::InvalidRange(input.to_string())),
    }
}

/// `<xr> [ "." <xr> [ "." <xr> <qualifier>? ] ]`
fn partial(s: &str, input: &str) -> Result<Partial, Error> {
    let mut cur = Cursor::new(s);
    let major = xr(&mut cur, input)?;
    let mut p = Partial {
        major,
        minor: Xr::X,
        patch: Xr::X,
        pre: Identifiers::empty(),
        build: Identifiers::empty(),
    };
    if cur.eat(b'.') {
        p.minor = xr(&mut cur, input)?;
        if cur.eat(b'.') {
            p.patch = xr(&mut cur, input)?;
            if cur.eat(b'-') {
                p.pre = pre_release(&mut cur, input)
                    .map_err(|_| Error::InvalidRange(input.to_string()))?;
            }
            if cur.eat(b'+') {
                p.build =
                    build(&mut cur, input).map_err(|_| Error::InvalidRange(input.to_string()))?;
            }
        }
    }
    if !cur.done() {
        return Err(Error::InvalidRange(input.to_string()));
    }
    Ok(p)
}

fn ver(major: u64, minor: u64, patch: u64, pre: Identifiers) -> Version {
    Version::new(major, minor, patch).with_pre(pre)
}

fn zero() -> Identifiers {
    Identifiers::from_validated("0")
}

fn none() -> Identifiers {
    Identifiers::empty()
}

/// Attach a build channel to every comparator a `~`/`^` desugars to.
fn with_channel(mut comps: Vec<Comparator>, channel: &Identifiers) -> Vec<Comparator> {
    if !channel.is_empty() {
        for c in comps.iter_mut() {
            if let Some(v) = c.version.take() {
                c.version = Some(v.with_build(channel.clone()));
            }
        }
        // A channel can turn `>=0.0.0` back into a real bound.
        for c in comps.iter_mut() {
            if c.version.is_none() {
                *c = Comparator {
                    op: Op::Gte,
                    version: Some(Version::new(0, 0, 0).with_build(channel.clone())),
                };
            }
        }
    }
    comps
}

fn tilde(p: Partial) -> Vec<Comparator> {
    let Partial {
        major,
        minor,
        patch,
        pre,
        build,
    } = p;
    if major.is_x() {
        return vec![Comparator::any()];
    }
    let (m, mi) = (major.n(), minor.n());
    let out = if minor.is_x() {
        vec![
            Comparator::new(Op::Gte, ver(m, 0, 0, none())),
            Comparator::new(Op::Lt, ver(m + 1, 0, 0, zero())),
        ]
    } else if patch.is_x() {
        vec![
            Comparator::new(Op::Gte, ver(m, mi, 0, none())),
            Comparator::new(Op::Lt, ver(m, mi + 1, 0, zero())),
        ]
    } else {
        vec![
            Comparator::new(Op::Gte, ver(m, mi, patch.n(), pre)),
            Comparator::new(Op::Lt, ver(m, mi + 1, 0, zero())),
        ]
    };
    with_channel(out, &build)
}

fn caret(p: Partial) -> Vec<Comparator> {
    let Partial {
        major,
        minor,
        patch,
        pre,
        build,
    } = p;
    if major.is_x() {
        return vec![Comparator::any()];
    }
    let (m, mi, pa) = (major.n(), minor.n(), patch.n());
    let out = if minor.is_x() {
        vec![
            Comparator::new(Op::Gte, ver(m, 0, 0, none())),
            Comparator::new(Op::Lt, ver(m + 1, 0, 0, zero())),
        ]
    } else if patch.is_x() {
        let upper = if m == 0 {
            ver(0, mi + 1, 0, zero())
        } else {
            ver(m + 1, 0, 0, zero())
        };
        vec![
            Comparator::new(Op::Gte, ver(m, mi, 0, none())),
            Comparator::new(Op::Lt, upper),
        ]
    } else {
        let upper = if m == 0 {
            if mi == 0 {
                ver(0, 0, pa + 1, zero())
            } else {
                ver(0, mi + 1, 0, zero())
            }
        } else {
            ver(m + 1, 0, 0, zero())
        };
        vec![
            Comparator::new(Op::Gte, ver(m, mi, pa, pre)),
            Comparator::new(Op::Lt, upper),
        ]
    };
    with_channel(out, &build)
}

/// A plain or x-range comparator with an optional operator.
fn xrange(op: Op, p: Partial) -> Vec<Comparator> {
    let Partial {
        major,
        minor,
        patch,
        pre,
        build,
    } = p;
    let xm = major.is_x() || minor.is_x();
    let any_x = xm || patch.is_x();
    if major.is_x() {
        return match op {
            Op::Gt | Op::Lt => vec![Comparator::new(Op::Lt, ver(0, 0, 0, zero()))],
            _ => vec![Comparator::any()],
        };
    }
    let m = major.n();
    let mi = if xm { 0 } else { minor.n() };
    if any_x && op != Op::Eq {
        return vec![match op {
            Op::Gt => {
                if xm {
                    Comparator::new(Op::Gte, ver(m + 1, 0, 0, none()))
                } else {
                    Comparator::new(Op::Gte, ver(m, mi + 1, 0, none()))
                }
            }
            Op::Lte => {
                if xm {
                    Comparator::new(Op::Lt, ver(m + 1, 0, 0, zero()))
                } else {
                    Comparator::new(Op::Lt, ver(m, mi + 1, 0, zero()))
                }
            }
            Op::Lt => Comparator::new(Op::Lt, ver(m, mi, 0, zero())),
            _ => Comparator::new(op, ver(m, mi, 0, none())),
        }];
    }
    if xm {
        return vec![
            Comparator::new(Op::Gte, ver(m, 0, 0, none())),
            Comparator::new(Op::Lt, ver(m + 1, 0, 0, zero())),
        ];
    }
    if patch.is_x() {
        return vec![
            Comparator::new(Op::Gte, ver(m, mi, 0, none())),
            Comparator::new(Op::Lt, ver(m, mi + 1, 0, zero())),
        ];
    }
    vec![Comparator::new(
        op,
        ver(m, mi, patch.n(), pre).with_build(build),
    )]
}

/// `<partial> - <partial>`: an inclusive span. Builds on either endpoint are
/// ignored; a pre-release on an endpoint is kept as that endpoint's channel.
fn hyphen(from: Partial, to: Partial) -> Vec<Comparator> {
    let mut out = Vec::new();
    if !from.major.is_x() {
        let v = if from.minor.is_x() {
            ver(from.major.n(), 0, 0, none())
        } else if from.patch.is_x() {
            ver(from.major.n(), from.minor.n(), 0, none())
        } else {
            ver(from.major.n(), from.minor.n(), from.patch.n(), from.pre)
        };
        out.push(Comparator::new(Op::Gte, v));
    }
    if !to.major.is_x() {
        out.push(if to.minor.is_x() {
            Comparator::new(Op::Lt, ver(to.major.n() + 1, 0, 0, zero()))
        } else if to.patch.is_x() {
            Comparator::new(Op::Lt, ver(to.major.n(), to.minor.n() + 1, 0, zero()))
        } else {
            Comparator::new(
                Op::Lte,
                ver(to.major.n(), to.minor.n(), to.patch.n(), to.pre),
            )
        });
    }
    if out.is_empty() {
        out.push(Comparator::any());
    }
    out
}

/// `X.Y.Z-*` with an optional operator: the empty-prefix pre-release channel.
fn tuple_pre(tok: &str) -> Option<(&str, u64, u64, u64)> {
    let body = tok.strip_suffix("-*")?;
    let (op, rest) = ["<=", ">=", "^", "~", "<", ">", "="]
        .iter()
        .find_map(|op| body.strip_prefix(op).map(|r| (*op, r)))
        .unwrap_or(("", body));
    let mut cur = Cursor::new(rest);
    let a = numeric(&mut cur, tok).ok()?;
    if !cur.eat(b'.') {
        return None;
    }
    let b = numeric(&mut cur, tok).ok()?;
    if !cur.eat(b'.') {
        return None;
    }
    let c = numeric(&mut cur, tok).ok()?;
    cur.done().then_some((op, a, b, c))
}

fn comparator_token(tok: &str, input: &str) -> Result<Vec<Comparator>, Error> {
    if tok.is_empty() || tok == "*" {
        return Ok(vec![Comparator::any()]);
    }
    if let Some(rest) = tok.strip_prefix('^') {
        return Ok(caret(partial(rest, input)?));
    }
    if let Some(rest) = tok.strip_prefix("~>").or_else(|| tok.strip_prefix('~')) {
        return Ok(tilde(partial(rest, input)?));
    }
    let (op, rest) = if let Some(r) = tok.strip_prefix(">=") {
        (Op::Gte, r)
    } else if let Some(r) = tok.strip_prefix("<=") {
        (Op::Lte, r)
    } else if let Some(r) = tok.strip_prefix('>') {
        (Op::Gt, r)
    } else if let Some(r) = tok.strip_prefix('<') {
        (Op::Lt, r)
    } else if let Some(r) = tok.strip_prefix('=') {
        (Op::Eq, r)
    } else {
        (Op::Eq, tok)
    };
    Ok(xrange(op, partial(rest, input)?))
}

fn same_comparator(a: &Comparator, b: &Comparator) -> bool {
    a.op == b.op
        && match (&a.version, &b.version) {
            (None, None) => true,
            (Some(x), Some(y)) => {
                x.major == y.major
                    && x.minor == y.minor
                    && x.patch == y.patch
                    && x.pre() == y.pre()
                    && x.build() == y.build()
            }
            _ => false,
        }
}

const OPERATORS: [&str; 8] = ["<", "<=", ">", ">=", "=", "~", "~>", "^"];

fn parse_set(s: &str, input: &str) -> Result<Set, Error> {
    let mut universal_pre = false;
    let mut any_pre = Vec::new();
    let mut tokens: Vec<std::borrow::Cow<'_, str>> = Vec::new();
    for tok in s.split_whitespace() {
        if tok == "*-*" {
            universal_pre = true;
            tokens.push(">=0.0.0-0".into());
        } else if let Some((op, a, b, c)) = tuple_pre(tok) {
            any_pre.push((a, b, c));
            tokens.push(format!("{op}{a}.{b}.{c}-0").into());
        } else {
            tokens.push(tok.into());
        }
    }

    let mut comps: Vec<Comparator> = Vec::new();
    if tokens.len() == 3 && tokens[1] == "-" {
        comps = hyphen(partial(&tokens[0], input)?, partial(&tokens[2], input)?);
    } else {
        let mut i = 0;
        while i < tokens.len() {
            // `>= 1.2.3`, `~ 1.2`, `^ 1`: an operator separated from its version.
            if OPERATORS.contains(&&*tokens[i]) && i + 1 < tokens.len() {
                let joined = format!("{}{}", tokens[i], tokens[i + 1]);
                comps.extend(comparator_token(&joined, input)?);
                i += 2;
            } else {
                comps.extend(comparator_token(&tokens[i], input)?);
                i += 1;
            }
        }
        if comps.is_empty() {
            comps.push(Comparator::any());
        }
    }

    // A comparator that can match nothing makes the whole set match nothing.
    if let Some(null) = comps.iter().find(|c| c.is_null()) {
        return Ok(Set {
            comparators: vec![null.clone()],
            universal_pre,
            any_pre,
        });
    }
    // Deduplicate by value (keeping first occurrence) and drop a redundant "any".
    let mut unique: Vec<Comparator> = Vec::with_capacity(comps.len());
    for c in comps {
        if !unique.iter().any(|u| same_comparator(u, &c)) {
            unique.push(c);
        }
    }
    if unique.len() > 1 {
        unique.retain(|c| !c.is_any());
    }
    Ok(Set {
        comparators: unique,
        universal_pre,
        any_pre,
    })
}
