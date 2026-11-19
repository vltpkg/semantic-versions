<img src="https://github.com/darcyclarke/octofiles/assets/459713/8ee74129-34e6-4bd4-8686-82954f424709" width="85" />

# semver.xyz

The **Semantic Versions** specification site and its reference parser — a modern,
`semver.org`-style home for a spec that restores build precedence and formally
defines sets, ranges and comparators.

## Layout

This repository is a [vlt](https://www.vlt.io) workspace (`vlt.json`):

```
.
├── site/                     # The semver.xyz static site (Vite, vanilla HTML/CSS/JS)
│   ├── index.html            # Home / manifesto
│   ├── spec/                 # The specification
│   ├── selector/             # Client-side range selector (uses the parser)
│   ├── grammar/              # BNF grammars + downloads
│   ├── origin/               # History of build metadata
│   ├── extensions/           # One page per extension, in layering order
│   │   ├── variants/         # Build Variants
│   │   ├── integrity/        # Package Integrity
│   │   └── dependency-locks/ # Dependency Locks + live generator
│   ├── public/               # CNAME, favicon, downloadable *.bnf grammars
│   └── src/                  # Shared design system (style.css) + shell (nav/footer)
├── packages/
│   └── parser/               # `semantic-versions` — the reference implementation
├── extensions/               # Extension specifications (markdown + source)
│   ├── variants/             # 1. Build Variants — which artifact
│   ├── integrity/            # 2. Package Integrity — which bytes
│   └── dependency-locks/     # 3. Dependency Locks — which graph (builds on 1 and 2)
└── spec/                     # Specification source notes
```

## Develop

Install [vlt](https://www.vlt.io) (`curl -fsSL https://install.vlt.sh | bash`),
then:

```sh
vlt install
vlt run dev -w site      # start the site (Vite) at http://localhost:5173
vlt run build -w site    # build the static site into site/dist
vlt run preview -w site  # preview the production build
vlt run test -w packages/parser   # run the parser test suite (tap)
```

The root `package.json` also exposes convenience wrappers, e.g. `vlt run build`.

The [range selector](https://semver.xyz/selector/) imports the `semantic-versions`
parser directly, so the site and the reference implementation never drift.

## Deployment (Cloudflare Pages)

The site is a static [Cloudflare Pages](https://developers.cloudflare.com/pages/)
project, `semver-xyz`, served at [`semver.xyz`](https://semver.xyz). The custom
domain is attached to the Pages project in the Cloudflare dashboard;
[`wrangler.toml`](wrangler.toml) points Wrangler at `site/dist`.

```sh
vlt run deploy           # build, then publish site/dist to production (branch main)
vlt run deploy:preview   # build, then publish a preview deployment
vlt run cf:whoami        # check which Cloudflare account Wrangler is using
```

Use `wrangler pages deploy`, not `wrangler deploy`: the latter is the Workers
command and fails on a Pages project with "Missing entry-point to Worker script
or to assets directory".

[`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) does the same on
every push to `main` once two repository secrets are set:

- `CLOUDFLARE_API_TOKEN`: an API token with the **Cloudflare Pages: Edit** permission
- `CLOUDFLARE_ACCOUNT_ID`: the account that owns the `semver-xyz` project

Without them the workflow still builds the site and skips the publish step.

Vite is configured with `base: "/"` because the site is served from the domain
root.

### Registry

[`vlt.json`](vlt.json) pins the npm registry alias to `https://registry.npmjs.org/`
under its `config` key, so `vlt-lock.json` resolves from the public registry for
everyone (CI included) rather than from whatever registry a contributor's
user-level vlt config points at.

## License

The specification text is licensed under
[CC BY 3.0](https://creativecommons.org/licenses/by/3.0/); the reference parser
(`packages/parser`) under the Apache License 2.0.
