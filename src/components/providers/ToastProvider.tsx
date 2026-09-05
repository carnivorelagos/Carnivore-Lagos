"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { CheckCircle, Info, WarningCircle, XCircle, X } from "@phosphor-icons/react";
import { cn } from "@/lib/client/cn";

type ToastTone = "info" | "success" | "warning" | "danger";

type ToastInput = {
  title: string;
  description?: string;
  tone?: ToastTone;
  duration?: number;
};

type ToastItem = Required<Omit<ToastInput, "description">> & {
  id: number;
  description?: string;
};

type ToastContextValue = {
  toast: (t: ToastInput) => void;
  dismiss: (id: number) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}

const TONE_ICON = {
  info: Info,
  success: CheckCircle,
  warning: WarningCircle,
  danger: XCircle,
} as const;

const TONE_ACCENT: Record<ToastTone, string> = {
  info: "text-[var(--color-muted)]",
  success: "text-[var(--color-success)]",
  warning: "text-[var(--color-warning)]",
  danger: "text-[var(--color-danger)]",
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const idRef = useRef(0);
  const timers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: number) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const toast = useCallback(
    ({ title, description, tone = "info", duration = 4500 }: ToastInput) => {
      const id = ++idRef.current;
      setItems((prev) => [...prev.slice(-2), { id, title, description, tone, duration }]);
      const timer = setTimeout(() => dismiss(id), duration);
      timers.current.set(id, timer);
    },
    [dismiss],
  );

  useEffect(() => {
    const map = timers.current;
    return () => {
      map.forEach((t) => clearTimeout(t));
      map.clear();
    };
  }, []);

  const value = useMemo(() => ({ toast, dismiss }), [toast, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="false"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-[80] flex flex-col items-center gap-2 p-4 sm:items-end"
      >
        {items.map((t) => {
          const Icon = TONE_ICON[t.tone];
          return (
            <div
              key={t.id}
              role="status"
              className="animate-rise pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-lg border border-[var(--color-line-strong)] bg-[var(--color-raised)] p-3.5 shadow-[var(--shadow-pop)]"
            >
              <Icon
                weight="fill"
                className={cn("mt-0.5 size-5 shrink-0", TONE_ACCENT[t.tone])}
                aria-hidden
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium leading-snug text-[var(--color-text)]">
                  {t.title}
                </p>
                {t.description ? (
                  <p className="mt-0.5 text-[13px] leading-snug text-[var(--color-muted)]">
                    {t.description}
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => dismiss(t.id)}
                aria-label="Dismiss notification"
                className="-m-1 rounded p-1 text-[var(--color-subtle)] transition-colors hover:text-[var(--color-text)]"
              >
                <X className="size-4" aria-hidden />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
