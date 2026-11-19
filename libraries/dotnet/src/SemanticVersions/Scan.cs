namespace SemanticVersions;

/// <summary>Scanning and comparison of dot-separated identifiers, without allocation.</summary>
internal static class Scan
{
    public const int MaxLength = 256;
    public const long MaxSafeInteger = 9007199254740991L;

    public static bool IsDigit(char c) => (uint)(c - '0') <= 9;

    public static bool IsIdentifierChar(char c) =>
        (uint)(c - '0') <= 9 || (uint)((c | 0x20) - 'a') <= 'z' - 'a' || c == '-';

    /// <summary>"0" or a non-zero digit followed by digits. Returns the end index, or -1.</summary>
    public static int Numeric(ReadOnlySpan<char> s, int i, out long value)
    {
        int start = i;
        long n = 0;
        while (i < s.Length && IsDigit(s[i]))
        {
            if (i - start < 18) n = n * 10 + (s[i] - '0');
            i++;
        }
        int l = i - start;
        value = n;
        if (l == 0 || (l > 1 && s[start] == '0') || l > 16 || n > MaxSafeInteger) return -1;
        return i;
    }

    /// <summary>
    /// Dot-separated identifiers from i. With pre, all-digit identifiers must have no leading zero
    /// and be below MaxSafeInteger. Returns the end index, or -1.
    /// </summary>
    public static int Identifiers(ReadOnlySpan<char> s, int i, bool pre)
    {
        while (true)
        {
            int id = i;
            bool digits = true;
            while (i < s.Length && IsIdentifierChar(s[i]))
            {
                if (!IsDigit(s[i])) digits = false;
                i++;
            }
            int l = i - id;
            if (l == 0) return -1;
            if (pre && digits)
            {
                if (l > 1 && s[id] == '0') return -1;
                if (l >= 16)
                {
                    long n = 0;
                    for (int k = id; k < i && n < MaxSafeInteger; k++) n = n * 10 + (s[k] - '0');
                    if (n >= MaxSafeInteger) return -1;
                }
            }
            if (i < s.Length && s[i] == '.')
            {
                i++;
                continue;
            }
            return i;
        }
    }

    /// <summary>Numeric identifiers compare numerically and below alphanumeric ones; a longer list wins a tie.</summary>
    public static int Compare(string a, string b)
    {
        if (string.Equals(a, b, StringComparison.Ordinal)) return 0;
        ReadOnlySpan<char> x = a, y = b;
        while (true)
        {
            int i = x.IndexOf('.'), j = y.IndexOf('.');
            var p = i < 0 ? x : x[..i];
            var q = j < 0 ? y : y[..j];
            int c = CompareOne(p, q);
            if (c != 0) return c;
            if (i < 0 && j < 0) return 0;
            if (i < 0) return -1;
            if (j < 0) return 1;
            x = x[(i + 1)..];
            y = y[(j + 1)..];
        }
    }

    private static bool AllDigits(ReadOnlySpan<char> s)
    {
        foreach (char c in s) if (!IsDigit(c)) return false;
        return true;
    }

    private static int CompareOne(ReadOnlySpan<char> a, ReadOnlySpan<char> b)
    {
        bool da = AllDigits(a), db = AllDigits(b);
        if (da && db)
        {
            a = a.TrimStart('0');
            b = b.TrimStart('0');
            if (a.Length != b.Length) return a.Length < b.Length ? -1 : 1;
        }
        else if (da) return -1;
        else if (db) return 1;
        int c = a.SequenceCompareTo(b);
        return c < 0 ? -1 : c > 0 ? 1 : 0;
    }

    /// <summary>Identifier-wise prefix: "rc" begins "rc.1" but not "rc1".</summary>
    public static bool StartsWith(string ids, string prefix) =>
        prefix.Length == 0 ||
        (ids.StartsWith(prefix, StringComparison.Ordinal) && (ids.Length == prefix.Length || ids[prefix.Length] == '.'));
}
