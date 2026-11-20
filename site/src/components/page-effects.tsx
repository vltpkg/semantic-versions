"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

/*
 * The behaviours every page shares, attached after each navigation and torn
 * down before the next: scroll-reveal animation, copy buttons on code
 * windows, hover-revealed heading anchors, and the table-of-contents
 * highlight. Content stays plain markup; only these effects are scripted.
 */
export function PageEffects() {
  const pathname = usePathname();
  useEffect(() => {
    const cleanups = [initReveal(), initCopy(), initHeadingAnchors(), initTOC()];
    return () => cleanups.forEach((fn) => fn());
  }, [pathname]);
  return null;
}

type Cleanup = () => void;

function initReveal(): Cleanup {
  const els = document.querySelectorAll(".reveal");
  if (!els.length) return () => {};
  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add("in");
          io.unobserve(entry.target);
        }
      }
    },
    { threshold: 0.12, rootMargin: "0px 0px -40px 0px" },
  );
  els.forEach((el) => io.observe(el));
  return () => io.disconnect();
}

function initCopy(): Cleanup {
  const offs: Cleanup[] = [];
  document.querySelectorAll<HTMLElement>("[data-copy]").forEach((win) => {
    const btn = win.querySelector<HTMLButtonElement>(".copy-btn");
    const code = win.querySelector<HTMLElement>("code, pre");
    if (!btn || !code) return;
    const onClick = async () => {
      try {
        await navigator.clipboard.writeText(code.innerText.trim());
        const prev = btn.textContent;
        btn.textContent = "Copied";
        btn.classList.add("copied");
        setTimeout(() => {
          btn.textContent = prev;
          btn.classList.remove("copied");
        }, 1400);
      } catch {
        btn.textContent = "Press ⌘C";
      }
    };
    btn.addEventListener("click", onClick);
    offs.push(() => btn.removeEventListener("click", onClick));
  });
  return () => offs.forEach((fn) => fn());
}

const ANCHOR_ICON =
  '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6.5 9.5a2.5 2.5 0 0 0 3.6.06l2.4-2.4a2.55 2.55 0 0 0-3.6-3.6l-1.1 1.1"/><path d="M9.5 6.5a2.5 2.5 0 0 0-3.6-.06l-2.4 2.4a2.55 2.55 0 0 0 3.6 3.6l1.1-1.1"/></svg>';

function slugify(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .split("-")
    .slice(0, 7)
    .join("-");
}

/*
 * Turn key headings into linkable anchors: assign a stable id where missing
 * and append a hover-revealed link that copies a deep link to the clipboard.
 */
function initHeadingAnchors(): Cleanup {
  const added: HTMLElement[] = [];
  const heads = document.querySelectorAll<HTMLElement>(".doc h2, .doc h3, .doc h4, .section-title, h2[id], h3[id]");
  heads.forEach((h) => {
    if (h.querySelector(".anchor-link")) return;
    let id = h.id;
    if (!id) {
      const base = slugify(h.textContent ?? "") || "section";
      id = base;
      let n = 1;
      while (document.getElementById(id)) id = `${base}-${++n}`;
      h.id = id;
    }
    h.classList.add("has-anchor");
    const a = document.createElement("a");
    a.className = "anchor-link";
    a.href = `#${id}`;
    a.setAttribute("aria-label", `Link to “${(h.textContent ?? "").trim()}”`);
    a.innerHTML = ANCHOR_ICON;
    a.addEventListener("click", () => {
      const url = `${location.origin}${location.pathname}#${id}`;
      navigator.clipboard?.writeText(url).then(
        () => {
          a.classList.add("copied");
          setTimeout(() => a.classList.remove("copied"), 1200);
        },
        () => {},
      );
    });
    h.appendChild(a);
    added.push(a);
  });
  return () => {
    for (const a of added) {
      a.parentElement?.classList.remove("has-anchor");
      a.remove();
    }
  };
}

/** Highlight the table-of-contents entry for the section currently in view. */
function initTOC(): Cleanup {
  const links = [...document.querySelectorAll<HTMLAnchorElement>(".toc a")];
  if (!links.length) return () => {};
  const byId = new Map(links.map((a) => [(a.getAttribute("href") ?? "").slice(1), a]));
  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          links.forEach((a) => a.classList.remove("active"));
          const a = byId.get(entry.target.id);
          if (a) a.classList.add("active");
        }
      }
    },
    { rootMargin: "-80px 0px -70% 0px" },
  );
  byId.forEach((_a, id) => {
    const el = document.getElementById(id);
    if (el) io.observe(el);
  });
  return () => io.disconnect();
}
