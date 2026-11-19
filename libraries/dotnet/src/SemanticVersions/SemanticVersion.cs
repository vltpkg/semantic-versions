using System.Diagnostics.CodeAnalysis;
using System.Globalization;
using System.Text;

namespace SemanticVersions;

/// <summary>Thrown for input that is not a version or not a range.</summary>
public sealed class SemanticVersionException(string message) : FormatException(message);

/// <summary>
/// A parsed Semantic Version, optionally scoped to a context (<c>npm:react@18.2.0</c>).
/// Ordering follows the specification: pre-releases rank below their release and builds rank
/// above it (<c>1.0.0-rc &lt; 1.0.0 &lt; 1.0.0+build</c>). The context never participates in
/// precedence or equality.
/// </summary>
public sealed class SemanticVersion : IComparable<SemanticVersion>, IEquatable<SemanticVersion>
{
    /// <summary>Major version.</summary>
    public long Major { get; }
    /// <summary>Minor version.</summary>
    public long Minor { get; }
    /// <summary>Patch version.</summary>
    public long Patch { get; }
    /// <summary>The pre-release, as written ("" for a normal version).</summary>
    public string Prerelease { get; }
    /// <summary>The build, as written ("" when there is none).</summary>
    public string Build { get; }
    /// <summary>The identity the version belongs to (e.g. <c>npm:react</c>), or null.</summary>
    public string? Context { get; }

    /// <summary>A version from its parts.</summary>
    public SemanticVersion(long major, long minor, long patch, string prerelease = "", string build = "", string? context = null)
    {
        Major = major;
        Minor = minor;
        Patch = patch;
        Prerelease = prerelease ?? throw new ArgumentNullException(nameof(prerelease));
        Build = build ?? throw new ArgumentNullException(nameof(build));
        Context = context;
    }

    /// <summary>True if this is a pre-release.</summary>
    public bool IsPrerelease => Prerelease.Length > 0;

    /// <summary>
    /// Parses a version, optionally context-qualified (<c>npm:react@1.2.3</c>). There is no
    /// coercion: <c>v1.2.3</c> and <c>1.2</c> are errors.
    /// </summary>
    /// <exception cref="SemanticVersionException">The input is not a version.</exception>
    public static SemanticVersion Parse(string s) =>
        TryParse(s, out var v) ? v : throw new SemanticVersionException($"invalid version: \"{s}\"");

    /// <summary>Parses a version; returns false for input that is not a version.</summary>
    public static bool TryParse(string s, [NotNullWhen(true)] out SemanticVersion? version)
    {
        version = null;
        if (s is null || s.Length > Scan.MaxLength) return false;
        // Fast path: a bare version scans directly. Only when that fails do we look for a
        // context or whitespace to strip.
        version = ScanCore(s, s, null);
        if (version is not null) return true;
        var (context, rest) = SplitReference(s);
        version = ScanCore(rest.Trim(), null, context);
        return version is not null;
    }

    /// <summary>
    /// Splits an optional context off a reference: <c>npm:react@1.2.3</c> → (<c>npm:react</c>,
    /// <c>1.2.3</c>). The context ends at the last <c>@</c> of the first whitespace-delimited
    /// token; an <c>@</c> at position 0 means there is none.
    /// </summary>
    public static (string? Context, string Remainder) SplitReference(string s)
    {
        if (s.IndexOf('@') < 0) return (null, s);
        int space = -1;
        for (int i = 0; i < s.Length; i++)
        {
            if (char.IsWhiteSpace(s[i])) { space = i; break; }
        }
        string head = space < 0 ? s : s[..space];
        string tail = space < 0 ? "" : s[space..];
        int at = head.LastIndexOf('@');
        return at > 0 ? (head[..at], head[(at + 1)..] + tail) : (null, s);
    }

    private static SemanticVersion? ScanCore(ReadOnlySpan<char> s, string? source, string? context)
    {
        int i = Scan.Numeric(s, 0, out long major);
        if (i < 0 || i >= s.Length || s[i] != '.') return null;
        i = Scan.Numeric(s, i + 1, out long minor);
        if (i < 0 || i >= s.Length || s[i] != '.') return null;
        i = Scan.Numeric(s, i + 1, out long patch);
        if (i < 0) return null;
        string pre = "", build = "";
        if (i < s.Length && s[i] == '-')
        {
            int end = Scan.Identifiers(s, i + 1, true);
            if (end < 0) return null;
            pre = source is null ? s[(i + 1)..end].ToString() : source.Substring(i + 1, end - i - 1);
            i = end;
        }
        if (i < s.Length && s[i] == '+')
        {
            int end = Scan.Identifiers(s, i + 1, false);
            if (end < 0) return null;
            build = source is null ? s[(i + 1)..end].ToString() : source.Substring(i + 1, end - i - 1);
            i = end;
        }
        return i == s.Length ? new SemanticVersion(major, minor, patch, pre, build, context) : null;
    }

    /// <summary>The version with its build removed.</summary>
    public SemanticVersion WithoutBuild() => new(Major, Minor, Patch, Prerelease, "", Context);

    /// <summary>The context-qualified form, <c>context@version</c>, or the bare version.</summary>
    public string Reference => Context is null ? ToString() : $"{Context}@{this}";

    internal bool SameTuple(SemanticVersion o) => Major == o.Major && Minor == o.Minor && Patch == o.Patch;

    /// <summary>Precedence ignoring builds (used by range comparators, where a build is a channel filter).</summary>
    internal int CompareWithoutBuild(SemanticVersion o)
    {
        if (Major != o.Major) return Major < o.Major ? -1 : 1;
        if (Minor != o.Minor) return Minor < o.Minor ? -1 : 1;
        if (Patch != o.Patch) return Patch < o.Patch ? -1 : 1;
        if (string.Equals(Prerelease, o.Prerelease, StringComparison.Ordinal)) return 0;
        if (Prerelease.Length == 0) return 1; // a pre-release ranks below its release
        if (o.Prerelease.Length == 0) return -1;
        return Scan.Compare(Prerelease, o.Prerelease);
    }

    /// <summary>-1, 0 or 1 by precedence.</summary>
    public int CompareTo(SemanticVersion? o)
    {
        if (o is null) return 1;
        if (Major != o.Major) return Major < o.Major ? -1 : 1;
        if (Minor != o.Minor) return Minor < o.Minor ? -1 : 1;
        if (Patch != o.Patch) return Patch < o.Patch ? -1 : 1;
        if (Prerelease.Length == 0 && o.Prerelease.Length == 0 && Build.Length == 0 && o.Build.Length == 0) return 0;
        int c = CompareWithoutBuild(o);
        if (c != 0) return c;
        if (string.Equals(Build, o.Build, StringComparison.Ordinal)) return 0;
        if (Build.Length == 0) return -1; // a build ranks above its release
        if (o.Build.Length == 0) return 1;
        return Scan.Compare(Build, o.Build);
    }

    /// <summary>Equal precedence (the context is ignored).</summary>
    public bool Equals(SemanticVersion? o) => o is not null && CompareTo(o) == 0;

    /// <inheritdoc />
    public override bool Equals(object? obj) => obj is SemanticVersion v && Equals(v);

    /// <inheritdoc />
    public override int GetHashCode() => HashCode.Combine(Major, Minor, Patch, NormalizedHash(Prerelease), NormalizedHash(Build));

    private static int NormalizedHash(string ids)
    {
        var h = new HashCode();
        foreach (var id in ids.Split('.'))
        {
            var t = id.Length > 1 && id.All(Scan.IsDigit) ? id.TrimStart('0') : id;
            h.Add(t.Length == 0 ? "0" : t, StringComparer.Ordinal);
        }
        return h.ToHashCode();
    }

    /// <summary>Precedence operators.</summary>
    public static bool operator <(SemanticVersion a, SemanticVersion b) => a.CompareTo(b) < 0;
    /// <summary>Precedence operators.</summary>
    public static bool operator >(SemanticVersion a, SemanticVersion b) => a.CompareTo(b) > 0;
    /// <summary>Precedence operators.</summary>
    public static bool operator <=(SemanticVersion a, SemanticVersion b) => a.CompareTo(b) <= 0;
    /// <summary>Precedence operators.</summary>
    public static bool operator >=(SemanticVersion a, SemanticVersion b) => a.CompareTo(b) >= 0;

    /// <summary>The version without its context.</summary>
    public override string ToString()
    {
        var b = new StringBuilder(16 + Prerelease.Length + Build.Length);
        b.Append(Major.ToString(CultureInfo.InvariantCulture)).Append('.')
         .Append(Minor.ToString(CultureInfo.InvariantCulture)).Append('.')
         .Append(Patch.ToString(CultureInfo.InvariantCulture));
        if (Prerelease.Length > 0) b.Append('-').Append(Prerelease);
        if (Build.Length > 0) b.Append('+').Append(Build);
        return b.ToString();
    }
}
