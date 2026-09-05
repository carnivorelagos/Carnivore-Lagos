import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Product photos are stored on Cloudinary (admin uploads go
    // direct-to-Cloudinary via a signed signature; the stored `imageUrl`
    // is always a res.cloudinary.com URL). Without this, every
    // `next/image` for a product photo fails with a 400.
    remotePatterns: [
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
        pathname: "/**",
      },
      // Placeholder brand/lifestyle photography only (home + menu hero
      // art). Swap for real Carnivore Lagos food photography before
      // launch — see the frontend implementation notes.
      { protocol: "https", hostname: "picsum.photos", pathname: "/**" },
      { protocol: "https", hostname: "fastly.picsum.photos", pathname: "/**" },
    ],
  },
};

export default nextConfig;
