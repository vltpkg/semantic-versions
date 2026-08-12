import { defineConfig } from "vite";
import { fileURLToPath, URL } from "node:url";

const entry = (p) => fileURLToPath(new URL(p, import.meta.url));

// Static multi-page site served from the domain root (semver.xyz).
export default defineConfig({
  base: "/",
  build: {
    target: "es2020",
    cssMinify: true,
    rollupOptions: {
      input: {
        home: entry("index.html"),
        spec: entry("spec/index.html"),
        selector: entry("selector/index.html"),
        grammar: entry("grammar/index.html"),
        origin: entry("origin/index.html"),
        license: entry("license/index.html"),
        extensions: entry("extensions/index.html"),
        deplocks: entry("extensions/dependency-locks/index.html"),
        integrity: entry("extensions/integrity/index.html"),
        variants: entry("extensions/variants/index.html"),
      },
    },
  },
});
