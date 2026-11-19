package xyz.semver;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/**
 * A parsed range: comparator sets joined by {@code ||}, optionally scoped to a context
 * ({@code npm:react@^18}). Advanced syntax (hyphen, x-ranges, {@code ~}, {@code ~>}, {@code ^},
 * {@code -*}, {@code *-*}) desugars to primitive comparators exactly as in the specification.
 */
public final class Range {
    /** A comparator operator. {@code EQ} is written without an operator ({@code 1.2.3}). */
    public enum Op {
        EQ(""), LT("<"), LTE("<="), GT(">"), GTE(">=");

        private final String symbol;

        Op(String symbol) {
            this.symbol = symbol;
        }

        @Override
        public String toString() {
            return symbol;
        }
    }

    /**
     * A primitive comparator: an operator and a bound, or "any" (matches every version). A build
     * on the bound is a build channel (a prefix filter on the candidate's build); a pre-release on
     * it declares a pre-release channel for its tuple.
     */
    public static final class Comparator {
        static final Comparator ANY = new Comparator(Op.EQ, null);

        private final Op op;
        private final Version version;

        Comparator(Op op, Version version) {
            this.op = op;
            this.version = version;
        }

        static Comparator of(Op op, Version v) {
            // ">=0.0.0" bounds nothing: it is the "any" comparator.
            if (op == Op.GTE && v.major() == 0 && v.minor() == 0 && v.patch() == 0
                    && v.prerelease().isEmpty() && v.build().isEmpty()) {
                return ANY;
            }
            return new Comparator(op, v);
        }

        public Op op() {
            return op;
        }

        /** The bound, or null for the "any" comparator. */
        public Version version() {
            return version;
        }

        public boolean isAny() {
            return version == null;
        }

        boolean isNull() {
            Version v = version;
            return v != null && op == Op.LT && v.major() == 0 && v.minor() == 0 && v.patch() == 0
                    && v.prerelease().equals("0") && v.build().isEmpty();
        }

        /** True if v passes the bound and, when the comparator declares a build channel, carries a build in it. */
        public boolean test(Version v) {
            if (version == null) return true;
            int o = v.compareWithoutBuild(version);
            boolean ok = switch (op) {
                case LT -> o < 0;
                case LTE -> o <= 0;
                case GT -> o > 0;
                case GTE -> o >= 0;
                case EQ -> o == 0;
            };
            return ok && (version.build().isEmpty() || Identifiers.startsWith(v.build(), version.build()));
        }

        boolean same(Comparator c) {
            if (op != c.op) return false;
            if (version == null || c.version == null) return version == c.version;
            Version a = version, b = c.version;
            return a.major() == b.major() && a.minor() == b.minor() && a.patch() == b.patch()
                    && a.prerelease().equals(b.prerelease()) && a.build().equals(b.build());
        }

        @Override
        public String toString() {
            return version == null ? "" : op + version.toString();
        }
    }

    private static final class Set {
        final Comparator[] comparators;
        final boolean universalPre; // *-*: pre-releases on every tuple are admitted
        final long[] anyPre; // X.Y.Z-*: triples of tuples whose pre-releases are admitted

        Set(Comparator[] comparators, boolean universalPre, long[] anyPre) {
            this.comparators = comparators;
            this.universalPre = universalPre;
            this.anyPre = anyPre;
        }

        boolean test(Version v) {
            for (Comparator c : comparators) {
                if (!c.test(v)) return false;
            }
            if (v.prerelease().isEmpty() || universalPre) return true;
            for (int i = 0; i < anyPre.length; i += 3) {
                if (anyPre[i] == v.major() && anyPre[i + 1] == v.minor() && anyPre[i + 2] == v.patch()) return true;
            }
            // A pre-release is admitted only by a comparator that declares a channel on the same
            // tuple whose identifiers it begins with.
            for (Comparator c : comparators) {
                Version b = c.version;
                if (b != null && !b.prerelease().isEmpty() && b.sameTuple(v)
                        && Identifiers.startsWith(v.prerelease(), b.prerelease())) {
                    return true;
                }
            }
            return false;
        }
    }

    private final String raw;
    private final String context;
    private final Set[] sets;

    private Range(String raw, String context, Set[] sets) {
        this.raw = raw;
        this.context = context;
        this.sets = sets;
    }

    /**
     * Parses a range.
     *
     * @throws SemanticVersionException if the input is not a range
     */
    public static Range parse(String s) {
        if (s.length() > Identifiers.MAX_LENGTH) {
            throw new SemanticVersionException("range is longer than 256 characters");
        }
        try {
            String[] ref = Version.splitReference(s);
            String body = ref[1];
            List<Set> sets = new ArrayList<>(2);
            int from = 0;
            while (true) {
                int bar = body.indexOf("||", from);
                String part = bar < 0 ? body.substring(from) : body.substring(from, bar);
                sets.add(parseSet(Identifiers.trim(part)));
                if (bar < 0) break;
                from = bar + 2;
            }
            if (sets.size() > 1) {
                // Drop sets that can match nothing (unless that is all there is), and collapse to
                // "any" if any set matches everything.
                Set first = sets.get(0);
                sets.removeIf(st -> st.comparators.length > 0 && st.comparators[0].isNull());
                if (sets.isEmpty()) {
                    sets.add(first);
                } else if (sets.size() > 1) {
                    for (Set st : sets) {
                        if (st.comparators.length == 1 && st.comparators[0].isAny()) {
                            sets = List.of(st);
                            break;
                        }
                    }
                }
            }
            return new Range(s, ref[0], sets.toArray(new Set[0]));
        } catch (Identifiers.Syntax e) {
            throw new SemanticVersionException("invalid range: \"" + s + "\"");
        }
    }

    /** Like {@link #parse} but returns null for input that is not a range. */
    public static Range tryParse(String s) {
        try {
            return parse(s);
        } catch (SemanticVersionException e) {
            return null;
        }
    }

    public String raw() {
        return raw;
    }

    /** The context the range is scoped to, or null. */
    public String context() {
        return context;
    }

    /** The desugared comparator sets. */
    public List<List<Comparator>> comparatorSets() {
        List<List<Comparator>> out = new ArrayList<>(sets.length);
        for (Set st : sets) out.add(List.of(st.comparators));
        return Collections.unmodifiableList(out);
    }

    /** True if v satisfies the range. A context-scoped range only admits versions of the same context. */
    public boolean test(Version v) {
        if (context != null && !context.equals(v.context())) return false;
        for (Set st : sets) {
            if (st.test(v)) return true;
        }
        return false;
    }

    /** The desugared range ("" when it matches everything). */
    @Override
    public String toString() {
        StringBuilder b = new StringBuilder();
        for (int i = 0; i < sets.length; i++) {
            if (i > 0) b.append("||");
            boolean first = true;
            for (Comparator c : sets[i].comparators) {
                if (c.isAny()) continue;
                if (!first) b.append(' ');
                first = false;
                b.append(c);
            }
        }
        return b.toString();
    }

    // ------------------------------------------------------------ desugaring

    private static final long X = -1; // a wildcard component (x, X, * or absent)

    private record Partial(long major, long minor, long patch, String pre, String build) {}

    private static long xr(String s, int i, long[] out, int[] end) throws Identifiers.Syntax {
        if (i < s.length()) {
            char c = s.charAt(i);
            if (c == 'x' || c == 'X' || c == '*') {
                end[0] = i + 1;
                return X;
            }
            if (Identifiers.isDigit(c)) {
                end[0] = Identifiers.numeric(s, i, out);
                return out[0];
            }
        }
        throw Identifiers.Syntax.INSTANCE;
    }

    /** {@code <xr> [ "." <xr> [ "." <xr> <qualifier>? ] ]} */
    private static Partial partial(String s) throws Identifiers.Syntax {
        long[] n = new long[1];
        int[] e = new int[1];
        long major = xr(s, 0, n, e);
        long minor = X, patch = X;
        String pre = "", build = "";
        int i = e[0];
        int len = s.length();
        if (i < len && s.charAt(i) == '.') {
            minor = xr(s, i + 1, n, e);
            i = e[0];
            if (i < len && s.charAt(i) == '.') {
                patch = xr(s, i + 1, n, e);
                i = e[0];
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
            }
        }
        if (i != len) throw Identifiers.Syntax.INSTANCE;
        return new Partial(major, minor, patch, pre, build);
    }

    private static long nz(long n) {
        return n == X ? 0 : n;
    }

    private static Version v(long major, long minor, long patch, String pre) {
        return new Version(major, minor, patch, pre, "", null);
    }

    private static Version v(long major, long minor, long patch) {
        return new Version(major, minor, patch, "", "", null);
    }

    /** Attaches a build channel to every comparator ~ or ^ desugars to. */
    private static void withChannel(List<Comparator> out, int from, String channel) {
        if (channel.isEmpty()) return;
        for (int i = from; i < out.size(); i++) {
            Comparator c = out.get(i);
            Version b = c.version;
            // A channel turns ">=0.0.0" back into a real bound.
            out.set(i, b == null
                    ? new Comparator(Op.GTE, new Version(0, 0, 0, "", channel, null))
                    : new Comparator(c.op, new Version(b.major(), b.minor(), b.patch(), b.prerelease(), channel, null)));
        }
    }

    private static void tilde(Partial p, List<Comparator> out) {
        if (p.major == X) {
            out.add(Comparator.ANY);
            return;
        }
        int from = out.size();
        long m = p.major, mi = nz(p.minor);
        if (p.minor == X) {
            out.add(Comparator.of(Op.GTE, v(m, 0, 0)));
            out.add(Comparator.of(Op.LT, v(m + 1, 0, 0, "0")));
        } else if (p.patch == X) {
            out.add(Comparator.of(Op.GTE, v(m, mi, 0)));
            out.add(Comparator.of(Op.LT, v(m, mi + 1, 0, "0")));
        } else {
            out.add(Comparator.of(Op.GTE, v(m, mi, p.patch, p.pre)));
            out.add(Comparator.of(Op.LT, v(m, mi + 1, 0, "0")));
        }
        withChannel(out, from, p.build);
    }

    private static void caret(Partial p, List<Comparator> out) {
        if (p.major == X) {
            out.add(Comparator.ANY);
            return;
        }
        int from = out.size();
        long m = p.major, mi = nz(p.minor), pa = nz(p.patch);
        if (p.minor == X) {
            out.add(Comparator.of(Op.GTE, v(m, 0, 0)));
            out.add(Comparator.of(Op.LT, v(m + 1, 0, 0, "0")));
        } else if (p.patch == X) {
            out.add(Comparator.of(Op.GTE, v(m, mi, 0)));
            out.add(Comparator.of(Op.LT, m == 0 ? v(0, mi + 1, 0, "0") : v(m + 1, 0, 0, "0")));
        } else {
            Version upper = m != 0 ? v(m + 1, 0, 0, "0") : mi == 0 ? v(0, 0, pa + 1, "0") : v(0, mi + 1, 0, "0");
            out.add(Comparator.of(Op.GTE, v(m, mi, pa, p.pre)));
            out.add(Comparator.of(Op.LT, upper));
        }
        withChannel(out, from, p.build);
    }

    private static void xrange(Op op, Partial p, List<Comparator> out) {
        boolean xm = p.major == X || p.minor == X;
        boolean anyX = xm || p.patch == X;
        if (p.major == X) {
            out.add(op == Op.GT || op == Op.LT ? Comparator.of(Op.LT, v(0, 0, 0, "0")) : Comparator.ANY);
            return;
        }
        long m = p.major, mi = xm ? 0 : p.minor;
        if (anyX && op != Op.EQ) {
            out.add(switch (op) {
                case GT -> Comparator.of(Op.GTE, xm ? v(m + 1, 0, 0) : v(m, mi + 1, 0));
                case LTE -> Comparator.of(Op.LT, xm ? v(m + 1, 0, 0, "0") : v(m, mi + 1, 0, "0"));
                case LT -> Comparator.of(Op.LT, v(m, mi, 0, "0"));
                default -> Comparator.of(op, v(m, mi, 0));
            });
            return;
        }
        if (xm) {
            out.add(Comparator.of(Op.GTE, v(m, 0, 0)));
            out.add(Comparator.of(Op.LT, v(m + 1, 0, 0, "0")));
        } else if (p.patch == X) {
            out.add(Comparator.of(Op.GTE, v(m, mi, 0)));
            out.add(Comparator.of(Op.LT, v(m, mi + 1, 0, "0")));
        } else {
            out.add(Comparator.of(op, new Version(m, mi, p.patch, p.pre, p.build, null)));
        }
    }

    /** {@code <partial> - <partial>}: an inclusive span; builds on either endpoint are ignored. */
    private static void hyphen(Partial a, Partial b, List<Comparator> out) {
        int from = out.size();
        if (a.major != X) {
            Version lo = a.minor == X ? v(a.major, 0, 0) : a.patch == X ? v(a.major, a.minor, 0) : v(a.major, a.minor, a.patch, a.pre);
            out.add(Comparator.of(Op.GTE, lo));
        }
        if (b.major != X) {
            if (b.minor == X) out.add(Comparator.of(Op.LT, v(b.major + 1, 0, 0, "0")));
            else if (b.patch == X) out.add(Comparator.of(Op.LT, v(b.major, b.minor + 1, 0, "0")));
            else out.add(Comparator.of(Op.LTE, v(b.major, b.minor, b.patch, b.pre)));
        }
        if (out.size() == from) out.add(Comparator.ANY);
    }

    private static final String[] TUPLE_PRE_OPS = {"<=", ">=", "^", "~", "<", ">", "="};

    /** Recognizes {@code X.Y.Z-*} with an optional operator; returns {op, a, b, c} or null. */
    private static Object[] tuplePre(String tok) {
        if (!tok.endsWith("-*")) return null;
        String body = tok.substring(0, tok.length() - 2);
        String op = "";
        for (String o : TUPLE_PRE_OPS) {
            if (body.startsWith(o)) {
                op = o;
                body = body.substring(o.length());
                break;
            }
        }
        try {
            long[] n = new long[1];
            int i = Identifiers.numeric(body, 0, n);
            long a = n[0];
            if (i >= body.length() || body.charAt(i) != '.') return null;
            i = Identifiers.numeric(body, i + 1, n);
            long b = n[0];
            if (i >= body.length() || body.charAt(i) != '.') return null;
            i = Identifiers.numeric(body, i + 1, n);
            if (i != body.length()) return null;
            return new Object[] {op, a, b, n[0]};
        } catch (Identifiers.Syntax e) {
            return null;
        }
    }

    private static void comparatorToken(String tok, List<Comparator> out) throws Identifiers.Syntax {
        if (tok.isEmpty() || tok.equals("*")) {
            out.add(Comparator.ANY);
            return;
        }
        char c = tok.charAt(0);
        if (c == '^') {
            caret(partial(tok.substring(1)), out);
            return;
        }
        if (c == '~') {
            tilde(partial(tok.startsWith("~>") ? tok.substring(2) : tok.substring(1)), out);
            return;
        }
        Op op = Op.EQ;
        String rest = tok;
        if (tok.startsWith(">=")) {
            op = Op.GTE;
            rest = tok.substring(2);
        } else if (tok.startsWith("<=")) {
            op = Op.LTE;
            rest = tok.substring(2);
        } else if (c == '>') {
            op = Op.GT;
            rest = tok.substring(1);
        } else if (c == '<') {
            op = Op.LT;
            rest = tok.substring(1);
        } else if (c == '=') {
            rest = tok.substring(1);
        }
        xrange(op, partial(rest), out);
    }

    private static boolean isOperator(String s) {
        return switch (s) {
            case "<", "<=", ">", ">=", "=", "~", "~>", "^" -> true;
            default -> false;
        };
    }

    private static List<String> fields(String s) {
        List<String> out = new ArrayList<>(4);
        int i = 0, n = s.length();
        while (i < n) {
            while (i < n && Identifiers.isSpace(s.charAt(i))) i++;
            int start = i;
            while (i < n && !Identifiers.isSpace(s.charAt(i))) i++;
            if (i > start) out.add(s.substring(start, i));
        }
        return out;
    }

    private static Set parseSet(String s) throws Identifiers.Syntax {
        boolean universal = false;
        long[] anyPre = new long[0];
        List<String> tokens = fields(s);
        for (int i = 0; i < tokens.size(); i++) {
            String tok = tokens.get(i);
            if (tok.equals("*-*")) {
                universal = true;
                tokens.set(i, ">=0.0.0-0");
            } else if (tok.endsWith("-*")) {
                Object[] t = tuplePre(tok);
                if (t != null) {
                    long[] grown = java.util.Arrays.copyOf(anyPre, anyPre.length + 3);
                    grown[anyPre.length] = (long) t[1];
                    grown[anyPre.length + 1] = (long) t[2];
                    grown[anyPre.length + 2] = (long) t[3];
                    anyPre = grown;
                    tokens.set(i, t[0] + "" + t[1] + "." + t[2] + "." + t[3] + "-0");
                }
            }
        }

        List<Comparator> comps = new ArrayList<>(4);
        if (tokens.size() == 3 && tokens.get(1).equals("-")) {
            hyphen(partial(tokens.get(0)), partial(tokens.get(2)), comps);
        } else {
            for (int i = 0; i < tokens.size(); i++) {
                // ">= 1.2.3", "~ 1.2": an operator separated from its version.
                if (isOperator(tokens.get(i)) && i + 1 < tokens.size()) {
                    comparatorToken(tokens.get(i) + tokens.get(i + 1), comps);
                    i++;
                } else {
                    comparatorToken(tokens.get(i), comps);
                }
            }
            if (comps.isEmpty()) comps.add(Comparator.ANY);
        }

        // A comparator that can match nothing makes the whole set match nothing.
        for (Comparator c : comps) {
            if (c.isNull()) return new Set(new Comparator[] {c}, universal, anyPre);
        }
        List<Comparator> unique = new ArrayList<>(comps.size());
        for (Comparator c : comps) {
            boolean dup = false;
            for (Comparator u : unique) {
                if (u.same(c)) {
                    dup = true;
                    break;
                }
            }
            if (!dup) unique.add(c);
        }
        if (unique.size() > 1) unique.removeIf(Comparator::isAny);
        return new Set(unique.toArray(new Comparator[0]), universal, anyPre);
    }
}
