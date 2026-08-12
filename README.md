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
│   ├── extensions/
│   │   └── dependency-locks/ # Folded-in Dependency Locks extension + live generator
│   ├── public/               # CNAME, favicon, downloadable *.bnf grammars
│   └── src/                  # Shared design system (style.css) + shell (nav/footer)
├── packages/
│   └── parser/               # `semantic-versions` — the reference implementation
├── extensions/
│   └── dependency-locks/     # The Dependency Locks specification (markdown + source)
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

## Deployment (GitHub Pages + Cloudflare)

The site deploys to **GitHub Pages** via
[`.github/workflows/deploy.yml`](.github/workflows/deploy.yml): every push to
`main` installs vlt, runs `vlt install`, builds `site/dist`, and publishes it
with `actions/deploy-pages`.

Custom domain: [`semver.xyz`](https://semver.xyz).

- `site/public/CNAME` contains `semver.xyz`, so the Pages deploy sets the custom
  domain automatically.
- `site/public/.nojekyll` disables Jekyll processing (needed so files/directories
  beginning with `_` are served as-is).
- Vite is configured with `base: "/"` because the site is served from the domain
  root.

### Cloudflare

Point the domain at GitHub Pages through Cloudflare:

1. **DNS** — add a proxied (orange-cloud) `CNAME` record:
   `semver.xyz` → `vltpkg.github.io`. For the apex, Cloudflare's CNAME flattening
   handles the root record.
2. **SSL/TLS mode** — set to **Full** (not "Flexible"). GitHub Pages already
   terminates TLS on its origin; "Flexible" causes a redirect loop.
3. In the repository's **Settings → Pages**, enable **Enforce HTTPS** once the
   certificate for `semver.xyz` has been provisioned.
4. If you hit a redirect loop, confirm SSL mode is **Full** and, in Cloudflare
   **Rules → Settings**, that "Always Use HTTPS" is not fighting the Pages
   redirect.

## License

The specification text is licensed under
[CC BY 3.0](https://creativecommons.org/licenses/by/3.0/); the reference parser
(`packages/parser`) under the Apache License 2.0.
