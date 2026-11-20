import { llmsFullTxt } from "@/lib/corpus";
import { text } from "@/lib/text-response";

export const dynamic = "force-static";

export const GET = () => text(llmsFullTxt());
