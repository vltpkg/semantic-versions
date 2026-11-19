import { defineConfig } from "vite";
import { fileURLToPath, URL } from "node:url";
import { renderSpecFile } from "./scripts/render-spec.mjs";

const entry = (p) => fileURLToPath(new URL(p, import.meta.url));

// The canonical specification. Rendered into spec/index.html at the
// `<!-- spec:toc -->` and `<!-- spec:content -->` markers, so the spec is only
// ever edited in one place.
const SPEC_MD = entry("../spec/SPEC.md");

function specMarkdown() {
  return {
    name: "semver-xyz:spec-markdown",
    transformIndexHtml: {
      order: "pre",
      handler(html) {
        if (!html.includes("<!-- spec:content -->")) return html;
        const { html: body, toc } = renderSpecFile(SPEC_MD);
        return html.replace("<!-- spec:toc -->", toc).replace("<!-- spec:content -->", body);
      },
    },
    configureServer(server) {
      server.watcher.add(SPEC_MD);
      server.watcher.on("change", (file) => {
        if (file === SPEC_MD) server.ws.send({ type: "full-reload" });
      });
    },
  };
}

// Static multi-page site served from the domain root (semver.xyz).
export default defineConfig({
  base: "/",
  plugins: [specMarkdown()],
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
        faq: entry("faq/index.html"),
        license: entry("license/index.html"),
        extensions: entry("extensions/index.html"),
        variants: entry("extensions/variants/index.html"),
        integrity: entry("extensions/integrity/index.html"),
        deplocks: entry("extensions/dependency-locks/index.html"),
      },
    },
  },
});
