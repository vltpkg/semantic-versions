<?php

declare(strict_types=1);

namespace Vlt\SemanticVersions;

/**
 * A parsed Semantic Version, optionally scoped to a context (npm:react@18.2.0).
 *
 * Ordering follows the specification: pre-releases rank below their release and builds rank
 * above it (1.0.0-rc < 1.0.0 < 1.0.0+build). The context never participates in precedence.
 */
final class Version implements \Stringable
{
    public function __construct(
        public readonly int $major,
        public readonly int $minor,
        public readonly int $patch,
        /** The pre-release, as written ('' for a normal version). */
        public readonly string $prerelease = '',
        /** The build, as written ('' when there is none). */
        public readonly string $build = '',
        /** The identity the version belongs to, e.g. "npm:react". */
        public readonly ?string $context = null,
    ) {
    }

    /**
     * Parse a version, optionally context-qualified (npm:react@1.2.3). There is no coercion:
     * "v1.2.3" and "1.2" are errors.
     *
     * @throws SemanticVersionException
     */
    public static function parse(string $s): self
    {
        return self::tryParse($s) ?? throw new SemanticVersionException("invalid version: \"$s\"");
    }

    /** Like parse(), but returns null for input that is not a version. */
    public static function tryParse(string $s): ?self
    {
        if (\strlen($s) > Identifiers::MAX_LENGTH) {
            return null;
        }
        $context = null;
        if (!preg_match(Identifiers::VERSION, $s, $m)) {
            [$context, $rest] = self::splitReference($s);
            if (!preg_match(Identifiers::VERSION, trim($rest), $m)) {
                return null;
            }
        }
        if (\strlen($s) >= 16) {
            if (!Identifiers::safe($m[1]) || !Identifiers::safe($m[2]) || !Identifiers::safe($m[3])) {
                return null;
            }
            if (isset($m[4]) && $m[4] !== '' && !Identifiers::preSafe($m[4])) {
                return null;
            }
        }
        return new self((int) $m[1], (int) $m[2], (int) $m[3], $m[4] ?? '', $m[5] ?? '', $context);
    }

    /**
     * Split an optional context off a reference: "npm:react@1.2.3" → ["npm:react", "1.2.3"]. The
     * context ends at the last "@" of the first whitespace-delimited token; an "@" at position 0
     * means there is none.
     *
     * @return array{0: ?string, 1: string}
     */
    public static function splitReference(string $s): array
    {
        if (!str_contains($s, '@')) {
            return [null, $s];
        }
        $head = $s;
        $tail = '';
        if (preg_match('/\s/', $s, $m, PREG_OFFSET_CAPTURE)) {
            $head = substr($s, 0, $m[0][1]);
            $tail = substr($s, $m[0][1]);
        }
        $at = strrpos($head, '@');
        if ($at !== false && $at > 0) {
            return [substr($head, 0, $at), substr($head, $at + 1) . $tail];
        }
        return [null, $s];
    }

    public function isPrerelease(): bool
    {
        return $this->prerelease !== '';
    }

    public function withoutBuild(): self
    {
        return new self($this->major, $this->minor, $this->patch, $this->prerelease, '', $this->context);
    }

    /** The context-qualified form, "context@version", or the bare version. */
    public function reference(): string
    {
        return $this->context === null ? (string) $this : $this->context . '@' . $this;
    }

    /** Precedence ignoring builds (range comparators treat a build as a channel filter). */
    public function compareWithoutBuild(self $o): int
    {
        if ($this->major !== $o->major) {
            return $this->major < $o->major ? -1 : 1;
        }
        if ($this->minor !== $o->minor) {
            return $this->minor < $o->minor ? -1 : 1;
        }
        if ($this->patch !== $o->patch) {
            return $this->patch < $o->patch ? -1 : 1;
        }
        if ($this->prerelease === $o->prerelease) {
            return 0;
        }
        if ($this->prerelease === '') {
            return 1; // a pre-release ranks below its release
        }
        if ($o->prerelease === '') {
            return -1;
        }
        return Identifiers::compare($this->prerelease, $o->prerelease);
    }

    /** -1, 0 or 1 by precedence. */
    public function compare(self $o): int
    {
        $c = $this->compareWithoutBuild($o);
        if ($c !== 0 || $this->build === $o->build) {
            return $c;
        }
        if ($this->build === '') {
            return -1; // a build ranks above its release
        }
        if ($o->build === '') {
            return 1;
        }
        return Identifiers::compare($this->build, $o->build);
    }

    public function equals(self $o): bool
    {
        return $this->compare($o) === 0;
    }

    public function __toString(): string
    {
        $s = $this->major . '.' . $this->minor . '.' . $this->patch;
        if ($this->prerelease !== '') {
            $s .= '-' . $this->prerelease;
        }
        if ($this->build !== '') {
            $s .= '+' . $this->build;
        }
        return $s;
    }
}
