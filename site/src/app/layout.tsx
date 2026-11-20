import { Analytics } from "@vercel/analytics/next";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { Agents } from "@/components/agents";
import { Footer } from "@/components/footer";
import { Nav } from "@/components/nav";
import { PageEffects } from "@/components/page-effects";
import { ThemeProvider } from "@/components/theme-provider";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  icons: { icon: { url: "/favicon.svg", type: "image/svg+xml" } },
};

/*
 * Every page: the header, the page's own <main>, the footer. The chrome is
 * the layout's, so a navigation re-renders the page and nothing else. The
 * Agents provider gives browser agents the page's Affordances graph.
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* The Markdown index of the site, for agents (also the llms.txt convention). */}
        <link rel="describedby" type="text/markdown" href="/llms.txt" />
      </head>
      <body>
        <ThemeProvider>
          <Agents>
            <Nav />
            {children}
            <Footer />
            <PageEffects />
          </Agents>
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  );
}
