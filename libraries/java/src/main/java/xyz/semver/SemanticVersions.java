package xyz.semver;

import java.util.ArrayList;
import java.util.Collection;
import java.util.List;

/**
 * Parse, compare and match versions per the Semantic Versions specification
 * (<a href="https://semver.xyz">semver.xyz</a>).
 *
 * <p>A port of the JavaScript reference implementation ({@code semantic-versions} on npm), checked
 * against the same shared conformance suite.
 */
public final class SemanticVersions {
    private SemanticVersions() {}

    /** The longest version or range accepted. */
    public static final int MAX_LENGTH = Identifiers.MAX_LENGTH;

    /** The largest numeric version component accepted. */
    public static final long MAX_SAFE_INTEGER = Identifiers.MAX_SAFE_INTEGER;

    /** Parses a version; throws {@link SemanticVersionException}. */
    public static Version parse(String version) {
        return Version.parse(version);
    }

    /** The normalized version, or null if the input is not a version. */
    public static String valid(String version) {
        Version v = Version.tryParse(version);
        return v == null ? null : v.toString();
    }

    /** The desugared range ({@code *} when it matches everything), or null. */
    public static String validRange(String range) {
        Range r = Range.tryParse(range);
        if (r == null) return null;
        String s = r.toString();
        return s.isEmpty() ? "*" : s;
    }

    /** -1, 0 or 1 by precedence (builds rank above their release). */
    public static int compare(String a, String b) {
        return Integer.signum(Version.parse(a).compareTo(Version.parse(b)));
    }

    /** True if version satisfies range; invalid input never does. */
    public static boolean satisfies(String version, String range) {
        if (version.equals(range)) {
            // Mirrors the JavaScript reference: an identical string trivially matches.
            return Version.tryParse(version) != null;
        }
        Range r = Range.tryParse(range);
        if (r == null) return false;
        Version v = Version.tryParse(version);
        return v != null && r.test(v);
    }

    private static String pick(Collection<String> versions, String range, boolean lower) {
        Range r = Range.tryParse(range);
        if (r == null) return null;
        String best = null;
        Version bv = null;
        for (String s : versions) {
            Version v = Version.tryParse(s);
            if (v == null || !r.test(v)) continue;
            if (bv == null || (lower ? v.compareTo(bv) < 0 : v.compareTo(bv) > 0)) {
                best = s;
                bv = v;
            }
        }
        return best;
    }

    /** The highest version that satisfies range, or null. */
    public static String maxSatisfying(Collection<String> versions, String range) {
        return pick(versions, range, false);
    }

    /** The lowest version that satisfies range, or null. */
    public static String minSatisfying(Collection<String> versions, String range) {
        return pick(versions, range, true);
    }

    /** Versions sorted ascending by precedence (stable); invalid entries throw. */
    public static List<String> sort(Collection<String> versions) {
        List<Version> parsed = new ArrayList<>(versions.size());
        List<String> raw = new ArrayList<>(versions);
        for (String s : raw) parsed.add(Version.parse(s));
        Integer[] order = new Integer[raw.size()];
        for (int i = 0; i < order.length; i++) order[i] = i;
        java.util.Arrays.sort(order, (x, y) -> parsed.get(x).compareTo(parsed.get(y)));
        List<String> out = new ArrayList<>(order.length);
        for (int i : order) out.add(raw.get(i));
        return out;
    }

    /** Versions sorted descending by precedence (stable). */
    public static List<String> rsort(Collection<String> versions) {
        List<String> reversed = new ArrayList<>(versions);
        java.util.Collections.reverse(reversed);
        List<String> out = sort(reversed);
        java.util.Collections.reverse(out);
        return out;
    }
}
