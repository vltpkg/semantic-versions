import type { IconName } from "@/lib/site";

/** Icons for the Spec menu (16px, 1.5 stroke, currentColor). */
const PATHS: Record<IconName, React.ReactNode> = {
  spec: (
    <>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 3v5h5" />
      <path d="M9 13h6M9 17h4" />
    </>
  ),
  grammar: (
    <>
      <path d="M8 3H7a2 2 0 0 0-2 2v5a2 2 0 0 1-2 2 2 2 0 0 1 2 2v5a2 2 0 0 0 2 2h1" />
      <path d="M16 21h1a2 2 0 0 0 2-2v-5a2 2 0 0 1 2-2 2 2 0 0 1-2-2V5a2 2 0 0 0-2-2h-1" />
    </>
  ),
  variants: (
    <>
      <path d="m12 3 9 4.5-9 4.5-9-4.5z" />
      <path d="m3 12 9 4.5 9-4.5" />
      <path d="m3 16.5 9 4.5 9-4.5" />
    </>
  ),
  integrity: (
    <>
      <path d="M12 3 4 6v6c0 4.4 3.4 8.2 8 9 4.6-.8 8-4.6 8-9V6z" />
      <path d="m9 12 2 2 4-4" />
    </>
  ),
  locks: (
    <>
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </>
  ),
  extensions: (
    <>
      <rect x="4" y="4" width="7" height="7" rx="1.5" />
      <rect x="13" y="4" width="7" height="7" rx="1.5" />
      <rect x="4" y="13" width="7" height="7" rx="1.5" />
      <rect x="13" y="13" width="7" height="7" rx="1.5" />
    </>
  ),
};

export function MenuIcon({ name }: { name: IconName }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {PATHS[name]}
    </svg>
  );
}

export const Chevron = () => (
  <svg className="nav-chevron" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="m4 6 4 4 4-4" />
  </svg>
);

export const SunIcon = () => (
  <svg className="icon-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </svg>
);

export const MoonIcon = () => (
  <svg className="icon-moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
  </svg>
);

export const GitHubMark = () => (
  <svg className="icon-github" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
    <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.63 7.63 0 0 1 2-.27c.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
  </svg>
);

export const MenuToggleIcon = () => (
  <>
    <svg className="icon-menu" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
      <path d="M3 6h18M3 12h18M3 18h18" />
    </svg>
    <svg className="icon-close" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  </>
);

export const VltMark = () => (
  <svg className="footer-mark" viewBox="0 0 24 24" fill="currentColor" aria-label="vlt" role="img">
    <path d="M8.66659 6.33329C8.66659 6.68925 8.61079 7.03216 8.50747 7.35379C8.21694 8.2582 7.99884 9.28798 8.47332 10.1109L10.6593 13.9022C10.9243 14.3618 11.4692 14.5626 11.9997 14.5626C12.5304 14.5626 13.0755 14.3617 13.3406 13.902L15.5265 10.1108C16.001 9.28787 15.7829 8.25813 15.4924 7.35374C15.389 7.03215 15.3333 6.68925 15.3333 6.33332C15.3333 4.49239 16.8257 3.00003 18.6666 3.00003C20.5075 3.00003 21.9999 4.49239 21.9999 6.33332C21.9999 8.17424 20.5075 9.66661 18.6666 9.66661C18.1358 9.66661 17.5906 9.86748 17.3254 10.3273L15.1397 14.1182C14.6652 14.9411 14.8834 15.971 15.1739 16.8754C15.2772 17.197 15.333 17.54 15.333 17.8959C15.333 19.7368 13.8406 21.2292 11.9997 21.2292C10.1588 21.2292 8.66644 19.7368 8.66644 17.8959C8.66644 17.5399 8.72226 17.1969 8.8256 16.8752C9.1162 15.9708 9.33437 14.9409 8.85984 14.1179L6.67422 10.3272C6.40911 9.86744 5.86403 9.66659 5.33329 9.66659C3.49237 9.66659 2 8.17422 2 6.33329C2 4.49237 3.49237 3 5.33329 3C7.17422 3 8.66659 4.49237 8.66659 6.33329Z" />
  </svg>
);

export const AnchorIcon = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M6.5 9.5a2.5 2.5 0 0 0 3.6.06l2.4-2.4a2.55 2.55 0 0 0-3.6-3.6l-1.1 1.1" />
    <path d="M9.5 6.5a2.5 2.5 0 0 0-3.6-.06l-2.4 2.4a2.55 2.55 0 0 0 3.6 3.6l1.1-1.1" />
  </svg>
);
