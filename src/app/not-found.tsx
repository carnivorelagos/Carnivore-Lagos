import Link from "next/link";
import { buttonVariants } from "@/components/ui/Button";

export default function NotFound() {
  return (
    <main className="grid min-h-[100dvh] place-items-center px-6 text-center">
      <div>
        <p className="font-mono text-[13px] uppercase tracking-[0.2em] text-[var(--color-gold)]">
          404
        </p>
        <h1 className="mt-3 font-display text-3xl text-[var(--color-text)] sm:text-4xl">
          This page isn&apos;t on the menu
        </h1>
        <p className="mx-auto mt-3 max-w-sm text-sm text-[var(--color-muted)]">
          The link may be old or mistyped. The grill is still on, though.
        </p>
        <Link href="/" className={buttonVariants({ className: "mt-6" })}>
          Back to Carnivore Lagos
        </Link>
      </div>
    </main>
  );
}
