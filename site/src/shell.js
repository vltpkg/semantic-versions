// Shared chrome for every page: nav + footer injection, active-link state,
// scroll-reveal animation, and copy buttons. Content lives in each page's HTML;
// only the surrounding chrome is rendered here so it stays consistent.

// Current published version of the specification, shown in the nav and footer.
const SPEC_VERSION = "1.0.0";

const NAV = [
  { href: "/spec/", label: "Spec", badge: SPEC_VERSION },
  { href: "/extensions/", label: "Extensions" },
  { href: "/grammar/", label: "Grammar" },
  { href: "/selector/", label: "Try" },
  { href: "/proposal/", label: "Proposal" },
  { href: "/origin/", label: "History" },
  { href: "/faq/", label: "FAQ" },
];

// Apply a previously chosen theme as early as possible (visitors without an
// explicit choice fall through to the CSS `prefers-color-scheme` default, so
// they never flash). Runs at module load, before the chrome is mounted.
try {
  const saved = localStorage.getItem("semver-xyz.theme");
  if (saved === "dark" || saved === "light") {
    document.documentElement.setAttribute("data-theme", saved);
  }
} catch {
  /* storage may be unavailable; non-fatal */
}

const THEME_TOGGLE = `
      <button class="theme-toggle" type="button" aria-label="Toggle color theme" title="Toggle color theme">
        <svg class="icon-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>
        <svg class="icon-moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>
      </button>`;

const VLT_MARK = `<svg class="footer-mark" viewBox="0 0 24 24" fill="currentColor" aria-label="vlt" role="img"><path d="M8.66659 6.33329C8.66659 6.68925 8.61079 7.03216 8.50747 7.35379C8.21694 8.2582 7.99884 9.28798 8.47332 10.1109L10.6593 13.9022C10.9243 14.3618 11.4692 14.5626 11.9997 14.5626C12.5304 14.5626 13.0755 14.3617 13.3406 13.902L15.5265 10.1108C16.001 9.28787 15.7829 8.25813 15.4924 7.35374C15.389 7.03215 15.3333 6.68925 15.3333 6.33332C15.3333 4.49239 16.8257 3.00003 18.6666 3.00003C20.5075 3.00003 21.9999 4.49239 21.9999 6.33332C21.9999 8.17424 20.5075 9.66661 18.6666 9.66661C18.1358 9.66661 17.5906 9.86748 17.3254 10.3273L15.1397 14.1182C14.6652 14.9411 14.8834 15.971 15.1739 16.8754C15.2772 17.197 15.333 17.54 15.333 17.8959C15.333 19.7368 13.8406 21.2292 11.9997 21.2292C10.1588 21.2292 8.66644 19.7368 8.66644 17.8959C8.66644 17.5399 8.72226 17.1969 8.8256 16.8752C9.1162 15.9708 9.33437 14.9409 8.85984 14.1179L6.67422 10.3272C6.40911 9.86744 5.86403 9.66659 5.33329 9.66659C3.49237 9.66659 2 8.17422 2 6.33329C2 4.49237 3.49237 3 5.33329 3C7.17422 3 8.66659 4.49237 8.66659 6.33329Z" /></svg>`;

const GITHUB_MARK = `<svg class="icon-github" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.63 7.63 0 0 1 2-.27c.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z"/></svg>`;

const MENU_ICON = `
      <svg class="icon-menu" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M3 6h18M3 12h18M3 18h18"/></svg>
      <svg class="icon-close" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>`;

function isActive(href) {
  const path = location.pathname.replace(/index\.html$/, "");
  if (href === "/") return path === "/";
  return path.startsWith(href);
}

function renderNav() {
  const links = NAV.map(
    (n) =>
      `<a href="${n.href}"${isActive(n.href) ? ' class="active"' : ""}>${n.label}${
        n.badge ? ` <span class="nav-ver" aria-label="version ${n.badge}">${n.badge}</span>` : ""
      }</a>`,
  ).join("");

  return `
    <header class="nav">
      <a class="brand" href="/" aria-label="semver.xyz home">
        <span class="brand-word"><span class="brand-name">semver</span><span class="brand-tld">.xyz</span></span>
      </a>
      <nav class="nav-links">
        ${links}
        ${THEME_TOGGLE}
        <a href="https://github.com/vltpkg/semantic-versions" class="nav-cta nav-cta-icon" target="_blank" rel="noopener" aria-label="GitHub repository" title="GitHub repository">${GITHUB_MARK}</a>
        <button class="nav-toggle" type="button" aria-label="Open menu" aria-expanded="false" aria-controls="mobile-nav">${MENU_ICON}</button>
      </nav>
      <div class="mobile-nav" id="mobile-nav" hidden>
        ${links}
      </div>
    </header>`;
}

function renderFooter() {
  return `
    <footer class="footer">
      <div class="wrap footer-inner">
        <a class="footer-brand" href="https://www.vlt.io" target="_blank" rel="noopener">
          ${VLT_MARK}
          <span>A specification stewarded by vlt</span>
        </a>
        <span class="footer-meta">
          <span class="footer-ver">Semantic Versions ${SPEC_VERSION}</span>
          <a class="footer-link" href="/license/">License: CC BY 3.0</a>
          <a class="footer-link" href="https://github.com/vltpkg/semantic-versions" target="_blank" rel="noopener">GitHub</a>
        </span>
      </div>
    </footer>`;
}

function mountChrome() {
  const navSlot = document.querySelector("[data-nav]");
  if (navSlot) navSlot.outerHTML = renderNav();
  else document.body.insertAdjacentHTML("afterbegin", renderNav());

  const footSlot = document.querySelector("[data-footer]");
  if (footSlot) footSlot.outerHTML = renderFooter();
  else document.body.insertAdjacentHTML("beforeend", renderFooter());
}

function initReveal() {
  const els = document.querySelectorAll(".reveal");
  if (!els.length) return;
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
}

function initCopy() {
  document.querySelectorAll("[data-copy]").forEach((win) => {
    const btn = win.querySelector(".copy-btn");
    const code = win.querySelector("code, pre");
    if (!btn || !code) return;
    btn.addEventListener("click", async () => {
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
    });
  });
}

// Turn key headings into linkable anchors: assign a stable id where missing and
// append a hover-revealed link that copies a deep link to the clipboard.
const ANCHOR_ICON = `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6.5 9.5a2.5 2.5 0 0 0 3.6.06l2.4-2.4a2.55 2.55 0 0 0-3.6-3.6l-1.1 1.1"/><path d="M9.5 6.5a2.5 2.5 0 0 0-3.6-.06l-2.4 2.4a2.55 2.55 0 0 0 3.6 3.6l1.1-1.1"/></svg>`;

function slugify(text) {
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

function initHeadingAnchors() {
  const heads = document.querySelectorAll(
    ".doc h2, .doc h3, .doc h4, .section-title, h2[id], h3[id]",
  );
  heads.forEach((h) => {
    if (h.querySelector(".anchor-link")) return;

    let id = h.id;
    if (!id) {
      const base = slugify(h.textContent) || "section";
      id = base;
      let n = 1;
      while (document.getElementById(id)) id = `${base}-${++n}`;
      h.id = id;
    }

    h.classList.add("has-anchor");
    const a = document.createElement("a");
    a.className = "anchor-link";
    a.href = `#${id}`;
    a.setAttribute("aria-label", `Link to “${h.textContent.trim()}”`);
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
  });
}

// Lightweight BNF syntax highlighting: colour nonterminals, quoted literals and
// operators without hand-wrapping every token in the markup.
function initBnf() {
  const esc = (s) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const re = /(<[^>\n]+>)|("(?:[^"\\]|\\.)*")|(::=|\||\(|\)|\*|\+|\?|\[|\])/g;

  document.querySelectorAll("pre.bnf code").forEach((code) => {
    if (code.dataset.hl) return;
    const text = code.textContent;
    let out = "";
    let last = 0;
    let atLineStart = true;
    let seenDef = false;
    let m;
    while ((m = re.exec(text))) {
      const between = text.slice(last, m.index);
      out += esc(between);
      if (/\n/.test(between)) {
        atLineStart = true;
        seenDef = false;
      } else if (between.trim() !== "") {
        atLineStart = false;
      }

      if (m[1]) {
        const cls = atLineStart && !seenDef ? "tok-def" : "tok-ref";
        if (cls === "tok-def") seenDef = true;
        out += `<span class="${cls}">${esc(m[1])}</span>`;
        atLineStart = false;
      } else if (m[2]) {
        out += `<span class="lit">${esc(m[2])}</span>`;
        atLineStart = false;
      } else {
        if (m[3] === "::=") seenDef = true;
        out += `<span class="op">${esc(m[3])}</span>`;
        atLineStart = false;
      }
      last = re.lastIndex;
    }
    out += esc(text.slice(last));
    code.innerHTML = out;
    code.dataset.hl = "1";
  });
}

// Wire the nav theme toggle. The resolved theme is derived from an explicit
// choice when present, otherwise the OS preference, so the first click always
// flips to the opposite of what the visitor is currently seeing.
function initTheme() {
  const btn = document.querySelector(".theme-toggle");
  if (!btn) return;
  const resolved = () => {
    const explicit = document.documentElement.getAttribute("data-theme");
    if (explicit) return explicit;
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  };
  btn.addEventListener("click", () => {
    const next = resolved() === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem("semver-xyz.theme", next);
    } catch {
      /* storage may be unavailable; non-fatal */
    }
  });
}

// Toggle the mobile nav drawer. The text links are hidden on narrow screens, so
// the hamburger reveals them in a panel below the header. Closes on link click,
// Escape, or when the viewport grows back to the desktop breakpoint.
function initMobileNav() {
  const btn = document.querySelector(".nav-toggle");
  const menu = document.getElementById("mobile-nav");
  if (!btn || !menu) return;

  const setOpen = (open) => {
    btn.setAttribute("aria-expanded", String(open));
    btn.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    menu.hidden = !open;
  };

  btn.addEventListener("click", () => {
    setOpen(btn.getAttribute("aria-expanded") !== "true");
  });
  menu.querySelectorAll("a").forEach((a) =>
    a.addEventListener("click", () => setOpen(false)),
  );
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") setOpen(false);
  });
  window.addEventListener("resize", () => {
    if (window.innerWidth > 880) setOpen(false);
  });
}

// Highlight the table-of-contents entry for the section currently in view.
function initTOC() {
  const links = [...document.querySelectorAll(".toc a")];
  if (!links.length) return;
  const byId = new Map(
    links.map((a) => [a.getAttribute("href").slice(1), a]),
  );
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
}

mountChrome();
initTheme();
initMobileNav();
initReveal();
initCopy();
initHeadingAnchors();
initBnf();
initTOC();
