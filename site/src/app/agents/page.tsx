import type { Metadata } from "next";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "For agents: semver.xyz without a browser · semver.xyz",
  alternates: { canonical: "/agents/" },
  description:
    "How to read and use semver.xyz without a browser: llms.txt, every page as Markdown, the Affordances graph with actions that run the reference parser, and MCP.",
};

const CURL = {
  graph: `curl -H 'Accept: application/vnd.affordances+json' ${SITE}/selector/`,
  call: `curl ${SITE}/selector/ \\
  -H 'Content-Type: application/vnd.affordances+json' \\
  -d '{"action":"select","input":{"range":"^1.0.0-rc","versions":["1.0.0-beta.2","1.0.0-rc.1","1.0.0","1.0.0+build.7"]}}'`,
  mcp: `npx @affordances/mcp ${SITE}`,
};

function Snippet({ title, code }: { title: string; code: string }) {
  return (
    <div className="code-window" data-copy="">
      <div className="code-bar">
        <span className="code-title">{title}</span>
        <button className="copy-btn" type="button" aria-label="Copy">
          Copy
        </button>
      </div>
      <pre className="code">
        <code>{code}</code>
      </pre>
    </div>
  );
}

export default function Page() {
  return (
    <main>
      <section className="page-hero reveal">
        <p className="eyebrow">For agents</p>
        <h1>
          Readable <span className="grad">without a browser.</span>
        </h1>
        <p className="lead">
          Everything on this site answers in text. Start from <a href="/llms.txt">llms.txt</a>, read any page as
          Markdown, or ask a page for its graph: what it shows, what can be done there, and where to go next. The
          graph is <a href="https://www.affordances.sh" target="_blank" rel="noopener">Affordances</a>, and its
          actions run the same reference parser the <a href="/selector/">range selector</a> does, so an agent can test
          a range, desugar it or order versions by precedence with one request.
        </p>
      </section>

      <section className="wrap">
        <div className="grid features home-cards agent-cards">
          <a className="card reveal" href="/llms.txt">
            <span className="card-kicker">INDEX</span>
            <h3>llms.txt</h3>
            <p>
              The normative Markdown first (the specification, the extensions, the grammars), then every page. Read it
              before anything else. <code>llms-full.txt</code> is the core text in one file.
            </p>
            <div className="card-arrow">Open →</div>
          </a>
          <a className="card reveal" href="/spec/SPEC.md">
            <span className="card-kicker">MARKDOWN</span>
            <h3>Every page as Markdown</h3>
            <p>
              Add <code>.md</code> to any page&rsquo;s path (<code>/faq.md</code>), or request it with{" "}
              <code>Accept: text/markdown</code>. The specification itself is served as written at{" "}
              <code>/spec/SPEC.md</code>.
            </p>
            <div className="card-arrow">Read the spec →</div>
          </a>
          <a className="card reveal" href="/.well-known/affordances.json">
            <span className="card-kicker">GRAPH</span>
            <h3>The Affordances graph</h3>
            <p>
              Ask any page with <code>Accept: application/vnd.affordances+json</code>. The selector&rsquo;s graph has{" "}
              <code>select</code>, <code>desugar</code>, <code>parse</code>, <code>compare</code> and{" "}
              <code>bump</code>; the spec&rsquo;s has <code>readSection</code>; the grammars&rsquo; has{" "}
              <code>readGrammar</code>.
            </p>
            <div className="card-arrow">Site index →</div>
          </a>
          <a className="card reveal" href="https://www.affordances.sh/docs/guides/mcp" target="_blank" rel="noopener">
            <span className="card-kicker">MCP</span>
            <h3>Connect an MCP client</h3>
            <p>
              <code>@affordances/mcp</code> serves this site to Claude, Cursor and other MCP clients as two tools:
              open a page, call an action. No token is needed; every action here is public and read-only.
            </p>
            <div className="card-arrow">How →</div>
          </a>
        </div>
      </section>

      <section className="wrap">
        <div className="section-head left reveal">
          <p className="eyebrow">Try it</p>
          <h2 className="section-title big">Three requests.</h2>
          <p className="lead">
            The graph of the range selector, one call to its <code>select</code> action, and the MCP server. Each
            answers with JSON; the Markdown twins answer with text.
          </p>
        </div>
        <div className="snippets reveal">
          <Snippet title="read a page's graph" code={CURL.graph} />
          <Snippet title="call an action" code={CURL.call} />
          <Snippet title="serve the site to an MCP client" code={CURL.mcp} />
        </div>
      </section>

      <section className="wrap">
        <div className="doc-status reveal">
          <p className="eyebrow">What an agent can rely on</p>
          <p>
            Every action is <code>public</code> and <code>readOnly</code>: nothing here changes state, needs a session
            or asks for confirmation. The graphs and the Markdown are generated from the same sources as the pages
            (<code>spec/SPEC.md</code>, the extension Markdown, <code>benchmarks/results</code>), so they never
            disagree with what a person sees. Where a page and its Markdown could differ, the Markdown governs; the
            specification&rsquo;s text is normative.
          </p>
        </div>
      </section>
    </main>
  );
}
