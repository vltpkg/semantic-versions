<?php

declare(strict_types=1);

namespace Vlt\SemanticVersions;

/**
 * Parse, compare and match versions per the Semantic Versions specification (https://semver.xyz).
 * A port of the JavaScript reference implementation (semantic-versions on npm), checked against
 * the same shared conformance suite.
 */
final class SemanticVersions
{
    public const MAX_LENGTH = Identifiers::MAX_LENGTH;
    public const MAX_SAFE_INTEGER = Identifiers::MAX_SAFE_INTEGER;

    /** @throws SemanticVersionException */
    public static function parse(string $version): Version
    {
        return Version::parse($version);
    }

    /** The normalized version, or null if the input is not a version. */
    public static function valid(string $version): ?string
    {
        $v = Version::tryParse($version);
        return $v === null ? null : (string) $v;
    }

    /** The desugared range ("*" when it matches everything), or null. */
    public static function validRange(string $range): ?string
    {
        $r = Range::tryParse($range);
        if ($r === null) {
            return null;
        }
        $s = (string) $r;
        return $s === '' ? '*' : $s;
    }

    /**
     * -1, 0 or 1 by precedence (builds rank above their release).
     *
     * @throws SemanticVersionException
     */
    public static function compare(string $a, string $b): int
    {
        return Version::parse($a)->compare(Version::parse($b));
    }

    /** True if $version satisfies $range; invalid input never does. */
    public static function satisfies(string $version, string $range): bool
    {
        if ($version === $range) {
            // Mirrors the JavaScript reference: an identical string trivially matches.
            return Version::tryParse($version) !== null;
        }
        $r = Range::tryParse($range);
        $v = $r === null ? null : Version::tryParse($version);
        return $v !== null && $r->test($v);
    }

    /** @param iterable<string> $versions */
    public static function maxSatisfying(iterable $versions, string $range): ?string
    {
        return self::pick($versions, $range, 1);
    }

    /** @param iterable<string> $versions */
    public static function minSatisfying(iterable $versions, string $range): ?string
    {
        return self::pick($versions, $range, -1);
    }

    /**
     * Versions sorted ascending by precedence (stable); invalid entries throw.
     *
     * @param list<string> $versions
     * @return list<string>
     */
    public static function sort(array $versions): array
    {
        $parsed = array_map(static fn (string $s) => [$s, Version::parse($s)], array_values($versions));
        usort($parsed, static fn (array $a, array $b) => $a[1]->compare($b[1])); // usort is stable (PHP 8)
        return array_column($parsed, 0);
    }

    /**
     * Versions sorted descending by precedence (stable).
     *
     * @param list<string> $versions
     * @return list<string>
     */
    public static function rsort(array $versions): array
    {
        $parsed = array_map(static fn (string $s) => [$s, Version::parse($s)], array_values($versions));
        usort($parsed, static fn (array $a, array $b) => $b[1]->compare($a[1]));
        return array_column($parsed, 0);
    }

    private static function pick(iterable $versions, string $range, int $direction): ?string
    {
        $r = Range::tryParse($range);
        if ($r === null) {
            return null;
        }
        $best = null;
        $bv = null;
        foreach ($versions as $s) {
            $v = Version::tryParse($s);
            if ($v === null || !$r->test($v)) {
                continue;
            }
            if ($bv === null || $v->compare($bv) === $direction) {
                $best = $s;
                $bv = $v;
            }
        }
        return $best;
    }
}
