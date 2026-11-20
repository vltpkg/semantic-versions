import { docByUrl, renderDoc } from "@/lib/corpus";
import { markdown } from "@/lib/text-response";

export const dynamic = "force-static";

/** The canonical Markdown, mirrored from the repository with its links rewritten for the site. */
export const GET = () => markdown(renderDoc(docByUrl("/extensions/dependency-locks/dependency-locks.md")!));
