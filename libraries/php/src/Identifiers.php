<?php

declare(strict_types=1);

namespace Vlt\SemanticVersions;

/** @internal Identifier scanning and comparison. */
final class Identifiers
{
    public const MAX_LENGTH = 256;
    public const MAX_SAFE_INTEGER = 9007199254740991;

    private const NUM = '(?:0|[1-9][0-9]*)';
    private const PRE_ID = '(?:0|[1-9][0-9]*|[0-9]*[A-Za-z-][0-9A-Za-z-]*)';
    private const BUILD_ID = '[0-9A-Za-z-]+';
    public const PRE = self::PRE_ID . '(?:\.' . self::PRE_ID . ')*';
    public const BUILD = self::BUILD_ID . '(?:\.' . self::BUILD_ID . ')*';
    public const VERSION = '/^(' . self::NUM . ')\.(' . self::NUM . ')\.(' . self::NUM . ')(?:-(' . self::PRE . '))?(?:\+(' . self::BUILD . '))?$/D';
    public const PRE_ONLY = '/^' . self::PRE . '$/D';
    public const BUILD_ONLY = '/^' . self::BUILD . '$/D';
    private const XR = '(?:[xX*]|0|[1-9][0-9]*)';
    public const PARTIAL = '/^(' . self::XR . ')(?:\.(' . self::XR . ')(?:\.(' . self::XR . ')(?:-([^+]*))?(?:\+(.*))?)?)?$/sD';
    public const TUPLE_PRE = '/^(<=|>=|\^|~|<|>|=)?(' . self::NUM . ')\.(' . self::NUM . ')\.(' . self::NUM . ')-\*$/D';

    public static function safe(string $n): bool
    {
        return \strlen($n) < 16 || (\strlen($n) === 16 && $n <= '9007199254740991');
    }

    /** The JavaScript reference requires numeric pre-release identifiers below MAX_SAFE_INTEGER. */
    public static function preSafe(string $pre): bool
    {
        foreach (explode('.', $pre) as $id) {
            if (\strlen($id) >= 16 && ctype_digit($id) && (\strlen($id) > 16 || $id >= '9007199254740991')) {
                return false;
            }
        }
        return true;
    }

    /** Numeric identifiers compare numerically and below alphanumeric ones; a longer list wins a tie. */
    public static function compare(string $a, string $b): int
    {
        if ($a === $b) {
            return 0;
        }
        $x = explode('.', $a);
        $y = explode('.', $b);
        $n = min(\count($x), \count($y));
        for ($i = 0; $i < $n; $i++) {
            $p = $x[$i];
            $q = $y[$i];
            if ($p === $q) {
                continue;
            }
            $dp = ctype_digit($p);
            $dq = ctype_digit($q);
            if ($dp && $dq) {
                $p = ltrim($p, '0');
                $q = ltrim($q, '0');
                if (\strlen($p) !== \strlen($q)) {
                    return \strlen($p) < \strlen($q) ? -1 : 1;
                }
                $c = strcmp($p, $q);
            } elseif ($dp) {
                return -1;
            } elseif ($dq) {
                return 1;
            } else {
                $c = strcmp($p, $q);
            }
            if ($c !== 0) {
                return $c < 0 ? -1 : 1;
            }
        }
        return \count($x) <=> \count($y);
    }

    /** Identifier-wise prefix: "rc" begins "rc.1" but not "rc1". */
    public static function startsWith(string $ids, string $prefix): bool
    {
        return $prefix === '' || $ids === $prefix || str_starts_with($ids, $prefix . '.');
    }
}
