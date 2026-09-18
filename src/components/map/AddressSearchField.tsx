"use client";

import { useEffect, useRef, useState } from "react";
import { MapPin } from "@phosphor-icons/react";
import { TextArea } from "@/components/ui/form";
import { searchAddress, type AddressSuggestion } from "@/lib/client/endpoints";

const MIN_CHARS = 4;
const DEBOUNCE_MS = 600;

type Status = "idle" | "loading" | "done" | "error";

/**
 * The checkout address box. Typing in it looks the address up (Lagos only)
 * and offers matches; picking one drops the delivery pin there and fills
 * the field. That pin is what prices the delivery and enables Pay — before
 * this, typing an address left the pin unset, so the fee never appeared
 * and Pay stayed disabled with no explanation.
 *
 * Suggestions render in the page flow (not a floating popover) so they
 * never fall behind the map or the on-screen keyboard on a phone.
 */
export function AddressSearchField({
  value,
  onTextChange,
  onPick,
  hasPin,
  error,
}: {
  value: string;
  onTextChange: (text: string) => void;
  onPick: (s: AddressSuggestion) => void;
  /** A delivery pin is already set (map tap, "Use my location" or a pick). */
  hasPin: boolean;
  error?: string | null;
}) {
  const [results, setResults] = useState<AddressSuggestion[]>([]);
  const [approximate, setApproximate] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const runId = useRef(0);

  useEffect(() => {
    const t = timer;
    return () => {
      if (t.current) clearTimeout(t.current);
    };
  }, []);

  const run = async (q: string) => {
    const id = ++runId.current;
    setStatus("loading");
    setOpen(true);
    try {
      const r = await searchAddress(q);
      if (id !== runId.current) return;
      setResults(r.results);
      setApproximate(r.approximate);
      setStatus("done");
    } catch {
      if (id === runId.current) setStatus("error");
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    const previous = value;
    onTextChange(text);

    if (timer.current) clearTimeout(timer.current);
    runId.current++; // drop any lookup still in flight for older text

    const q = text.trim();
    // Adding directions after an address that's already located isn't a
    // request to move the pin.
    const onlyAppended = hasPin && previous.length > 0 && text.startsWith(previous);
    if (q.length < MIN_CHARS || onlyAppended) {
      setResults([]);
      setStatus("idle");
      setOpen(false);
      return;
    }
    timer.current = setTimeout(() => void run(q), DEBOUNCE_MS);
  };

  const pick = (s: AddressSuggestion) => {
    if (timer.current) clearTimeout(timer.current);
    runId.current++;
    setResults([]);
    setStatus("idle");
    setOpen(false);
    onPick(s);
  };

  const showPanel = open && (results.length > 0 || !hasPin);

  return (
    <div
      className="space-y-2"
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOpen(false);
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") setOpen(false);
      }}
    >
      <TextArea
        label="Address & directions"
        placeholder="Start typing your street or area, e.g. Admiralty Way, Lekki"
        rows={2}
        autoComplete="street-address"
        value={value}
        error={error}
        onChange={handleChange}
        onFocus={() => {
          if (results.length > 0) setOpen(true);
        }}
        hint={
          hasPin
            ? "Add any landmark or directions the rider needs."
            : "Start typing, then choose your address from the list — or use My location / tap the map."
        }
      />

      {showPanel ? (
        <div
          role="listbox"
          aria-label="Address suggestions"
          className="rounded-lg border border-[var(--color-line-strong)] bg-[var(--color-surface)] p-2"
        >
          {status === "loading" && results.length === 0 ? (
            <p className="px-1.5 py-1 text-[12.5px] text-[var(--color-subtle)]">
              Looking up that address…
            </p>
          ) : null}

          {status === "error" && results.length === 0 ? (
            <p className="px-1.5 py-1 text-[12.5px] text-[var(--color-warning)]">
              Couldn&apos;t search just now. Tap the map or use My location to place your pin.
            </p>
          ) : null}

          {status === "done" && results.length === 0 ? (
            <p className="px-1.5 py-1 text-[12.5px] text-[var(--color-warning)]">
              We couldn&apos;t find that address. Try just the street or area name, or tap the
              map / use My location to place your pin.
            </p>
          ) : null}

          {results.length > 0 ? (
            <>
              <p className="px-1.5 pb-1.5 text-[12px] text-[var(--color-subtle)]">
                {approximate
                  ? "Closest match we found — pick it, then drag the pin to your exact spot."
                  : "Pick your location to see the delivery fee:"}
              </p>
              <ul className="space-y-1">
                {results.map((s) => (
                  <li key={`${s.lat},${s.lng},${s.label}`}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={false}
                      onClick={() => pick(s)}
                      className="flex w-full items-start gap-2 rounded-md px-2 py-2 text-left text-[13px] leading-snug text-[var(--color-text)] transition-colors hover:bg-[var(--color-raised)] focus-visible:bg-[var(--color-raised)]"
                    >
                      <MapPin
                        className="mt-px size-4 shrink-0 text-[var(--color-accent)]"
                        weight="fill"
                        aria-hidden
                      />
                      <span className="line-clamp-2">{s.label}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
