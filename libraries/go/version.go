// Package semanticversions parses, compares and matches versions per the
// Semantic Versions specification (https://semver.xyz).
//
// It is a port of the JavaScript reference implementation (semantic-versions
// on npm) and passes the same shared conformance suite.
package semanticversions

import (
	"errors"
	"fmt"
	"strconv"
	"strings"
	"unicode"
)

// MaxLength is the longest version or range accepted, in bytes.
const MaxLength = 256

// MaxSafeInteger is the largest numeric version component accepted.
const MaxSafeInteger uint64 = 9007199254740991

var (
	// ErrInvalidVersion is returned (wrapped) for input that is not a version.
	ErrInvalidVersion = errors.New("invalid version")
	// ErrInvalidRange is returned (wrapped) for input that is not a range.
	ErrInvalidRange = errors.New("invalid range")
	// ErrTooLong is returned (wrapped) for input longer than MaxLength.
	ErrTooLong = errors.New("longer than 256 bytes")
	// ErrTooLarge is returned (wrapped) for a numeric component above MaxSafeInteger.
	ErrTooLarge = errors.New("numeric component too large")
)

// Version is a parsed Semantic Version, optionally scoped to a context
// (npm:react@18.2.0).
//
// Precedence follows the specification: pre-releases rank below their
// release and builds rank above it (1.0.0-rc < 1.0.0 < 1.0.0+build). The
// context never participates in precedence.
type Version struct {
	Major, Minor, Patch uint64
	// Pre is the pre-release, as written ("" for a normal version).
	Pre string
	// Build is the build, as written ("" when there is none).
	Build string
	// Context is the identity the version belongs to, e.g. "npm:react".
	Context string
}

// Parse parses a version, optionally context-qualified (npm:react@1.2.3).
// There is no coercion: "v1.2.3" and "1.2" are errors.
func Parse(s string) (Version, error) {
	if len(s) > MaxLength {
		return Version{}, fmt.Errorf("%w: %w", ErrInvalidVersion, ErrTooLong)
	}
	// Fast path: a bare version scans directly. Only when that fails do we look
	// for a context or whitespace to strip.
	if v, err := parseCore(s); err == nil {
		return v, nil
	}
	context, rest := SplitReference(s)
	v, err := parseCore(strings.TrimSpace(rest))
	if err != nil {
		return Version{}, fmt.Errorf("%w %q: %w", ErrInvalidVersion, s, err)
	}
	v.Context = context
	return v, nil
}

// MustParse is like Parse but panics on error.
func MustParse(s string) Version {
	v, err := Parse(s)
	if err != nil {
		panic(err)
	}
	return v
}

// SplitReference splits an optional context off a reference:
// "npm:react@1.2.3" → ("npm:react", "1.2.3"). The context ends at the last
// "@" of the first whitespace-delimited token; an "@" at position 0 means
// there is no context.
func SplitReference(s string) (context, rest string) {
	if strings.IndexByte(s, '@') < 0 {
		return "", s
	}
	head, tail := s, ""
	if i := strings.IndexFunc(s, unicode.IsSpace); i >= 0 {
		head, tail = s[:i], s[i:]
	}
	if at := strings.LastIndexByte(head, '@'); at > 0 {
		return head[:at], head[at+1:] + tail
	}
	return "", s
}

// IsPrerelease reports whether v has a pre-release.
func (v Version) IsPrerelease() bool { return v.Pre != "" }

// String formats the version without its context.
func (v Version) String() string {
	b := make([]byte, 0, 16+len(v.Pre)+len(v.Build))
	b = strconv.AppendUint(b, v.Major, 10)
	b = append(b, '.')
	b = strconv.AppendUint(b, v.Minor, 10)
	b = append(b, '.')
	b = strconv.AppendUint(b, v.Patch, 10)
	if v.Pre != "" {
		b = append(b, '-')
		b = append(b, v.Pre...)
	}
	if v.Build != "" {
		b = append(b, '+')
		b = append(b, v.Build...)
	}
	return string(b)
}

// Reference formats the version with its context: "npm:react@18.2.0".
func (v Version) Reference() string {
	if v.Context == "" {
		return v.String()
	}
	return v.Context + "@" + v.String()
}

// Compare returns -1, 0 or 1 by precedence.
func (v Version) Compare(o Version) int {
	if c := v.compareWithoutBuild(o); c != 0 {
		return c
	}
	switch {
	case v.Build == o.Build:
		return 0
	case v.Build == "":
		return -1 // a build ranks above its release
	case o.Build == "":
		return 1
	}
	return compareIdentifiers(v.Build, o.Build)
}

// Less reports whether v has lower precedence than o.
func (v Version) Less(o Version) bool { return v.Compare(o) < 0 }

// Equal reports whether v and o have the same precedence.
func (v Version) Equal(o Version) bool { return v.Compare(o) == 0 }

func cmpUint(a, b uint64) int {
	if a < b {
		return -1
	}
	if a > b {
		return 1
	}
	return 0
}

func (v Version) compareWithoutBuild(o Version) int {
	if v.Major != o.Major {
		return cmpUint(v.Major, o.Major)
	}
	if v.Minor != o.Minor {
		return cmpUint(v.Minor, o.Minor)
	}
	if v.Patch != o.Patch {
		return cmpUint(v.Patch, o.Patch)
	}
	switch {
	case v.Pre == o.Pre:
		return 0
	case v.Pre == "":
		return 1 // a pre-release ranks below its release
	case o.Pre == "":
		return -1
	}
	return compareIdentifiers(v.Pre, o.Pre)
}

func (v Version) sameTuple(o Version) bool {
	return v.Major == o.Major && v.Minor == o.Minor && v.Patch == o.Patch
}

// compareIdentifiers compares dot-separated identifiers: numeric ones
// numerically and below alphanumeric ones; a longer list wins a tie.
func compareIdentifiers(a, b string) int {
	for {
		var x, y string
		i := strings.IndexByte(a, '.')
		if i < 0 {
			x, a = a, ""
		} else {
			x, a = a[:i], a[i+1:]
		}
		j := strings.IndexByte(b, '.')
		if j < 0 {
			y, b = b, ""
		} else {
			y, b = b[:j], b[j+1:]
		}
		if c := compareIdentifier(x, y); c != 0 {
			return c
		}
		switch {
		case i < 0 && j < 0:
			return 0
		case i < 0:
			return -1
		case j < 0:
			return 1
		}
	}
}

func allDigits(s string) bool {
	for i := 0; i < len(s); i++ {
		if s[i]-'0' > 9 {
			return false
		}
	}
	return true
}

func compareIdentifier(a, b string) int {
	if a == b {
		return 0
	}
	da, db := allDigits(a), allDigits(b)
	switch {
	case da && db:
		a, b = strings.TrimLeft(a, "0"), strings.TrimLeft(b, "0")
		if len(a) != len(b) {
			return cmpUint(uint64(len(a)), uint64(len(b)))
		}
		return strings.Compare(a, b)
	case da:
		return -1
	case db:
		return 1
	}
	return strings.Compare(a, b)
}

// hasIdentifierPrefix reports whether prefix's identifiers begin ids
// ("rc" begins "rc.1" but not "rc1").
func hasIdentifierPrefix(ids, prefix string) bool {
	return prefix == "" || (strings.HasPrefix(ids, prefix) && (len(ids) == len(prefix) || ids[len(prefix)] == '.'))
}

// ------------------------------------------------------------------ scanning

// class: 0 = not an identifier character, 1 = letter or hyphen, 2 = digit.
var class = func() (t [256]uint8) {
	for c := 0; c < 256; c++ {
		switch {
		case c >= '0' && c <= '9':
			t[c] = 2
		case c >= 'a' && c <= 'z', c >= 'A' && c <= 'Z', c == '-':
			t[c] = 1
		}
	}
	return
}()

var errSyntax = errors.New("syntax")

// numeric scans "0" or a non-zero digit followed by digits.
func numeric(s string, i int) (uint64, int, error) {
	start := i
	var n uint64
	for i < len(s) {
		d := s[i] - '0'
		if d > 9 {
			break
		}
		if i-start < 20 {
			n = n*10 + uint64(d)
		}
		i++
	}
	l := i - start
	if l == 0 || (l > 1 && s[start] == '0') {
		return 0, i, errSyntax
	}
	if l > 16 || n > MaxSafeInteger {
		return 0, i, ErrTooLarge
	}
	return n, i, nil
}

// identifiers scans dot-separated identifiers. With pre, all-digit
// identifiers must have no leading zero and be below MaxSafeInteger.
func identifiers(s string, i int, pre bool) (string, int, error) {
	start := i
	for {
		id := i
		digits := true
		for i < len(s) {
			c := class[s[i]]
			if c == 0 {
				break
			}
			if c != 2 {
				digits = false
			}
			i++
		}
		l := i - id
		if l == 0 {
			return "", i, errSyntax
		}
		if pre && digits {
			if l > 1 && s[id] == '0' {
				return "", i, errSyntax
			}
			if l >= 16 {
				var n uint64
				for k := id; k < i && n < MaxSafeInteger; k++ {
					n = n*10 + uint64(s[k]-'0')
				}
				if n >= MaxSafeInteger {
					return "", i, ErrTooLarge
				}
			}
		}
		if i < len(s) && s[i] == '.' {
			i++
			continue
		}
		return s[start:i], i, nil
	}
}

func parseCore(s string) (Version, error) {
	var v Version
	var err error
	i := 0
	if v.Major, i, err = numeric(s, i); err != nil {
		return v, err
	}
	if i >= len(s) || s[i] != '.' {
		return v, errSyntax
	}
	if v.Minor, i, err = numeric(s, i+1); err != nil {
		return v, err
	}
	if i >= len(s) || s[i] != '.' {
		return v, errSyntax
	}
	if v.Patch, i, err = numeric(s, i+1); err != nil {
		return v, err
	}
	if i < len(s) && s[i] == '-' {
		if v.Pre, i, err = identifiers(s, i+1, true); err != nil {
			return v, err
		}
	}
	if i < len(s) && s[i] == '+' {
		if v.Build, i, err = identifiers(s, i+1, false); err != nil {
			return v, err
		}
	}
	if i != len(s) {
		return v, errSyntax
	}
	return v, nil
}
