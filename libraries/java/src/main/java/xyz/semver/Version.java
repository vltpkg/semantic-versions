package xyz.semver;

import java.util.Objects;

/**
 * A parsed Semantic Version, optionally scoped to a context ({@code npm:react@18.2.0}).
 *
 * <p>Ordering follows the specification: pre-releases rank below their release and builds rank
 * above it ({@code 1.0.0-rc < 1.0.0 < 1.0.0+build}). The context never participates in precedence
 * or equality.
 */
public final class Version implements Comparable<Version> {
    private final long major;
    private final long minor;
    private final long patch;
    private final String pre;
    private final String build;
    private final String context;

    /** A version from its parts; {@code pre} and {@code build} are "" when absent, context may be null. */
    public Version(long major, long minor, long patch, String pre, String build, String context) {
        this.major = major;
        this.minor = minor;
        this.patch = patch;
        this.pre = Objects.requireNonNull(pre);
        this.build = Objects.requireNonNull(build);
        this.context = context;
    }

    /** A normal version {@code major.minor.patch}. */
    public Version(long major, long minor, long patch) {
        this(major, minor, patch, "", "", null);
    }

    /**
     * Parses a version, optionally context-qualified ({@code npm:react@1.2.3}). There is no
     * coercion: {@code v1.2.3} and {@code 1.2} are errors.
     *
     * @throws SemanticVersionException if the input is not a version
     */
    public static Version parse(String s) {
        if (s.length() > Identifiers.MAX_LENGTH) {
            throw new SemanticVersionException("version is longer than 256 characters");
        }
        // Fast path: a bare version scans directly. Only when that fails do we look for a
        // context or whitespace to strip.
        Version v = scan(s, null);
        if (v != null) return v;
        String[] ref = splitReference(s);
        v = scan(Identifiers.trim(ref[1]), ref[0]);
        if (v == null) throw new SemanticVersionException("invalid version: \"" + s + "\"");
        return v;
    }

    /** Like {@link #parse} but returns null for input that is not a version. */
    public static Version tryParse(String s) {
        if (s.length() > Identifiers.MAX_LENGTH) return null;
        Version v = scan(s, null);
        if (v != null) return v;
        String[] ref = splitReference(s);
        return scan(Identifiers.trim(ref[1]), ref[0]);
    }

    /**
     * Splits an optional context off a reference: {@code npm:react@1.2.3} → {@code ["npm:react",
     * "1.2.3"]}. The context (index 0) is null when there is none. It ends at the last {@code @}
     * of the first whitespace-delimited token; an {@code @} at position 0 means there is none.
     */
    public static String[] splitReference(String s) {
        if (s.indexOf('@') < 0) return new String[] {null, s};
        int space = -1;
        for (int i = 0; i < s.length(); i++) {
            if (Identifiers.isSpace(s.charAt(i))) {
                space = i;
                break;
            }
        }
        String head = space < 0 ? s : s.substring(0, space);
        String tail = space < 0 ? "" : s.substring(space);
        int at = head.lastIndexOf('@');
        if (at > 0) return new String[] {head.substring(0, at), head.substring(at + 1) + tail};
        return new String[] {null, s};
    }

    private static Version scan(String s, String context) {
        try {
            long[] n = new long[1];
            int i = Identifiers.numeric(s, 0, n);
            long major = n[0];
            if (i >= s.length() || s.charAt(i) != '.') return null;
            i = Identifiers.numeric(s, i + 1, n);
            long minor = n[0];
            if (i >= s.length() || s.charAt(i) != '.') return null;
            i = Identifiers.numeric(s, i + 1, n);
            long patch = n[0];
            String pre = "";
            String build = "";
            int len = s.length();
            if (i < len && s.charAt(i) == '-') {
                int end = Identifiers.identifiers(s, i + 1, true);
                pre = s.substring(i + 1, end);
                i = end;
            }
            if (i < len && s.charAt(i) == '+') {
                int end = Identifiers.identifiers(s, i + 1, false);
                build = s.substring(i + 1, end);
                i = end;
            }
            if (i != len) return null;
            return new Version(major, minor, patch, pre, build, context);
        } catch (Identifiers.Syntax e) {
            return null;
        }
    }

    public long major() {
        return major;
    }

    public long minor() {
        return minor;
    }

    public long patch() {
        return patch;
    }

    /** The pre-release, as written ("" for a normal version). */
    public String prerelease() {
        return pre;
    }

    /** The build, as written ("" when there is none). */
    public String build() {
        return build;
    }

    /** The context, e.g. {@code npm:react}, or null. */
    public String context() {
        return context;
    }

    public boolean isPrerelease() {
        return !pre.isEmpty();
    }

    /** The version with its build removed. */
    public Version withoutBuild() {
        return new Version(major, minor, patch, pre, "", context);
    }

    /** The context-qualified form, {@code context@version}, or the bare version. */
    public String reference() {
        return context == null ? toString() : context + "@" + this;
    }

    boolean sameTuple(Version o) {
        return major == o.major && minor == o.minor && patch == o.patch;
    }

    /** Precedence ignoring builds (used by range comparators, where a build is a channel filter). */
    int compareWithoutBuild(Version o) {
        if (major != o.major) return major < o.major ? -1 : 1;
        if (minor != o.minor) return minor < o.minor ? -1 : 1;
        if (patch != o.patch) return patch < o.patch ? -1 : 1;
        if (pre.equals(o.pre)) return 0;
        if (pre.isEmpty()) return 1; // a pre-release ranks below its release
        if (o.pre.isEmpty()) return -1;
        return Identifiers.compare(pre, o.pre);
    }

    @Override
    public int compareTo(Version o) {
        if (major != o.major) return major < o.major ? -1 : 1;
        if (minor != o.minor) return minor < o.minor ? -1 : 1;
        if (patch != o.patch) return patch < o.patch ? -1 : 1;
        if (pre.isEmpty() && o.pre.isEmpty() && build.isEmpty() && o.build.isEmpty()) return 0;
        int c = compareWithoutBuild(o);
        if (c != 0) return c;
        if (build.equals(o.build)) return 0;
        if (build.isEmpty()) return -1; // a build ranks above its release
        if (o.build.isEmpty()) return 1;
        return Identifiers.compare(build, o.build);
    }

    /** Equal precedence (the context is ignored). */
    @Override
    public boolean equals(Object o) {
        return o instanceof Version v && compareTo(v) == 0;
    }

    @Override
    public int hashCode() {
        // Two versions are equal only when every identifier is identical (a
        // leading-zero build identifier compares as text), so the strings hash.
        int h = Long.hashCode(major) * 961 + Long.hashCode(minor) * 31 + Long.hashCode(patch);
        h = h * 31 + pre.hashCode();
        return h * 31 + build.hashCode();
    }

    @Override
    public String toString() {
        StringBuilder b = new StringBuilder(16 + pre.length() + build.length());
        b.append(major).append('.').append(minor).append('.').append(patch);
        if (!pre.isEmpty()) b.append('-').append(pre);
        if (!build.isEmpty()) b.append('+').append(build);
        return b.toString();
    }
}
