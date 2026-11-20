import { PAGES, lastModified } from "@/lib/corpus";
import { SITE } from "@/lib/site";
import { text } from "@/lib/text-response";

export const dynamic = "force-static";

export const GET = () =>
  text(
    [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
      ...PAGES.map(([url]) => ["  <url>", `    <loc>${SITE}${url}</loc>`, `    <lastmod>${lastModified(url)}</lastmod>`, "  </url>"].join("\n")),
      "</urlset>",
      "",
    ].join("\n"),
    "application/xml; charset=utf-8",
  );
