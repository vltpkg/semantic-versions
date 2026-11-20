package semanticversions

import (
	"fmt"
	"strconv"
	"strings"
)

// Op is a comparator operator. OpEq is written without an operator ("1.2.3").
type Op uint8

// Comparator operators.
const (
	OpEq Op = iota
	OpLt
	OpLte
	OpGt
	OpGte
)

func (o Op) String() string {
	return [...]string{"", "<", "<=", ">", ">="}[o]
}

// Comparator is a primitive comparator: an operator and a bound, or "any"
// (matches every version). A build on the bound is a build channel (a prefix
// filter on the candidate's build); a pre-release on it declares a
// pre-release channel for its tuple.
type Comparator struct {
	Op      Op
	Version Version
	// Any is true for the comparator that matches every version.
	Any bool
}

var anyComparator = Comparator{Any: true}

func newComparator(op Op, v Version) Comparator {
	// ">=0.0.0" bounds nothing: it is the "any" comparator.
	if op == OpGte && v.Major == 0 && v.Minor == 0 && v.Patch == 0 && v.Pre == "" && v.Build == "" {
		return anyComparator
	}
	return Comparator{Op: op, Version: v}
}

func (c Comparator) isNull() bool {
	v := c.Version
	return !c.Any && c.Op == OpLt && v.Major == 0 && v.Minor == 0 && v.Patch == 0 && v.Pre == "0" && v.Build == ""
}

// Test reports whether v passes the bound and, when the comparator declares
// a build channel, carries a build in that channel.
func (c Comparator) Test(v Version) bool {
	if c.Any {
		return true
	}
	o := v.compareWithoutBuild(c.Version)
	var ok bool
	switch c.Op {
	case OpLt:
		ok = o < 0
	case OpLte:
		ok = o <= 0
	case OpGt:
		ok = o > 0
	case OpGte:
		ok = o >= 0
	default:
		ok = o == 0
	}
	return ok && (c.Version.Build == "" || hasIdentifierPrefix(v.Build, c.Version.Build))
}

func (c Comparator) String() string {
	if c.Any {
		return ""
	}
	return c.Op.String() + c.Version.String()
}

type tuple struct{ major, minor, patch uint64 }

type set struct {
	comparators []Comparator
	universal   bool    // *-*: pre-releases on every tuple are admitted
	anyPre      []tuple // X.Y.Z-*: any pre-release of these tuples
}

func (s *set) test(v Version) bool {
	for i := range s.comparators {
		if !s.comparators[i].Test(v) {
			return false
		}
	}
	if v.Pre == "" || s.universal {
		return true
	}
	for _, t := range s.anyPre {
		if t.major == v.Major && t.minor == v.Minor && t.patch == v.Patch {
			return true
		}
	}
	// A pre-release is admitted only by a comparator that declares a channel
	// on the same tuple whose identifiers it begins with.
	for i := range s.comparators {
		b := s.comparators[i].Version
		if !s.comparators[i].Any && b.Pre != "" && b.sameTuple(v) && hasIdentifierPrefix(v.Pre, b.Pre) {
			return true
		}
	}
	return false
}

// Range is a parsed range: comparator sets joined by "||", optionally scoped
// to a context (npm:react@^18).
type Range struct {
	// Context is the identity the range is scoped to, if any.
	Context string
	sets    []set
}

// ParseRange parses a range. Advanced syntax (hyphen, x-ranges, ~, ~>, ^,
// -*, *-*) desugars to primitive comparators exactly as in the specification.
func ParseRange(s string) (Range, error) {
	if len(s) > MaxLength {
		return Range{}, fmt.Errorf("%w: %w", ErrInvalidRange, ErrTooLong)
	}
	context, body := SplitReference(s)
	r := Range{Context: context}
	for {
		part := body
		i := strings.Index(body, "||")
		if i >= 0 {
			part, body = body[:i], body[i+2:]
		}
		st, err := parseSet(strings.TrimSpace(part))
		if err != nil {
			return Range{}, fmt.Errorf("%w %q", ErrInvalidRange, s)
		}
		r.sets = append(r.sets, st)
		if i < 0 {
			break
		}
	}
	if len(r.sets) > 1 {
		// Drop sets that can match nothing (unless that is all there is), and
		// collapse to "any" if any set matches everything.
		first := r.sets[0]
		kept := r.sets[:0]
		for _, st := range r.sets {
			if len(st.comparators) == 0 || !st.comparators[0].isNull() {
				kept = append(kept, st)
			}
		}
		r.sets = kept
		if len(r.sets) == 0 {
			r.sets = []set{first}
		} else if len(r.sets) > 1 {
			for _, st := range r.sets {
				if len(st.comparators) == 1 && st.comparators[0].Any {
					r.sets = []set{st}
					break
				}
			}
		}
	}
	return r, nil
}

// MustParseRange is like ParseRange but panics on error.
func MustParseRange(s string) Range {
	r, err := ParseRange(s)
	if err != nil {
		panic(err)
	}
	return r
}

// Test reports whether v satisfies the range. A context-scoped range only
// admits versions of the same context.
func (r Range) Test(v Version) bool {
	if r.Context != "" && v.Context != r.Context {
		return false
	}
	for i := range r.sets {
		if r.sets[i].test(v) {
			return true
		}
	}
	return false
}

// ComparatorSets returns the desugared comparator sets.
func (r Range) ComparatorSets() [][]Comparator {
	out := make([][]Comparator, len(r.sets))
	for i, s := range r.sets {
		out[i] = append([]Comparator(nil), s.comparators...)
	}
	return out
}

// String formats the desugared range ("" when it matches everything).
func (r Range) String() string {
	var b strings.Builder
	for i, s := range r.sets {
		if i > 0 {
			b.WriteString("||")
		}
		first := true
		for _, c := range s.comparators {
			if c.Any {
				continue
			}
			if !first {
				b.WriteByte(' ')
			}
			first = false
			b.WriteString(c.String())
		}
	}
	return b.String()
}

// ---------------------------------------------------------------- desugaring

const x = ^uint64(0) // a wildcard component (x, X, * or absent)

type partial struct {
	major, minor, patch uint64
	pre, build          string
}

func xr(s string, i int) (uint64, int, error) {
	if i < len(s) && (s[i] == 'x' || s[i] == 'X' || s[i] == '*') {
		return x, i + 1, nil
	}
	if i < len(s) && s[i]-'0' <= 9 {
		return numeric(s, i)
	}
	return 0, i, errSyntax
}

// parsePartial scans <xr> [ "." <xr> [ "." <xr> <qualifier>? ] ].
func parsePartial(s string) (partial, error) {
	p := partial{minor: x, patch: x}
	var err error
	i := 0
	if p.major, i, err = xr(s, i); err != nil {
		return p, err
	}
	if i < len(s) && s[i] == '.' {
		if p.minor, i, err = xr(s, i+1); err != nil {
			return p, err
		}
		if i < len(s) && s[i] == '.' {
			if p.patch, i, err = xr(s, i+1); err != nil {
				return p, err
			}
			if i < len(s) && s[i] == '-' {
				if p.pre, i, err = identifiers(s, i+1, true); err != nil {
					return p, err
				}
			}
			if i < len(s) && s[i] == '+' {
				if p.build, i, err = identifiers(s, i+1, false); err != nil {
					return p, err
				}
			}
		}
	}
	if i != len(s) {
		return p, errSyntax
	}
	return p, nil
}

func nz(n uint64) uint64 {
	if n == x {
		return 0
	}
	return n
}

func ver(major, minor, patch uint64, pre string) Version {
	return Version{Major: major, Minor: minor, Patch: patch, Pre: pre}
}

// withChannel attaches a build channel to every comparator ~ or ^ desugars to.
func withChannel(comps []Comparator, channel string) []Comparator {
	if channel == "" {
		return comps
	}
	for i := range comps {
		if comps[i].Any {
			// A channel turns ">=0.0.0" back into a real bound.
			comps[i] = Comparator{Op: OpGte, Version: Version{Build: channel}}
		} else {
			comps[i].Version.Build = channel
		}
	}
	return comps
}

// tilde desugars "~" (patch-level changes when a minor is given, minor-level
// otherwise) and, with approximate set, "~>": the pessimistic operator with
// its RubyGems meaning, which drops the last supplied part and allows up to the
// next value of the part before it, so two parts reach the next major. A
// trailing x is not a supplied part.
func tilde(p partial, approximate bool, out []Comparator) []Comparator {
	if p.major == x {
		return append(out, anyComparator)
	}
	m, mi := p.major, nz(p.minor)
	var c []Comparator
	switch {
	case p.minor == x:
		c = []Comparator{newComparator(OpGte, ver(m, 0, 0, "")), newComparator(OpLt, ver(m+1, 0, 0, "0"))}
	case p.patch == x:
		upper := ver(m, mi+1, 0, "0")
		if approximate {
			upper = ver(m+1, 0, 0, "0")
		}
		c = []Comparator{newComparator(OpGte, ver(m, mi, 0, "")), newComparator(OpLt, upper)}
	default:
		c = []Comparator{newComparator(OpGte, ver(m, mi, p.patch, p.pre)), newComparator(OpLt, ver(m, mi+1, 0, "0"))}
	}
	return append(out, withChannel(c, p.build)...)
}

func caret(p partial, out []Comparator) []Comparator {
	if p.major == x {
		return append(out, anyComparator)
	}
	m, mi, pa := p.major, nz(p.minor), nz(p.patch)
	var c []Comparator
	switch {
	case p.minor == x:
		c = []Comparator{newComparator(OpGte, ver(m, 0, 0, "")), newComparator(OpLt, ver(m+1, 0, 0, "0"))}
	case p.patch == x:
		upper := ver(m+1, 0, 0, "0")
		if m == 0 {
			upper = ver(0, mi+1, 0, "0")
		}
		c = []Comparator{newComparator(OpGte, ver(m, mi, 0, "")), newComparator(OpLt, upper)}
	default:
		upper := ver(m+1, 0, 0, "0")
		if m == 0 {
			if mi == 0 {
				upper = ver(0, 0, pa+1, "0")
			} else {
				upper = ver(0, mi+1, 0, "0")
			}
		}
		c = []Comparator{newComparator(OpGte, ver(m, mi, pa, p.pre)), newComparator(OpLt, upper)}
	}
	return append(out, withChannel(c, p.build)...)
}

func xrange(op Op, p partial, out []Comparator) []Comparator {
	xm := p.major == x || p.minor == x
	anyX := xm || p.patch == x
	if p.major == x {
		if op == OpGt || op == OpLt {
			return append(out, newComparator(OpLt, ver(0, 0, 0, "0")))
		}
		return append(out, anyComparator)
	}
	m := p.major
	mi := uint64(0)
	if !xm {
		mi = p.minor
	}
	if anyX && op != OpEq {
		switch op {
		case OpGt:
			if xm {
				return append(out, newComparator(OpGte, ver(m+1, 0, 0, "")))
			}
			return append(out, newComparator(OpGte, ver(m, mi+1, 0, "")))
		case OpLte:
			if xm {
				return append(out, newComparator(OpLt, ver(m+1, 0, 0, "0")))
			}
			return append(out, newComparator(OpLt, ver(m, mi+1, 0, "0")))
		case OpLt:
			return append(out, newComparator(OpLt, ver(m, mi, 0, "0")))
		default:
			return append(out, newComparator(op, ver(m, mi, 0, "")))
		}
	}
	if xm {
		return append(out, newComparator(OpGte, ver(m, 0, 0, "")), newComparator(OpLt, ver(m+1, 0, 0, "0")))
	}
	if p.patch == x {
		return append(out, newComparator(OpGte, ver(m, mi, 0, "")), newComparator(OpLt, ver(m, mi+1, 0, "0")))
	}
	v := ver(m, mi, p.patch, p.pre)
	v.Build = p.build
	return append(out, newComparator(op, v))
}

// hyphen desugars "<partial> - <partial>": an inclusive span. Builds on either
// endpoint are ignored; a pre-release on an endpoint is kept.
// hyphen desugars "a - b". Each endpoint keeps its own labels: a pre-release
// as that endpoint's pre-release channel and a build as its build channel.
func hyphen(a, b partial) []Comparator {
	var out []Comparator
	if a.major != x {
		var v Version
		switch {
		case a.minor == x:
			v = ver(a.major, 0, 0, "")
		case a.patch == x:
			v = ver(a.major, a.minor, 0, "")
		default:
			v = ver(a.major, a.minor, a.patch, a.pre)
		}
		out = append(out, withChannel([]Comparator{newComparator(OpGte, v)}, a.build)...)
	}
	if b.major != x {
		var c Comparator
		switch {
		case b.minor == x:
			c = newComparator(OpLt, ver(b.major+1, 0, 0, "0"))
		case b.patch == x:
			c = newComparator(OpLt, ver(b.major, b.minor+1, 0, "0"))
		default:
			c = newComparator(OpLte, ver(b.major, b.minor, b.patch, b.pre))
		}
		out = append(out, withChannel([]Comparator{c}, b.build)...)
	}
	if len(out) == 0 {
		out = append(out, anyComparator)
	}
	return out
}

var tuplePreOps = [...]string{"<=", ">=", "^", "~", "<", ">", "="}

// tuplePre recognizes "X.Y.Z-*" with an optional operator.
func tuplePre(tok string) (op string, t tuple, ok bool) {
	body, found := strings.CutSuffix(tok, "-*")
	if !found {
		return "", t, false
	}
	for _, o := range tuplePreOps {
		if strings.HasPrefix(body, o) {
			op, body = o, body[len(o):]
			break
		}
	}
	var err error
	i := 0
	if t.major, i, err = numeric(body, i); err != nil || i >= len(body) || body[i] != '.' {
		return "", t, false
	}
	if t.minor, i, err = numeric(body, i+1); err != nil || i >= len(body) || body[i] != '.' {
		return "", t, false
	}
	if t.patch, i, err = numeric(body, i+1); err != nil || i != len(body) {
		return "", t, false
	}
	return op, t, true
}

func comparatorToken(tok string, out []Comparator) ([]Comparator, error) {
	if tok == "" || tok == "*" {
		return append(out, anyComparator), nil
	}
	var op Op
	rest := tok
	switch tok[0] {
	case '^':
		p, err := parsePartial(tok[1:])
		if err != nil {
			return out, err
		}
		return caret(p, out), nil
	case '~':
		rest = tok[1:]
		approximate := strings.HasPrefix(rest, ">")
		if approximate {
			rest = rest[1:]
		}
		p, err := parsePartial(rest)
		if err != nil {
			return out, err
		}
		return tilde(p, approximate, out), nil
	case '>':
		if strings.HasPrefix(tok, ">=") {
			op, rest = OpGte, tok[2:]
		} else {
			op, rest = OpGt, tok[1:]
		}
	case '<':
		if strings.HasPrefix(tok, "<=") {
			op, rest = OpLte, tok[2:]
		} else {
			op, rest = OpLt, tok[1:]
		}
	case '=':
		op, rest = OpEq, tok[1:]
	}
	p, err := parsePartial(rest)
	if err != nil {
		return out, err
	}
	return xrange(op, p, out), nil
}

func isOperator(s string) bool {
	switch s {
	case "<", "<=", ">", ">=", "=", "~", "~>", "^":
		return true
	}
	return false
}

func sameComparator(a, b Comparator) bool {
	if a.Op != b.Op || a.Any != b.Any {
		return false
	}
	if a.Any {
		return true
	}
	x, y := a.Version, b.Version
	return x.Major == y.Major && x.Minor == y.Minor && x.Patch == y.Patch && x.Pre == y.Pre && x.Build == y.Build
}

func parseSet(s string) (set, error) {
	var st set
	fields := strings.Fields(s)
	tokens := fields[:0:0]
	for _, tok := range fields {
		if tok == "*-*" {
			st.universal = true
			tokens = append(tokens, ">=0.0.0-0")
		} else if op, t, ok := tuplePre(tok); ok {
			st.anyPre = append(st.anyPre, t)
			tokens = append(tokens, op+strconv.FormatUint(t.major, 10)+"."+strconv.FormatUint(t.minor, 10)+"."+strconv.FormatUint(t.patch, 10)+"-0")
		} else {
			tokens = append(tokens, tok)
		}
	}

	var comps []Comparator
	if len(tokens) == 3 && tokens[1] == "-" {
		a, err := parsePartial(tokens[0])
		if err != nil {
			return st, err
		}
		b, err := parsePartial(tokens[2])
		if err != nil {
			return st, err
		}
		comps = hyphen(a, b)
	} else {
		comps = make([]Comparator, 0, 2*len(tokens))
		var err error
		for i := 0; i < len(tokens); i++ {
			// ">= 1.2.3", "~ 1.2": an operator separated from its version.
			if isOperator(tokens[i]) && i+1 < len(tokens) {
				comps, err = comparatorToken(tokens[i]+tokens[i+1], comps)
				i++
			} else {
				comps, err = comparatorToken(tokens[i], comps)
			}
			if err != nil {
				return st, err
			}
		}
		if len(comps) == 0 {
			comps = append(comps, anyComparator)
		}
	}

	// A comparator that can match nothing makes the whole set match nothing.
	for _, c := range comps {
		if c.isNull() {
			st.comparators = []Comparator{c}
			return st, nil
		}
	}
	// Deduplicate (keeping the first occurrence) and drop a redundant "any".
	unique := comps[:0]
	for _, c := range comps {
		dup := false
		for _, u := range unique {
			if sameComparator(u, c) {
				dup = true
				break
			}
		}
		if !dup {
			unique = append(unique, c)
		}
	}
	if len(unique) > 1 {
		kept := unique[:0]
		for _, c := range unique {
			if !c.Any {
				kept = append(kept, c)
			}
		}
		unique = kept
	}
	st.comparators = unique
	return st, nil
}
