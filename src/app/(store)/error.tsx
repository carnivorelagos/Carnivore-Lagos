"use client";

import { useEffect } from "react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/Button";

export default function StoreError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="grid min-h-[60vh] place-items-center px-6 text-center">
      <div>
        <h1 className="font-display text-2xl text-[var(--color-text)] sm:text-3xl">
          Something went wrong
        </h1>
        <p className="mx-auto mt-2 max-w-sm text-sm text-[var(--color-muted)]">
          That page hit a snag. Try again, or head back to the menu.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <button type="button" onClick={reset} className={buttonVariants({ variant: "primary" })}>
            Try again
          </button>
          <Link href="/menu" className={buttonVariants({ variant: "secondary" })}>
            Go to menu
          </Link>
        </div>
      </div>
    </div>
  );
}
