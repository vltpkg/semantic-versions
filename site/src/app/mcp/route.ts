import { createClient, describeSite } from "@affordances/mcp";
import type { McpServer } from "@modelcontextprotocol/server";
import { createMcpHandler } from "mcp-handler";
import { z } from "zod";
import { GET as graph, POST as callAction } from "@/app/api/affordances/graph/[[...path]]/route";
import { SITE, SPEC_VERSION } from "@/lib/site";

/*
 * The site as an MCP server (streamable HTTP, stateless, no auth): the same
 * two tools `npx @affordances/mcp https://semver.xyz` gives a client, served
 * here so an MCP client can connect by URL. `affordances_open` reads a
 * page's graph and `affordances_call` calls one of its actions; the server's
 * instructions list every route and action signature up front. Requests go
 * to the Affordances handler in-process, never back out over the network.
 */
const local: typeof fetch = async (input, init) => {
  const request = new Request(input, init);
  return request.method === "POST" ? callAction(request) : graph(request);
};

const site = createClient(SITE, { fetch: local });

const text = (value: unknown) => ({ content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }] });
const failure = (error: unknown) => ({ isError: true, content: [{ type: "text" as const, text: (error as Error).message }] });

const register = (server: McpServer) => {
  server.registerTool(
    "affordances_open",
    {
      title: "Open a page",
      description: `Read a page on ${SITE}: its entities (what the page shows), actions (what you can do there, with input schemas) and nav (where to go next). Start at "/" or "/selector/".`,
      inputSchema: { path: z.string().describe("A path on the site, e.g. /spec/ or /selector/") },
      annotations: { readOnlyHint: true },
    },
    async ({ path }) => site.open(path).then(text, failure),
  );
  server.registerTool(
    "affordances_call",
    {
      title: "Call an action",
      description: `Call an action from a page's graph on ${SITE}. Every action here is public and read-only: select, desugar, parse, compare and bump on /selector/; readSection on /spec/; readGrammar on /grammar/. Returns the action's output.`,
      inputSchema: {
        path: z.string().describe("The page the action is on, e.g. /selector/"),
        action: z.string(),
        input: z.record(z.string(), z.unknown()).optional(),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ path, action, input }) => site.call(path, action, input ?? {}).then(text, failure),
  );
};

let instructions: Promise<string> | undefined;

const handler = async (request: Request) => {
  instructions ??= site.index().then(describeSite);
  return createMcpHandler(register, {
    serverInfo: { name: "Semantic Versions", version: SPEC_VERSION },
    instructions: await instructions,
  })(request);
};

export { handler as GET, handler as POST, handler as DELETE };
