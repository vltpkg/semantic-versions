# Conformance suite

Language-neutral test cases for [Semantic Versions](https://semver.xyz/spec/).
Every implementation in this repository runs them, and any third-party
implementation can too: they are plain JSON.

| File | Cases | What it checks |
| --- | --- | --- |
| [`versions.json`](versions.json) | `{ input, valid, version?, context? }` | Whether a string is a version, its normalized form, and its context |
| [`precedence.json`](precedence.json) | `{ a, b, expected }` | The sign of `compare(a, b)`: `-1`, `0` or `1` |
| [`ranges.json`](ranges.json) | `{ range, version, expected }` | Whether `version` satisfies `range` |
| [`desugar.json`](desugar.json) | `{ input, output, accept? }` | Advanced range syntax and the primitive comparators it means |

Every case has a `category` (the feature it exercises: `build-precedence`,
`prerelease-channels`, `context`, …) and some carry a `note`. Expected values come
from the specification text and from the reference implementations' own test
assertions; they are reviewed by hand, never regenerated from an implementation's
output. A desugared range may be written in any of its `accept`ed forms (for
example, a redundant `>=0.0.0` lower bound may be omitted).

Where to find the runners:

- JavaScript: [`libraries/javascript/test/conformance.js`](../libraries/javascript/test/conformance.js)
- Rust: [`libraries/rust/tests/conformance.rs`](../libraries/rust/tests/conformance.rs)
- Scoring other libraries: [`../benchmarks`](../benchmarks)

Building an implementation in another language? Run these files against it; a
complete implementation passes every case.
