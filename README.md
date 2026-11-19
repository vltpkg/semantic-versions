<img src="https://github.com/darcyclarke/octofiles/assets/459713/8ee74129-34e6-4bd4-8686-82954f424709" width="85" />

# semver.xyz

**Semantic Versions** is an open specification for how version numbers are
assigned, incremented, grouped, compared and matched: a spiritual successor to
[Semantic Versioning 2.0.0-rc.1](https://semver.org/spec/v2.0.0-rc.1.html) that
restores build precedence and formally defines sets, ranges, comparators and
channels. This repository holds the specification, its extensions, the
reference parser and the [semver.xyz](https://semver.xyz) site.

- **Read the spec:** [`spec/SPEC.md`](spec/SPEC.md) (also at [semver.xyz/spec](https://semver.xyz/spec/))
- **Questions:** [semver.xyz/faq](https://semver.xyz/faq/)
- **Try ranges in the browser:** [semver.xyz/selector](https://semver.xyz/selector/)
- **Reference parser:** [`semantic-versions`](packages/parser) on npm

## Where things live

Each document has exactly one source; the site renders or links to it rather
than keeping a second copy.

| What | Source of truth | On the site |
| --- | --- | --- |
| The specification | [`spec/SPEC.md`](spec/SPEC.md) | [`/spec/`](https://semver.xyz/spec/), rendered from the Markdown at build time |
| Extensions | [`extensions/*/*.md`](extensions) | [`/extensions/`](https://semver.xyz/extensions/), one presentation page each |
| FAQ | [`site/faq/index.html`](site/faq/index.html) | [`/faq/`](https://semver.xyz/faq/) |
| Comparison with SemVer 2.0.0 | [`site/proposal/index.html`](site/proposal/index.html) | [`/proposal/#compare`](https://semver.xyz/proposal/#compare) |
| BNF grammars | [`site/public/spec/*.bnf`](site/public/spec) | [`/grammar/`](https://semver.xyz/grammar/) |

To change the specification, edit `spec/SPEC.md` and nothing else: it reads
correctly on GitHub, and `vlt run dev -w site` live-reloads `/spec/` as you
save. Keep headings plain where other pages link to them (`#context`,
`#precedence`, `#pre-release-channels`, `#build-channels`), since heading ids
follow GitHub's slug rules on both GitHub and the site.

## Layout

This repository is a [vlt](https://www.vlt.io) workspace (`vlt.json`):

```
.
├── spec/
│   └── SPEC.md               # The specification (canonical)
├── extensions/               # Extension specifications (markdown + source)
│   ├── variants/             # 1. Build Variants: which artifact
│   ├── integrity/            # 2. Package Integrity: which bytes
│   └── dependency-locks/     # 3. Dependency Locks: which graph (builds on 1 and 2)
├── packages/
│   └── parser/               # `semantic-versions`, the reference implementation
└── site/                     # The semver.xyz static site (Vite, vanilla HTML/CSS/JS)
    ├── index.html            # Home
    ├── spec/                 # Template; content rendered from spec/SPEC.md
    ├── extensions/           # One page per extension, in layering order
    ├── grammar/              # BNF grammars + downloads
    ├── selector/             # Client-side range selector (uses the parser)
    ├── proposal/             # Semantic Versioning 3.0.0 proposal + 2.0.0 comparison
    ├── origin/               # History of build metadata
    ├── faq/                  # Frequently asked questions
    ├── license/
    ├── scripts/
    │   ├── render-spec.mjs   # Markdown → /spec/ (used by vite.config.js)
    │   └── ai-artifacts.mjs  # llms.txt, sitemap.xml, robots.txt, Markdown mirrors
    ├── public/               # favicon, fonts, downloadable *.bnf grammars
    └── src/                  # Shared design system (style.css) + shell (nav/footer)
```

## Develop

Install [vlt](https://www.vlt.io) (`curl -fsSL https://install.vlt.sh | bash`,
Node 22.22 or newer), then:

```sh
vlt install
vlt run dev -w site               # start the site (Vite) at http://localhost:5173
vlt run build -w site             # build the static site into site/dist
vlt run preview -w site           # preview the production build
vlt run test -w packages/parser   # run the parser test suite (tap)
```

The root `package.json` also exposes convenience wrappers, e.g. `vlt run build`.

`dev` and `build` first run `site/scripts/ai-artifacts.mjs`, which writes the
machine-readable files served from the site root (`/llms.txt`, `/llms-full.txt`,
`/sitemap.xml`, `/robots.txt` and Markdown mirrors of the spec and extensions).
They are gitignored; never edit the copies under `site/public/`.

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
