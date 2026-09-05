/**
 * Static brand content. The API exposes no restaurant profile beyond
 * RestaurantSettings.restaurantName (admin-only), so anything here that
 * isn't a verifiable fact (address, phone, hours, socials) is a
 * PLACEHOLDER the restaurant must confirm before launch. Kept in one
 * place so there's a single list to fill in.
 */
export const BRAND = {
  name: "Carnivore Lagos",
  shortName: "Carnivore",
  tagline: "A Lagos grill house",
  // One-liner used in hero + meta.
  promise: "Suya, grills and pepper soup, fired over open coals and sent your way.",
  city: "Lagos, Nigeria",

  // --- PLACEHOLDERS - confirm with the restaurant ---
  addressLine: "Address to be confirmed",
  phoneDisplay: "+234 -",
  hours: [
    { days: "Mon – Thu", time: "12:00 – 22:00" },
    { days: "Fri – Sat", time: "12:00 – 23:30" },
    { days: "Sunday", time: "13:00 – 22:00" },
  ],
  instagram: "#",
} as const;

/**
 * Placeholder photography. `next/image` needs a real URL to render, so
 * these point at seeded Picsum images rendered dark/grainy so they read
 * as intentional art direction rather than stock. Replace `src` with
 * real Cloudinary food photography before launch.
 */
export type BrandImage = { src: string; alt: string; note: string };

export const PLACEHOLDER_IMAGES = {
  hero: {
    src: "https://picsum.photos/seed/carnivore-coals-hero/1600/1400",
    alt: "Skewers of suya over glowing coals",
    note: "Replace: hero - hands turning suya skewers over open flame, 1600x1400+",
  },
  storyGrill: {
    src: "https://picsum.photos/seed/carnivore-grill/1200/1500",
    alt: "A charcoal grill loaded with meat",
    note: "Replace: the grill, close and hot, 1200x1500+",
  },
  storyPlate: {
    src: "https://picsum.photos/seed/carnivore-plate/1200/900",
    alt: "A plated grill with sides",
    note: "Replace: a finished plate, styled, 1200x900+",
  },
  menuHero: {
    src: "https://picsum.photos/seed/carnivore-menu/1600/900",
    alt: "Assorted grilled dishes on a dark table",
    note: "Replace: menu banner - spread of dishes, 1600x900+",
  },
} satisfies Record<string, BrandImage>;
