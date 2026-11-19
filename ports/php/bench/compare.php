<?php

// Benchmarks semantic-versions against composer/semver (Composer's constraint engine) and
// z4kn4fein/php-semver on real-world inputs, and scores all three against the shared conformance
// suite. Writes ../../../benchmarks/results/php.json.
//
//   composer install && php bench/compare.php     (from ports/php)
//   php bench/compare.php --quick                 (fast run, does not write results)

declare(strict_types=1);

require getenv('SV_AUTOLOAD') ?: __DIR__ . '/../vendor/autoload.php';

use Composer\Semver\Constraint\Constraint as ComposerConstraint;
use Composer\Semver\VersionParser;
use Vlt\SemanticVersions\Range;
use Vlt\SemanticVersions\SemanticVersions as SV;
use Vlt\SemanticVersions\Version;
use z4kn4fein\SemVer\Constraints\Constraint as ZConstraint;
use z4kn4fein\SemVer\Version as ZVersion;

const ROOT = __DIR__ . '/../../..';
$quick = in_array('--quick', $argv, true);

/** Median nanoseconds per operation of $f, which performs $ops operations. */
function measure(int $ops, callable $f): float
{
    global $quick;
    [$sample, $samples] = $quick ? [60_000_000, 5] : [250_000_000, 15];
    $warm = hrtime(true) + 200_000_000;
    while (hrtime(true) < $warm) {
        $f();
    }
    $results = [];
    for ($s = 0; $s < $samples; $s++) {
        $start = hrtime(true);
        $calls = 0;
        do {
            $f();
            $calls++;
            $elapsed = hrtime(true) - $start;
        } while ($elapsed < $sample);
        $results[] = $elapsed / ($calls * $ops);
    }
    sort($results);
    return $results[intdiv($samples, 2)];
}

function attempt(callable $f): mixed
{
    try {
        return $f();
    } catch (\Throwable) {
        return null;
    }
}

function installed(string $package, string $fallback): string
{
    $lock = __DIR__ . '/../vendor/composer/installed.json';
    if (is_file($lock)) {
        $data = json_decode(file_get_contents($lock), true);
        foreach ($data['packages'] ?? $data as $p) {
            if (($p['name'] ?? null) === $package) {
                return ltrim($p['version'], 'v');
            }
        }
    }
    return $fallback;
}

// ---------------------------------------------------------------- adapters

$composer = new VersionParser();
$cnorm = static fn (string $s) => $composer->normalize($s);

$libs = [
    [
        'name' => 'semantic-versions',
        'version' => '1.0.0',
        'parse' => static fn ($s) => Version::parse($s),
        'same' => static fn ($input, $expected) => (string) Version::parse($input) === $expected,
        'context' => static fn ($s) => Version::parse($s)->context,
        'compare' => static fn ($a, $b) => SV::compare($a, $b),
        'satisfies' => static fn ($v, $r) => Range::parse($r) && SV::satisfies($v, $r),
        'range' => static fn ($r) => Range::parse($r),
        'desugar' => static fn ($r) => SV::validRange($r),
    ],
    [
        'name' => 'composer/semver',
        'version' => installed('composer/semver', '3.6.0'),
        'parse' => $cnorm,
        // Composer normalizes to its own four-part form (1.2.3.0, -RC1), so a version is scored
        // on parsing to the same value as the expected one rather than on formatting.
        'same' => static fn ($input, $expected) => $cnorm($input) === $cnorm($expected),
        'context' => static fn ($s) => null,
        'compare' => static fn ($a, $b) => version_compare($cnorm($a), $cnorm($b)),
        'satisfies' => static function ($v, $r) use ($composer, $cnorm) {
            $c = $composer->parseConstraints($r);
            $n = attempt(static fn () => $cnorm($v));
            return $n !== null && $c->matches(new ComposerConstraint('==', $n));
        },
        'range' => static fn ($r) => $composer->parseConstraints($r),
        'desugar' => null,
    ],
    [
        'name' => 'z4kn4fein/php-semver',
        'version' => installed('z4kn4fein/php-semver', '3.0.0'),
        'parse' => static fn ($s) => ZVersion::parse($s),
        'same' => static fn ($input, $expected) => (string) ZVersion::parse($input) === $expected,
        'context' => static fn ($s) => null,
        'compare' => static fn ($a, $b) => ZVersion::compare(ZVersion::parse($a), ZVersion::parse($b)),
        'satisfies' => static function ($v, $r) {
            $c = ZConstraint::parse($r);
            $x = ZVersion::parseOrNull($v);
            return $x !== null && $x->isSatisfying($c);
        },
        'range' => static fn ($r) => ZConstraint::parse($r),
        'desugar' => null,
    ],
];

function cases(string $name): array
{
    return json_decode(file_get_contents(ROOT . "/conformance/$name.json"), true, flags: JSON_THROW_ON_ERROR)['cases'];
}

function conformance(array $l): array
{
    $by = [];
    $tally = static function (string $cat, bool $ok) use (&$by): void {
        $by[$cat] ??= ['passed' => 0, 'total' => 0];
        $by[$cat]['total']++;
        $by[$cat]['passed'] += $ok ? 1 : 0;
    };
    foreach (cases('versions') as $c) {
        if ($c['valid']) {
            $ok = attempt(static fn () => $l['same']($c['input'], $c['version'])) === true;
            if (array_key_exists('context', $c)) {
                $ok = $ok && attempt(static fn () => $l['context']($c['input'])) === $c['context'];
            }
        } else {
            $ok = attempt(static fn () => $l['parse']($c['input'])) === null;
        }
        $tally($c['category'], $ok);
    }
    foreach (cases('precedence') as $c) {
        $got = attempt(static fn () => $l['compare']($c['a'], $c['b']));
        $tally($c['category'], $got !== null && ($got <=> 0) === $c['expected']);
    }
    foreach (cases('ranges') as $c) {
        $tally($c['category'], (attempt(static fn () => $l['satisfies']($c['version'], $c['range'])) === true) === $c['expected']);
    }
    if ($l['desugar'] !== null) {
        foreach (cases('desugar') as $c) {
            $got = attempt(static fn () => $l['desugar']($c['input']));
            $tally($c['category'], $got === $c['output'] || ($got !== null && in_array($got, $c['accept'] ?? [], true)));
        }
    }
    ksort($by);
    return $by;
}

$corpus = json_decode(file_get_contents(ROOT . '/benchmarks/corpus.json'), true, flags: JSON_THROW_ON_ERROR);
$versions = $corpus['versions'];
$allRanges = $corpus['ranges'];
$packages = $corpus['packages'];

// Ranges every library accepts.
$ranges = array_values(array_filter($allRanges, static fn ($r) => attempt(static fn () => Range::parse($r)) !== null
    && attempt(static fn () => $composer->parseConstraints($r)) !== null
    && attempt(static fn () => ZConstraint::parse($r)) !== null));
$comparable = array_flip($ranges);
$resolutions = array_values(array_filter($corpus['resolutions'], static fn ($r) => isset($comparable[$r[1]])));
$pairs = array_sum(array_map(static fn ($r) => count($packages[$r[0]]), $resolutions));
$tasks = [];

$row = static function (string $id, string $label, string $description, array $results) use (&$tasks): void {
    $out = [];
    foreach ($results as $name => $ns) {
        fwrite(STDERR, sprintf("%-10s %-22s %10.1f ns/op\n", $id, $name, $ns));
        $out[$name] = ['nsPerOp' => round($ns, 1), 'opsPerSec' => (int) round(1e9 / $ns)];
    }
    $tasks[] = ['id' => $id, 'label' => $label, 'description' => $description, 'results' => $out];
};

$n = count($versions);
$row('parse', 'Parse a version', "$n published versions", [
    'semantic-versions' => measure($n, static function () use ($versions) {
        foreach ($versions as $s) {
            Version::tryParse($s);
        }
    }),
    'composer/semver' => measure($n, static function () use ($versions, $composer) {
        foreach ($versions as $s) {
            try {
                $composer->normalize($s);
            } catch (\UnexpectedValueException) {
            }
        }
    }),
    'z4kn4fein/php-semver' => measure($n, static function () use ($versions) {
        foreach ($versions as $s) {
            ZVersion::parseOrNull($s);
        }
    }),
]);

// Parsed once outside the timing. Composer's parsed form is its normalized string, which it
// orders with version_compare.
$svs = array_values(array_filter(array_map([Version::class, 'tryParse'], $versions)));
$cvs = array_values(array_filter(array_map(static fn ($s) => attempt(static fn () => $composer->normalize($s)), $versions)));
$zvs = array_values(array_filter(array_map([ZVersion::class, 'parseOrNull'], $versions)));
$row('sort', 'Sort versions', "$n parsed versions by precedence (per version)", [
    'semantic-versions' => measure(count($svs), static function () use ($svs) {
        $l = $svs;
        usort($l, static fn (Version $a, Version $b) => $a->compare($b));
    }),
    'composer/semver' => measure(count($cvs), static function () use ($cvs) {
        $l = $cvs;
        usort($l, 'version_compare');
    }),
    'z4kn4fein/php-semver' => measure(count($zvs), static function () use ($zvs) {
        $l = $zvs;
        usort($l, [ZVersion::class, 'compare']);
    }),
]);

$row('range', 'Parse a range', count($ranges) . ' real dependency ranges', [
    'semantic-versions' => measure(count($ranges), static function () use ($ranges) {
        foreach ($ranges as $r) {
            Range::parse($r);
        }
    }),
    'composer/semver' => measure(count($ranges), static function () use ($ranges, $composer) {
        foreach ($ranges as $r) {
            $composer->parseConstraints($r);
        }
    }),
    'z4kn4fein/php-semver' => measure(count($ranges), static function () use ($ranges) {
        foreach ($ranges as $r) {
            ZConstraint::parse($r);
        }
    }),
]);

$svPkg = [];
$cPkg = [];
$zPkg = [];
foreach ($packages as $name => $vs) {
    $svPkg[$name] = array_values(array_filter(array_map([Version::class, 'tryParse'], $vs)));
    $cPkg[$name] = array_map(static fn ($n) => new ComposerConstraint('==', $n),
        array_values(array_filter(array_map(static fn ($s) => attempt(static fn () => $composer->normalize($s)), $vs))));
    $zPkg[$name] = array_values(array_filter(array_map([ZVersion::class, 'parseOrNull'], $vs)));
}
$svPairs = array_map(static fn ($r) => [Range::parse($r[1]), $svPkg[$r[0]]], $resolutions);
$cPairs = array_map(static fn ($r) => [$composer->parseConstraints($r[1]), $cPkg[$r[0]]], $resolutions);
$zPairs = array_map(static fn ($r) => [ZConstraint::parse($r[1]), $zPkg[$r[0]]], $resolutions);
$row('satisfies', 'range->test(version)', "$pairs version × range checks", [
    'semantic-versions' => measure($pairs, static function () use ($svPairs) {
        foreach ($svPairs as [$r, $vs]) {
            foreach ($vs as $v) {
                $r->test($v);
            }
        }
    }),
    'composer/semver' => measure($pairs, static function () use ($cPairs) {
        foreach ($cPairs as [$r, $vs]) {
            foreach ($vs as $v) {
                $r->matches($v);
            }
        }
    }),
    'z4kn4fein/php-semver' => measure($pairs, static function () use ($zPairs) {
        foreach ($zPairs as [$r, $vs]) {
            foreach ($vs as $v) {
                $r->isSatisfiedBy($v);
            }
        }
    }),
]);

$cNorm = [];
foreach ($packages as $name => $vs) {
    $cNorm[$name] = array_values(array_filter(array_map(static fn ($s) => attempt(static fn () => $composer->normalize($s)), $vs)));
}
$row('resolve', 'Resolve a range', count($resolutions) . " max-satisfying lookups against a package's versions", [
    'semantic-versions' => measure(count($resolutions), static function () use ($resolutions, $svPkg) {
        foreach ($resolutions as [$name, $range]) {
            $r = Range::parse($range);
            $best = null;
            foreach ($svPkg[$name] as $v) {
                if ($r->test($v) && ($best === null || $v->compare($best) > 0)) {
                    $best = $v;
                }
            }
        }
    }),
    'composer/semver' => measure(count($resolutions), static function () use ($resolutions, $cNorm, $composer) {
        foreach ($resolutions as [$name, $range]) {
            $r = $composer->parseConstraints($range);
            $best = null;
            foreach ($cNorm[$name] as $v) {
                if ($r->matches(new ComposerConstraint('==', $v)) && ($best === null || version_compare($v, $best) > 0)) {
                    $best = $v;
                }
            }
        }
    }),
    'z4kn4fein/php-semver' => measure(count($resolutions), static function () use ($resolutions, $zPkg) {
        foreach ($resolutions as [$name, $range]) {
            $r = ZConstraint::parse($range);
            $best = null;
            foreach ($zPkg[$name] as $v) {
                if ($r->isSatisfiedBy($v) && ($best === null || ZVersion::compare($v, $best) > 0)) {
                    $best = $v;
                }
            }
        }
    }),
]);

$conf = [];
$coverage = [];
$libraries = [];
foreach ($libs as $l) {
    $conf[$l['name']] = conformance($l);
    $coverage[$l['name']] = [
        'versions' => count(array_filter($versions, static fn ($v) => attempt(static fn () => $l['parse']($v)) !== null)),
        'ranges' => count(array_filter($allRanges, static fn ($r) => attempt(static fn () => $l['range']($r)) !== null)),
    ];
    $libraries[$l['name']] = ['version' => $l['version']];
}
if ($quick) {
    foreach ($conf as $name => $c) {
        fwrite(STDERR, sprintf("conformance %s %d/%d coverage %s\n", $name, array_sum(array_column($c, 'passed')), array_sum(array_column($c, 'total')), json_encode($coverage[$name])));
    }
    exit(0);
}

$cpu = 'unknown';
if (is_readable('/proc/cpuinfo') && preg_match('/^model name\s*:\s*(.+)$/m', file_get_contents('/proc/cpuinfo'), $m)) {
    $cpu = trim($m[1]);
} elseif (($s = trim((string) @shell_exec('sysctl -n machdep.cpu.brand_string 2>/dev/null'))) !== '') {
    $cpu = $s;
}
$out = [
    'language' => 'PHP',
    'subject' => 'semantic-versions',
    'baseline' => 'composer/semver',
    'environment' => [
        'runtime' => 'PHP ' . PHP_VERSION . (function_exists('opcache_get_status') && (opcache_get_status(false)['jit']['on'] ?? false) ? ' (JIT)' : ''),
        'cpu' => $cpu,
        'platform' => strtolower(PHP_OS) . ' ' . php_uname('m'),
        'date' => date('Y-m-d'),
    ],
    'libraries' => $libraries,
    'corpus' => ['versions' => $n, 'ranges' => count($allRanges), 'comparableRanges' => count($ranges), 'fetched' => $corpus['fetched']],
    'coverage' => $coverage,
    'tasks' => $tasks,
    'conformance' => $conf,
    'notes' => [
        'composer/semver' => "Composer's model differs by design: versions normalize to four parts with stability flags (1.0.0-rc.1 becomes 1.0.0.0-RC1), builds are dropped, and pre-release names outside alpha, beta, RC and patch are rejected. Versions are scored on parsing to the same value.",
    ],
];
file_put_contents(ROOT . '/benchmarks/results/php.json', json_encode($out, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) . "\n");
