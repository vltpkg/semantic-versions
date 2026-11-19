"""Semantic Versions: parsing, precedence and ranges.

A port of the JavaScript reference implementation (`semantic-versions` on
npm). Behaviour is checked against the shared conformance suite in
`conformance/` at the root of the repository.
"""

from __future__ import annotations

import re
from typing import Iterable, List, Optional, Sequence, Tuple

MAX_LENGTH = 256
MAX_SAFE_INTEGER = 9007199254740991

__all__ = [
    "MAX_LENGTH",
    "MAX_SAFE_INTEGER",
    "SemanticVersionError",
    "InvalidVersion",
    "InvalidRange",
    "Version",
    "Comparator",
    "Range",
    "split_reference",
    "parse",
    "valid",
    "valid_range",
    "compare",
    "satisfies",
    "max_satisfying",
    "min_satisfying",
    "sort",
    "rsort",
]


class SemanticVersionError(ValueError):
    """Base class for parse errors."""


class InvalidVersion(SemanticVersionError):
    """The input is not a version."""


class InvalidRange(SemanticVersionError):
    """The input is not a range."""


_NUM = r"(?:0|[1-9][0-9]*)"
_PRE_ID = r"(?:0|[1-9][0-9]*|[0-9]*[A-Za-z-][0-9A-Za-z-]*)"
_BUILD_ID = r"[0-9A-Za-z-]+"
_PRE = rf"{_PRE_ID}(?:\.{_PRE_ID})*"
_BUILD = rf"{_BUILD_ID}(?:\.{_BUILD_ID})*"
_VERSION = re.compile(rf"({_NUM})\.({_NUM})\.({_NUM})(?:-({_PRE}))?(?:\+({_BUILD}))?")
_match_version = _VERSION.fullmatch
_PRE_ONLY = re.compile(_PRE).fullmatch
_BUILD_ONLY = re.compile(_BUILD).fullmatch
_XR = r"(?:[xX*]|0|[1-9][0-9]*)"
_PARTIAL = re.compile(
    rf"({_XR})(?:\.({_XR})(?:\.({_XR})(?:-([^+]*))?(?:\+(.*))?)?)?", re.S
).fullmatch
_TUPLE_PRE = re.compile(rf"(<=|>=|\^|~|<|>|=)?({_NUM})\.({_NUM})\.({_NUM})-\*").fullmatch


def _safe(n: str) -> bool:
    return len(n) <= 16 and int(n) <= MAX_SAFE_INTEGER


def _pre_safe(pre: str) -> bool:
    # The JavaScript reference requires numeric pre-release identifiers to be
    # below MAX_SAFE_INTEGER.
    for i in pre.split("."):
        if len(i) >= 16 and i.isdigit() and int(i) >= MAX_SAFE_INTEGER:
            return False
    return True


def _ids_key(ids: str) -> tuple:
    # Numeric identifiers sort numerically and below alphanumeric ones.
    return tuple((0, int(i), "") if i.isdigit() else (1, 0, i) for i in ids.split("."))


# A release ranks above its pre-releases; a build ranks above its release.
_RELEASE = (1, ())
_NO_BUILD = (0, ())


def _starts_with(ids: str, prefix: str) -> bool:
    """Identifier-wise prefix: `rc` begins `rc.1` but not `rc1`."""
    return not prefix or ids == prefix or ids.startswith(prefix + ".")


def split_reference(value: str) -> Tuple[Optional[str], str]:
    """Split an optional context off a reference.

    ``npm:react@1.2.3`` -> ``("npm:react", "1.2.3")``. The context ends at the
    last ``@`` of the first whitespace-delimited token; an ``@`` at position 0
    (a bare scoped npm name) means there is no context.
    """
    if "@" not in value:
        return None, value
    m = re.search(r"\s", value)
    head, tail = (value[: m.start()], value[m.start() :]) if m else (value, "")
    at = head.rfind("@")
    if at > 0:
        return head[:at], head[at + 1 :] + tail
    return None, value


class Version:
    """A parsed Semantic Version, optionally scoped to a context.

    Ordering follows the specification: pre-releases rank below their release
    and builds rank above it (``1.0.0-rc < 1.0.0 < 1.0.0+build``). The context
    never participates in precedence or equality.
    """

    __slots__ = ("major", "minor", "patch", "pre", "build", "context", "_key")

    def __init__(
        self,
        major: int,
        minor: int,
        patch: int,
        pre: str = "",
        build: str = "",
        context: Optional[str] = None,
    ) -> None:
        self.major = major
        self.minor = minor
        self.patch = patch
        self.pre = pre
        self.build = build
        self.context = context
        self._key = None

    @classmethod
    def parse(cls, value: str) -> "Version":
        """Parse a version, optionally context-qualified (``npm:react@1.2.3``).
        There is no coercion: ``v1.2.3`` and ``1.2`` are errors."""
        if len(value) > MAX_LENGTH:
            raise InvalidVersion(f"version is longer than {MAX_LENGTH} characters")
        m = _match_version(value)
        context = None
        if m is None:
            context, rest = split_reference(value)
            m = _match_version(rest.strip())
            if m is None:
                raise InvalidVersion(f"invalid version: {value!r}")
        major, minor, patch, pre, build = m.groups()
        if len(value) >= 16:
            if not (_safe(major) and _safe(minor) and _safe(patch)):
                raise InvalidVersion(f"version component too large: {value!r}")
            if pre and not _pre_safe(pre):
                raise InvalidVersion(f"pre-release identifier too large: {value!r}")
        v = cls.__new__(cls)
        v.major = int(major)
        v.minor = int(minor)
        v.patch = int(patch)
        v.pre = pre or ""
        v.build = build or ""
        v.context = context
        v._key = (
            v.major,
            v.minor,
            v.patch,
            (0, _ids_key(pre)) if pre else _RELEASE,
            (1, _ids_key(build)) if build else _NO_BUILD,
        )
        return v

    @property
    def prerelease(self) -> bool:
        return bool(self.pre)

    @property
    def key(self) -> tuple:
        """A tuple that orders versions by precedence."""
        k = self._key
        if k is None:
            pre = (0, _ids_key(self.pre)) if self.pre else _RELEASE
            build = (1, _ids_key(self.build)) if self.build else _NO_BUILD
            k = self._key = (self.major, self.minor, self.patch, pre, build)
        return k

    def _key_without_build(self) -> tuple:
        return self.key[:4]

    def without_build(self) -> "Version":
        return Version(self.major, self.minor, self.patch, self.pre, "", self.context)

    @property
    def reference(self) -> str:
        """``context@version``, or the bare version."""
        return f"{self.context}@{self}" if self.context else str(self)

    def __str__(self) -> str:
        s = f"{self.major}.{self.minor}.{self.patch}"
        if self.pre:
            s += "-" + self.pre
        if self.build:
            s += "+" + self.build
        return s

    def __repr__(self) -> str:
        return f"Version({self.reference!r})"

    def __eq__(self, other: object) -> bool:
        return isinstance(other, Version) and self.key == other.key

    def __ne__(self, other: object) -> bool:
        return not self == other

    def __lt__(self, other: "Version") -> bool:
        return self.key < other.key

    def __le__(self, other: "Version") -> bool:
        return self.key <= other.key

    def __gt__(self, other: "Version") -> bool:
        return self.key > other.key

    def __ge__(self, other: "Version") -> bool:
        return self.key >= other.key

    def __hash__(self) -> int:
        return hash(self.key)


_ANY = None  # an "any" comparator has no bound


class Comparator:
    """A primitive comparator: an operator and a bound, or "any".

    A build on the bound is a build channel (a prefix filter on the
    candidate's build); a pre-release on it declares a pre-release channel
    for its tuple.
    """

    __slots__ = ("op", "version", "_bound")

    def __init__(self, op: str, version: Optional[Version]) -> None:
        self.op = op
        self.version = version
        self._bound = version._key_without_build() if version is not None else None

    @classmethod
    def make(cls, op: str, version: Version) -> "Comparator":
        # `>=0.0.0` bounds nothing: it is the "any" comparator.
        if (
            op == ">="
            and version.major == 0
            and version.minor == 0
            and version.patch == 0
            and not version.pre
            and not version.build
        ):
            return ANY
        return cls(op, version)

    @property
    def is_any(self) -> bool:
        return self.version is None

    @property
    def is_null(self) -> bool:
        v = self.version
        return (
            v is not None
            and self.op == "<"
            and v.major == 0
            and v.minor == 0
            and v.patch == 0
            and v.pre == "0"
            and not v.build
        )

    def test(self, version: Version) -> bool:
        b = self._bound
        if b is None:
            return True
        k = version.key[:4]
        op = self.op
        if op == "<":
            ok = k < b
        elif op == ">=":
            ok = k >= b
        elif op == "<=":
            ok = k <= b
        elif op == ">":
            ok = k > b
        else:
            ok = k == b
        if not ok:
            return False
        channel = self.version.build
        return not channel or _starts_with(version.build, channel)

    def _same(self, other: "Comparator") -> bool:
        a, b = self.version, other.version
        if self.op != other.op:
            return False
        if a is None or b is None:
            return a is b
        return (a.major, a.minor, a.patch, a.pre, a.build) == (
            b.major,
            b.minor,
            b.patch,
            b.pre,
            b.build,
        )

    def __str__(self) -> str:
        return "" if self.version is None else self.op + str(self.version)

    def __repr__(self) -> str:
        return f"Comparator({str(self)!r})"


ANY = Comparator("", None)
_ZERO = "0"


def _v(major: int, minor: int, patch: int, pre: str = "") -> Version:
    return Version(major, minor, patch, pre)


class _Partial:
    __slots__ = ("major", "minor", "patch", "pre", "build")


def _partial(s: str, raw: str) -> _Partial:
    m = _PARTIAL(s)
    if m is None:
        raise InvalidRange(f"invalid range: {raw!r}")
    major, minor, patch, pre, build = m.groups()
    p = _Partial()
    p.major = _xr(major, raw)
    p.minor = _xr(minor, raw)
    p.patch = _xr(patch, raw)
    if pre is not None:
        if not _PRE_ONLY(pre) or not _pre_safe(pre):
            raise InvalidRange(f"invalid range: {raw!r}")
    if build is not None and not _BUILD_ONLY(build):
        raise InvalidRange(f"invalid range: {raw!r}")
    p.pre = pre or ""
    p.build = build or ""
    return p


def _xr(s: Optional[str], raw: str) -> Optional[int]:
    if s is None or s in ("x", "X", "*"):
        return None
    if not _safe(s):
        raise InvalidRange(f"range component too large: {raw!r}")
    return int(s)


def _with_channel(comps: List[Comparator], channel: str) -> List[Comparator]:
    if not channel:
        return comps
    out = []
    for c in comps:
        if c.version is None:
            # A channel turns `>=0.0.0` back into a real bound.
            out.append(Comparator(">=", Version(0, 0, 0, "", channel)))
        else:
            v = c.version
            out.append(Comparator(c.op, Version(v.major, v.minor, v.patch, v.pre, channel)))
    return out


def _tilde(p: _Partial) -> List[Comparator]:
    if p.major is None:
        return [ANY]
    m, mi = p.major, p.minor or 0
    if p.minor is None:
        out = [Comparator.make(">=", _v(m, 0, 0)), Comparator.make("<", _v(m + 1, 0, 0, _ZERO))]
    elif p.patch is None:
        out = [Comparator.make(">=", _v(m, mi, 0)), Comparator.make("<", _v(m, mi + 1, 0, _ZERO))]
    else:
        out = [
            Comparator.make(">=", _v(m, mi, p.patch, p.pre)),
            Comparator.make("<", _v(m, mi + 1, 0, _ZERO)),
        ]
    return _with_channel(out, p.build)


def _caret(p: _Partial) -> List[Comparator]:
    if p.major is None:
        return [ANY]
    m, mi, pa = p.major, p.minor or 0, p.patch or 0
    if p.minor is None:
        out = [Comparator.make(">=", _v(m, 0, 0)), Comparator.make("<", _v(m + 1, 0, 0, _ZERO))]
    elif p.patch is None:
        upper = _v(0, mi + 1, 0, _ZERO) if m == 0 else _v(m + 1, 0, 0, _ZERO)
        out = [Comparator.make(">=", _v(m, mi, 0)), Comparator.make("<", upper)]
    else:
        if m == 0:
            upper = _v(0, 0, pa + 1, _ZERO) if mi == 0 else _v(0, mi + 1, 0, _ZERO)
        else:
            upper = _v(m + 1, 0, 0, _ZERO)
        out = [Comparator.make(">=", _v(m, mi, pa, p.pre)), Comparator.make("<", upper)]
    return _with_channel(out, p.build)


def _xrange(op: str, p: _Partial) -> List[Comparator]:
    xm = p.major is None or p.minor is None
    any_x = xm or p.patch is None
    if p.major is None:
        if op in (">", "<"):
            return [Comparator.make("<", _v(0, 0, 0, _ZERO))]
        return [ANY]
    m = p.major
    mi = 0 if xm else p.minor
    if any_x and op != "":
        if op == ">":
            v = _v(m + 1, 0, 0) if xm else _v(m, mi + 1, 0)
            return [Comparator.make(">=", v)]
        if op == "<=":
            v = _v(m + 1, 0, 0, _ZERO) if xm else _v(m, mi + 1, 0, _ZERO)
            return [Comparator.make("<", v)]
        if op == "<":
            return [Comparator.make("<", _v(m, mi, 0, _ZERO))]
        return [Comparator.make(op, _v(m, mi, 0))]
    if xm:
        return [Comparator.make(">=", _v(m, 0, 0)), Comparator.make("<", _v(m + 1, 0, 0, _ZERO))]
    if p.patch is None:
        return [Comparator.make(">=", _v(m, mi, 0)), Comparator.make("<", _v(m, mi + 1, 0, _ZERO))]
    return [Comparator.make(op, Version(m, mi, p.patch, p.pre, p.build))]


def _hyphen(a: _Partial, b: _Partial) -> List[Comparator]:
    out = []
    if a.major is not None:
        if a.minor is None:
            v = _v(a.major, 0, 0)
        elif a.patch is None:
            v = _v(a.major, a.minor, 0)
        else:
            v = _v(a.major, a.minor, a.patch, a.pre)
        out.append(Comparator.make(">=", v))
    if b.major is not None:
        if b.minor is None:
            out.append(Comparator.make("<", _v(b.major + 1, 0, 0, _ZERO)))
        elif b.patch is None:
            out.append(Comparator.make("<", _v(b.major, b.minor + 1, 0, _ZERO)))
        else:
            out.append(Comparator.make("<=", _v(b.major, b.minor, b.patch, b.pre)))
    return out or [ANY]


_PREFIXES = (">=", "<=", ">", "<", "=")
_OPERATORS = frozenset(("<", "<=", ">", ">=", "=", "~", "~>", "^"))


def _comparator_token(tok: str, raw: str) -> List[Comparator]:
    if not tok or tok == "*":
        return [ANY]
    c = tok[0]
    if c == "^":
        return _caret(_partial(tok[1:], raw))
    if c == "~":
        return _tilde(_partial(tok[2:] if tok.startswith("~>") else tok[1:], raw))
    for op in _PREFIXES:
        if tok.startswith(op):
            return _xrange("" if op == "=" else op, _partial(tok[len(op) :], raw))
    return _xrange("", _partial(tok, raw))


class _Set:
    __slots__ = ("comparators", "universal_pre", "any_pre")

    def test(self, v: Version) -> bool:
        for c in self.comparators:
            if not c.test(v):
                return False
        if not v.pre or self.universal_pre:
            return True
        t = (v.major, v.minor, v.patch)
        if t in self.any_pre:
            return True
        # A pre-release is admitted only by a comparator that declares a
        # channel on the same tuple whose identifiers it begins with.
        for c in self.comparators:
            b = c.version
            if b is not None and b.pre and (b.major, b.minor, b.patch) == t:
                if _starts_with(v.pre, b.pre):
                    return True
        return False


def _parse_set(s: str, raw: str) -> _Set:
    universal_pre = False
    any_pre = []
    tokens = []
    for tok in s.split():
        if tok == "*-*":
            universal_pre = True
            tokens.append(">=0.0.0-0")
        elif tok.endswith("-*") and (m := _TUPLE_PRE(tok)):
            op, a, b, c = m.groups()
            any_pre.append((int(a), int(b), int(c)))
            tokens.append(f"{op or ''}{a}.{b}.{c}-0")
        else:
            tokens.append(tok)

    comps: List[Comparator] = []
    if len(tokens) == 3 and tokens[1] == "-":
        comps = _hyphen(_partial(tokens[0], raw), _partial(tokens[2], raw))
    else:
        i, n = 0, len(tokens)
        while i < n:
            # `>= 1.2.3`, `~ 1.2`: an operator separated from its version.
            if tokens[i] in _OPERATORS and i + 1 < n:
                comps.extend(_comparator_token(tokens[i] + tokens[i + 1], raw))
                i += 2
            else:
                comps.extend(_comparator_token(tokens[i], raw))
                i += 1
        if not comps:
            comps = [ANY]

    out = _Set()
    out.universal_pre = universal_pre
    out.any_pre = any_pre
    for c in comps:
        # A comparator that can match nothing makes the whole set match nothing.
        if c.is_null:
            out.comparators = [c]
            return out
    unique: List[Comparator] = []
    for c in comps:
        if not any(u._same(c) for u in unique):
            unique.append(c)
    if len(unique) > 1:
        unique = [c for c in unique if c.version is not None]
    out.comparators = unique
    return out


class Range:
    """A parsed range: comparator sets joined by ``||``, optionally scoped to a
    context (``npm:react@^18``). Advanced syntax (hyphen, x-ranges, ``~``,
    ``~>``, ``^``, ``-*``, ``*-*``) desugars to primitive comparators exactly
    as in the specification."""

    __slots__ = ("raw", "context", "_sets")

    def __init__(self, value: str) -> None:
        if len(value) > MAX_LENGTH:
            raise InvalidRange(f"range is longer than {MAX_LENGTH} characters")
        self.raw = value
        context, body = split_reference(value)
        self.context = context
        sets = [_parse_set(part.strip(), value) for part in body.split("||")]
        if len(sets) > 1:
            # Drop sets that can match nothing (unless that is all there is)
            # and collapse to "any" if any set matches everything.
            first = sets[0]
            sets = [s for s in sets if not (s.comparators and s.comparators[0].is_null)]
            if not sets:
                sets = [first]
            elif len(sets) > 1:
                for s in sets:
                    if len(s.comparators) == 1 and s.comparators[0].version is None:
                        sets = [s]
                        break
        self._sets = sets

    @classmethod
    def parse(cls, value: str) -> "Range":
        return cls(value)

    @property
    def comparator_sets(self) -> List[List[Comparator]]:
        return [list(s.comparators) for s in self._sets]

    def test(self, version: Version) -> bool:
        """True if ``version`` satisfies the range. A context-scoped range only
        admits versions of the same context."""
        if self.context is not None and version.context != self.context:
            return False
        for s in self._sets:
            if s.test(version):
                return True
        return False

    satisfies = test

    def __contains__(self, version: Version) -> bool:
        return self.test(version)

    def __str__(self) -> str:
        return "||".join(
            " ".join(str(c) for c in s.comparators if c.version is not None) for s in self._sets
        )

    def __repr__(self) -> str:
        return f"Range({self.raw!r})"


# ------------------------------------------------------------------ functions


def parse(version: str) -> Version:
    """Parse a version; raises :class:`InvalidVersion`."""
    return Version.parse(version)


def valid(version: str) -> Optional[str]:
    """The normalized version, or ``None`` if it is not a version."""
    try:
        return str(Version.parse(version))
    except SemanticVersionError:
        return None


def valid_range(range: str) -> Optional[str]:
    """The desugared range (``*`` when it matches everything), or ``None``."""
    try:
        return str(Range(range)) or "*"
    except SemanticVersionError:
        return None


def compare(a: str, b: str) -> int:
    """-1, 0 or 1 by precedence (builds rank above their release)."""
    x, y = Version.parse(a).key, Version.parse(b).key
    return (x > y) - (x < y)


def satisfies(version: str, range: str) -> bool:
    if version == range:
        # Mirrors the JavaScript reference: an identical string trivially matches.
        return valid(version) is not None
    try:
        return Range(range).test(Version.parse(version))
    except SemanticVersionError:
        return False


def _pick(versions: Iterable[str], range: str, best_is_lower: bool) -> Optional[str]:
    try:
        r = Range(range)
    except SemanticVersionError:
        return None
    best = best_key = None
    for s in versions:
        try:
            v = Version.parse(s)
        except SemanticVersionError:
            continue
        if not r.test(v):
            continue
        k = v.key
        if best is None or (k < best_key if best_is_lower else k > best_key):
            best, best_key = s, k
    return best


def max_satisfying(versions: Iterable[str], range: str) -> Optional[str]:
    """The highest version in ``versions`` that satisfies ``range``."""
    return _pick(versions, range, False)


def min_satisfying(versions: Iterable[str], range: str) -> Optional[str]:
    """The lowest version in ``versions`` that satisfies ``range``."""
    return _pick(versions, range, True)


def sort(versions: Sequence[str]) -> List[str]:
    """Versions sorted ascending by precedence; invalid entries raise."""
    return sorted(versions, key=lambda s: Version.parse(s).key)


def rsort(versions: Sequence[str]) -> List[str]:
    """Versions sorted descending by precedence."""
    return sorted(versions, key=lambda s: Version.parse(s).key, reverse=True)
