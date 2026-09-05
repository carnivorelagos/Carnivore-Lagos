import Image from "next/image";
import Link from "next/link";
import {
  Fire,
  Motorcycle,
  Storefront,
} from "@phosphor-icons/react/dist/ssr";
import { buttonVariants } from "@/components/ui/Button";
import { FeaturedGrill } from "@/components/store/FeaturedGrill";
import { BRAND, PLACEHOLDER_IMAGES } from "@/lib/client/brand";

const GRILL_STORY = [
  {
    icon: Fire,
    title: "Cooked over open coal",
    body: "Suya, asun, tozo and ram balangu seasoned with yaji and grilled to order. Nothing sits under a lamp.",
  },
  {
    icon: Storefront,
    title: "Pick it up hot",
    body: "Order ahead, skip the wait, collect at the counter with your order number.",
  },
  {
    icon: Motorcycle,
    title: "Or delivered across Lagos",
    body: "Drop a pin at checkout. We quote the delivery fee up front before you pay.",
  },
];

const WHAT_WE_GRILL = [
  "Carnivore Grill",
  "Pepper Soup",
  "Shawarma",
  "Meal Combo & Sides",
  "Smoothies",
  "Cocktails",
];

export default function HomePage() {
  return (
    <>
      {/* Hero ---------------------------------------------------------- */}
      <section className="relative isolate overflow-hidden">
        <Image
          src={PLACEHOLDER_IMAGES.hero.src}
          alt={PLACEHOLDER_IMAGES.hero.alt}
          fill
          priority
          sizes="100vw"
          className="-z-10 object-cover"
        />
        <div
          aria-hidden
          className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgba(21,16,13,0.72)_0%,rgba(21,16,13,0.86)_55%,var(--color-bg)_100%)]"
        />
        <div
          aria-hidden
          className="absolute inset-0 -z-10 bg-[radial-gradient(120%_90%_at_15%_0%,rgba(214,73,31,0.28)_0%,transparent_55%)]"
        />

        <div className="shell gutter flex min-h-[calc(100dvh-3.5rem)] flex-col justify-end pb-16 pt-20 sm:min-h-[calc(100dvh-4rem)] sm:pb-24">
          <p className="mb-4 text-[13px] font-medium uppercase tracking-[0.22em] text-[var(--color-gold)]">
            {BRAND.tagline}
          </p>
          <h1 className="max-w-[15ch] font-display text-[2.75rem] font-medium leading-[1.02] tracking-[-0.02em] text-[var(--color-text)] sm:text-6xl lg:text-7xl">
            Smoke, pepper and <span className="italic text-[var(--color-accent)]">fire</span>.
          </h1>
          <p className="mt-5 max-w-md text-[15px] leading-relaxed text-[var(--color-muted)] sm:text-base">
            Suya, grills and pepper soup, fired over open coals. Pickup or delivery across Lagos.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link href="/menu" className={buttonVariants({ size: "lg", className: "px-7" })}>
              View menu
            </Link>
            <Link
              href="/account/orders"
              className={buttonVariants({ variant: "secondary", size: "lg" })}
            >
              Track an order
            </Link>
          </div>
        </div>
      </section>

      {/* Featured (real data) --------------------------------------- */}
      <FeaturedGrill />

      {/* Story: three plain rows, not cards ------------------------ */}
      <section className="border-y border-[var(--color-line)] bg-[var(--color-surface)]">
        <div className="shell gutter grid divide-y divide-[var(--color-line)] py-4 sm:grid-cols-3 sm:divide-x sm:divide-y-0 sm:py-0">
          {GRILL_STORY.map(({ icon: Icon, title, body }) => (
            <div key={title} className="flex flex-col gap-2 py-8 sm:px-8 sm:py-12">
              <Icon className="size-6 text-[var(--color-accent)]" aria-hidden />
              <h3 className="font-display text-lg text-[var(--color-text)]">{title}</h3>
              <p className="text-sm leading-relaxed text-[var(--color-muted)]">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* What we grill: editorial split -------------------------- */}
      <section className="shell gutter grid gap-8 py-16 sm:grid-cols-2 sm:items-center sm:py-24">
        <div className="relative aspect-[4/5] overflow-hidden rounded-xl border border-[var(--color-line)] sm:aspect-[4/5]">
          <Image
            src={PLACEHOLDER_IMAGES.storyGrill.src}
            alt={PLACEHOLDER_IMAGES.storyGrill.alt}
            fill
            sizes="(max-width: 640px) 100vw, 45vw"
            className="object-cover"
          />
        </div>
        <div>
          <h2 className="font-display text-3xl leading-tight sm:text-4xl">
            One kitchen. The whole spread.
          </h2>
          <p className="mt-4 max-w-md text-[15px] leading-relaxed text-[var(--color-muted)]">
            From half-chicken suya and giant prawn skewers to catfish pepper soup, native rice
            and fresh smoothies. Built for one plate or a platter for ten.
          </p>
          <ul className="mt-6 flex flex-wrap gap-2">
            {WHAT_WE_GRILL.map((cat) => (
              <li
                key={cat}
                className="rounded-full border border-[var(--color-line-strong)] px-3 py-1.5 text-[13px] text-[var(--color-muted)]"
              >
                {cat}
              </li>
            ))}
          </ul>
          <Link
            href="/menu"
            className={buttonVariants({ variant: "secondary", size: "md", className: "mt-7" })}
          >
            View menu
          </Link>
        </div>
      </section>

      {/* Closing band ------------------------------------------- */}
      <section className="relative isolate overflow-hidden border-t border-[var(--color-line)]">
        <div
          aria-hidden
          className="absolute inset-0 -z-10 bg-[radial-gradient(90%_120%_at_80%_100%,rgba(214,73,31,0.22)_0%,transparent_60%)]"
        />
        <div className="shell gutter flex flex-col items-start gap-6 py-20 sm:items-center sm:py-28 sm:text-center">
          <h2 className="max-w-[18ch] font-display text-3xl leading-tight sm:text-5xl">
            Hungry now? The coals are already hot.
          </h2>
          <Link href="/menu" className={buttonVariants({ size: "lg", className: "px-8" })}>
            View menu
          </Link>
        </div>
      </section>
    </>
  );
}
