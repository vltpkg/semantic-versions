"use server";

import { AffordancesError, defineAction } from "@affordances/next";
import { z } from "zod";
import { specSections } from "@/lib/render-spec";
import spec from "./state";

export const readSection = defineAction({
  name: "readSection",
  description: "Read one section of the Semantic Versions specification as Markdown, by the id listed in sections (e.g. precedence, ranges, build-channels).",
  input: z.object({ id: z.string().min(1).describe("A section id from sections") }),
  output: z.object({ id: z.string(), title: z.string(), markdown: z.string() }),
  state: spec,
  expose: "public",
  readOnly: true,
  run: ({ id }) => {
    const section = specSections().find((s) => s.id === id);
    if (!section) throw new AffordancesError("not_found", `No section ${id}; see sections for the ids`);
    return section;
  },
});
