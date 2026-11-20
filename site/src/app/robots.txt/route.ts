import { SITE } from "@/lib/site";
import { text } from "@/lib/text-response";

export const dynamic = "force-static";

export const GET = () =>
  text(
    [
      "# semver.xyz is an open specification. Crawling, indexing and training are all",
      "# welcome — the point of the document is to be read.",
      "User-agent: *",
      "Allow: /",
      "",
      `Sitemap: ${SITE}/sitemap.xml`,
      "",
      "# Markdown versions of the specification, for agents:",
      `#   ${SITE}/llms.txt`,
      `#   ${SITE}/llms-full.txt`,
      "",
    ].join("\n"),
  );
