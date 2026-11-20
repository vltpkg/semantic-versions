/** The extensions, in layering order, as the index and each extension's graph list them. */
export const EXTENSIONS = [
  {
    id: "variants",
    title: "Build Variants",
    url: "/extensions/variants/",
    markdown: "/extensions/variants/variants.md",
    grammar: "/spec/VARIANTS.bnf",
    summary: "Which artifact: os, arch, abi and feature coordinates carried as build metadata, e.g. 1.0.0+linux.x64.musl, so one version can address a target matrix and a range can select a channel of it.",
  },
  {
    id: "integrity",
    title: "Package Integrity",
    url: "/extensions/integrity/",
    markdown: "/extensions/integrity/integrity.md",
    grammar: "/spec/INTEGRITY.bnf",
    summary: "Which bytes: a content-addressable digest carried in the version, e.g. 1.0.0+sha512.<hex>, pinning the exact artifact.",
  },
  {
    id: "dependency-locks",
    title: "Dependency Locks",
    url: "/extensions/dependency-locks/",
    markdown: "/extensions/dependency-locks/dependency-locks.md",
    specification: "/extensions/dependency-locks/dependency-locks-spec.md",
    summary: "Which graph: a resolved transitive subgraph attached to a version as +lock.<payload>, whose nodes are variant- and integrity-qualified identities.",
  },
] as const;

export type Extension = (typeof EXTENSIONS)[number];

export const extension = (id: Extension["id"]): Extension => EXTENSIONS.find((e) => e.id === id)!;
