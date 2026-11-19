// Benchmarks SemanticVersions against Semver (maxhauser) and SemanticVersioning (a node-semver
// port) on real-world inputs, and scores all three against the shared conformance suite. Writes
// ../../benchmarks/results/dotnet.json (paths are relative to ports/dotnet).
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text.Json;
using System.Text.Json.Nodes;
using Semver;
using SemanticVersions;
using NV = SemanticVersioning.Version;
using NR = SemanticVersioning.Range;

bool quick = args.Contains("-quick") || args.Contains("--quick");
string root = Environment.GetEnvironmentVariable("SV_ROOT") ?? Path.GetFullPath(Path.Combine("..", ".."));
object? sink = null;

double Measure(int ops, Action f)
{
    long sample = quick ? 60 : 250;
    int samples = quick ? 5 : 15;
    // The JIT needs longer than an interpreter to settle: warm up for 1 s.
    var warm = Stopwatch.StartNew();
    while (warm.ElapsedMilliseconds < (quick ? 300 : 1000)) f();
    var results = new double[samples];
    for (int s = 0; s < samples; s++)
    {
        var sw = Stopwatch.StartNew();
        long calls = 0;
        do
        {
            f();
            calls++;
        } while (sw.ElapsedMilliseconds < sample);
        results[s] = sw.Elapsed.TotalNanoseconds / (calls * (double)ops);
    }
    Array.Sort(results);
    return results[samples / 2];
}

T? Attempt<T>(Func<T> f)
{
    try { return f(); } catch { return default; }
}

var libs = new[]
{
    new Lib("semantic-versions", typeof(Versions).Assembly.GetName().Version!.ToString(3),
        s => SemanticVersion.Parse(s),
        s => SemanticVersion.Parse(s).ToString(),
        s => SemanticVersion.Parse(s).Context,
        Versions.Compare,
        (v, r) => { SemanticRange.Parse(r); return Versions.Satisfies(v, r); },
        r => SemanticRange.Parse(r),
        Versions.ValidRange),
    new Lib("Semver", "3.0.0",
        s => SemVersion.Parse(s, SemVersionStyles.Strict),
        s => SemVersion.Parse(s, SemVersionStyles.Strict).ToString(),
        _ => null,
        (a, b) => SemVersion.ComparePrecedence(SemVersion.Parse(a, SemVersionStyles.Strict), SemVersion.Parse(b, SemVersionStyles.Strict)),
        (v, r) =>
        {
            var range = SemVersionRange.ParseNpm(r);
            return SemVersion.TryParse(v, SemVersionStyles.Strict, out var x) && range.Contains(x);
        },
        r => SemVersionRange.ParseNpm(r),
        null),
    new Lib("SemanticVersioning", "3.0.0",
        s => new NV(s),
        s =>
        {
            var v = new NV(s);
            return v.Build is null ? v.Clean() : v.Clean() + "+" + v.Build;
        },
        _ => null,
        (a, b) => new NV(a).CompareTo(new NV(b)),
        (v, r) =>
        {
            var range = new NR(r);
            return NV.TryParse(v, out var x) && range.IsSatisfied(x);
        },
        r => new NR(r),
        null),
};

IEnumerable<JsonElement> Cases(string name) =>
    JsonDocument.Parse(File.ReadAllText(Path.Combine(root, "conformance", name + ".json"))).RootElement.GetProperty("cases").EnumerateArray();
string S(JsonElement c, string k) => c.GetProperty(k).GetString()!;

JsonObject Conformance(Lib l)
{
    var by = new SortedDictionary<string, (int passed, int total)>(StringComparer.Ordinal);
    void Tally(string cat, bool ok)
    {
        by.TryGetValue(cat, out var t);
        by[cat] = (t.passed + (ok ? 1 : 0), t.total + 1);
    }
    foreach (var c in Cases("versions"))
    {
        var input = S(c, "input");
        bool ok = c.GetProperty("valid").GetBoolean()
            ? Attempt(() => l.Normalized(input)) == S(c, "version")
              && (!c.TryGetProperty("context", out var ctx) || Attempt(() => l.Context(input)) == ctx.GetString())
            : Attempt(() => l.Parse(input)) is null;
        Tally(S(c, "category"), ok);
    }
    foreach (var c in Cases("precedence"))
    {
        int? got = Attempt<int?>(() => l.Compare(S(c, "a"), S(c, "b")));
        Tally(S(c, "category"), got is not null && Math.Sign(got.Value) == c.GetProperty("expected").GetInt32());
    }
    foreach (var c in Cases("ranges"))
    {
        Tally(S(c, "category"), Attempt(() => l.Satisfies(S(c, "version"), S(c, "range"))) == c.GetProperty("expected").GetBoolean());
    }
    if (l.Desugar is not null)
    {
        foreach (var c in Cases("desugar"))
        {
            var got = Attempt(() => l.Desugar(S(c, "input")));
            var accept = c.TryGetProperty("accept", out var a) ? a.EnumerateArray().Select(x => x.GetString()).ToList() : [];
            Tally(S(c, "category"), got == S(c, "output") || (got is not null && accept.Contains(got)));
        }
    }
    var o = new JsonObject();
    foreach (var (k, v) in by) o[k] = new JsonObject { ["passed"] = v.passed, ["total"] = v.total };
    return o;
}

var corpus = JsonDocument.Parse(File.ReadAllText(Path.Combine(root, "benchmarks", "corpus.json"))).RootElement;
List<string> Strings(JsonElement e) => e.EnumerateArray().Select(x => x.GetString()!).ToList();
var versions = Strings(corpus.GetProperty("versions"));
var allRanges = Strings(corpus.GetProperty("ranges"));
var packages = corpus.GetProperty("packages").EnumerateObject().ToDictionary(p => p.Name, p => Strings(p.Value));

// Ranges every npm-syntax library accepts.
var ranges = allRanges.Where(r => SemanticRange.TryParse(r, out _) && SemVersionRange.TryParseNpm(r, out _) && NR.TryParse(r, out _)).ToList();
var comparable = ranges.ToHashSet();
var resolutions = corpus.GetProperty("resolutions").EnumerateArray()
    .Select(r => (name: r[0].GetString()!, range: r[1].GetString()!)).Where(r => comparable.Contains(r.range)).ToList();
int pairs = resolutions.Sum(r => packages[r.name].Count);

var tasks = new JsonArray();
void Row(string id, string label, string description, (string name, double ns)[] results)
{
    var res = new JsonObject();
    foreach (var (name, ns) in results)
    {
        Console.Error.WriteLine($"{id,-10} {name,-20} {ns,10:F1} ns/op");
        res[name] = new JsonObject { ["nsPerOp"] = Math.Round(ns, 1), ["opsPerSec"] = Math.Round(1e9 / ns) };
    }
    tasks.Add(new JsonObject { ["id"] = id, ["label"] = label, ["description"] = description, ["results"] = res });
}

int n = versions.Count;
Row("parse", "Parse a version", $"{n} published versions", [
    ("semantic-versions", Measure(n, () => { foreach (var s in versions) { SemanticVersion.TryParse(s, out var v); sink = v; } })),
    ("Semver", Measure(n, () => { foreach (var s in versions) { SemVersion.TryParse(s, SemVersionStyles.Strict, out var v); sink = v; } })),
    ("SemanticVersioning", Measure(n, () => { foreach (var s in versions) { NV.TryParse(s, out var v); sink = v; } })),
]);

var svs = versions.Select(s => SemanticVersion.TryParse(s, out var v) ? v : null).OfType<SemanticVersion>().ToArray();
var mhs = versions.Select(s => SemVersion.TryParse(s, SemVersionStyles.Strict, out var v) ? v : null).OfType<SemVersion>().ToArray();
var nvs = versions.Select(s => NV.TryParse(s, out var v) ? v : null).OfType<NV>().ToArray();
Row("sort", "Sort versions", $"{n} parsed versions by precedence (per version)", [
    ("semantic-versions", Measure(svs.Length, () => { var l = (SemanticVersion[])svs.Clone(); Versions.Sort(l); sink = l; })),
    ("Semver", Measure(mhs.Length, () => { var l = (SemVersion[])mhs.Clone(); Array.Sort(l, SemVersion.PrecedenceComparer); sink = l; })),
    ("SemanticVersioning", Measure(nvs.Length, () => { var l = (NV[])nvs.Clone(); Array.Sort(l); sink = l; })),
]);

Row("range", "Parse a range", $"{ranges.Count} real dependency ranges", [
    ("semantic-versions", Measure(ranges.Count, () => { foreach (var r in ranges) sink = SemanticRange.Parse(r); })),
    ("Semver", Measure(ranges.Count, () => { foreach (var r in ranges) sink = SemVersionRange.ParseNpm(r); })),
    ("SemanticVersioning", Measure(ranges.Count, () => { foreach (var r in ranges) sink = new NR(r); })),
]);

var svPkg = packages.ToDictionary(p => p.Key, p => p.Value.Select(s => SemanticVersion.TryParse(s, out var v) ? v : null).OfType<SemanticVersion>().ToArray());
var mhPkg = packages.ToDictionary(p => p.Key, p => p.Value.Select(s => SemVersion.TryParse(s, SemVersionStyles.Strict, out var v) ? v : null).OfType<SemVersion>().ToArray());
var nvPkg = packages.ToDictionary(p => p.Key, p => p.Value.Select(s => NV.TryParse(s, out var v) ? v : null).OfType<NV>().ToArray());
var svPairs = resolutions.Select(r => (SemanticRange.Parse(r.range), svPkg[r.name])).ToArray();
var mhPairs = resolutions.Select(r => (SemVersionRange.ParseNpm(r.range), mhPkg[r.name])).ToArray();
var nvPairs = resolutions.Select(r => (new NR(r.range), nvPkg[r.name])).ToArray();
Row("satisfies", "range.Test(version)", $"{pairs} version × range checks", [
    ("semantic-versions", Measure(pairs, () => { int h = 0; foreach (var (r, vs) in svPairs) foreach (var v in vs) if (r.Test(v)) h++; sink = h; })),
    ("Semver", Measure(pairs, () => { int h = 0; foreach (var (r, vs) in mhPairs) foreach (var v in vs) if (r.Contains(v)) h++; sink = h; })),
    ("SemanticVersioning", Measure(pairs, () => { int h = 0; foreach (var (r, vs) in nvPairs) foreach (var v in vs) if (r.IsSatisfied(v)) h++; sink = h; })),
]);

Row("resolve", "Resolve a range", $"{resolutions.Count} max-satisfying lookups against a package's versions", [
    ("semantic-versions", Measure(resolutions.Count, () =>
    {
        foreach (var (name, range) in resolutions)
        {
            var r = SemanticRange.Parse(range);
            SemanticVersion? best = null;
            foreach (var v in svPkg[name]) if (r.Test(v) && (best is null || v.CompareTo(best) > 0)) best = v;
            sink = best;
        }
    })),
    ("Semver", Measure(resolutions.Count, () =>
    {
        foreach (var (name, range) in resolutions)
        {
            var r = SemVersionRange.ParseNpm(range);
            SemVersion? best = null;
            foreach (var v in mhPkg[name]) if (r.Contains(v) && (best is null || SemVersion.ComparePrecedence(v, best) > 0)) best = v;
            sink = best;
        }
    })),
    ("SemanticVersioning", Measure(resolutions.Count, () =>
    {
        foreach (var (name, range) in resolutions)
        {
            var r = new NR(range);
            NV? best = null;
            foreach (var v in nvPkg[name]) if (r.IsSatisfied(v) && (best is null || v.CompareTo(best) > 0)) best = v;
            sink = best;
        }
    })),
]);
GC.KeepAlive(sink);

var conformance = new JsonObject();
var coverage = new JsonObject();
var libraries = new JsonObject();
foreach (var l in libs)
{
    conformance[l.Name] = Conformance(l);
    coverage[l.Name] = new JsonObject
    {
        ["versions"] = versions.Count(v => Attempt(() => l.Parse(v)) is not null),
        ["ranges"] = allRanges.Count(r => Attempt(() => l.Range(r)) is not null),
    };
    libraries[l.Name] = new JsonObject { ["version"] = l.Version };
}
if (quick)
{
    foreach (var l in libs)
    {
        var c = conformance[l.Name]!.AsObject();
        Console.Error.WriteLine($"conformance {l.Name} {c.Sum(x => (int)x.Value!["passed"]!)}/{c.Sum(x => (int)x.Value!["total"]!)} coverage {coverage[l.Name]!.ToJsonString()}");
    }
    return;
}
var output = new JsonObject
{
    ["language"] = ".NET",
    ["subject"] = "semantic-versions",
    ["baseline"] = "Semver",
    ["environment"] = new JsonObject
    {
        ["runtime"] = RuntimeInformation.FrameworkDescription,
        ["cpu"] = CpuModel(),
        ["platform"] = $"{(OperatingSystem.IsLinux() ? "linux" : OperatingSystem.IsMacOS() ? "darwin" : "windows")} {RuntimeInformation.OSArchitecture.ToString().ToLowerInvariant()}",
        ["date"] = DateTime.Now.ToString("yyyy-MM-dd"),
    },
    ["libraries"] = libraries,
    ["corpus"] = new JsonObject { ["versions"] = n, ["ranges"] = allRanges.Count, ["comparableRanges"] = ranges.Count, ["fetched"] = corpus.GetProperty("fetched").GetString() },
    ["coverage"] = coverage,
    ["tasks"] = tasks,
    ["conformance"] = conformance,
    ["notes"] = new JsonObject { ["Semver"] = "Compared by precedence (ComparePrecedence), which ignores builds as SemVer 2.0.0 specifies." },
};
File.WriteAllText(Path.Combine(root, "benchmarks", "results", "dotnet.json"), output.ToJsonString(new JsonSerializerOptions { WriteIndented = true }) + "\n");

static string CpuModel()
{
    try
    {
        var line = File.ReadLines("/proc/cpuinfo").FirstOrDefault(l => l.StartsWith("model name", StringComparison.Ordinal));
        if (line is not null) return line.Split(':', 2)[1].Trim();
    }
    catch (IOException) { }
    try
    {
        var p = Process.Start(new ProcessStartInfo("sysctl", "-n machdep.cpu.brand_string") { RedirectStandardOutput = true })!;
        var s = p.StandardOutput.ReadToEnd().Trim();
        if (s.Length > 0) return s;
    }
    catch (Exception) { }
    return RuntimeInformation.ProcessArchitecture.ToString();
}

record Lib(
    string Name,
    string Version,
    Func<string, object?> Parse,
    Func<string, string?> Normalized,
    Func<string, string?> Context,
    Func<string, string, int> Compare,
    Func<string, string, bool> Satisfies,
    Func<string, object?> Range,
    Func<string, string?>? Desugar);
