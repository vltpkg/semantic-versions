"use client";

import { AffordancesProvider } from "@affordances/react";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/*
 * Affordances in the browser: the provider loads the current page's graph
 * and registers each of its actions as a WebMCP tool, so an agent running in
 * the visitor's tab can test ranges or read the spec through the same
 * handler a headless agent uses. Every action here is read-only, so there
 * is nothing to refresh after a call.
 */
export function Agents({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return <AffordancesProvider path={pathname}>{children}</AffordancesProvider>;
}
