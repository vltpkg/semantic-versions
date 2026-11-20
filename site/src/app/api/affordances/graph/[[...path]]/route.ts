import { manifest } from "@affordances/next/manifest";
import { createRouteHandler } from "@affordances/next/route";
import { SITE } from "@/lib/site";

/*
 * Every page's graph and actions (src/app/**{state,actions}.ts, collected
 * into .affordances/manifest.ts by withAffordances), plus the site index at
 * /.well-known/affordances.json, which also names the hosted MCP endpoint.
 */
export const GET = createRouteHandler({ manifest: { ...manifest!, mcp: `${SITE}/mcp` } });
export const POST = GET;
