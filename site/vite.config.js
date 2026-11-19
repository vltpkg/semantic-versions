import { defineConfig } from "vite";
import { fileURLToPath, URL } from "node:url";
import { readFileSync, existsSync } from "node:fs";
import { renderSpecFile } from "./scripts/render-spec.mjs";
import { toolCardsHtml, overviewHtml, toolSectionsHtml, conformanceTotal, heroLanguagesHtml } from "../benchmarks/render.mjs";
import { LANGUAGES } from "../benchmarks/languages.mjs";
import { ICONS } from "../benchmarks/icons.mjs";

const entry = (p) => fileURLToPath(new URL(p, import.meta.url));

// The canonical specification. Rendered into spec/index.html at the
// `<!-- spec:toc -->` and `<!-- spec:content -->` markers, so the spec is only
// ever edited in one place.
const SPEC_MD = entry("../spec/SPEC.md");

// Benchmark and conformance results (benchmarks/results/<language>.json) for
// every implementation in benchmarks/languages.mjs, rendered into
// libraries/index.html at `<!-- libraries:cards|overview|sections|languages|cases -->`
// markers with the same renderer the READMEs use, and the language marks into
// the home page at `<!-- libraries:hero -->`.
const RESULTS_DIR = entry("../benchmarks/results/");

function benchmarkTables() {
  const load = () => {
    const results = {};
    for (const l of LANGUAGES) {
      const file = `${RESULTS_DIR}${l.id}.json`;
      if (existsSync(file)) results[l.id] = JSON.parse(readFileSync(file, "utf8"));
    }
    return results;
  };
  return {
    name: "semver-xyz:benchmark-tables",
    transformIndexHtml: {
      order: "pre",
      handler(html) {
        if (!html.includes("<!-- libraries:")) return html;
        const results = load();
        const listed = LANGUAGES.filter((l) => results[l.id]);
        const cases = listed.length ? conformanceTotal(results[listed[0].id]).total : 0;
        return html.replace(/<!-- libraries:(cards|overview|sections|languages|cases|hero) -->/g, (_, what) => {
          if (what === "hero") return heroLanguagesHtml(LANGUAGES, ICONS);
          if (what === "cards") return toolCardsHtml(LANGUAGES, results, ICONS);
          if (what === "overview") return overviewHtml(LANGUAGES, results, ICONS);
          if (what === "sections") return toolSectionsHtml(LANGUAGES, results, ICONS);
          if (what === "languages") return String(listed.length);
          return String(cases);
        });
      },
    },
    configureServer(server) {
      server.watcher.add(RESULTS_DIR);
      server.watcher.on("change", (file) => {
        if (file.startsWith(RESULTS_DIR) || file.includes("/benchmarks/")) server.ws.send({ type: "full-reload" });
      });
    },
  };
}

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
  plugins: [specMarkdown(), benchmarkTables()],
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
        libraries: entry("libraries/index.html"),
        license: entry("license/index.html"),
        extensions: entry("extensions/index.html"),
        variants: entry("extensions/variants/index.html"),
        integrity: entry("extensions/integrity/index.html"),
        deplocks: entry("extensions/dependency-locks/index.html"),
      },
    },
  },
});
