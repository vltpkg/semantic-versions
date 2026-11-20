import { Analytics } from "@vercel/analytics/next";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
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
 * the layout's, so a navigation re-renders the page and nothing else.
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
          <Nav />
          {children}
          <Footer />
          <PageEffects />
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  );
}
