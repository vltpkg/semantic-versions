/** Current published version of the specification, shown in the nav and footer. */
export const SPEC_VERSION = "1.0.0";

export const SITE = "https://semver.xyz";
export const REPO = "https://github.com/vltpkg/semantic-versions";

export type IconName = "spec" | "grammar" | "variants" | "integrity" | "locks" | "extensions";

export type MenuItem = { href: string; icon: IconName; title: string; desc?: string };

/** The Spec menu groups the specification with what is defined on top of it. */
export const SPEC_MENU = {
  label: "Spec",
  badge: SPEC_VERSION,
  featured: {
    href: "/spec/",
    icon: "spec",
    title: "Specification",
    desc: "Versions, precedence, sets, ranges and channels",
  } satisfies MenuItem,
  items: [
    { href: "/grammar/", icon: "grammar", title: "Grammar", desc: "BNF forms and the reference parser" },
    { href: "/extensions/variants/", icon: "variants", title: "Build Variants", desc: "Which artifact: os, arch and abi targets" },
    { href: "/extensions/integrity/", icon: "integrity", title: "Package Integrity", desc: "Which bytes: a digest in the version" },
    { href: "/extensions/dependency-locks/", icon: "locks", title: "Dependency Locks", desc: "Which graph: a pinned subgraph" },
  ] satisfies MenuItem[],
  footer: { href: "/extensions/", icon: "extensions", title: "All extensions" } satisfies MenuItem,
};

/**
 * Then the case for the spec, background, and the one action ("Try", a pill
 * next to the theme toggle and GitHub link).
 */
export const NAV: { href: string; label: string; cta?: boolean }[] = [
  { href: "/proposal/", label: "Proposal" },
  { href: "/libraries/", label: "Libraries" },
  { href: "/origin/", label: "History" },
  { href: "/faq/", label: "FAQ" },
  { href: "/selector/", label: "Try", cta: true },
];

export const SPEC_PATHS = [SPEC_MENU.featured.href, ...SPEC_MENU.items.map((i) => i.href), SPEC_MENU.footer.href];

/** Active-link state: a section link is active for every page beneath it. */
export function isActive(pathname: string, href: string): boolean {
  const path = pathname.replace(/index\.html$/, "");
  if (href === "/") return path === "/";
  return path.startsWith(href);
}

/** The extensions index is only current on itself, not on every extension. */
export function isCurrent(pathname: string, href: string): boolean {
  return isActive(pathname, href) && (href !== "/extensions/" || pathname.replace(/index\.html$/, "") === "/extensions/");
}
