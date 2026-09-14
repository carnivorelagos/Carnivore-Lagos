import Link from "next/link";
import { buttonVariants } from "@/components/ui/buttonVariants";

export default function NotFound() {
  return (
    <main className="relative grid min-h-[100dvh] place-items-center overflow-hidden px-6 text-center">
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-[radial-gradient(80%_60%_at_50%_0%,color-mix(in_oklab,var(--color-accent)_16%,transparent),transparent_70%)]"
      />
      <div>
        <p className="eyebrow text-[var(--color-accent)]">Error 404</p>
        <h1 className="mt-4 text-4xl text-[var(--color-text)] sm:text-5xl">
          This isn&apos;t on the menu
        </h1>
        <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-[var(--color-muted)]">
          The link may be old or mistyped. The grill is still on, though.
        </p>
        <Link href="/" className={buttonVariants({ size: "lg", className: "mt-7" })}>
          Back to Carnivore Lagos
        </Link>
      </div>
    </main>
  );
}
