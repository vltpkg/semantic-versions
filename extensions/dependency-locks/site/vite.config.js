import { defineConfig } from "vite";

// Static marketing site. Relative base so it can be hosted from any sub-path
// (GitHub Pages project sites, S3 prefixes, etc.).
export default defineConfig({
  base: "./",
  build: {
    target: "es2020",
    cssMinify: true,
  },
});
