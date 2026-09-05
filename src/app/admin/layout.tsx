import type { Metadata } from "next";
import { AdminAuthProvider } from "@/components/providers/AdminAuthProvider";
import { AdminShell } from "@/components/admin/AdminShell";

export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
};

/**
 * The `.admin` class re-declares the design tokens to the light,
 * functional admin palette (see globals.css). Everything inside renders
 * in that system; nothing here should look like the storefront.
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="admin min-h-[100dvh] bg-[var(--color-bg)] text-[var(--color-text)]">
      <AdminAuthProvider>
        <AdminShell>{children}</AdminShell>
      </AdminAuthProvider>
    </div>
  );
}
