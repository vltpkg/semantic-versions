import parse from "html-react-parser";
import { renderSpecFile } from "@/lib/render-spec";

/*
 * The specification, rendered from spec/SPEC.md at build time. The page hero
 * carries the title; the article carries everything under it.
 */
export function SpecToc() {
  const { toc } = renderSpecFile();
  return (
    <>
      {toc.map(({ id, label }) => (
        <a key={id} href={`#${id}`}>
          {label}
        </a>
      ))}
    </>
  );
}

export function SpecBody() {
  const { html } = renderSpecFile();
  return <>{parse(html)}</>;
}
