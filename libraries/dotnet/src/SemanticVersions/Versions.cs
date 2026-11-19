namespace SemanticVersions;

/// <summary>
/// Parse, compare and match versions per the Semantic Versions specification
/// (<see href="https://semver.xyz">semver.xyz</see>). A port of the JavaScript reference
/// implementation (semantic-versions on npm), checked against the same conformance suite.
/// </summary>
public static class Versions
{
    /// <summary>The longest version or range accepted.</summary>
    public const int MaxLength = Scan.MaxLength;

    /// <summary>The largest numeric version component accepted.</summary>
    public const long MaxSafeInteger = Scan.MaxSafeInteger;

    /// <summary>Parses a version; throws <see cref="SemanticVersionException"/>.</summary>
    public static SemanticVersion Parse(string version) => SemanticVersion.Parse(version);

    /// <summary>The normalized version, or null if the input is not a version.</summary>
    public static string? Valid(string version) =>
        SemanticVersion.TryParse(version, out var v) ? v.ToString() : null;

    /// <summary>The desugared range (<c>*</c> when it matches everything), or null.</summary>
    public static string? ValidRange(string range)
    {
        if (!SemanticRange.TryParse(range, out var r)) return null;
        var s = r.ToString();
        return s.Length == 0 ? "*" : s;
    }

    /// <summary>-1, 0 or 1 by precedence (builds rank above their release).</summary>
    public static int Compare(string a, string b) => Math.Sign(SemanticVersion.Parse(a).CompareTo(SemanticVersion.Parse(b)));

    /// <summary>True if version satisfies range; invalid input never does.</summary>
    public static bool Satisfies(string version, string range)
    {
        // Mirrors the JavaScript reference: an identical string trivially matches.
        if (version == range) return SemanticVersion.TryParse(version, out _);
        return SemanticRange.TryParse(range, out var r) && SemanticVersion.TryParse(version, out var v) && r.Test(v);
    }

    private static string? Pick(IEnumerable<string> versions, string range, bool lower)
    {
        if (!SemanticRange.TryParse(range, out var r)) return null;
        string? best = null;
        SemanticVersion? bv = null;
        foreach (var s in versions)
        {
            if (!SemanticVersion.TryParse(s, out var v) || !r.Test(v)) continue;
            if (bv is null || (lower ? v.CompareTo(bv) < 0 : v.CompareTo(bv) > 0))
            {
                best = s;
                bv = v;
            }
        }
        return best;
    }

    /// <summary>The highest version that satisfies range, or null.</summary>
    public static string? MaxSatisfying(IEnumerable<string> versions, string range) => Pick(versions, range, false);

    /// <summary>The lowest version that satisfies range, or null.</summary>
    public static string? MinSatisfying(IEnumerable<string> versions, string range) => Pick(versions, range, true);

    /// <summary>Versions sorted ascending by precedence (stable); invalid entries throw.</summary>
    public static List<string> Sort(IEnumerable<string> versions) =>
        versions.Select(s => (s, v: SemanticVersion.Parse(s))).OrderBy(x => x.v).Select(x => x.s).ToList();

    /// <summary>Versions sorted descending by precedence (stable).</summary>
    public static List<string> RSort(IEnumerable<string> versions) =>
        versions.Select(s => (s, v: SemanticVersion.Parse(s))).OrderByDescending(x => x.v).Select(x => x.s).ToList();

    /// <summary>Sorts parsed versions in place, ascending by precedence (stable).</summary>
    public static void Sort(SemanticVersion[] versions) => MergeSort(versions, ascending: true);

    /// <summary>Sorts parsed versions in place, descending by precedence (stable).</summary>
    public static void RSort(SemanticVersion[] versions) => MergeSort(versions, ascending: false);

    // Array.Sort is an unstable introsort; the reference implementation's sort is stable. This is
    // a bottom-up merge sort: insertion-sorted runs, then merges through one scratch buffer.
    private static void MergeSort(SemanticVersion[] a, bool ascending)
    {
        const int Run = 12;
        int n = a.Length;
        int sign = ascending ? 1 : -1;
        for (int lo = 0; lo < n; lo += Run)
        {
            int hi = Math.Min(lo + Run, n);
            for (int i = lo + 1; i < hi; i++)
            {
                var x = a[i];
                int j = i;
                while (j > lo && sign * x.CompareTo(a[j - 1]) < 0)
                {
                    a[j] = a[j - 1];
                    j--;
                }
                a[j] = x;
            }
        }
        if (n <= Run) return;
        var src = a;
        var dst = new SemanticVersion[n];
        for (int width = Run; width < n; width *= 2)
        {
            for (int lo = 0; lo < n; lo += 2 * width)
            {
                int mid = Math.Min(lo + width, n), hi = Math.Min(lo + 2 * width, n);
                if (mid >= hi || sign * src[mid - 1].CompareTo(src[mid]) <= 0)
                {
                    Array.Copy(src, lo, dst, lo, hi - lo); // already in order
                    continue;
                }
                int i = lo, j = mid, k = lo;
                while (i < mid && j < hi)
                {
                    dst[k++] = sign * src[j].CompareTo(src[i]) < 0 ? src[j++] : src[i++];
                }
                Array.Copy(src, i, dst, k, mid - i);
                Array.Copy(src, j, dst, k + mid - i, hi - j);
            }
            (src, dst) = (dst, src);
        }
        if (!ReferenceEquals(src, a)) Array.Copy(src, a, n);
    }
}
