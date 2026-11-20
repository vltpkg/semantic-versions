"use client";

import { useEffect, useRef } from "react";

/*
 * The pages' interactive parts are plain DOM modules (src/lib/interactive)
 * that wire themselves to the markup the page rendered and hand back a
 * dispose function. Each is loaded on demand, after the page is on screen,
 * and torn down when the page unmounts.
 */
type Mountable = { mount: () => () => void };

function useMount(load: () => Promise<Mountable>) {
  useEffect(() => {
    let cancelled = false;
    let dispose: (() => void) | undefined;
    load().then((m) => {
      if (cancelled) return;
      dispose = m.mount();
    });
    return () => {
      cancelled = true;
      dispose?.();
    };
  }, [load]);
}

const loadSelector = () => import("@/lib/interactive/selector");
const loadVariants = () => import("@/lib/interactive/variants");
const loadIntegrity = () => import("@/lib/interactive/integrity");
const loadLockGenerator = () => import("@/lib/interactive/lock-generator");

/** The range selector (/selector/). */
export function SelectorScript() {
  useMount(loadSelector);
  return null;
}

/** The Build Variants channel matrix (/extensions/variants/). */
export function VariantsScript() {
  useMount(loadVariants);
  return null;
}

/** The Package Integrity digest tool (/extensions/integrity/). */
export function IntegrityScript() {
  useMount(loadIntegrity);
  return null;
}

/** The Dependency Locks generator (/extensions/dependency-locks/). */
export function LockGeneratorScript() {
  useMount(loadLockGenerator);
  return null;
}

type Initable = { init: (root: HTMLDivElement) => () => void };

function useInit(ref: React.RefObject<HTMLDivElement | null>, load: () => Promise<Initable>) {
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    let cancelled = false;
    let dispose: (() => void) | undefined;
    load().then((m) => {
      if (cancelled) return;
      dispose = m.init(root);
    });
    return () => {
      cancelled = true;
      dispose?.();
    };
  }, [ref, load]);
}

const loadHeroArt = () => import("@/lib/interactive/hero-art");
const loadVersionSort = () => import("@/lib/interactive/version-sort");

/** The interactive ASCII "X.Y.Z" behind the home hero. */
export function HeroArt() {
  const ref = useRef<HTMLDivElement>(null);
  useInit(ref, loadHeroArt);
  return (
    <div className="hero-art" data-hero-art="" aria-hidden="true" ref={ref}>
      <canvas />
    </div>
  );
}

/** The live precedence sort beside the "Why a new spec" copy. */
export function VersionSort() {
  const ref = useRef<HTMLDivElement>(null);
  useInit(ref, loadVersionSort);
  return <div className="why-sort" data-version-sort="" ref={ref} />;
}
