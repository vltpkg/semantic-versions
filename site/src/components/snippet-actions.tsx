"use client";

import { mdPath, openInHrefs } from "@affordances/md/react/client";
import { useEffect, useRef, useState } from "react";
import { Chevron, ClaudeMark, OpenAIMark, TerminalIcon } from "@/components/icons";

/*
 * Open in, for one code window: a chevron beside its Copy button whose menu
 * opens Claude, ChatGPT or Claude Code with the snippet and what to do with
 * it. Mounted into every [data-copy] window after the page renders
 * (components/page-effects.tsx), since the windows are plain markup.
 */
export type Snippet = {
  /** The snippet's text. */
  code: string;
  /** The window's label, e.g. "anatomy of a version" or "RANGE.bnf". */
  title: string;
  /** An install command for one of the libraries, a grammar, or any other snippet. */
  kind: "install" | "grammar" | "snippet";
  /** The library's language, for an install command. */
  language?: string;
};

// claude-cli://open takes 5,000 characters; past this the prompt links the page instead of pasting the snippet
const INLINE_MAX = 3000;

const prompts = ({ code, title, kind, language }: Snippet) => {
  const page = `${window.location.origin}${mdPath(window.location.pathname)}`;
  if (kind === "install") {
    const use = `then show me how to parse, compare and match versions with it. The library's page and README are linked from ${page}.`;
    return {
      prompt: `Add the Semantic Versions library for ${language} to my project: run \`${code}\`, ${use}`,
      claudeCode: `Ask me which project to work in, then add the Semantic Versions library for ${language} to it with \`${code}\` and ${use}`,
    };
  }
  const what = kind === "grammar" ? `the ${title} grammar` : `the "${title}" snippet`;
  const ask = kind === "grammar" ? "Explain it, and help me implement a parser for it." : "Explain it and help me use it.";
  const body =
    code.length > INLINE_MAX
      ? `Read ${what} in ${page}, from Semantic Versions (semver.xyz). ${ask}`
      : `From Semantic Versions (semver.xyz, ${page}), ${what}:\n\n\`\`\`${kind === "grammar" ? "bnf" : ""}\n${code}\n\`\`\`\n\n${ask}`;
  return { prompt: body, claudeCode: `${body} Before changing anything, ask me which project to work in.` };
};

export function SnippetActions(snippet: Snippet) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, [open]);

  // Built when the menu opens: the prompts need the page's origin, known only in the browser.
  const links = open ? openInHrefs(prompts(snippet)) : null;

  return (
    <div className="code-actions" ref={ref}>
      <button
        ref={triggerRef}
        className="copy-btn code-more"
        type="button"
        aria-label="Open this snippet in a chat"
        title="Open in Claude, ChatGPT or Claude Code"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        onKeyDown={(e) => {
          if (e.key === "Escape" && open) setOpen(false);
        }}
      >
        <Chevron />
      </button>
      {links ? (
        <div
          className="page-panel code-panel"
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setOpen(false);
              triggerRef.current?.focus();
            }
          }}
          onBlur={(e) => {
            if (!ref.current?.contains(e.relatedTarget as Node | null)) setOpen(false);
          }}
        >
          <a className="page-item" href={links.claude} target="_blank" rel="noopener noreferrer">
            <ClaudeMark />
            Open in Claude
          </a>
          <a className="page-item" href={links.chatgpt} target="_blank" rel="noopener noreferrer">
            <OpenAIMark />
            Open in ChatGPT
          </a>
          <a className="page-item" href={links.claudeCode}>
            <TerminalIcon />
            Open in Claude Code
          </a>
        </div>
      ) : null}
    </div>
  );
}
