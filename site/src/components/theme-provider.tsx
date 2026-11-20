"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ReactNode } from "react";

/*
 * Light or dark, as `data-theme` on <html>, applied before first paint so a
 * returning visitor never flashes. `semver-xyz.theme` is the key the static
 * site used, so an earlier choice carries over. Visitors without a choice get
 * their OS preference; the stylesheet's own `prefers-color-scheme` fallback
 * covers them until the attribute lands. The stylesheet sets `color-scheme`
 * itself, so the provider does not.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemesProvider attribute="data-theme" storageKey="semver-xyz.theme" defaultTheme="system" enableSystem enableColorScheme={false}>
      {children}
    </NextThemesProvider>
  );
}
