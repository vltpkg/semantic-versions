import type { ReactNode } from "react";

/*
 * Lightweight BNF syntax highlighting: colour nonterminals, quoted literals
 * and operators, rendered on the server so the markup is final before any
 * script runs. The first nonterminal on a line, before its `::=`, is the one
 * being defined.
 */
const TOKEN = /(<[^>\n]+>)|("(?:[^"\\]|\\.)*")|(::=|\||\(|\)|\*|\+|\?|\[|\])/g;

function highlight(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let atLineStart = true;
  let seenDef = false;
  let m: RegExpExecArray | null;
  TOKEN.lastIndex = 0;
  while ((m = TOKEN.exec(text))) {
    const between = text.slice(last, m.index);
    if (between) out.push(between);
    if (/\n/.test(between)) {
      atLineStart = true;
      seenDef = false;
    } else if (between.trim() !== "") {
      atLineStart = false;
    }
    const key = out.length;
    if (m[1]) {
      const cls = atLineStart && !seenDef ? "tok-def" : "tok-ref";
      if (cls === "tok-def") seenDef = true;
      out.push(<span key={key} className={cls}>{m[1]}</span>);
    } else if (m[2]) {
      out.push(<span key={key} className="lit">{m[2]}</span>);
    } else {
      if (m[3] === "::=") seenDef = true;
      out.push(<span key={key} className="op">{m[3]}</span>);
    }
    atLineStart = false;
    last = TOKEN.lastIndex;
  }
  out.push(text.slice(last));
  return out;
}

/** A `<pre class="bnf">` block, with the copy button the static site gave it. */
export function Bnf({ children, copy }: { children: string; copy?: boolean }) {
  return (
    <pre className="bnf" data-copy={copy ? "" : undefined}>
      {copy ? (
        <button className="copy-btn" type="button" aria-label="Copy">
          Copy
        </button>
      ) : null}
      <code data-hl="1">{highlight(children)}</code>
    </pre>
  );
}
