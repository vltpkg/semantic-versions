use std::cmp::Ordering;
use std::fmt;

/// One pre-release or build identifier, borrowed from its version.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum Identifier<'a> {
    /// All digits, compared numerically.
    Numeric(&'a str),
    /// Contains a letter or hyphen, compared in ASCII order.
    AlphaNumeric(&'a str),
}

impl<'a> Identifier<'a> {
    pub(crate) fn new(s: &'a str) -> Self {
        if s.bytes().all(|c| c.is_ascii_digit()) {
            Identifier::Numeric(s)
        } else {
            Identifier::AlphaNumeric(s)
        }
    }

    /// The identifier as written.
    pub fn as_str(&self) -> &'a str {
        match self {
            Identifier::Numeric(s) | Identifier::AlphaNumeric(s) => s,
        }
    }

    /// The numeric value, for a numeric identifier that fits in a `u64`.
    pub fn as_number(&self) -> Option<u64> {
        match self {
            Identifier::Numeric(s) => s.parse().ok(),
            Identifier::AlphaNumeric(_) => None,
        }
    }
}

impl fmt::Display for Identifier<'_> {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(self.as_str())
    }
}

impl Ord for Identifier<'_> {
    /// Numeric identifiers compare numerically (ignoring leading zeroes, which
    /// builds may carry) and sort before alphanumeric ones, which compare in
    /// ASCII order.
    fn cmp(&self, other: &Self) -> Ordering {
        match (self, other) {
            (Identifier::Numeric(a), Identifier::Numeric(b)) => {
                let a = a.trim_start_matches('0');
                let b = b.trim_start_matches('0');
                a.len()
                    .cmp(&b.len())
                    .then_with(|| a.as_bytes().cmp(b.as_bytes()))
            }
            (Identifier::Numeric(_), Identifier::AlphaNumeric(_)) => Ordering::Less,
            (Identifier::AlphaNumeric(_), Identifier::Numeric(_)) => Ordering::Greater,
            (Identifier::AlphaNumeric(a), Identifier::AlphaNumeric(b)) => {
                a.as_bytes().cmp(b.as_bytes())
            }
        }
    }
}

impl PartialOrd for Identifier<'_> {
    fn partial_cmp(&self, other: &Self) -> Option<Ordering> {
        Some(self.cmp(other))
    }
}

/// Compare two identifiers given as bytes (always ASCII).
#[inline]
fn cmp_id_bytes(a: &[u8], b: &[u8]) -> Ordering {
    let da = a.iter().all(u8::is_ascii_digit);
    let db = b.iter().all(u8::is_ascii_digit);
    match (da, db) {
        (true, true) => {
            let a = trim_zeros(a);
            let b = trim_zeros(b);
            a.len().cmp(&b.len()).then_with(|| a.cmp(b))
        }
        (true, false) => Ordering::Less,
        (false, true) => Ordering::Greater,
        (false, false) => a.cmp(b),
    }
}

#[inline]
fn trim_zeros(s: &[u8]) -> &[u8] {
    let n = s.iter().take_while(|&&c| c == b'0').count();
    &s[n..]
}

const INLINE: usize = 22;

#[derive(Clone)]
enum Repr {
    Empty,
    Inline { len: u8, buf: [u8; INLINE] },
    Heap(Box<[u8]>),
}

/// Dot-separated identifiers (a pre-release or a build), stored as written.
/// Empty when the version has none. Short lists (up to 22 bytes, which covers
/// `rc.1`, `beta.4`, `next.12`, …) are stored inline without allocating;
/// identifiers are produced on demand.
#[derive(Clone)]
pub struct Identifiers(Repr);

impl Default for Identifiers {
    fn default() -> Self {
        Identifiers::empty()
    }
}

impl PartialEq for Identifiers {
    fn eq(&self, other: &Self) -> bool {
        self.bytes() == other.bytes()
    }
}

impl Eq for Identifiers {}

impl std::hash::Hash for Identifiers {
    fn hash<H: std::hash::Hasher>(&self, state: &mut H) {
        self.bytes().hash(state);
    }
}

impl Identifiers {
    pub(crate) fn from_validated(s: &str) -> Self {
        Identifiers::from_ascii(s.as_bytes())
    }

    /// `b` must already be validated identifier text (ASCII only).
    #[inline]
    pub(crate) fn from_ascii(b: &[u8]) -> Self {
        if b.is_empty() {
            Identifiers(Repr::Empty)
        } else if b.len() <= INLINE {
            let mut buf = [0u8; INLINE];
            buf[..b.len()].copy_from_slice(b);
            Identifiers(Repr::Inline {
                len: b.len() as u8,
                buf,
            })
        } else {
            Identifiers(Repr::Heap(b.into()))
        }
    }

    pub(crate) const fn empty() -> Self {
        Identifiers(Repr::Empty)
    }

    #[inline]
    fn bytes(&self) -> &[u8] {
        match &self.0 {
            Repr::Empty => &[],
            Repr::Inline { len, buf } => &buf[..*len as usize],
            Repr::Heap(b) => b,
        }
    }

    /// True when there are no identifiers.
    #[inline]
    pub fn is_empty(&self) -> bool {
        self.bytes().is_empty()
    }

    /// The identifiers as written, joined by `.` (empty when there are none).
    pub fn as_str(&self) -> &str {
        // Only ASCII identifier characters are ever stored.
        std::str::from_utf8(self.bytes()).expect("identifiers are ASCII")
    }

    /// The identifiers in order.
    pub fn iter(&self) -> impl Iterator<Item = Identifier<'_>> + '_ {
        let s = self.as_str();
        s.split('.')
            .filter(move |_| !s.is_empty())
            .map(Identifier::new)
    }

    /// Number of identifiers.
    pub fn len(&self) -> usize {
        let b = self.bytes();
        if b.is_empty() {
            0
        } else {
            b.iter().filter(|&&c| c == b'.').count() + 1
        }
    }

    /// True if `prefix`'s identifiers are a prefix of these (identifier-wise:
    /// `rc` is a prefix of `rc.1` but not of `rc1`).
    #[inline]
    pub fn starts_with(&self, prefix: &Identifiers) -> bool {
        let (s, p) = (self.bytes(), prefix.bytes());
        p.is_empty() || (s.starts_with(p) && (s.len() == p.len() || s[p.len()] == b'.'))
    }

    /// Identifier-wise comparison; a longer list wins when one is a prefix of
    /// the other.
    pub(crate) fn cmp_ids(&self, other: &Identifiers) -> Ordering {
        let (a, b) = (self.bytes(), other.bytes());
        // Identifiers before the first differing byte are equal: skip them in
        // one pass (eight bytes at a time) rather than classifying each one.
        // Canaries and nightlies share long prefixes.
        let n = a.len().min(b.len());
        let mut k = 0;
        while k + 8 <= n && a[k..k + 8] == b[k..k + 8] {
            k += 8;
        }
        while k < n && a[k] == b[k] {
            k += 1;
        }
        if k == a.len() && k == b.len() {
            return Ordering::Equal;
        }
        let mut i = k;
        while i > 0 && a[i - 1] != b'.' {
            i -= 1;
        }
        let mut j = i;
        loop {
            let ea = a[i..]
                .iter()
                .position(|&c| c == b'.')
                .map_or(a.len(), |p| i + p);
            let eb = b[j..]
                .iter()
                .position(|&c| c == b'.')
                .map_or(b.len(), |p| j + p);
            match cmp_id_bytes(&a[i..ea], &b[j..eb]) {
                Ordering::Equal => {}
                o => return o,
            }
            match (ea == a.len(), eb == b.len()) {
                (true, true) => return Ordering::Equal,
                (true, false) => return Ordering::Less,
                (false, true) => return Ordering::Greater,
                (false, false) => {}
            }
            i = ea + 1;
            j = eb + 1;
        }
    }
}

impl fmt::Debug for Identifiers {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_list().entries(self.iter()).finish()
    }
}

impl fmt::Display for Identifiers {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(self.as_str())
    }
}
