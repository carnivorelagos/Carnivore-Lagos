"use client";

import { forwardRef, useId } from "react";
import { WarningCircle } from "@phosphor-icons/react";
import { cn } from "@/lib/client/cn";

// 16px, not 15 — iOS Safari (and Chrome on iOS, same WebKit engine) auto-
// zooms the whole page in when a focused text input's font-size is under
// 16px, and doesn't reliably zoom back out on blur. That auto-zoom, not a
// layout bug, was the live "cutting off on the right" report: tapping the
// next field re-triggers it, which is why a manual pinch-back never held.
export const controlClasses =
  "w-full rounded-md border border-[var(--color-line-strong)] bg-[var(--color-surface)] " +
  "px-3.5 text-base text-[var(--color-text)] transition-colors " +
  "placeholder:text-[var(--color-subtle)] " +
  "focus:border-[var(--color-accent)] focus-visible:outline-2 focus-visible:outline-offset-1 " +
  "focus-visible:outline-[var(--color-focus)] " +
  "disabled:cursor-not-allowed disabled:opacity-60 " +
  "aria-[invalid=true]:border-[var(--color-danger)]";

type FieldShellProps = {
  label: string;
  htmlFor: string;
  hint?: string;
  error?: string | null;
  required?: boolean;
  optionalHint?: boolean;
  children: React.ReactNode;
  className?: string;
};

export function FieldShell({
  label,
  htmlFor,
  hint,
  error,
  required,
  optionalHint,
  children,
  className,
}: FieldShellProps) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label
        htmlFor={htmlFor}
        className="flex items-baseline justify-between gap-2 text-[13px] font-medium text-[var(--color-text)]"
      >
        <span>
          {label}
          {required ? <span className="text-[var(--color-danger)]"> *</span> : null}
        </span>
        {optionalHint && !required ? (
          <span className="text-[12px] font-normal text-[var(--color-subtle)]">Optional</span>
        ) : null}
      </label>
      {children}
      {error ? (
        <p className="flex items-center gap-1.5 text-[12.5px] text-[var(--color-danger)]">
          <WarningCircle weight="fill" className="size-3.5 shrink-0" aria-hidden />
          {error}
        </p>
      ) : hint ? (
        <p className="text-[12.5px] text-[var(--color-subtle)]">{hint}</p>
      ) : null}
    </div>
  );
}

type BaseFieldProps = {
  label: string;
  hint?: string;
  error?: string | null;
  optionalHint?: boolean;
  containerClassName?: string;
};

export type TextFieldProps = BaseFieldProps &
  Omit<React.InputHTMLAttributes<HTMLInputElement>, "id"> & { id?: string };

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  { label, hint, error, optionalHint, containerClassName, className, id, required, ...rest },
  ref,
) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  return (
    <FieldShell
      label={label}
      htmlFor={fieldId}
      hint={hint}
      error={error}
      required={required}
      optionalHint={optionalHint}
      className={containerClassName}
    >
      <input
        ref={ref}
        id={fieldId}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={error || hint ? `${fieldId}-msg` : undefined}
        className={cn(controlClasses, "h-11", className)}
        {...rest}
      />
    </FieldShell>
  );
});

export type TextAreaProps = BaseFieldProps &
  Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, "id"> & { id?: string };

export const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(function TextArea(
  { label, hint, error, optionalHint, containerClassName, className, id, required, rows = 3, ...rest },
  ref,
) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  return (
    <FieldShell
      label={label}
      htmlFor={fieldId}
      hint={hint}
      error={error}
      required={required}
      optionalHint={optionalHint}
      className={containerClassName}
    >
      <textarea
        ref={ref}
        id={fieldId}
        rows={rows}
        required={required}
        aria-invalid={error ? true : undefined}
        className={cn(controlClasses, "resize-y py-2.5 leading-relaxed", className)}
        {...rest}
      />
    </FieldShell>
  );
});

export type SelectFieldProps = BaseFieldProps &
  Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "id"> & { id?: string };

export const SelectField = forwardRef<HTMLSelectElement, SelectFieldProps>(function SelectField(
  { label, hint, error, optionalHint, containerClassName, className, id, required, children, ...rest },
  ref,
) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  return (
    <FieldShell
      label={label}
      htmlFor={fieldId}
      hint={hint}
      error={error}
      required={required}
      optionalHint={optionalHint}
      className={containerClassName}
    >
      <select
        ref={ref}
        id={fieldId}
        required={required}
        aria-invalid={error ? true : undefined}
        className={cn(controlClasses, "h-11 pr-9", className)}
        {...rest}
      >
        {children}
      </select>
    </FieldShell>
  );
});
