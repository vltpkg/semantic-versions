package xyz.semver.bench;

import com.github.zafarkhaja.semver.expr.ExpressionParser;
import xyz.semver.Json;
import xyz.semver.Range;
import xyz.semver.SemanticVersions;
import xyz.semver.Version;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.TreeMap;
import java.util.function.BiFunction;
import java.util.function.Function;
import org.semver4j.Semver;
import org.semver4j.range.RangeList;
import org.semver4j.range.RangeListFactory;

/**
 * Benchmarks semantic-versions against semver4j (npm-compatible ranges) and java-semver on
 * real-world inputs, and scores all three against the shared conformance suite. Writes
 * ../../../benchmarks/results/java.json. See bench/run.sh.
 */
public final class Compare {
    static boolean quick;
    static volatile Object sink;

    /** Median nanoseconds per operation of f, which performs ops operations. */
    static double measure(int ops, Runnable f) {
        long sample = quick ? 60_000_000L : 250_000_000L;
        int samples = quick ? 5 : 15;
        // The JIT needs longer than an interpreter to settle: warm up for 1 s.
        long warm = System.nanoTime() + (quick ? 300_000_000L : 1_000_000_000L);
        while (System.nanoTime() < warm) f.run();
        double[] results = new double[samples];
        for (int s = 0; s < samples; s++) {
            long start = System.nanoTime();
            long calls = 0;
            long elapsed;
            do {
                f.run();
                calls++;
                elapsed = System.nanoTime() - start;
            } while (elapsed < sample);
            results[s] = (double) elapsed / (calls * ops);
        }
        Arrays.sort(results);
        return results[samples / 2];
    }

    static <T> T attempt(java.util.concurrent.Callable<T> f) {
        try {
            return f.call();
        } catch (Exception | Error e) {
            return null;
        }
    }

    record Lib(
            String name,
            String version,
            Function<String, Object> parse,
            Function<String, String> normalized,
            Function<String, String> context,
            BiFunction<String, String, Integer> compare,
            BiFunction<String, String, Boolean> satisfies,
            Function<String, Object> range,
            Function<String, String> desugar) {}

    static final String SEMVER4J = System.getProperty("semver4j.version", "6.0.0");
    static final String JSEMVER = System.getProperty("jsemver.version", "0.10.2");

    static final List<Lib> LIBS = List.of(
            new Lib("semantic-versions", "1.0.0",
                    Version::parse,
                    s -> Version.parse(s).toString(),
                    s -> Version.parse(s).context(),
                    SemanticVersions::compare,
                    (v, r) -> {
                        Range.parse(r);
                        return SemanticVersions.satisfies(v, r);
                    },
                    Range::parse,
                    SemanticVersions::validRange),
            new Lib("semver4j", SEMVER4J,
                    Semver::new,
                    s -> new Semver(s).getVersion(),
                    s -> null,
                    (a, b) -> new Semver(a).compareTo(new Semver(b)),
                    (v, r) -> {
                        RangeList range = RangeListFactory.create(r);
                        Semver x = Semver.parse(v);
                        return x != null && range.isSatisfiedBy(x);
                    },
                    RangeListFactory::create,
                    null),
            new Lib("java-semver", JSEMVER,
                    com.github.zafarkhaja.semver.Version::parse,
                    s -> com.github.zafarkhaja.semver.Version.parse(s).toString(),
                    s -> null,
                    (a, b) -> com.github.zafarkhaja.semver.Version.parse(a).compareTo(com.github.zafarkhaja.semver.Version.parse(b)),
                    (v, r) -> {
                        var expr = ExpressionParser.newInstance().parse(r);
                        return com.github.zafarkhaja.semver.Version.tryParse(v).map(x -> x.satisfies(expr)).orElse(false);
                    },
                    r -> ExpressionParser.newInstance().parse(r),
                    null));

    @SuppressWarnings("unchecked")
    static List<Map<String, Object>> cases(Path root, String name) throws Exception {
        return (List<Map<String, Object>>) ((Map<String, Object>) Json.parse(Files.readString(root.resolve("conformance/" + name + ".json")))).get("cases");
    }

    @SuppressWarnings("unchecked")
    static Map<String, Map<String, Integer>> conformance(Path root, Lib l) throws Exception {
        Map<String, Map<String, Integer>> by = new TreeMap<>();
        BiFunction<String, Boolean, Void> tally = (cat, ok) -> {
            Map<String, Integer> t = by.computeIfAbsent(cat, k -> new LinkedHashMap<>(Map.of("passed", 0, "total", 0)));
            t.put("total", t.get("total") + 1);
            if (ok) t.put("passed", t.get("passed") + 1);
            return null;
        };
        for (Map<String, Object> c : cases(root, "versions")) {
            String in = (String) c.get("input");
            boolean ok;
            if ((Boolean) c.get("valid")) {
                ok = Objects.equals(attempt(() -> l.normalized.apply(in)), c.get("version"));
                if (c.containsKey("context")) ok = ok && Objects.equals(attempt(() -> l.context.apply(in)), c.get("context"));
            } else {
                ok = attempt(() -> l.parse.apply(in)) == null;
            }
            tally.apply((String) c.get("category"), ok);
        }
        for (Map<String, Object> c : cases(root, "precedence")) {
            Integer got = attempt(() -> l.compare.apply((String) c.get("a"), (String) c.get("b")));
            tally.apply((String) c.get("category"), got != null && Integer.signum(got) == ((Long) c.get("expected")).intValue());
        }
        for (Map<String, Object> c : cases(root, "ranges")) {
            Boolean got = attempt(() -> l.satisfies.apply((String) c.get("version"), (String) c.get("range")));
            tally.apply((String) c.get("category"), Boolean.TRUE.equals(got) == (Boolean) c.get("expected"));
        }
        if (l.desugar != null) {
            for (Map<String, Object> c : cases(root, "desugar")) {
                String got = attempt(() -> l.desugar.apply((String) c.get("input")));
                List<Object> accept = (List<Object>) c.getOrDefault("accept", List.of());
                tally.apply((String) c.get("category"), Objects.equals(got, c.get("output")) || (got != null && accept.contains(got)));
            }
        }
        return by;
    }

    @SuppressWarnings("unchecked")
    public static void main(String[] args) throws Exception {
        quick = Arrays.asList(args).contains("--quick");
        Path root = Path.of(System.getProperty("root", "../../.."));
        Map<String, Object> corpus = (Map<String, Object>) Json.parse(Files.readString(root.resolve("benchmarks/corpus.json")));
        List<String> versions = (List<String>) corpus.get("versions");
        List<String> allRanges = (List<String>) corpus.get("ranges");
        Map<String, List<String>> packages = (Map<String, List<String>>) corpus.get("packages");

        // Ranges both npm-syntax libraries accept; java-semver has its own expression syntax, so
        // it is compared on versions only.
        List<String> ranges = new ArrayList<>();
        for (String r : allRanges) {
            if (attempt(() -> Range.parse(r)) != null && attempt(() -> RangeListFactory.create(r)) != null) ranges.add(r);
        }
        Set<String> comparable = new HashSet<>(ranges);
        List<String[]> resolutions = new ArrayList<>();
        int pairs = 0;
        for (Object o : (List<Object>) corpus.get("resolutions")) {
            List<String> p = (List<String>) o;
            if (comparable.contains(p.get(1))) {
                resolutions.add(new String[] {p.get(0), p.get(1)});
                pairs += packages.get(p.get(0)).size();
            }
        }

        List<Map<String, Object>> tasks = new ArrayList<>();
        BiFunction<String[], Map<String, Double>, Void> row = (meta, res) -> {
            Map<String, Object> results = new LinkedHashMap<>();
            res.forEach((name, ns) -> {
                System.err.printf("%-10s %-18s %10.1f ns/op%n", meta[0], name, ns);
                results.put(name, Map.of("nsPerOp", Math.round(ns * 10) / 10.0, "opsPerSec", Math.round(1e9 / ns)));
            });
            Map<String, Object> t = new LinkedHashMap<>();
            t.put("id", meta[0]);
            t.put("label", meta[1]);
            t.put("description", meta[2]);
            t.put("results", results);
            tasks.add(t);
            return null;
        };

        int n = versions.size();
        Map<String, Double> parse = new LinkedHashMap<>();
        parse.put("semantic-versions", measure(n, () -> {
            for (String s : versions) sink = Version.tryParse(s);
        }));
        parse.put("semver4j", measure(n, () -> {
            for (String s : versions) sink = Semver.parse(s);
        }));
        parse.put("java-semver", measure(n, () -> {
            for (String s : versions) sink = com.github.zafarkhaja.semver.Version.tryParse(s);
        }));
        row.apply(new String[] {"parse", "Parse a version", n + " published versions"}, parse);

        List<Version> svs = new ArrayList<>();
        List<Semver> s4s = new ArrayList<>();
        List<com.github.zafarkhaja.semver.Version> jss = new ArrayList<>();
        for (String s : versions) {
            Version a = Version.tryParse(s);
            if (a != null) svs.add(a);
            Semver b = Semver.parse(s);
            if (b != null) s4s.add(b);
            com.github.zafarkhaja.semver.Version.tryParse(s).ifPresent(jss::add);
        }
        Map<String, Double> sort = new LinkedHashMap<>();
        sort.put("semantic-versions", measure(svs.size(), () -> {
            List<Version> l = new ArrayList<>(svs);
            l.sort(null);
            sink = l;
        }));
        sort.put("semver4j", measure(s4s.size(), () -> {
            List<Semver> l = new ArrayList<>(s4s);
            l.sort(null);
            sink = l;
        }));
        sort.put("java-semver", measure(jss.size(), () -> {
            List<com.github.zafarkhaja.semver.Version> l = new ArrayList<>(jss);
            l.sort(null);
            sink = l;
        }));
        row.apply(new String[] {"sort", "Sort versions", n + " parsed versions by precedence (per version)"}, sort);

        Map<String, Double> range = new LinkedHashMap<>();
        range.put("semantic-versions", measure(ranges.size(), () -> {
            for (String r : ranges) sink = Range.parse(r);
        }));
        range.put("semver4j", measure(ranges.size(), () -> {
            for (String r : ranges) sink = RangeListFactory.create(r);
        }));
        row.apply(new String[] {"range", "Parse a range", ranges.size() + " real dependency ranges"}, range);

        Map<String, List<Version>> svPkg = new HashMap<>();
        Map<String, List<Semver>> s4Pkg = new HashMap<>();
        packages.forEach((name, vs) -> {
            List<Version> a = new ArrayList<>();
            List<Semver> b = new ArrayList<>();
            for (String s : vs) {
                Version x = Version.tryParse(s);
                if (x != null) a.add(x);
                Semver y = Semver.parse(s);
                if (y != null) b.add(y);
            }
            svPkg.put(name, a);
            s4Pkg.put(name, b);
        });
        List<Range> svRanges = new ArrayList<>();
        List<RangeList> s4Ranges = new ArrayList<>();
        for (String[] r : resolutions) {
            svRanges.add(Range.parse(r[1]));
            s4Ranges.add(RangeListFactory.create(r[1]));
        }
        Map<String, Double> sat = new LinkedHashMap<>();
        sat.put("semantic-versions", measure(pairs, () -> {
            int hits = 0;
            for (int i = 0; i < resolutions.size(); i++) {
                Range r = svRanges.get(i);
                for (Version v : svPkg.get(resolutions.get(i)[0])) if (r.test(v)) hits++;
            }
            sink = hits;
        }));
        sat.put("semver4j", measure(pairs, () -> {
            int hits = 0;
            for (int i = 0; i < resolutions.size(); i++) {
                RangeList r = s4Ranges.get(i);
                for (Semver v : s4Pkg.get(resolutions.get(i)[0])) if (r.isSatisfiedBy(v)) hits++;
            }
            sink = hits;
        }));
        row.apply(new String[] {"satisfies", "range.test(version)", pairs + " version × range checks"}, sat);

        Map<String, Double> resolve = new LinkedHashMap<>();
        resolve.put("semantic-versions", measure(resolutions.size(), () -> {
            for (String[] res : resolutions) {
                Range r = Range.parse(res[1]);
                Version best = null;
                for (Version v : svPkg.get(res[0])) if (r.test(v) && (best == null || v.compareTo(best) > 0)) best = v;
                sink = best;
            }
        }));
        resolve.put("semver4j", measure(resolutions.size(), () -> {
            for (String[] res : resolutions) {
                RangeList r = RangeListFactory.create(res[1]);
                Semver best = null;
                for (Semver v : s4Pkg.get(res[0])) if (r.isSatisfiedBy(v) && (best == null || v.compareTo(best) > 0)) best = v;
                sink = best;
            }
        }));
        row.apply(new String[] {"resolve", "Resolve a range", resolutions.size() + " max-satisfying lookups against a package's versions"}, resolve);

        Map<String, Object> conf = new LinkedHashMap<>();
        Map<String, Object> coverage = new LinkedHashMap<>();
        Map<String, Object> libraries = new LinkedHashMap<>();
        for (Lib l : LIBS) {
            conf.put(l.name, conformance(root, l));
            int cv = 0, cr = 0;
            for (String v : versions) if (attempt(() -> l.parse.apply(v)) != null) cv++;
            for (String r : allRanges) if (attempt(() -> l.range.apply(r)) != null) cr++;
            coverage.put(l.name, Map.of("versions", cv, "ranges", cr));
            libraries.put(l.name, Map.of("version", l.version));
        }
        if (quick) {
            conf.forEach((k, v) -> {
                int p = 0, t = 0;
                for (Map<String, Integer> x : ((Map<String, Map<String, Integer>>) v).values()) {
                    p += x.get("passed");
                    t += x.get("total");
                }
                System.err.println("conformance " + k + " " + p + "/" + t + " coverage " + coverage.get(k));
            });
            return;
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("language", "Java");
        out.put("subject", "semantic-versions");
        out.put("baseline", "semver4j");
        out.put("environment", Map.of(
                "runtime", System.getProperty("java.vm.name").replace("OpenJDK 64-Bit Server VM", "OpenJDK") + " " + Runtime.version().feature(),
                "cpu", cpuModel(),
                "platform", System.getProperty("os.name").toLowerCase() + " " + System.getProperty("os.arch"),
                "date", LocalDate.now().toString()));
        out.put("libraries", libraries);
        out.put("corpus", Map.of("versions", n, "ranges", allRanges.size(), "comparableRanges", ranges.size(), "fetched", corpus.get("fetched")));
        out.put("coverage", coverage);
        out.put("tasks", tasks);
        out.put("conformance", conf);
        out.put("notes", Map.of("java-semver", "Its range expressions use their own syntax (& and | operators), so it is compared on versions only."));
        Files.writeString(root.resolve("benchmarks/results/java.json"), toJson(out, "") + "\n");
    }

    static String cpuModel() {
        try {
            for (String line : Files.readAllLines(Path.of("/proc/cpuinfo"))) {
                if (line.startsWith("model name")) return line.split(":", 2)[1].trim();
            }
        } catch (Exception ignored) {
            // not Linux
        }
        try {
            Process p = new ProcessBuilder("sysctl", "-n", "machdep.cpu.brand_string").start();
            String s = new String(p.getInputStream().readAllBytes()).trim();
            if (!s.isEmpty()) return s;
        } catch (Exception ignored) {
            // not macOS
        }
        return "unknown";
    }

    @SuppressWarnings("unchecked")
    static String toJson(Object o, String indent) {
        String in = indent + "  ";
        if (o == null) return "null";
        if (o instanceof String s) return '"' + s.replace("\\", "\\\\").replace("\"", "\\\"") + '"';
        if (o instanceof Number || o instanceof Boolean) {
            if (o instanceof Double d && d == Math.rint(d) && !Double.isInfinite(d)) return String.valueOf(d.longValue());
            return String.valueOf(o);
        }
        if (o instanceof Map<?, ?> m) {
            if (m.isEmpty()) return "{}";
            StringBuilder b = new StringBuilder("{\n");
            Map<String, Object> sorted = m instanceof LinkedHashMap ? (Map<String, Object>) m : new TreeMap<>((Map<String, Object>) m);
            int i = 0;
            for (Map.Entry<String, Object> e : sorted.entrySet()) {
                b.append(in).append(toJson(e.getKey(), in)).append(": ").append(toJson(e.getValue(), in));
                b.append(++i < sorted.size() ? ",\n" : "\n");
            }
            return b.append(indent).append('}').toString();
        }
        if (o instanceof List<?> l) {
            if (l.isEmpty()) return "[]";
            StringBuilder b = new StringBuilder("[\n");
            for (int i = 0; i < l.size(); i++) {
                b.append(in).append(toJson(l.get(i), in)).append(i + 1 < l.size() ? ",\n" : "\n");
            }
            return b.append(indent).append(']').toString();
        }
        throw new IllegalArgumentException(o.getClass().toString());
    }
}
