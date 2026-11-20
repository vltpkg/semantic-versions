/** A static text file, prerendered at build time. */
export const text = (body: string, type = "text/plain; charset=utf-8") =>
  new Response(body, { headers: { "content-type": type, "cache-control": "public, max-age=0, must-revalidate" } });

export const markdown = (body: string) => text(body, "text/markdown; charset=utf-8");
