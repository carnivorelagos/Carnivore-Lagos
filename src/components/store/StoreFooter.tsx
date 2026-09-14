import Link from "next/link";
import { InstagramLogo, MapPin } from "@phosphor-icons/react/dist/ssr";
import { Wordmark } from "@/components/store/Wordmark";
import { BRAND } from "@/lib/client/brand";

export function StoreFooter() {
  return (
    <footer className="mt-16 border-t border-[var(--color-line)] bg-[var(--color-surface)]">
      <div className="shell gutter grid gap-8 py-12 sm:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <Wordmark size="md" href={null} />
          <p className="mt-3 max-w-xs text-sm leading-relaxed text-[var(--color-muted)]">
            {BRAND.promise}
          </p>
          <p className="mt-4 flex items-center gap-1.5 text-[13px] text-[var(--color-subtle)]">
            <MapPin className="size-4" aria-hidden />
            {BRAND.city}
          </p>
        </div>

        <nav className="text-sm" aria-label="Footer">
          <p className="mb-3 text-[12px] font-medium uppercase tracking-[0.14em] text-[var(--color-subtle)]">
            Order
          </p>
          <ul className="space-y-2 text-[var(--color-muted)]">
            <li>
              <Link href="/menu" className="hover:text-[var(--color-text)]">
                Full menu
              </Link>
            </li>
            <li>
              <Link href="/cart" className="hover:text-[var(--color-text)]">
                Your cart
              </Link>
            </li>
            <li>
              <Link href="/history" className="hover:text-[var(--color-text)]">
                Order history
              </Link>
            </li>
          </ul>
        </nav>

        <div className="text-sm">
          <p className="mb-3 text-[12px] font-medium uppercase tracking-[0.14em] text-[var(--color-subtle)]">
            Hours
          </p>
          <ul className="space-y-1.5 text-[var(--color-muted)]">
            {BRAND.hours.map((h) => (
              <li key={h.days} className="flex justify-between gap-4">
                <span>{h.days}</span>
                <span className="tnum text-[var(--color-subtle)]">{h.time}</span>
              </li>
            ))}
          </ul>
          <a
            href={BRAND.instagram}
            className="mt-4 inline-flex items-center gap-1.5 text-[13px] text-[var(--color-muted)] hover:text-[var(--color-text)]"
          >
            <InstagramLogo className="size-4" aria-hidden />
            Instagram
          </a>
        </div>
      </div>

      <div className="border-t border-[var(--color-line)]">
        <div className="shell gutter flex flex-col gap-1 py-5 text-[12px] text-[var(--color-subtle)] sm:flex-row sm:items-center sm:justify-between">
          <p>
            &copy; {new Date().getFullYear()} {BRAND.name}. All rights reserved.
          </p>
          <p>Prices in Nigerian Naira. Pickup and delivery within Lagos.</p>
        </div>
      </div>
    </footer>
  );
}
