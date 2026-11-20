"use client";

import { mdPath, openInHrefs, usePageMarkdown } from "@affordances/md/react/client";
import { useEffect, useRef, useState } from "react";
import {
  AlertIcon,
  CheckIcon,
  Chevron,
  ClaudeMark,
  CopyIcon,
  MarkdownMark,
  OpenAIMark,
  TerminalIcon,
} from "@/components/icons";

/*
 * Copy Page and Open in, as docs.vlt.io has them: a split pill in the page
 * hero. The button copies the page's Markdown twin (/spec.md, what an agent
 * reading the URL gets); the menu views it, or opens a chat in Claude,
 * ChatGPT or Claude Code already reading it. Left out of the Markdown twin
 * itself (data-affordances-md="skip").
 */
export function PageActions({
  path,
  prompt,
  claudeCode,
}: {
  /** The page's path, with its trailing slash: /spec/. */
  path: string;
  /** What the chat should do with the page; it gets the twin's URL appended. */
  prompt?: string;
  /** The same for Claude Code, which starts in the home directory. */
  claudeCode?: string;
}) {
  const { load, preload } = usePageMarkdown(path);
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  const [open, setOpen] = useState(false);
  const [origin, setOrigin] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // The chat links need an absolute URL for the twin; the origin is only known in the browser.
  useEffect(() => setOrigin(window.location.origin), []);

  useEffect(() => {
    if (state === "idle") return;
    const t = setTimeout(() => setState("idle"), 1600);
    return () => clearTimeout(t);
  }, [state]);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, [open]);

  const copy = () => {
    load().then(
      (markdown) =>
        navigator.clipboard.writeText(markdown).then(
          () => setState("copied"),
          () => setState("failed"),
        ),
      () => setState("failed"),
    );
  };

  const twin = mdPath(path);
  const md = origin ? `${origin}${twin}` : twin;
  const links = openInHrefs({
    prompt: `${prompt ?? "Read this page from semver.xyz, the Semantic Versions specification site, so I can ask questions about it:"} ${md}`,
    claudeCode: `${claudeCode ?? "Read this page from semver.xyz, the Semantic Versions specification site. Before changing anything, ask me which project to work in:"} ${md}`,
  });

  return (
    <div className="page-actions" data-affordances-md="skip" ref={ref}>
      <button
        className={`page-copy${state !== "idle" ? ` ${state}` : ""}`}
        type="button"
        onPointerEnter={preload}
        onFocus={preload}
        onClick={copy}
        aria-label="Copy this page as Markdown"
      >
        {state === "failed" ? <AlertIcon /> : state === "copied" ? <CheckIcon /> : <CopyIcon />}
        <span>Copy page</span>
        <span aria-live="polite" className="sr-only">
          {state === "copied" ? "Copied" : state === "failed" ? "Failed to copy the page" : ""}
        </span>
      </button>
      <button
        ref={triggerRef}
        className="page-more"
        type="button"
        aria-label="More page actions"
        aria-expanded={open}
        aria-controls="page-actions-menu"
        onClick={() => setOpen(!open)}
        onKeyDown={(e) => {
          if (e.key === "Escape" && open) setOpen(false);
        }}
      >
        <Chevron />
      </button>
      <div
        className="page-panel"
        id="page-actions-menu"
        hidden={!open}
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
        <a className="page-item" href={twin} target="_blank" rel="noopener">
          <MarkdownMark />
          View as Markdown
        </a>
        <div className="page-sep" role="separator" />
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
    </div>
  );
}
