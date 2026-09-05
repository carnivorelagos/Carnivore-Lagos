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
            <div className="flex min-h-[100dvh] flex-col">
              <StoreHeader />
              <main className="flex-1 pb-20 sm:pb-0">{children}</main>
              <StoreFooter />
              <BottomNav />
            </div>
          </CartSheetProvider>
        </CartProvider>
      </NotificationProvider>
    </AuthProvider>
  );
}
