<?php

declare(strict_types=1);

namespace Vlt\SemanticVersions;

/**
 * A primitive comparator: an operator and a bound, or "any" (matches every version). A build on
 * the bound is a build channel (a prefix filter on the candidate's build); a pre-release on it
 * declares a pre-release channel for its tuple.
 */
final class Comparator implements \Stringable
{
    private static ?self $any = null;

    /** @param string $op one of "<", "<=", ">", ">=", "" (equal) */
    public function __construct(public readonly string $op, public readonly ?Version $version)
    {
    }

    public static function any(): self
    {
        return self::$any ??= new self('', null);
    }

    /** @internal ">=0.0.0" bounds nothing: it is the "any" comparator. */
    public static function of(string $op, Version $v): self
    {
        if ($op === '>=' && $v->major === 0 && $v->minor === 0 && $v->patch === 0 && $v->prerelease === '' && $v->build === '') {
            return self::any();
        }
        return new self($op, $v);
    }

    public function isAny(): bool
    {
        return $this->version === null;
    }

    /** @internal */
    public function isNull(): bool
    {
        $v = $this->version;
        return $v !== null && $this->op === '<' && $v->major === 0 && $v->minor === 0 && $v->patch === 0
            && $v->prerelease === '0' && $v->build === '';
    }

    /** True if $v passes the bound and, when the comparator declares a build channel, carries a build in it. */
    public function test(Version $v): bool
    {
        $b = $this->version;
        if ($b === null) {
            return true;
        }
        $o = $v->compareWithoutBuild($b);
        $ok = match ($this->op) {
            '<' => $o < 0,
            '<=' => $o <= 0,
            '>' => $o > 0,
            '>=' => $o >= 0,
            default => $o === 0,
        };
        return $ok && ($b->build === '' || Identifiers::startsWith($v->build, $b->build));
    }

    /** @internal */
    public function same(self $c): bool
    {
        if ($this->op !== $c->op) {
            return false;
        }
        $a = $this->version;
        $b = $c->version;
        if ($a === null || $b === null) {
            return $a === $b;
        }
        return $a->major === $b->major && $a->minor === $b->minor && $a->patch === $b->patch
            && $a->prerelease === $b->prerelease && $a->build === $b->build;
    }

    public function __toString(): string
    {
        return $this->version === null ? '' : $this->op . $this->version;
    }
}
