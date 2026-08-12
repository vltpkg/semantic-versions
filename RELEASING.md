# Releasing `semantic-versions`

The reference parser lives in [`packages/parser`](./packages/parser) and is published to
npm as [`semantic-versions`](https://www.npmjs.com/package/semantic-versions). All commands
below use [`vlt`](https://www.vlt.io) and run from the repository root.

Publishing has to run from the root with `--workspace packages/parser`; the root
`package.json` is `private`, and vlt reads the workspace target from the flag.

## One-time setup

Authenticate vlt against the npm registry. This stores a bearer token in vlt's keychain:

```sh
vlt login --registry=https://registry.npmjs.org/
# or, to paste an existing automation/granular token:
vlt token add --registry=https://registry.npmjs.org/
```

Confirm you're the right user and have publish rights:

```sh
vlt whoami --registry=https://registry.npmjs.org/
```

## Cut a release

1. Update the version in `packages/parser/package.json` (for example `1.0.0`). Keep the
   `CHANGELOG`/release notes in the GitHub Release.
2. Verify the package contents and metadata without publishing:

   ```sh
   vlt run publish:dry
   ```

   Check the reported `name`, `version`, `access`, `registry` and `files` list (it should
   contain `index.js`, `lib/`, `README.md` and `LICENSE`, and nothing else).
3. Publish (runs the test suite first, then publishes with public access):

   ```sh
   vlt run release
   ```

Pre-release tags publish under a dist-tag instead of `latest`:

```sh
vlt publish --workspace packages/parser --access public --tag next
```

## Automated release (GitHub Actions)

[`.github/workflows/release.yml`](./.github/workflows/release.yml) publishes on a published
GitHub Release (or a manual run from the Actions tab). It requires one repository secret:

- **`NPM_TOKEN`** — an npm automation or granular access token with publish rights for the
  `semantic-versions` package. The workflow seeds vlt's keychain from this token, runs the
  test suite, and then publishes.

To do a manual dry run through CI, trigger the workflow with the **dry-run** input checked.

## What gets published

Only the runtime files ship, per the `files` allowlist in `packages/parser/package.json`:
`index.js`, `lib/`, `README.md` and `LICENSE`. Tests, benchmarks and coverage output are
excluded.
