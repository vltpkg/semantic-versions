package semanticversions

// Valid returns the normalized version and true, or "" and false if s is
// not a version.
func Valid(s string) (string, bool) {
	v, err := Parse(s)
	if err != nil {
		return "", false
	}
	return v.String(), true
}

// ValidRange returns the desugared range ("*" when it matches everything) and
// true, or "" and false if s is not a range.
func ValidRange(s string) (string, bool) {
	r, err := ParseRange(s)
	if err != nil {
		return "", false
	}
	if out := r.String(); out != "" {
		return out, true
	}
	return "*", true
}

// Compare parses a and b and returns -1, 0 or 1 by precedence.
func Compare(a, b string) (int, error) {
	x, err := Parse(a)
	if err != nil {
		return 0, err
	}
	y, err := Parse(b)
	if err != nil {
		return 0, err
	}
	return x.Compare(y), nil
}

// Satisfies reports whether version satisfies rng. Invalid input never does.
func Satisfies(version, rng string) bool {
	if version == rng {
		// Mirrors the JavaScript reference: an identical string trivially matches.
		_, ok := Valid(version)
		return ok
	}
	r, err := ParseRange(rng)
	if err != nil {
		return false
	}
	v, err := Parse(version)
	if err != nil {
		return false
	}
	return r.Test(v)
}

func pick(versions []string, rng string, lower bool) (string, bool) {
	r, err := ParseRange(rng)
	if err != nil {
		return "", false
	}
	best, found := "", false
	var bv Version
	for _, s := range versions {
		v, err := Parse(s)
		if err != nil || !r.Test(v) {
			continue
		}
		if c := v.Compare(bv); !found || (lower && c < 0) || (!lower && c > 0) {
			best, bv, found = s, v, true
		}
	}
	return best, found
}

// MaxSatisfying returns the highest version in versions that satisfies rng.
func MaxSatisfying(versions []string, rng string) (string, bool) {
	return pick(versions, rng, false)
}

// MinSatisfying returns the lowest version in versions that satisfies rng.
func MinSatisfying(versions []string, rng string) (string, bool) {
	return pick(versions, rng, true)
}

// Sort sorts versions in place, ascending by precedence. The sort is stable.
func Sort(versions []Version) {
	mergeSort(versions, comparePtr)
}

// RSort sorts versions in place, descending by precedence. The sort is stable.
func RSort(versions []Version) {
	mergeSort(versions, func(a, b *Version) int { return comparePtr(b, a) })
}

// comparePtr compares by precedence without copying either version.
func comparePtr(a, b *Version) int {
	if a.Major != b.Major {
		return cmpUint(a.Major, b.Major)
	}
	if a.Minor != b.Minor {
		return cmpUint(a.Minor, b.Minor)
	}
	if a.Patch != b.Patch {
		return cmpUint(a.Patch, b.Patch)
	}
	if a.Pre == "" && b.Pre == "" && a.Build == b.Build {
		return 0
	}
	return a.Compare(*b)
}

// mergeSort is a stable bottom-up merge sort: insertion-sorted runs, then
// merges through one scratch buffer. It compares through pointers, which is
// what makes it faster than slices.SortStableFunc for 80-byte elements.
func mergeSort(a []Version, cmp func(a, b *Version) int) {
	const run = 12
	n := len(a)
	for lo := 0; lo < n; lo += run {
		hi := min(lo+run, n)
		for i := lo + 1; i < hi; i++ {
			for j := i; j > lo && cmp(&a[j], &a[j-1]) < 0; j-- {
				a[j], a[j-1] = a[j-1], a[j]
			}
		}
	}
	if n <= run {
		return
	}
	src, dst := a, make([]Version, n)
	for width := run; width < n; width *= 2 {
		for lo := 0; lo < n; lo += 2 * width {
			mid, hi := min(lo+width, n), min(lo+2*width, n)
			if mid >= hi || cmp(&src[mid-1], &src[mid]) <= 0 {
				copy(dst[lo:hi], src[lo:hi]) // already in order
				continue
			}
			i, j, k := lo, mid, lo
			for i < mid && j < hi {
				if cmp(&src[j], &src[i]) < 0 {
					dst[k] = src[j]
					j++
				} else {
					dst[k] = src[i]
					i++
				}
				k++
			}
			k += copy(dst[k:], src[i:mid])
			copy(dst[k:], src[j:hi])
		}
		src, dst = dst, src
	}
	if &src[0] != &a[0] {
		copy(a, src)
	}
}
