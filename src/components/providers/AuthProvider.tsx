"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { customerLogout, getMe } from "@/lib/client/endpoints";
import { isApiError } from "@/lib/client/api";
import type { Customer } from "@/lib/client/types";

type AuthContextValue = {
  customer: Customer | null;
  loading: boolean;
  /** True once the first /api/me probe has resolved. */
  ready: boolean;
  refresh: () => Promise<void>;
  /** Directly set the customer (after OTP verify / email confirm). */
  setCustomer: (c: Customer) => void;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [customer, setCustomerState] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const me = await getMe();
      setCustomerState(me);
    } catch (e) {
      // 401 = signed out. Never surface as an application error.
      if (isApiError(e) && (e.status === 401 || e.code === "UNAUTHORIZED")) {
        setCustomerState(null);
      } else {
        // Transient/network failure: keep whatever we had, don't crash.
        setCustomerState((prev) => prev);
      }
    } finally {
      setLoading(false);
      setReady(true);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const setCustomer = useCallback((c: Customer) => {
    setCustomerState(c);
    setReady(true);
    setLoading(false);
  }, []);

  const logout = useCallback(async () => {
    try {
      await customerLogout();
    } finally {
      setCustomerState(null);
    }
  }, []);

  const value = useMemo(
    () => ({ customer, loading, ready, refresh, setCustomer, logout }),
    [customer, loading, ready, refresh, setCustomer, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
