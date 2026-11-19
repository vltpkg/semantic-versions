package io.vlt.semanticversions;

/** Thrown for input that is not a version or not a range. */
public class SemanticVersionException extends IllegalArgumentException {
    private static final long serialVersionUID = 1L;

    public SemanticVersionException(String message) {
        super(message);
    }
}
