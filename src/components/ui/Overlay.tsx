"use client";

import { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "@phosphor-icons/react";
import { cn } from "@/lib/client/cn";

const FOCUSABLE =
  'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';

function useOverlayBehaviour(open: boolean, onClose: () => void, panelRef: React.RefObject<HTMLElement | null>) {
  const restoreRef = useRef<HTMLElement | null>(null);

  useLayoutEffect(() => {
    if (!open) return;
    restoreRef.current = document.activeElement as HTMLElement | null;
    const { style } = document.body;
    const prev = style.overflow;
    style.overflow = "hidden";
    return () => {
      style.overflow = prev;
      restoreRef.current?.focus?.();
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    // Focus first focusable, else the panel itself.
    const first = panel?.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? panel)?.focus();

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== "Tab" || !panel) return;
      const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null,
      );
      if (items.length === 0) {
        e.preventDefault();
        panel.focus();
        return;
      }
      const firstEl = items[0];
      const lastEl = items[items.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === firstEl || active === panel)) {
        e.preventDefault();
        lastEl.focus();
      } else if (!e.shiftKey && active === lastEl) {
        e.preventDefault();
        firstEl.focus();
      }
    }
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [open, onClose, panelRef]);
}

type OverlayProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  /** Visually hide the title but keep it for screen readers. */
  hideTitle?: boolean;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
};

/** Bottom sheet on mobile, right-hand drawer from `sm` up. */
export function Sheet({
  open,
  onClose,
  title,
  hideTitle,
  description,
  children,
  footer,
  className,
}: OverlayProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const close = useCallback(() => onClose(), [onClose]);
  useOverlayBehaviour(open, close, panelRef);

  if (typeof document === "undefined" || !open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-stretch sm:justify-end">
      <button
        type="button"
        aria-label="Close"
        tabIndex={-1}
        onClick={close}
        className="absolute inset-0 bg-[rgba(0,0,0,0.62)] backdrop-blur-[3px] animate-[rise_.2s_ease]"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        aria-describedby={description ? "sheet-desc" : undefined}
        tabIndex={-1}
        className={cn(
          "relative flex max-h-[92dvh] w-full flex-col rounded-t-[var(--radius-xl)] border border-[var(--color-line-strong)] bg-[var(--color-bg)] shadow-[var(--shadow-pop)]",
          "sm:h-full sm:max-h-none sm:w-[min(28rem,100vw)] sm:rounded-none sm:rounded-l-[var(--radius-xl)]",
          "translate-y-0 animate-[rise_.28s_var(--ease-out-quint)]",
          className,
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-[var(--color-line)] px-5 py-4">
          <div className="min-w-0">
            <h2
              className={cn(
                "font-display text-lg text-[var(--color-text)]",
                hideTitle && "sr-only",
              )}
            >
              {title}
            </h2>
            {description ? (
              <p id="sheet-desc" className="mt-0.5 text-[13px] text-[var(--color-muted)]">
                {description}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={close}
            aria-label="Close"
            className="-m-1.5 rounded-md p-1.5 text-[var(--color-muted)] transition-colors hover:bg-[color-mix(in_oklab,var(--color-muted)_14%,transparent)] hover:text-[var(--color-text)]"
          >
            <X className="size-5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4">{children}</div>
        {footer ? (
          <div className="border-t border-[var(--color-line)] px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            {footer}
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}

/** Centered modal. Use sparingly - confirmations and short flows only. */
export function Dialog({
  open,
  onClose,
  title,
  hideTitle,
  description,
  children,
  footer,
  className,
}: OverlayProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const close = useCallback(() => onClose(), [onClose]);
  useOverlayBehaviour(open, close, panelRef);

  if (typeof document === "undefined" || !open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-end justify-center p-0 sm:items-center sm:p-4">
      <button
        type="button"
        aria-label="Close"
        tabIndex={-1}
        onClick={close}
        className="absolute inset-0 bg-[rgba(0,0,0,0.62)] backdrop-blur-[3px]"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={cn(
          "relative flex w-full max-w-md flex-col rounded-t-[var(--radius-xl)] border border-[var(--color-line-strong)] bg-[var(--color-bg)] shadow-[var(--shadow-pop)] sm:rounded-[var(--radius-xl)]",
          "animate-[rise_.24s_var(--ease-out-quint)]",
          className,
        )}
      >
        <div className="px-5 pt-5">
          <h2
            className={cn("font-display text-xl text-[var(--color-text)]", hideTitle && "sr-only")}
          >
            {title}
          </h2>
          {description ? (
            <p className="mt-1 text-sm text-[var(--color-muted)]">{description}</p>
          ) : null}
        </div>
        <div className="px-5 py-4">{children}</div>
        {footer ? (
          <div className="flex flex-col-reverse gap-2 border-t border-[var(--color-line)] px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:flex-row sm:justify-end">
            {footer}
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
