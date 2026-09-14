"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * Top-of-viewport navigation progress bar. Starts the instant a link is
 * clicked (or `router.push`/`replace` runs) and completes when the new
 * route commits. Purely a "the app heard you and is working" signal — an
 * indeterminate trickle, not real progress.
 *
 * Safety: a hard cap forces completion after MAX_MS, so the bar can never
 * get stuck visible even if a completion signal is missed.
 *
 * Motion: a single GPU-composited `scaleX`; JS only nudges the target a
 * few times. `linear` for the trickle, a strong ease-out for the snap to
 * 100%. Under `prefers-reduced-motion` there is no movement — the bar
 * only fades (handled entirely in CSS).
 */

const MAX_MS = 8000;
const TRICKLE_MS = 600;

// Patch history ONCE so programmatic navigation also starts the bar. Two
// rules keep it safe:
//   1. Additive — the original is always called first.
//   2. The "start" signal is dispatched on a fresh macrotask, never
//      synchronously: Next calls replaceState from inside React's commit
//      phase, and scheduling a state update there throws.
let historyPatched = false;
function patchHistory() {
  if (historyPatched || typeof window === "undefined") return;
  historyPatched = true;
  for (const method of ["pushState", "replaceState"] as const) {
    const original = window.history[method];
    window.history[method] = function patched(
      this: History,
      ...argv: Parameters<History["pushState"]>
    ) {
      const before = window.location.href;
      const result = original.apply(this, argv);
      const urlArg = argv[2];
      if (urlArg != null) {
        try {
          // Only signal a real URL change — ignore state-only updates and
          // the same-URL replaceState Next fires during hydration.
          if (new URL(String(urlArg), before).href !== before) {
            setTimeout(() => window.dispatchEvent(new Event("routeprogress:start")), 0);
          }
        } catch {
          /* ignore malformed url */
        }
      }
      return result;
    };
  }
}

function isPlainInternalAnchorClick(e: MouseEvent): boolean {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) {
    return false;
  }
  const anchor = (e.target as Element | null)?.closest?.("a");
  if (!anchor) return false;
  const href = anchor.getAttribute("href");
  if (!href || href.startsWith("#")) return false;
  if (anchor.target && anchor.target !== "_self") return false;
  if (anchor.hasAttribute("download")) return false;
  try {
    const url = new URL(href, window.location.href);
    if (url.origin !== window.location.origin) return false;
    if (url.pathname === window.location.pathname && url.search === window.location.search) return false;
  } catch {
    return false;
  }
  return true;
}

export function RouteProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [state, setState] = useState<"idle" | "loading" | "finishing">("idle");
  const [progress, setProgress] = useState(0);
  // Lazy init: safe against hydration because `reduce` only affects output
  // while state === "loading", which is never true on the first render.
  const [reduce] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );

  const finishRef = useRef<() => void>(() => {});

  useEffect(() => {
    patchHistory();

    // Closure-local state mirror so the handlers can guard synchronously
    // without writing a ref during render.
    let phase: "idle" | "loading" | "finishing" = "idle";
    let armed = false;
    let trickle: ReturnType<typeof setInterval> | undefined;
    let cap: ReturnType<typeof setTimeout> | undefined;
    let done: ReturnType<typeof setTimeout> | undefined;

    const clearTimers = () => {
      if (trickle) clearInterval(trickle);
      if (cap) clearTimeout(cap);
      if (done) clearTimeout(done);
      trickle = cap = done = undefined;
    };

    const finish = () => {
      if (phase === "idle") return;
      clearTimers();
      phase = "finishing";
      setState("finishing");
      setProgress(1);
      done = setTimeout(() => {
        phase = "idle";
        setState("idle");
        setProgress(0);
      }, 420);
    };
    finishRef.current = finish;

    const start = () => {
      if (!armed || phase === "loading") return;
      clearTimers();
      phase = "loading";
      setState("loading");
      setProgress(0.08);
      trickle = setInterval(() => {
        setProgress((p) => (p >= 0.9 ? p : p + Math.max(0.015, (0.9 - p) * 0.1)));
      }, TRICKLE_MS);
      cap = setTimeout(finish, MAX_MS);
    };

    const onClick = (e: MouseEvent) => {
      if (isPlainInternalAnchorClick(e)) start();
    };

    // Ignore the history churn Next does during initial hydration.
    const armTimer = setTimeout(() => {
      armed = true;
    }, 500);

    window.addEventListener("routeprogress:start", start);
    window.addEventListener("popstate", start);
    document.addEventListener("click", onClick, { capture: true });

    return () => {
      clearTimeout(armTimer);
      window.removeEventListener("routeprogress:start", start);
      window.removeEventListener("popstate", start);
      document.removeEventListener("click", onClick, { capture: true });
      clearTimers();
      finishRef.current = () => {};
    };
  }, []);

  // Route committed → finish whatever is in flight. No-op on mount and on
  // any change that started nothing.
  useEffect(() => {
    finishRef.current();
  }, [pathname, searchParams]);

  const inlineTransform =
    state === "loading" && !reduce ? { transform: `scaleX(${progress})` } : undefined;

  return (
    <div
      className="route-progress"
      data-state={state}
      role="progressbar"
      aria-hidden={state === "idle"}
      aria-label="Loading the page"
      style={inlineTransform}
    />
  );
}
