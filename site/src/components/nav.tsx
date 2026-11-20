"use client";

import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { useEffect, useRef, useState } from "react";
import { Chevron, GitHubMark, MenuIcon, MenuToggleIcon, MoonIcon, SunIcon } from "@/components/icons";
import { NAV, REPO, SPEC_MENU, SPEC_PATHS, isActive, isCurrent, type MenuItem } from "@/lib/site";

/*
 * The site header: brand, the Spec dropdown, the section links, the theme
 * toggle, the GitHub link and the mobile drawer. Rendered on the server like
 * everything else; the handlers below only add behaviour to the same markup.
 */
export function Nav() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  return (
    <header className="nav">
      <a className="brand" href="/" aria-label="semver.xyz home">
        <span className="brand-word">
          <span className="brand-name">semver</span>
          <span className="brand-tld">.xyz</span>
        </span>
      </a>
      <nav className="nav-links">
        <SpecMenu pathname={pathname} />
        {NAV.map((n) => (
          <NavLink key={n.href} href={n.href} label={n.label} pathname={pathname} cta={n.cta} />
        ))}
        <ThemeToggle />
        <a href={REPO} className="nav-cta nav-cta-icon" target="_blank" rel="noopener" aria-label="GitHub repository" title="GitHub repository">
          <GitHubMark />
        </a>
        <button
          className="nav-toggle"
          type="button"
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
          aria-expanded={mobileOpen}
          aria-controls="mobile-nav"
          onClick={() => setMobileOpen(!mobileOpen)}
        >
          <MenuToggleIcon />
        </button>
      </nav>
      <MobileNav pathname={pathname} open={mobileOpen} setOpen={setMobileOpen} />
    </header>
  );
}

function NavLink({ href, label, pathname, cta }: { href: string; label: string; pathname: string; cta?: boolean }) {
  const active = isActive(pathname, href);
  const cls = [active && "active", cta && "nav-cta"].filter(Boolean).join(" ");
  return (
    <a href={href} className={cls || undefined} aria-current={active ? "page" : undefined}>
      {label}
    </a>
  );
}

/*
 * The Spec dropdown: opens on hover (with a short close delay so the pointer
 * can travel to the panel) for fine pointers, and on click / Enter / Space
 * everywhere. Escape or a click outside closes it.
 */
function SpecMenu({ pathname }: { pathname: string }) {
  const m = SPEC_MENU;
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeTimer = useRef(0);
  const active = SPEC_PATHS.some((p) => isActive(pathname, p));

  const hoverable = () => window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  const set = (next: boolean) => {
    clearTimeout(closeTimer.current);
    setOpen(next);
  };

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, [open]);

  const item = (i: MenuItem, cls: string) => {
    const current = isCurrent(pathname, i.href);
    return (
      <a key={i.href} className={`${cls}${current ? " current" : ""}`} href={i.href} aria-current={current ? "page" : undefined}>
        <span className="menu-icon">
          <MenuIcon name={i.icon} />
        </span>
        <span className="menu-text">
          <span className="menu-title">
            {i.title}
            {i === m.featured ? (
              <>
                {" "}
                <span className="nav-ver">{m.badge}</span>
              </>
            ) : null}
          </span>
          {i.desc ? <span className="menu-desc">{i.desc}</span> : null}
        </span>
      </a>
    );
  };

  return (
    <div
      className={`nav-menu${open ? " open" : ""}`}
      data-nav-menu=""
      ref={ref}
      onPointerEnter={(e) => {
        if (e.pointerType === "mouse" && hoverable()) set(true);
      }}
      onPointerLeave={(e) => {
        if (e.pointerType !== "mouse" || !hoverable()) return;
        closeTimer.current = window.setTimeout(() => setOpen(false), 140);
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape" && open) {
          set(false);
          triggerRef.current?.focus();
        }
      }}
      onBlur={(e) => {
        if (!ref.current?.contains(e.relatedTarget as Node | null)) set(false);
      }}
    >
      <button
        ref={triggerRef}
        className={`nav-menu-trigger${active ? " active" : ""}`}
        type="button"
        aria-expanded={open}
        aria-controls="spec-menu"
        onClick={() => set(!open)}
      >
        {m.label}{" "}
        <span className="nav-ver" aria-label={`version ${m.badge}`}>
          {m.badge}
        </span>
        <Chevron />
      </button>
      <div className="nav-panel" id="spec-menu" hidden={!open}>
        {item(m.featured, "menu-item menu-featured")}
        <div className="menu-grid">{m.items.map((i) => item(i, "menu-item"))}</div>
        <a className="menu-footer" href={m.footer.href}>
          <MenuIcon name={m.footer.icon} />
          <span>{m.footer.title}</span>
          <span aria-hidden="true">→</span>
        </a>
      </div>
    </div>
  );
}

/*
 * The resolved theme is an explicit choice when there is one, otherwise the
 * OS preference, so the first click always flips to the opposite of what the
 * visitor is currently seeing. The icons swap in CSS from `data-theme`.
 */
function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  return (
    <button
      className="theme-toggle"
      type="button"
      aria-label="Toggle color theme"
      title="Toggle color theme"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
    >
      <SunIcon />
      <MoonIcon />
    </button>
  );
}

/*
 * The mobile nav drawer. The text links are hidden on narrow screens, so the
 * hamburger reveals them in a panel below the header. Closes on link click,
 * Escape, or when the viewport grows back to the desktop breakpoint.
 */
function MobileNav({ pathname, open, setOpen }: { pathname: string; open: boolean; setOpen: (open: boolean) => void }) {
  const m = SPEC_MENU;
  const all = [m.featured, ...m.items, m.footer];

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onResize = () => {
      if (window.innerWidth > 880) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", onResize);
    return () => {
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onResize);
    };
  }, [open, setOpen]);

  return (
    <div
      className="mobile-nav"
      id="mobile-nav"
      hidden={!open}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest("a")) setOpen(false);
      }}
    >
        <div className="mobile-group">
          <div className="mobile-group-label">
            {m.label} <span className="nav-ver">{m.badge}</span>
          </div>
          {all.map((i) => {
            const current = isCurrent(pathname, i.href);
            return (
              <a key={i.href} href={i.href} className={current ? "active" : undefined} aria-current={current ? "page" : undefined}>
                <span className="menu-icon">
                  <MenuIcon name={i.icon} />
                </span>
                {i.title}
              </a>
            );
          })}
        </div>
        {NAV.map((n) => (
          <NavLink key={n.href} href={n.href} label={n.label} pathname={pathname} />
        ))}
    </div>
  );
}
