import { defineConfig } from "vite";
import { fileURLToPath, URL } from "node:url";

const entry = (p) => fileURLToPath(new URL(p, import.meta.url));

// Static multi-page site served from the domain root (semver.xyz).
export default defineConfig({
  base: "/",
  server: {
    fs: {
      // vlt keeps packages in the repo-root `node_modules/.vlt/` store, outside the
      // `site/` root Vite serves by default. Without this, dev requests for
      // brotli-wasm's `.wasm` get a 403 HTML page and the lock generator fails to
      // instantiate it (the production build inlines it as an asset, so only dev breaks).
      allow: [entry("..")],
    },
  },
  build: {
    target: "es2020",
    cssMinify: true,
    rollupOptions: {
      input: {
        home: entry("index.html"),
        spec: entry("spec/index.html"),
        proposal: entry("proposal/index.html"),
        selector: entry("selector/index.html"),
        grammar: entry("grammar/index.html"),
        origin: entry("origin/index.html"),
        license: entry("license/index.html"),
        extensions: entry("extensions/index.html"),
        variants: entry("extensions/variants/index.html"),
        integrity: entry("extensions/integrity/index.html"),
        deplocks: entry("extensions/dependency-locks/index.html"),
      },
    },
  },
});
