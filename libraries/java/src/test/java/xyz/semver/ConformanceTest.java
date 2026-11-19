package xyz.semver;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;

/**
 * Runs the shared conformance suite (../../conformance) against this library. Dependency-free:
 * exits non-zero on failure.
 *
 * <pre>javac -d build $(find src -name '*.java') && java -cp build xyz.semver.ConformanceTest</pre>
 */
public final class ConformanceTest {
    private static final List<String> failures = new ArrayList<>();
    private static int checks;

    private static void check(boolean ok, String message) {
        checks++;
        if (!ok) failures.add(message);
    }

    @SuppressWarnings("unchecked")
    static List<Map<String, Object>> cases(Path suite, String name) throws Exception {
        Map<String, Object> doc = (Map<String, Object>) Json.parse(Files.readString(suite.resolve(name + ".json")));
        return (List<Map<String, Object>>) doc.get("cases");
    }

    @SuppressWarnings("unchecked")
    public static void main(String[] args) throws Exception {
        Path suite = Path.of(args.length > 0 ? args[0] : "../../conformance");
        for (Map<String, Object> c : cases(suite, "versions")) {
            String in = (String) c.get("input");
            Version v = Version.tryParse(in);
            if ((Boolean) c.get("valid")) {
                check(v != null && v.toString().equals(c.get("version")), "parse " + in + " -> " + v);
                if (c.containsKey("context")) check(v != null && Objects.equals(v.context(), c.get("context")), "context " + in);
            } else {
                check(v == null, "accepted invalid " + in);
            }
        }
        for (Map<String, Object> c : cases(suite, "precedence")) {
            String a = (String) c.get("a"), b = (String) c.get("b");
            long want = (Long) c.get("expected");
            check(SemanticVersions.compare(a, b) == want && SemanticVersions.compare(b, a) == -want, "compare " + a + " " + b);
        }
        for (Map<String, Object> c : cases(suite, "ranges")) {
            String v = (String) c.get("version"), r = (String) c.get("range");
            check(SemanticVersions.satisfies(v, r) == (Boolean) c.get("expected"), "satisfies " + v + " in " + r);
        }
        for (Map<String, Object> c : cases(suite, "desugar")) {
            String got = SemanticVersions.validRange((String) c.get("input"));
            List<Object> accept = (List<Object>) c.getOrDefault("accept", List.of());
            check(Objects.equals(got, c.get("output")) || accept.contains(got), "desugar " + c.get("input") + " -> " + got);
        }

        List<String> vs = List.of("1.0.0", "2.0.0-rc.1", "1.5.0", "2.0.0", "1.5.0+build");
        check("1.5.0+build".equals(SemanticVersions.maxSatisfying(vs, "^1")), "maxSatisfying");
        check("1.0.0".equals(SemanticVersions.minSatisfying(vs, "^1")), "minSatisfying");
        check(SemanticVersions.sort(vs).equals(List.of("1.0.0", "1.5.0", "1.5.0+build", "2.0.0-rc.1", "2.0.0")), "sort");
        check(SemanticVersions.rsort(vs).get(0).equals("2.0.0"), "rsort");
        check("*".equals(SemanticVersions.validRange(">=0.0.0")), "validRange any");
        check(Range.parse("npm:react@^18").test(Version.parse("npm:react@18.2.0")), "context match");
        check(!Range.parse("npm:react@^18").test(Version.parse("18.2.0")), "context mismatch");
        check(Version.parse("1.0.0+001").equals(Version.parse("1.0.0+1"))
                && Version.parse("1.0.0+001").hashCode() == Version.parse("1.0.0+1").hashCode(), "equals/hashCode");
        try {
            Version.parse("1.2");
            check(false, "1.2 accepted");
        } catch (SemanticVersionException expected) {
            check(true, "");
        }

        if (!failures.isEmpty()) {
            failures.forEach(f -> System.err.println("FAIL " + f));
            System.err.println(failures.size() + " of " + checks + " checks failed");
            System.exit(1);
        }
        System.out.println("ok " + checks + " checks");
    }
}
