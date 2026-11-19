package xyz.semver;

/** Scanning and comparison of dot-separated identifiers, without allocation. */
final class Identifiers {
    private Identifiers() {}

    static final int MAX_LENGTH = 256;
    static final long MAX_SAFE_INTEGER = 9007199254740991L;

    /** Thrown internally while scanning; carries no stack trace. */
    static final class Syntax extends Exception {
        private static final long serialVersionUID = 1L;
        static final Syntax INSTANCE = new Syntax();

        private Syntax() {
            super(null, null, false, false);
        }
    }

    static boolean isDigit(char c) {
        return c >= '0' && c <= '9';
    }

    static boolean isDigitInt(int c) {
        return c >= '0' && c <= '9';
    }

    static boolean isIdentifierChar(char c) {
        return (c >= '0' && c <= '9') || (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || c == '-';
    }

    /** Scans "0" or a non-zero digit followed by digits; returns the end index, value in out[0]. */
    static int numeric(String s, int i, long[] out) throws Syntax {
        int start = i;
        long n = 0;
        int len = s.length();
        while (i < len) {
            char c = s.charAt(i);
            if (c < '0' || c > '9') break;
            if (i - start < 18) n = n * 10 + (c - '0');
            i++;
        }
        int l = i - start;
        if (l == 0 || (l > 1 && s.charAt(start) == '0') || l > 16 || n > MAX_SAFE_INTEGER) {
            throw Syntax.INSTANCE;
        }
        out[0] = n;
        return i;
    }

    /**
     * Scans dot-separated identifiers from i; returns the end index. With pre, all-digit
     * identifiers must have no leading zero and be below MAX_SAFE_INTEGER.
     */
    static int identifiers(String s, int i, boolean pre) throws Syntax {
        int len = s.length();
        while (true) {
            int id = i;
            boolean digits = true;
            while (i < len) {
                char c = s.charAt(i);
                if (!isIdentifierChar(c)) break;
                if (!isDigit(c)) digits = false;
                i++;
            }
            int l = i - id;
            if (l == 0) throw Syntax.INSTANCE;
            if (pre && digits) {
                if (l > 1 && s.charAt(id) == '0') throw Syntax.INSTANCE;
                if (l >= 16) {
                    long n = 0;
                    for (int k = id; k < i && n < MAX_SAFE_INTEGER; k++) n = n * 10 + (s.charAt(k) - '0');
                    if (n >= MAX_SAFE_INTEGER) throw Syntax.INSTANCE;
                }
            }
            if (i < len && s.charAt(i) == '.') {
                i++;
                continue;
            }
            return i;
        }
    }

    /** Numeric identifiers compare numerically and below alphanumeric ones; longer lists win ties. */
    static int compare(String a, String b) {
        if (a.equals(b)) return 0;
        int i = 0, j = 0, la = a.length(), lb = b.length();
        while (true) {
            int ea = a.indexOf('.', i);
            if (ea < 0) ea = la;
            int eb = b.indexOf('.', j);
            if (eb < 0) eb = lb;
            int c = compareOne(a, i, ea, b, j, eb);
            if (c != 0) return c;
            boolean doneA = ea == la, doneB = eb == lb;
            if (doneA && doneB) return 0;
            if (doneA) return -1;
            if (doneB) return 1;
            i = ea + 1;
            j = eb + 1;
        }
    }

    private static boolean allDigits(String s, int from, int to) {
        for (int k = from; k < to; k++) if (!isDigit(s.charAt(k))) return false;
        return true;
    }

    private static int compareOne(String a, int i, int ea, String b, int j, int eb) {
        boolean da = allDigits(a, i, ea), db = allDigits(b, j, eb);
        if (da && db) {
            while (i < ea - 1 && a.charAt(i) == '0') i++;
            while (j < eb - 1 && b.charAt(j) == '0') j++;
            int la = ea - i, lb = eb - j;
            if (la != lb) return la < lb ? -1 : 1;
        } else if (da) {
            return -1;
        } else if (db) {
            return 1;
        }
        int n = Math.min(ea - i, eb - j);
        for (int k = 0; k < n; k++) {
            char x = a.charAt(i + k), y = b.charAt(j + k);
            if (x != y) return x < y ? -1 : 1;
        }
        return Integer.compare(ea - i, eb - j);
    }

    /** Identifier-wise prefix: "rc" begins "rc.1" but not "rc1". */
    static boolean startsWith(String ids, String prefix) {
        return prefix.isEmpty()
                || (ids.startsWith(prefix) && (ids.length() == prefix.length() || ids.charAt(prefix.length()) == '.'));
    }

    static boolean isSpace(char c) {
        return Character.isWhitespace(c) || Character.isSpaceChar(c);
    }

    /** String.strip()-style trim. */
    static String trim(String s) {
        return s.strip();
    }
}
