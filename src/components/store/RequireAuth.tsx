"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";
import { Spinner } from "@/components/ui/feedback";

/** Gates a customer-only page. Redirects to /login preserving the target. */
export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { customer, ready } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (ready && !customer) {
      router.replace(`/login?redirect=${encodeURIComponent(pathname)}`);
    }
  }, [ready, customer, router, pathname]);

  if (!ready || !customer) {
    return (
      <div className="shell gutter grid min-h-[50vh] place-items-center py-20">
        <Spinner />
      </div>
    );
  }

  return <>{children}</>;
}
