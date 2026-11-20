# Releasing

Every library lives in [`libraries/<language>`](../libraries) and is versioned on
its own. Before any release, make sure CI is green on `main`: each library runs
the shared [conformance suite](../conformance) there.

Release notes go in a GitHub Release. Tags follow `libraries/<language>/vX.Y.Z`
(for Go this exact form is required, because the module lives in a subdirectory).

| Library | Registry | Version lives in | Publish (from the repository root) |
| --- | --- | --- | --- |
| JavaScript | npm `semantic-versions` | `libraries/javascript/package.json` | `vlt run release` (or the [release workflow](workflows/release.yml)) |
| Rust | crates.io `semantic-versions` | `libraries/rust/Cargo.toml` | `cd libraries/rust && cargo publish` |
| Python | PyPI `semantic-versions` | `libraries/python/pyproject.toml` | `cd libraries/python && python -m build && twine upload dist/*` |
| Go | `semver.xyz/go` | the tag | `git tag libraries/go/vX.Y.Z && git push origin libraries/go/vX.Y.Z` |
| Ruby | RubyGems `semantic-versions` | `libraries/ruby/lib/semantic_versions/version.rb` | `cd libraries/ruby && gem build semantic-versions.gemspec && gem push semantic-versions-X.Y.Z.gem` |
| Java | Maven Central `xyz.semver:semantic-versions` | `libraries/java/pom.xml` | `cd libraries/java && mvn -P release deploy`, then **Publish** in the Central Portal |
| .NET | NuGet `SemanticVersions` | `libraries/dotnet/src/SemanticVersions/SemanticVersions.csproj` | upload the `nuget-package` artifact from CI at nuget.org, or `dotnet nuget push` |
| PHP | Packagist `vltpkg/semantic-versions` | the tag | sync to the split repo and tag it (below) |

## Credentials

Each registry's token stays on the publisher's machine; none are stored in this
repository.

- **npm:** `vlt login --registry=https://registry.npmjs.org/`. CI publishing uses
  the `NPM_TOKEN` repository secret.
- **crates.io:** `cargo login`.
- **PyPI:** an API token, used by twine as username `__token__`.
- **RubyGems:** an API key with the "Push rubygem" scope in `~/.gem/credentials`.
  The gem requires MFA (`rubygems_mfa_required`).
- **Maven Central:** a Central Portal user token as `<server id="central">` in
  `~/.m2/settings.xml`, and a GPG key published to a keyserver. The `release`
  profile in `pom.xml` signs and uploads; the deployment waits in the Portal until
  you publish it.
- **NuGet:** an API key, or upload through the nuget.org web UI.

## Go: the vanity import path

`semver.xyz/go` resolves through [`site/src/app/go/route.ts`](../site/src/app/go/route.ts),
whose `go-import` tag points at `libraries/go`. If the directory ever moves, update
that tag, not the module path. After tagging, request the version at
`https://pkg.go.dev/semver.xyz/go@vX.Y.Z` if it doesn't appear on its own.

## PHP: the split repository

Packagist reads [`vltpkg/semantic-versions-php`](https://github.com/vltpkg/semantic-versions-php),
which holds only the contents of `libraries/php` (Composer needs `composer.json`
at a repository root). To release:

```sh
git clone https://github.com/vltpkg/semantic-versions-php /tmp/sv-php
rsync -a --delete --exclude .git --exclude vendor --exclude composer.lock libraries/php/ /tmp/sv-php/
cd /tmp/sv-php && git add -A && git commit -m "semantic-versions X.Y.Z"
git tag vX.Y.Z && git push origin HEAD vX.Y.Z
```

Packagist picks up the tag automatically once its GitHub hook is set up;
otherwise, press **Update** on the package page.

## What ships to npm

Only the runtime files, per the `files` allowlist in
`libraries/javascript/package.json`: `index.js`, `lib/`, `README.md` and
`LICENSE`. Check with `vlt run publish:dry` before publishing.
