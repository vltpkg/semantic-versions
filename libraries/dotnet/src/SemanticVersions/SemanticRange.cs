using System.Text;

namespace SemanticVersions;

/// <summary>A comparator operator. <see cref="Eq"/> is written without an operator (<c>1.2.3</c>).</summary>
public enum Op
{
    /// <summary>=</summary>
    Eq,
    /// <summary>&lt;</summary>
    Lt,
    /// <summary>&lt;=</summary>
    Lte,
    /// <summary>&gt;</summary>
    Gt,
    /// <summary>&gt;=</summary>
    Gte,
}

/// <summary>
/// A primitive comparator: an operator and a bound, or "any" (matches every version). A build on
/// the bound is a build channel (a prefix filter on the candidate's build); a pre-release on it
/// declares a pre-release channel for its tuple.
/// </summary>
public sealed class Comparator
{
    internal static readonly Comparator Any = new(Op.Eq, null);

    /// <summary>The operator.</summary>
    public Op Op { get; }
    /// <summary>The bound, or null for the "any" comparator.</summary>
    public SemanticVersion? Version { get; }

    // The bound's fields, kept inline so Test compares without chasing the Version object.
    private readonly long _major, _minor, _patch;
    private readonly string _pre = "", _channel = "";

    internal Comparator(Op op, SemanticVersion? version)
    {
        Op = op;
        Version = version;
        if (version is not null)
        {
            (_major, _minor, _patch, _pre, _channel) = (version.Major, version.Minor, version.Patch, version.Prerelease, version.Build);
        }
    }

    internal static Comparator Of(Op op, SemanticVersion v) =>
        // ">=0.0.0" bounds nothing: it is the "any" comparator.
        op == Op.Gte && v.Major == 0 && v.Minor == 0 && v.Patch == 0 && v.Prerelease.Length == 0 && v.Build.Length == 0
            ? Any
            : new Comparator(op, v);

    /// <summary>True for the comparator that matches every version.</summary>
    public bool IsAny => Version is null;

    internal bool IsNull => Version is { Major: 0, Minor: 0, Patch: 0, Prerelease: "0", Build: "" } && Op == Op.Lt;

    /// <summary>True if v passes the bound and, when the comparator declares a build channel, carries a build in it.</summary>
    public bool Test(SemanticVersion v)
    {
        if (Version is null) return true;
        int o;
        if (v.Major != _major) o = v.Major < _major ? -1 : 1;
        else if (v.Minor != _minor) o = v.Minor < _minor ? -1 : 1;
        else if (v.Patch != _patch) o = v.Patch < _patch ? -1 : 1;
        else if (v.Prerelease.Length == 0) o = _pre.Length == 0 ? 0 : 1; // a pre-release ranks below its release
        else o = _pre.Length == 0 ? -1 : Scan.Compare(v.Prerelease, _pre);
        bool ok = Op switch
        {
            Op.Lt => o < 0,
            Op.Lte => o <= 0,
            Op.Gt => o > 0,
            Op.Gte => o >= 0,
            _ => o == 0,
        };
        return ok && (_channel.Length == 0 || Scan.StartsWith(v.Build, _channel));
    }

    internal bool Same(Comparator c)
    {
        if (Op != c.Op) return false;
        if (Version is null || c.Version is null) return Version is null && c.Version is null;
        var (a, b) = (Version, c.Version);
        return a.Major == b.Major && a.Minor == b.Minor && a.Patch == b.Patch
            && a.Prerelease == b.Prerelease && a.Build == b.Build;
    }

    /// <inheritdoc />
    public override string ToString() => Version is null ? "" : Symbol(Op) + Version;

    internal static string Symbol(Op op) => op switch
    {
        Op.Lt => "<",
        Op.Lte => "<=",
        Op.Gt => ">",
        Op.Gte => ">=",
        _ => "",
    };
}

/// <summary>
/// A parsed range: comparator sets joined by <c>||</c>, optionally scoped to a context
/// (<c>npm:react@^18</c>). Advanced syntax (hyphen, x-ranges, <c>~</c>, <c>~&gt;</c>, <c>^</c>,
/// <c>-*</c>, <c>*-*</c>) desugars to primitive comparators exactly as in the specification.
/// </summary>
public sealed class SemanticRange
{
    private sealed class Set(Comparator[] comparators, bool universalPre, (long, long, long)[] anyPre)
    {
        public readonly Comparator[] Comparators = comparators;

        public bool Test(SemanticVersion v)
        {
            foreach (var c in Comparators)
            {
                if (!c.Test(v)) return false;
            }
            if (v.Prerelease.Length == 0 || universalPre) return true;
            foreach (var (a, b, c) in anyPre)
            {
                if (a == v.Major && b == v.Minor && c == v.Patch) return true;
            }
            // A pre-release is admitted only by a comparator that declares a channel on the same
            // tuple whose identifiers it begins with.
            foreach (var c in Comparators)
            {
                var bound = c.Version;
                if (bound is not null && bound.Prerelease.Length > 0 && bound.SameTuple(v) && Scan.StartsWith(v.Prerelease, bound.Prerelease))
                    return true;
            }
            return false;
        }
    }

    private readonly Set[] _sets;

    /// <summary>The range as written.</summary>
    public string Raw { get; }
    /// <summary>The context the range is scoped to, or null.</summary>
    public string? Context { get; }

    private SemanticRange(string raw, string? context, Set[] sets)
    {
        Raw = raw;
        Context = context;
        _sets = sets;
    }

    /// <summary>Parses a range.</summary>
    /// <exception cref="SemanticVersionException">The input is not a range.</exception>
    public static SemanticRange Parse(string s) =>
        TryParse(s, out var r) ? r : throw new SemanticVersionException($"invalid range: \"{s}\"");

    /// <summary>Parses a range; returns false for input that is not a range.</summary>
    public static bool TryParse(string s, [System.Diagnostics.CodeAnalysis.NotNullWhen(true)] out SemanticRange? range)
    {
        range = null;
        if (s is null || s.Length > Scan.MaxLength) return false;
        var (context, body) = SemanticVersion.SplitReference(s);
        var sets = new List<Set>(2);
        int from = 0;
        while (true)
        {
            int bar = body.IndexOf("||", from, StringComparison.Ordinal);
            var part = bar < 0 ? body[from..] : body[from..bar];
            var set = ParseSet(part.Trim());
            if (set is null) return false;
            sets.Add(set);
            if (bar < 0) break;
            from = bar + 2;
        }
        if (sets.Count > 1)
        {
            // Drop sets that can match nothing (unless that is all there is), and collapse to
            // "any" if any set matches everything.
            var first = sets[0];
            sets.RemoveAll(st => st.Comparators.Length > 0 && st.Comparators[0].IsNull);
            if (sets.Count == 0) sets.Add(first);
            else if (sets.Count > 1)
            {
                var any = sets.Find(st => st.Comparators.Length == 1 && st.Comparators[0].IsAny);
                if (any is not null) sets = [any];
            }
        }
        range = new SemanticRange(s, context, [.. sets]);
        return true;
    }

    /// <summary>The desugared comparator sets.</summary>
    public IReadOnlyList<IReadOnlyList<Comparator>> ComparatorSets => _sets.Select(st => (IReadOnlyList<Comparator>)st.Comparators.ToArray()).ToArray();

    /// <summary>True if v satisfies the range. A context-scoped range only admits versions of the same context.</summary>
    public bool Test(SemanticVersion v)
    {
        if (Context is not null && !string.Equals(Context, v.Context, StringComparison.Ordinal)) return false;
        foreach (var st in _sets)
        {
            if (st.Test(v)) return true;
        }
        return false;
    }

    /// <summary>The desugared range ("" when it matches everything).</summary>
    public override string ToString()
    {
        var b = new StringBuilder();
        for (int i = 0; i < _sets.Length; i++)
        {
            if (i > 0) b.Append("||");
            bool first = true;
            foreach (var c in _sets[i].Comparators)
            {
                if (c.IsAny) continue;
                if (!first) b.Append(' ');
                first = false;
                b.Append(c);
            }
        }
        return b.ToString();
    }

    // ------------------------------------------------------------ desugaring

    private const long X = -1; // a wildcard component (x, X, * or absent)

    private readonly record struct Partial(long Major, long Minor, long Patch, string Pre, string Build);

    private static int Xr(string s, int i, out long value)
    {
        value = X;
        if (i < s.Length && (s[i] == 'x' || s[i] == 'X' || s[i] == '*')) return i + 1;
        if (i < s.Length && Scan.IsDigit(s[i])) return Scan.Numeric(s, i, out value);
        return -1;
    }

    /// <summary><c>&lt;xr&gt; [ "." &lt;xr&gt; [ "." &lt;xr&gt; &lt;qualifier&gt;? ] ]</c></summary>
    private static Partial? ParsePartial(string s)
    {
        int i = Xr(s, 0, out long major);
        if (i < 0) return null;
        long minor = X, patch = X;
        string pre = "", build = "";
        if (i < s.Length && s[i] == '.')
        {
            i = Xr(s, i + 1, out minor);
            if (i < 0) return null;
            if (i < s.Length && s[i] == '.')
            {
                i = Xr(s, i + 1, out patch);
                if (i < 0) return null;
                if (i < s.Length && s[i] == '-')
                {
                    int end = Scan.Identifiers(s, i + 1, true);
                    if (end < 0) return null;
                    pre = s[(i + 1)..end];
                    i = end;
                }
                if (i < s.Length && s[i] == '+')
                {
                    int end = Scan.Identifiers(s, i + 1, false);
                    if (end < 0) return null;
                    build = s[(i + 1)..end];
                    i = end;
                }
            }
        }
        return i == s.Length ? new Partial(major, minor, patch, pre, build) : null;
    }

    private static long Nz(long n) => n == X ? 0 : n;

    private static SemanticVersion V(long major, long minor, long patch, string pre = "") => new(major, minor, patch, pre);

    /// <summary>Attaches a build channel to every comparator ~ or ^ desugars to.</summary>
    private static void WithChannel(List<Comparator> output, int from, string channel)
    {
        if (channel.Length == 0) return;
        for (int i = from; i < output.Count; i++)
        {
            var c = output[i];
            var b = c.Version;
            // A channel turns ">=0.0.0" back into a real bound.
            output[i] = b is null
                ? new Comparator(Op.Gte, new SemanticVersion(0, 0, 0, "", channel))
                : new Comparator(c.Op, new SemanticVersion(b.Major, b.Minor, b.Patch, b.Prerelease, channel));
        }
    }

    /// <summary>
    /// <c>~</c> allows patch-level changes when a minor is given, minor-level
    /// otherwise. With <paramref name="approximate"/>, <c>~&gt;</c> keeps its
    /// RubyGems meaning: drop the last supplied part and allow up to the next
    /// value of the part before it, so two parts reach the next major. A
    /// trailing x is not a supplied part.
    /// </summary>
    private static void Tilde(Partial p, bool approximate, List<Comparator> output)
    {
        if (p.Major == X)
        {
            output.Add(Comparator.Any);
            return;
        }
        int from = output.Count;
        long m = p.Major, mi = Nz(p.Minor);
        if (p.Minor == X)
        {
            output.Add(Comparator.Of(Op.Gte, V(m, 0, 0)));
            output.Add(Comparator.Of(Op.Lt, V(m + 1, 0, 0, "0")));
        }
        else if (p.Patch == X)
        {
            output.Add(Comparator.Of(Op.Gte, V(m, mi, 0)));
            output.Add(Comparator.Of(Op.Lt, approximate ? V(m + 1, 0, 0, "0") : V(m, mi + 1, 0, "0")));
        }
        else
        {
            output.Add(Comparator.Of(Op.Gte, V(m, mi, p.Patch, p.Pre)));
            output.Add(Comparator.Of(Op.Lt, V(m, mi + 1, 0, "0")));
        }
        WithChannel(output, from, p.Build);
    }

    private static void Caret(Partial p, List<Comparator> output)
    {
        if (p.Major == X)
        {
            output.Add(Comparator.Any);
            return;
        }
        int from = output.Count;
        long m = p.Major, mi = Nz(p.Minor), pa = Nz(p.Patch);
        if (p.Minor == X)
        {
            output.Add(Comparator.Of(Op.Gte, V(m, 0, 0)));
            output.Add(Comparator.Of(Op.Lt, V(m + 1, 0, 0, "0")));
        }
        else if (p.Patch == X)
        {
            output.Add(Comparator.Of(Op.Gte, V(m, mi, 0)));
            output.Add(Comparator.Of(Op.Lt, m == 0 ? V(0, mi + 1, 0, "0") : V(m + 1, 0, 0, "0")));
        }
        else
        {
            var upper = m != 0 ? V(m + 1, 0, 0, "0") : mi == 0 ? V(0, 0, pa + 1, "0") : V(0, mi + 1, 0, "0");
            output.Add(Comparator.Of(Op.Gte, V(m, mi, pa, p.Pre)));
            output.Add(Comparator.Of(Op.Lt, upper));
        }
        WithChannel(output, from, p.Build);
    }

    private static void XRange(Op op, Partial p, List<Comparator> output)
    {
        bool xm = p.Major == X || p.Minor == X;
        bool anyX = xm || p.Patch == X;
        if (p.Major == X)
        {
            output.Add(op is Op.Gt or Op.Lt ? Comparator.Of(Op.Lt, V(0, 0, 0, "0")) : Comparator.Any);
            return;
        }
        long m = p.Major, mi = xm ? 0 : p.Minor;
        if (anyX && op != Op.Eq)
        {
            output.Add(op switch
            {
                Op.Gt => Comparator.Of(Op.Gte, xm ? V(m + 1, 0, 0) : V(m, mi + 1, 0)),
                Op.Lte => Comparator.Of(Op.Lt, xm ? V(m + 1, 0, 0, "0") : V(m, mi + 1, 0, "0")),
                Op.Lt => Comparator.Of(Op.Lt, V(m, mi, 0, "0")),
                _ => Comparator.Of(op, V(m, mi, 0)),
            });
            return;
        }
        if (xm)
        {
            output.Add(Comparator.Of(Op.Gte, V(m, 0, 0)));
            output.Add(Comparator.Of(Op.Lt, V(m + 1, 0, 0, "0")));
        }
        else if (p.Patch == X)
        {
            output.Add(Comparator.Of(Op.Gte, V(m, mi, 0)));
            output.Add(Comparator.Of(Op.Lt, V(m, mi + 1, 0, "0")));
        }
        else
        {
            output.Add(Comparator.Of(op, new SemanticVersion(m, mi, p.Patch, p.Pre, p.Build)));
        }
    }

    /// <summary><c>&lt;partial&gt; - &lt;partial&gt;</c>: an inclusive span; builds on either endpoint are ignored.</summary>
    /// <summary>
    /// <c>a - b</c>. Each endpoint keeps its own labels: a pre-release as that
    /// endpoint's pre-release channel and a build as its build channel.
    /// </summary>
    private static void Hyphen(Partial a, Partial b, List<Comparator> output)
    {
        int from = output.Count;
        if (a.Major != X)
        {
            var lo = a.Minor == X ? V(a.Major, 0, 0) : a.Patch == X ? V(a.Major, a.Minor, 0) : V(a.Major, a.Minor, a.Patch, a.Pre);
            int at = output.Count;
            output.Add(Comparator.Of(Op.Gte, lo));
            WithChannel(output, at, a.Build);
        }
        if (b.Major != X)
        {
            int at = output.Count;
            if (b.Minor == X) output.Add(Comparator.Of(Op.Lt, V(b.Major + 1, 0, 0, "0")));
            else if (b.Patch == X) output.Add(Comparator.Of(Op.Lt, V(b.Major, b.Minor + 1, 0, "0")));
            else output.Add(Comparator.Of(Op.Lte, V(b.Major, b.Minor, b.Patch, b.Pre)));
            WithChannel(output, at, b.Build);
        }
        if (output.Count == from) output.Add(Comparator.Any);
    }

    private static readonly string[] TuplePreOps = ["<=", ">=", "^", "~", "<", ">", "="];

    /// <summary>Recognizes <c>X.Y.Z-*</c> with an optional operator.</summary>
    private static bool TuplePre(string tok, out string op, out (long, long, long) tuple)
    {
        op = "";
        tuple = default;
        if (!tok.EndsWith("-*", StringComparison.Ordinal)) return false;
        var body = tok[..^2];
        foreach (var o in TuplePreOps)
        {
            if (body.StartsWith(o, StringComparison.Ordinal))
            {
                op = o;
                body = body[o.Length..];
                break;
            }
        }
        int i = Scan.Numeric(body, 0, out long a);
        if (i < 0 || i >= body.Length || body[i] != '.') return false;
        i = Scan.Numeric(body, i + 1, out long b);
        if (i < 0 || i >= body.Length || body[i] != '.') return false;
        i = Scan.Numeric(body, i + 1, out long c);
        if (i != body.Length) return false;
        tuple = (a, b, c);
        return true;
    }

    private static bool ComparatorToken(string tok, List<Comparator> output)
    {
        if (tok.Length == 0 || tok == "*")
        {
            output.Add(Comparator.Any);
            return true;
        }
        Partial? p;
        switch (tok[0])
        {
            case '^':
                p = ParsePartial(tok[1..]);
                if (p is null) return false;
                Caret(p.Value, output);
                return true;
            case '~':
                bool approximate = tok.StartsWith("~>", StringComparison.Ordinal);
                p = ParsePartial(tok[(approximate ? 2 : 1)..]);
                if (p is null) return false;
                Tilde(p.Value, approximate, output);
                return true;
        }
        (Op op, string rest) =
            tok.StartsWith(">=", StringComparison.Ordinal) ? (Op.Gte, tok[2..]) :
            tok.StartsWith("<=", StringComparison.Ordinal) ? (Op.Lte, tok[2..]) :
            tok[0] == '>' ? (Op.Gt, tok[1..]) :
            tok[0] == '<' ? (Op.Lt, tok[1..]) :
            tok[0] == '=' ? (Op.Eq, tok[1..]) :
            (Op.Eq, tok);
        p = ParsePartial(rest);
        if (p is null) return false;
        XRange(op, p.Value, output);
        return true;
    }

    private static bool IsOperator(string s) => s is "<" or "<=" or ">" or ">=" or "=" or "~" or "~>" or "^";

    private static Set? ParseSet(string s)
    {
        bool universal = false;
        var anyPre = new List<(long, long, long)>();
        var tokens = new List<string>(s.Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries));
        for (int i = 0; i < tokens.Count; i++)
        {
            if (tokens[i] == "*-*")
            {
                universal = true;
                tokens[i] = ">=0.0.0-0";
            }
            else if (TuplePre(tokens[i], out var op, out var t))
            {
                anyPre.Add(t);
                tokens[i] = $"{op}{t.Item1}.{t.Item2}.{t.Item3}-0";
            }
        }

        var comps = new List<Comparator>(4);
        if (tokens.Count == 3 && tokens[1] == "-")
        {
            var a = ParsePartial(tokens[0]);
            var b = ParsePartial(tokens[2]);
            if (a is null || b is null) return null;
            Hyphen(a.Value, b.Value, comps);
        }
        else
        {
            for (int i = 0; i < tokens.Count; i++)
            {
                // ">= 1.2.3", "~ 1.2": an operator separated from its version.
                bool ok;
                if (IsOperator(tokens[i]) && i + 1 < tokens.Count)
                {
                    ok = ComparatorToken(tokens[i] + tokens[i + 1], comps);
                    i++;
                }
                else
                {
                    ok = ComparatorToken(tokens[i], comps);
                }
                if (!ok) return null;
            }
            if (comps.Count == 0) comps.Add(Comparator.Any);
        }

        // A comparator that can match nothing makes the whole set match nothing.
        foreach (var c in comps)
        {
            if (c.IsNull) return new Set([c], universal, [.. anyPre]);
        }
        var unique = new List<Comparator>(comps.Count);
        foreach (var c in comps)
        {
            if (!unique.Exists(u => u.Same(c))) unique.Add(c);
        }
        if (unique.Count > 1) unique.RemoveAll(c => c.IsAny);
        return new Set([.. unique], universal, [.. anyPre]);
    }
}
