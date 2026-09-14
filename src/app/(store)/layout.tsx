import { AuthProvider } from "@/components/providers/AuthProvider";
import { CartProvider } from "@/components/providers/CartProvider";
import { NotificationProvider } from "@/components/providers/NotificationProvider";
import { CartSheetProvider } from "@/components/store/CartSheet";
import { StoreHeader } from "@/components/store/StoreHeader";
import { StoreFooter } from "@/components/store/StoreFooter";
import { BottomNav } from "@/components/store/BottomNav";

export default function StoreLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <NotificationProvider>
        <CartProvider>
          <CartSheetProvider>
            <a
              href="#main"
              className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-[var(--radius-md)] focus:bg-[var(--color-accent)] focus:px-4 focus:py-2 focus:text-[13px] focus:font-semibold focus:uppercase focus:tracking-[0.08em] focus:text-[var(--color-on-accent)]"
            >
              Skip to menu
            </a>
            <div aria-hidden className="grain-overlay" />
            <div className="flex min-h-[100dvh] flex-col">
              <StoreHeader />
              <main id="main" className="flex-1 pb-20 sm:pb-0">
                {children}
              </main>
              <StoreFooter />
              <BottomNav />
            </div>
          </CartSheetProvider>
        </CartProvider>
      </NotificationProvider>
    </AuthProvider>
  );
}
