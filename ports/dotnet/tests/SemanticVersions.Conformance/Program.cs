using System.Text.Json;
using SemanticVersions;

// Runs the shared conformance suite (../../conformance) against this library.
var suite = args.Length > 0 ? args[0] : Path.Combine("..", "..", "conformance");
var failures = new List<string>();
int checks = 0;
void Check(bool ok, string message)
{
    checks++;
    if (!ok) failures.Add(message);
}
IEnumerable<JsonElement> Cases(string name) =>
    JsonDocument.Parse(File.ReadAllText(Path.Combine(suite, name + ".json"))).RootElement.GetProperty("cases").EnumerateArray();
string? Str(JsonElement c, string k) => c.TryGetProperty(k, out var v) ? v.GetString() : null;

foreach (var c in Cases("versions"))
{
    var input = Str(c, "input")!;
    var ok = SemanticVersion.TryParse(input, out var v);
    if (c.GetProperty("valid").GetBoolean())
    {
        Check(ok && v!.ToString() == Str(c, "version"), $"parse {input} -> {v}");
        if (c.TryGetProperty("context", out var ctx)) Check(v?.Context == ctx.GetString(), $"context {input}");
    }
    else
    {
        Check(!ok, $"accepted invalid {input}");
    }
}
foreach (var c in Cases("precedence"))
{
    string a = Str(c, "a")!, b = Str(c, "b")!;
    int want = c.GetProperty("expected").GetInt32();
    Check(Versions.Compare(a, b) == want && Versions.Compare(b, a) == -want, $"compare {a} {b}");
}
foreach (var c in Cases("ranges"))
{
    string v = Str(c, "version")!, r = Str(c, "range")!;
    Check(Versions.Satisfies(v, r) == c.GetProperty("expected").GetBoolean(), $"satisfies {v} in {r}");
}
foreach (var c in Cases("desugar"))
{
    var got = Versions.ValidRange(Str(c, "input")!);
    var accept = c.TryGetProperty("accept", out var acc) ? acc.EnumerateArray().Select(x => x.GetString()).ToList() : [];
    Check(got == Str(c, "output") || accept.Contains(got), $"desugar {Str(c, "input")} -> {got}");
}

string[] vs = ["1.0.0", "2.0.0-rc.1", "1.5.0", "2.0.0", "1.5.0+build"];
Check(Versions.MaxSatisfying(vs, "^1") == "1.5.0+build", "MaxSatisfying");
Check(Versions.MinSatisfying(vs, "^1") == "1.0.0", "MinSatisfying");
Check(Versions.Sort(vs).SequenceEqual(["1.0.0", "1.5.0", "1.5.0+build", "2.0.0-rc.1", "2.0.0"]), "Sort");
Check(Versions.RSort(vs)[0] == "2.0.0", "RSort");
Check(Versions.ValidRange(">=0.0.0") == "*", "ValidRange any");
Check(SemanticRange.Parse("npm:react@^18").Test(SemanticVersion.Parse("npm:react@18.2.0")), "context match");
Check(!SemanticRange.Parse("npm:react@^18").Test(SemanticVersion.Parse("18.2.0")), "context mismatch");
Check(SemanticVersion.Parse("1.0.0+001").Equals(SemanticVersion.Parse("1.0.0+1"))
    && SemanticVersion.Parse("1.0.0+001").GetHashCode() == SemanticVersion.Parse("1.0.0+1").GetHashCode(), "Equals/GetHashCode");
Check(!SemanticVersion.TryParse("1.2", out _), "1.2 rejected");

foreach (var f in failures) Console.Error.WriteLine("FAIL " + f);
if (failures.Count > 0)
{
    Console.Error.WriteLine($"{failures.Count} of {checks} checks failed");
    return 1;
}
Console.WriteLine($"ok {checks} checks");
return 0;
