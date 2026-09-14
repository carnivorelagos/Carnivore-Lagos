import Image from "next/image";
import Link from "next/link";
import {
  Fire,
  Motorcycle,
  Storefront,
} from "@phosphor-icons/react/dist/ssr";
import { buttonVariants } from "@/components/ui/buttonVariants";
import { FeaturedGrill } from "@/components/store/FeaturedGrill";
import { BRAND, PLACEHOLDER_IMAGES } from "@/lib/client/brand";

// Kept for a possible future restore — not currently rendered (the home
// page is menu-first now: FeaturedGrill only, then the footer). See the
// commented-out JSX below.
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
      {/* Hero, story, "what we grill" and the closing CTA band are
          disabled per the client's request: home page is menu-first now —
          straight into "Straight from the grill", then the footer. Left
          in place (commented out, not deleted) in case they're wanted
          back later.

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
          className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,color-mix(in_oklab,var(--color-bg)_68%,transparent)_0%,color-mix(in_oklab,var(--color-bg)_84%,transparent)_52%,var(--color-bg)_100%)]"
        />
        <div
          aria-hidden
          className="absolute inset-0 -z-10 bg-[radial-gradient(120%_90%_at_12%_0%,color-mix(in_oklab,var(--color-accent)_26%,transparent)_0%,transparent_55%)]"
        />

        <div className="shell gutter flex min-h-[calc(100dvh-3.5rem)] flex-col justify-end pb-16 pt-20 sm:min-h-[calc(100dvh-4rem)] sm:pb-24">
          <p className="eyebrow mb-5 flex items-center gap-3 text-[var(--color-bone)]">
            <span aria-hidden className="h-px w-8 bg-[var(--color-accent)]" />
            {BRAND.tagline}
          </p>
          <h1 className="display max-w-[16ch] text-[3rem] text-[var(--color-text)] sm:text-7xl lg:text-[5.5rem]">
            Smoke, pepper <br className="hidden sm:block" />and <span className="text-[var(--color-accent)]">fire</span>
          </h1>
          <p className="mt-6 max-w-md text-[15px] leading-relaxed text-[var(--color-muted)] sm:text-base">
            Suya, grills and pepper soup, fired over open coals. Pickup or delivery across Lagos.
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-3">
            <Link href="/menu" className={buttonVariants({ size: "lg" })}>
              View menu
            </Link>
            <Link
              href="/history"
              className={buttonVariants({ variant: "secondary", size: "lg" })}
            >
              Track an order
            </Link>
          </div>
        </div>
      </section>
      */}

      <FeaturedGrill standalone />

      {/*
      <section className="border-y border-[var(--color-line)] bg-[var(--color-surface)]">
        <div className="shell gutter grid divide-y divide-[var(--color-line)] py-4 sm:grid-cols-3 sm:divide-x sm:divide-y-0 sm:py-0">
          {GRILL_STORY.map(({ icon: Icon, title, body }, i) => (
            <div key={title} className="flex flex-col gap-3 py-8 sm:px-8 sm:py-14">
              <div className="flex items-center gap-3">
                <Icon className="size-5 text-[var(--color-accent)]" weight="fill" aria-hidden />
                <span className="eyebrow text-[var(--color-subtle)]">
                  {String(i + 1).padStart(2, "0")}
                </span>
              </div>
              <h3 className="text-[17px] text-[var(--color-text)]">{title}</h3>
              <p className="text-sm leading-relaxed text-[var(--color-muted)]">{body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="shell gutter grid gap-10 py-16 sm:grid-cols-2 sm:items-center sm:py-24">
        <div className="relative aspect-[4/5] overflow-hidden rounded-[var(--radius-xl)] border border-[var(--color-line)]">
          <Image
            src={PLACEHOLDER_IMAGES.storyGrill.src}
            alt={PLACEHOLDER_IMAGES.storyGrill.alt}
            fill
            sizes="(max-width: 640px) 100vw, 45vw"
            className="object-cover"
          />
          <div
            aria-hidden
            className="absolute inset-0 bg-[linear-gradient(160deg,transparent_45%,color-mix(in_oklab,var(--color-bg)_70%,transparent))]"
          />
        </div>
        <div>
          <h2 className="brand-rule text-3xl leading-[0.95] sm:text-[2.75rem]">
            One kitchen.<br />The whole spread.
          </h2>
          <p className="mt-6 max-w-md text-[15px] leading-relaxed text-[var(--color-muted)]">
            From half-chicken suya and giant prawn skewers to catfish pepper soup, native rice
            and fresh smoothies. Built for one plate or a platter for ten.
          </p>
          <ul className="mt-7 flex flex-wrap gap-2">
            {WHAT_WE_GRILL.map((cat) => (
              <li
                key={cat}
                className="rounded-full border border-[var(--color-line-strong)] px-3 py-1.5 text-[12px] font-semibold uppercase tracking-[0.05em] text-[var(--color-muted)]"
              >
                {cat}
              </li>
            ))}
          </ul>
          <Link
            href="/menu"
            className={buttonVariants({ variant: "secondary", size: "md", className: "mt-8" })}
          >
            View menu
          </Link>
        </div>
      </section>

      <section className="relative isolate overflow-hidden border-t border-[var(--color-line)]">
        <div
          aria-hidden
          className="absolute inset-0 -z-10 bg-[radial-gradient(90%_120%_at_80%_100%,color-mix(in_oklab,var(--color-accent)_20%,transparent)_0%,transparent_60%)]"
        />
        <div className="shell gutter flex flex-col items-start gap-7 py-20 sm:items-center sm:py-28 sm:text-center">
          <h2 className="display max-w-[16ch] text-[2rem] leading-[0.92] sm:text-[3.25rem]">
            Hungry now? The coals are already hot.
          </h2>
          <Link href="/menu" className={buttonVariants({ size: "lg" })}>
            View menu
          </Link>
        </div>
      </section>
      */}
    </>
  );
}
