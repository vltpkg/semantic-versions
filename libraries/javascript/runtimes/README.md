# Runtime checks

`semantic-versions` is plain ES2020 with no dependencies and no runtime APIs, so
the same files run on servers and in browsers. These harnesses prove it by running
the shared [conformance suite](../../../conformance) through the public API in
each runtime, unbundled:

| Harness | Runtimes |
| --- | --- |
| `server.js` | Node.js (18+), Deno, Bun |
| `workerd.js` | [workerd](https://github.com/cloudflare/workerd), the runtime behind Cloudflare Workers (no Node APIs, no DOM) |
| `browser.js` | Chromium, Firefox and WebKit, on the page and in a module worker |

```sh
cd libraries/javascript/runtimes
npm install
npx playwright install chromium firefox webkit
npm test          # or: npm run node | deno | bun | workerd | browsers
```

`check.js` is the runtime-neutral part; each harness only loads the JSON and
reports. `test/isomorphic.js` (run by `tap`) guards the same property statically:
relative imports only, no Node or DOM globals, nothing published that `index.js`
does not import, and no side effects on import.

This directory is not part of the published package or the vlt workspace.
