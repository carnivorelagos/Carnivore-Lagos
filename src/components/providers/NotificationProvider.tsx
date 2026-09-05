"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  getMyNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/lib/client/endpoints";
import { isApiError } from "@/lib/client/api";
import type { AppNotification } from "@/lib/client/types";
import { useAuth } from "@/components/providers/AuthProvider";

const POLL_MS = 45_000;
const PAGE_SIZE = 20;

type NotificationContextValue = {
  items: AppNotification[];
  unreadCount: number;
  loading: boolean;
  refresh: () => Promise<void>;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
};

const NotificationContext = createContext<NotificationContextValue | null>(null);

export function useNotifications(): NotificationContextValue {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error("useNotifications must be used inside <NotificationProvider>");
  return ctx;
}

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { customer } = useAuth();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const inFlight = useRef(false);

  const refresh = useCallback(async () => {
    if (!customer || inFlight.current) return;
    inFlight.current = true;
    setLoading(true);
    try {
      const res = await getMyNotifications({ page: 1, limit: PAGE_SIZE });
      setItems(res.items);
      setUnreadCount(res.unreadCount);
    } catch (e) {
      if (isApiError(e) && (e.status === 401 || e.code === "UNAUTHORIZED")) {
        setItems([]);
        setUnreadCount(0);
      }
      // transient errors: keep what we had
    } finally {
      inFlight.current = false;
      setLoading(false);
    }
  }, [customer]);

  // Reset + prime when auth state changes.
  useEffect(() => {
    if (!customer) {
      setItems([]);
      setUnreadCount(0);
      return;
    }
    void refresh();
  }, [customer, refresh]);

  // Poll while signed in and the tab is visible.
  useEffect(() => {
    if (!customer) return;
    const tick = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    const interval = setInterval(tick, POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [customer, refresh]);

  // Keep a ref so the memoised callbacks can trigger a re-fetch on error
  // without listing `refresh` as a dependency (which would rebuild them).
  const refreshRef = useRef<() => Promise<void>>(refresh);
  useEffect(() => {
    refreshRef.current = refresh;
  }, [refresh]);

  const markRead = useCallback(async (id: string) => {
    setItems((prev) =>
      prev.map((n) => (n.id === id && !n.readAt ? { ...n, readAt: new Date().toISOString() } : n)),
    );
    setUnreadCount((c) => Math.max(0, c - 1));
    try {
      await markNotificationRead(id);
    } catch {
      void refreshRef.current();
    }
  }, []);

  const markAllRead = useCallback(async () => {
    setItems((prev) => prev.map((n) => (n.readAt ? n : { ...n, readAt: new Date().toISOString() })));
    setUnreadCount(0);
    try {
      await markAllNotificationsRead();
    } catch {
      void refreshRef.current();
    }
  }, []);

  const value = useMemo(
    () => ({ items, unreadCount, loading, refresh, markRead, markAllRead }),
    [items, unreadCount, loading, refresh, markRead, markAllRead],
  );

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}
