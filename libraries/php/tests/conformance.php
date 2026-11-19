<?php

// Runs the shared conformance suite (../../conformance) against this package. Exits 1 on failure.

declare(strict_types=1);

spl_autoload_register(static function (string $class): void {
    $prefix = 'Vlt\\SemanticVersions\\';
    if (str_starts_with($class, $prefix)) {
        require __DIR__ . '/../src/' . substr($class, \strlen($prefix)) . '.php';
    }
});

use Vlt\SemanticVersions\Range;
use Vlt\SemanticVersions\SemanticVersions as SV;
use Vlt\SemanticVersions\Version;

$suite = $argv[1] ?? __DIR__ . '/../../../conformance';
$failures = [];
$checks = 0;
$check = static function (bool $ok, string $message) use (&$failures, &$checks): void {
    $checks++;
    if (!$ok) {
        $failures[] = $message;
    }
};
$cases = static fn (string $name): array => json_decode(file_get_contents("$suite/$name.json"), true, flags: JSON_THROW_ON_ERROR)['cases'];

foreach ($cases('versions') as $c) {
    $v = Version::tryParse($c['input']);
    if ($c['valid']) {
        $check($v !== null && (string) $v === $c['version'], "parse {$c['input']} -> " . ($v ?? 'null'));
        if (array_key_exists('context', $c)) {
            $check($v?->context === $c['context'], "context {$c['input']}");
        }
    } else {
        $check($v === null, "accepted invalid {$c['input']}");
    }
}
foreach ($cases('precedence') as $c) {
    $check(SV::compare($c['a'], $c['b']) === $c['expected'] && SV::compare($c['b'], $c['a']) === -$c['expected'], "compare {$c['a']} {$c['b']}");
}
foreach ($cases('ranges') as $c) {
    $check(SV::satisfies($c['version'], $c['range']) === $c['expected'], "satisfies {$c['version']} in {$c['range']}");
}
foreach ($cases('desugar') as $c) {
    $got = SV::validRange($c['input']);
    $check($got === $c['output'] || in_array($got, $c['accept'] ?? [], true), "desugar {$c['input']} -> " . var_export($got, true));
}

$vs = ['1.0.0', '2.0.0-rc.1', '1.5.0', '2.0.0', '1.5.0+build'];
$check(SV::maxSatisfying($vs, '^1') === '1.5.0+build', 'maxSatisfying');
$check(SV::minSatisfying($vs, '^1') === '1.0.0', 'minSatisfying');
$check(SV::sort($vs) === ['1.0.0', '1.5.0', '1.5.0+build', '2.0.0-rc.1', '2.0.0'], 'sort');
$check(SV::rsort($vs)[0] === '2.0.0', 'rsort');
$check(SV::validRange('>=0.0.0') === '*', 'validRange any');
$check(Range::parse('npm:react@^18')->test(Version::parse('npm:react@18.2.0')), 'context match');
$check(!Range::parse('npm:react@^18')->test(Version::parse('18.2.0')), 'context mismatch');
$check(Version::tryParse('1.2') === null, '1.2 rejected');

foreach ($failures as $f) {
    fwrite(STDERR, "FAIL $f\n");
}
if ($failures !== []) {
    fwrite(STDERR, count($failures) . " of $checks checks failed\n");
    exit(1);
}
echo "ok $checks checks\n";
