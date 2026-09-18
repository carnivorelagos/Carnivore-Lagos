import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { Anton, Inter, JetBrains_Mono } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";
import { ToastProvider } from "@/components/providers/ToastProvider";
import { RouteProgress } from "@/components/system/RouteProgress";

/**
 * Display face. Anton — a single heavy, condensed grotesque — is the
 * closest legible stand-in for the brushed Carnivore Lagos lettering.
 * Used only for h1/h2 and the wordmark; the sans carries everything else.
 */
const anton = Anton({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-anton",
  weight: "400",
});

/**
 * Logo face — Drazel (idealistudio), a distressed brush font, used ONLY for
 * the "CARNIVORE LAGOS" wordmark. Subset to A-Z, 0-9, space and a few
 * punctuation marks (~14KB) — enough for the wordmark, not the full font.
 * NOTE: the free download is "personal use only"; a commercial license is
 * sold at https://creativemarket.com/idealistudio/292381885-DRAZEL-%E2%80%94-Distressed-Brush-Font
 * To switch to licensed files, replace fonts/Drazel-subset.woff2.
 */
const drazel = localFont({
  src: "./fonts/Drazel-subset.woff2",
  display: "swap",
  variable: "--font-drazel",
  weight: "400",
});

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-jetbrains",
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"),
  title: {
    default: "Carnivore Lagos - Suya, grills & pepper soup, delivered",
    template: "%s · Carnivore Lagos",
  },
  description:
    "A Lagos grill house. Order half-chicken suya, asun, tomahawk, pepper soup and more for pickup or delivery.",
  applicationName: "Carnivore Lagos",
  openGraph: {
    title: "Carnivore Lagos",
    description:
      "A Lagos grill house. Order suya, grills and pepper soup for pickup or delivery.",
    type: "website",
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#0c0b0b",
  colorScheme: "dark light",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${anton.variable} ${drazel.variable} ${inter.variable} ${jetbrainsMono.variable}`}
    >
      <body>
        <Suspense fallback={null}>
          <RouteProgress />
        </Suspense>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
