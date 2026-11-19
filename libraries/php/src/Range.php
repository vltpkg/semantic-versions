<?php

declare(strict_types=1);

namespace Vlt\SemanticVersions;

/**
 * A parsed range: comparator sets joined by "||", optionally scoped to a context
 * (npm:react@^18). Advanced syntax (hyphen, x-ranges, ~, ~>, ^, -*, *-*) desugars to primitive
 * comparators exactly as in the specification.
 */
final class Range implements \Stringable
{
    private const OPERATORS = ['<' => true, '<=' => true, '>' => true, '>=' => true, '=' => true, '~' => true, '~>' => true, '^' => true];

    /**
     * @param list<array{0: list<Comparator>, 1: bool, 2: list<array{int, int, int}>}> $sets
     *        each: comparators, universal pre-release (*-*), tuples admitting any pre-release (X.Y.Z-*)
     */
    private function __construct(public readonly string $raw, public readonly ?string $context, private readonly array $sets)
    {
    }

    /** @throws SemanticVersionException */
    public static function parse(string $s): self
    {
        return self::tryParse($s) ?? throw new SemanticVersionException("invalid range: \"$s\"");
    }

    /** Like parse(), but returns null for input that is not a range. */
    public static function tryParse(string $s): ?self
    {
        if (\strlen($s) > Identifiers::MAX_LENGTH) {
            return null;
        }
        [$context, $body] = Version::splitReference($s);
        $sets = [];
        foreach (explode('||', $body) as $part) {
            $set = self::parseSet(trim($part));
            if ($set === null) {
                return null;
            }
            $sets[] = $set;
        }
        if (\count($sets) > 1) {
            // Drop sets that can match nothing (unless that is all there is), and collapse to
            // "any" if any set matches everything.
            $first = $sets[0];
            $sets = array_values(array_filter($sets, static fn ($st) => !($st[0] !== [] && $st[0][0]->isNull())));
            if ($sets === []) {
                $sets = [$first];
            } elseif (\count($sets) > 1) {
                foreach ($sets as $st) {
                    if (\count($st[0]) === 1 && $st[0][0]->isAny()) {
                        $sets = [$st];
                        break;
                    }
                }
            }
        }
        return new self($s, $context, $sets);
    }

    /** @return list<list<Comparator>> the desugared comparator sets */
    public function comparatorSets(): array
    {
        return array_map(static fn ($st) => $st[0], $this->sets);
    }

    /** True if $v satisfies the range. A context-scoped range only admits versions of the same context. */
    public function test(Version $v): bool
    {
        if ($this->context !== null && $v->context !== $this->context) {
            return false;
        }
        foreach ($this->sets as [$comparators, $universal, $anyPre]) {
            foreach ($comparators as $c) {
                if (!$c->test($v)) {
                    continue 2;
                }
            }
            if ($v->prerelease === '' || $universal) {
                return true;
            }
            foreach ($anyPre as [$a, $b, $c]) {
                if ($a === $v->major && $b === $v->minor && $c === $v->patch) {
                    return true;
                }
            }
            // A pre-release is admitted only by a comparator that declares a channel on the same
            // tuple whose identifiers it begins with.
            foreach ($comparators as $c) {
                $b = $c->version;
                if ($b !== null && $b->prerelease !== '' && $b->major === $v->major && $b->minor === $v->minor
                    && $b->patch === $v->patch && Identifiers::startsWith($v->prerelease, $b->prerelease)) {
                    return true;
                }
            }
        }
        return false;
    }

    /** The desugared range ('' when it matches everything). */
    public function __toString(): string
    {
        $out = [];
        foreach ($this->sets as [$comparators]) {
            $out[] = implode(' ', array_map('strval', array_filter($comparators, static fn ($c) => !$c->isAny())));
        }
        return implode('||', $out);
    }

    // ------------------------------------------------------------ desugaring

    /** @return array{0: ?int, 1: ?int, 2: ?int, 3: string, 4: string}|null major, minor, patch (null = x), pre, build */
    private static function partial(string $s): ?array
    {
        // Unmatched groups come back as null, so "1.2.3-" (an empty pre-release) is told apart
        // from "1.2.3" (none).
        if (!preg_match(Identifiers::PARTIAL, $s, $m, PREG_UNMATCHED_AS_NULL)) {
            return null;
        }
        $parts = [];
        for ($i = 1; $i <= 3; $i++) {
            $x = $m[$i] ?? null;
            if ($x === null || $x === 'x' || $x === 'X' || $x === '*') {
                $parts[] = null;
            } elseif (!Identifiers::safe($x)) {
                return null;
            } else {
                $parts[] = (int) $x;
            }
        }
        $pre = $m[4] ?? null;
        $build = $m[5] ?? null;
        if ($pre !== null && (!preg_match(Identifiers::PRE_ONLY, $pre) || !Identifiers::preSafe($pre))) {
            return null;
        }
        if ($build !== null && !preg_match(Identifiers::BUILD_ONLY, $build)) {
            return null;
        }
        return [$parts[0], $parts[1], $parts[2], $pre ?? '', $build ?? ''];
    }

    private static function v(int $major, int $minor, int $patch, string $pre = ''): Version
    {
        return new Version($major, $minor, $patch, $pre);
    }

    /** @param list<Comparator> $comps */
    private static function withChannel(array $comps, string $channel): array
    {
        if ($channel === '') {
            return $comps;
        }
        return array_map(static function (Comparator $c) use ($channel) {
            $b = $c->version;
            // A channel turns ">=0.0.0" back into a real bound.
            return $b === null
                ? new Comparator('>=', new Version(0, 0, 0, '', $channel))
                : new Comparator($c->op, new Version($b->major, $b->minor, $b->patch, $b->prerelease, $channel));
        }, $comps);
    }

    private static function tilde(array $p): array
    {
        [$m, $mi, $pa, $pre, $build] = $p;
        if ($m === null) {
            return [Comparator::any()];
        }
        $out = match (true) {
            $mi === null => [Comparator::of('>=', self::v($m, 0, 0)), Comparator::of('<', self::v($m + 1, 0, 0, '0'))],
            $pa === null => [Comparator::of('>=', self::v($m, $mi, 0)), Comparator::of('<', self::v($m, $mi + 1, 0, '0'))],
            default => [Comparator::of('>=', self::v($m, $mi, $pa, $pre)), Comparator::of('<', self::v($m, $mi + 1, 0, '0'))],
        };
        return self::withChannel($out, $build);
    }

    private static function caret(array $p): array
    {
        [$m, $mi, $pa, $pre, $build] = $p;
        if ($m === null) {
            return [Comparator::any()];
        }
        if ($mi === null) {
            $out = [Comparator::of('>=', self::v($m, 0, 0)), Comparator::of('<', self::v($m + 1, 0, 0, '0'))];
        } elseif ($pa === null) {
            $upper = $m === 0 ? self::v(0, $mi + 1, 0, '0') : self::v($m + 1, 0, 0, '0');
            $out = [Comparator::of('>=', self::v($m, $mi, 0)), Comparator::of('<', $upper)];
        } else {
            $upper = $m !== 0 ? self::v($m + 1, 0, 0, '0') : ($mi === 0 ? self::v(0, 0, $pa + 1, '0') : self::v(0, $mi + 1, 0, '0'));
            $out = [Comparator::of('>=', self::v($m, $mi, $pa, $pre)), Comparator::of('<', $upper)];
        }
        return self::withChannel($out, $build);
    }

    private static function xrange(string $op, array $p): array
    {
        [$m, $mi, $pa, $pre, $build] = $p;
        $xm = $m === null || $mi === null;
        $anyX = $xm || $pa === null;
        if ($m === null) {
            return [$op === '>' || $op === '<' ? Comparator::of('<', self::v(0, 0, 0, '0')) : Comparator::any()];
        }
        $mi = $xm ? 0 : $mi;
        if ($anyX && $op !== '') {
            return [match ($op) {
                '>' => Comparator::of('>=', $xm ? self::v($m + 1, 0, 0) : self::v($m, $mi + 1, 0)),
                '<=' => Comparator::of('<', $xm ? self::v($m + 1, 0, 0, '0') : self::v($m, $mi + 1, 0, '0')),
                '<' => Comparator::of('<', self::v($m, $mi, 0, '0')),
                default => Comparator::of($op, self::v($m, $mi, 0)),
            }];
        }
        if ($xm) {
            return [Comparator::of('>=', self::v($m, 0, 0)), Comparator::of('<', self::v($m + 1, 0, 0, '0'))];
        }
        if ($pa === null) {
            return [Comparator::of('>=', self::v($m, $mi, 0)), Comparator::of('<', self::v($m, $mi + 1, 0, '0'))];
        }
        return [Comparator::of($op, new Version($m, $mi, $pa, $pre, $build))];
    }

    private static function hyphen(array $a, array $b): array
    {
        $out = [];
        if ($a[0] !== null) {
            $lo = $a[1] === null ? self::v($a[0], 0, 0) : ($a[2] === null ? self::v($a[0], $a[1], 0) : self::v($a[0], $a[1], $a[2], $a[3]));
            $out[] = Comparator::of('>=', $lo);
        }
        if ($b[0] !== null) {
            $out[] = $b[1] === null ? Comparator::of('<', self::v($b[0] + 1, 0, 0, '0'))
                : ($b[2] === null ? Comparator::of('<', self::v($b[0], $b[1] + 1, 0, '0'))
                : Comparator::of('<=', self::v($b[0], $b[1], $b[2], $b[3])));
        }
        return $out === [] ? [Comparator::any()] : $out;
    }

    private static function comparatorToken(string $tok): ?array
    {
        if ($tok === '' || $tok === '*') {
            return [Comparator::any()];
        }
        if ($tok[0] === '^') {
            $p = self::partial(substr($tok, 1));
            return $p === null ? null : self::caret($p);
        }
        if ($tok[0] === '~') {
            $p = self::partial(substr($tok, str_starts_with($tok, '~>') ? 2 : 1));
            return $p === null ? null : self::tilde($p);
        }
        foreach (['>=', '<=', '>', '<', '='] as $op) {
            if (str_starts_with($tok, $op)) {
                $p = self::partial(substr($tok, \strlen($op)));
                return $p === null ? null : self::xrange($op === '=' ? '' : $op, $p);
            }
        }
        $p = self::partial($tok);
        return $p === null ? null : self::xrange('', $p);
    }

    private static function parseSet(string $s): ?array
    {
        $universal = false;
        $anyPre = [];
        if ($s === '') {
            $tokens = [];
        } elseif (strpbrk($s, " \t\n\r\v\f") === false) {
            $tokens = [$s]; // the common case: a single comparator
        } else {
            $tokens = preg_split('/\s+/', $s, -1, PREG_SPLIT_NO_EMPTY);
        }
        foreach ($tokens as $i => $tok) {
            if ($tok === '*-*') {
                $universal = true;
                $tokens[$i] = '>=0.0.0-0';
            } elseif (str_ends_with($tok, '-*') && preg_match(Identifiers::TUPLE_PRE, $tok, $m)) {
                $anyPre[] = [(int) $m[2], (int) $m[3], (int) $m[4]];
                $tokens[$i] = $m[1] . $m[2] . '.' . $m[3] . '.' . $m[4] . '-0';
            }
        }

        $comps = [];
        $n = \count($tokens);
        if ($n === 3 && $tokens[1] === '-') {
            $a = self::partial($tokens[0]);
            $b = self::partial($tokens[2]);
            if ($a === null || $b === null) {
                return null;
            }
            $comps = self::hyphen($a, $b);
        } else {
            for ($i = 0; $i < $n; $i++) {
                // ">= 1.2.3", "~ 1.2": an operator separated from its version.
                if (isset(self::OPERATORS[$tokens[$i]]) && $i + 1 < $n) {
                    $c = self::comparatorToken($tokens[$i] . $tokens[$i + 1]);
                    $i++;
                } else {
                    $c = self::comparatorToken($tokens[$i]);
                }
                if ($c === null) {
                    return null;
                }
                array_push($comps, ...$c);
            }
            if ($comps === []) {
                $comps = [Comparator::any()];
            }
        }

        // A comparator that can match nothing (<0.0.0-0) makes the whole set match nothing.
        foreach ($comps as $c) {
            $v = $c->version;
            if ($v !== null && $v->prerelease === '0' && $c->op === '<' && $v->major === 0 && $v->minor === 0
                && $v->patch === 0 && $v->build === '') {
                return [[$c], $universal, $anyPre];
            }
        }
        if (\count($comps) === 1) {
            return [$comps, $universal, $anyPre];
        }
        // Deduplicate (keeping the first occurrence) and drop a redundant "any".
        $unique = [];
        foreach ($comps as $c) {
            foreach ($unique as $u) {
                if ($u->same($c)) {
                    continue 2;
                }
            }
            $unique[] = $c;
        }
        if (\count($unique) > 1) {
            $kept = [];
            foreach ($unique as $c) {
                if ($c->version !== null) {
                    $kept[] = $c;
                }
            }
            $unique = $kept;
        }
        return [$unique, $universal, $anyPre];
    }
}
