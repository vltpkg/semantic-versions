"use server";

import { AffordancesError, defineAction } from "@affordances/next";
import { z } from "zod";
import { GRAMMAR_TEXT } from "@/lib/sources";
import grammar from "./state";

export const readGrammar = defineAction({
  name: "readGrammar",
  description: "Read one BNF grammar by file name, as listed in grammars (e.g. RANGE.bnf).",
  input: z.object({ file: z.string().min(1).describe("A file from grammars, such as VERSION.bnf") }),
  output: z.object({ file: z.string(), bnf: z.string() }),
  state: grammar,
  expose: "public",
  readOnly: true,
  run: ({ file }) => {
    const bnf = GRAMMAR_TEXT[file];
    if (bnf === undefined) throw new AffordancesError("not_found", `No grammar ${file}; see grammars for the files`);
    return { file, bnf };
  },
});
