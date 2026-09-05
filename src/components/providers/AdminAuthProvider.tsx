"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { adminLogout, adminMe } from "@/lib/client/endpoints";
import { isApiError } from "@/lib/client/api";
import type { AdminIdentity } from "@/lib/client/types";

type AdminAuthValue = {
  admin: AdminIdentity | null;
  ready: boolean;
  setAdmin: (a: AdminIdentity) => void;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
};

const AdminAuthContext = createContext<AdminAuthValue | null>(null);

export function useAdminAuth(): AdminAuthValue {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) throw new Error("useAdminAuth must be used inside <AdminAuthProvider>");
  return ctx;
}

/**
 * Guards every /admin route except /admin/login. A 401 from any admin
 * call (surfaced here on mount, and by pages on demand) sends the user
 * to /admin/login (Section 31).
 */
export function AdminAuthProvider({ children }: { children: React.ReactNode }) {
  const [admin, setAdminState] = useState<AdminIdentity | null>(null);
  const [ready, setReady] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const isLoginRoute = pathname === "/admin/login";

  const refresh = useCallback(async () => {
    try {
      const me = await adminMe();
      setAdminState(me);
    } catch (e) {
      setAdminState(null);
      if (isApiError(e) && (e.status === 401 || e.code === "UNAUTHORIZED")) {
        if (!isLoginRoute) {
          const next = encodeURIComponent(pathname || "/admin");
          router.replace(`/admin/login?next=${next}`);
        }
      }
    } finally {
      setReady(true);
    }
  }, [router, pathname, isLoginRoute]);

  useEffect(() => {
    if (isLoginRoute) {
      setReady(true);
      return;
    }
    void refresh();
  }, [isLoginRoute, refresh]);

  const setAdmin = useCallback((a: AdminIdentity) => {
    setAdminState(a);
    setReady(true);
  }, []);

  const logout = useCallback(async () => {
    try {
      await adminLogout();
    } finally {
      setAdminState(null);
      router.replace("/admin/login");
    }
  }, [router]);

  const value = useMemo(
    () => ({ admin, ready, setAdmin, refresh, logout }),
    [admin, ready, setAdmin, refresh, logout],
  );

  return <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>;
}
