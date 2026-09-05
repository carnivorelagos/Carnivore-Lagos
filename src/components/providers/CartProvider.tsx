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

export const CART_STORAGE_KEY = "carnivore_cart";
export const MAX_QTY_PER_ITEM = 50; // MAX_QUANTITY_PER_ITEM in validation.ts
export const MAX_DISTINCT_ITEMS = 30; // MAX_DISTINCT_ITEMS in validation.ts

export type CartItem = {
  productId: string;
  name: string;
  priceKobo: number;
  imageUrl: string | null;
  quantity: number;
};

type AddResult = "added" | "at-max-qty" | "cart-full";

type CartContextValue = {
  items: CartItem[];
  /** Hydrated from localStorage yet? Avoids SSR/first-paint mismatch. */
  hydrated: boolean;
  count: number;
  /** Display snapshot only - the server is authoritative at checkout. */
  subtotalKobo: number;
  add: (item: Omit<CartItem, "quantity">, quantity?: number) => AddResult;
  setQuantity: (productId: string, quantity: number) => void;
  remove: (productId: string) => void;
  clear: () => void;
  has: (productId: string) => boolean;
  quantityOf: (productId: string) => number;
};

const CartContext = createContext<CartContextValue | null>(null);

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside <CartProvider>");
  return ctx;
}

function sanitize(raw: unknown): CartItem[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: CartItem[] = [];
  for (const r of raw) {
    if (!r || typeof r !== "object") continue;
    const o = r as Record<string, unknown>;
    if (typeof o.productId !== "string" || seen.has(o.productId)) continue;
    if (typeof o.name !== "string" || typeof o.priceKobo !== "number") continue;
    const qty = Math.min(
      MAX_QTY_PER_ITEM,
      Math.max(1, Math.floor(Number(o.quantity) || 1)),
    );
    seen.add(o.productId);
    out.push({
      productId: o.productId,
      name: o.name,
      priceKobo: Math.max(0, Math.round(o.priceKobo)),
      imageUrl: typeof o.imageUrl === "string" ? o.imageUrl : null,
      quantity: qty,
    });
    if (out.length >= MAX_DISTINCT_ITEMS) break;
  }
  return out;
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const writeRef = useRef(false);

  // Load once on mount.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(CART_STORAGE_KEY);
      if (raw) setItems(sanitize(JSON.parse(raw)));
    } catch {
      /* corrupted / unavailable storage - start empty */
    }
    setHydrated(true);
  }, []);

  // Persist after hydration.
  useEffect(() => {
    if (!hydrated) return;
    writeRef.current = true;
    try {
      window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
    } catch {
      /* quota / private mode - cart still works for this session */
    }
  }, [items, hydrated]);

  // Keep multiple tabs in sync.
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key !== CART_STORAGE_KEY) return;
      if (writeRef.current) {
        writeRef.current = false;
        return;
      }
      try {
        setItems(sanitize(e.newValue ? JSON.parse(e.newValue) : []));
      } catch {
        setItems([]);
      }
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const add = useCallback<CartContextValue["add"]>((item, quantity = 1) => {
    let result: AddResult = "added";
    setItems((prev) => {
      const existing = prev.find((p) => p.productId === item.productId);
      if (existing) {
        const next = Math.min(MAX_QTY_PER_ITEM, existing.quantity + quantity);
        if (next === existing.quantity) result = "at-max-qty";
        return prev.map((p) =>
          p.productId === item.productId ? { ...p, quantity: next, priceKobo: item.priceKobo, name: item.name, imageUrl: item.imageUrl } : p,
        );
      }
      if (prev.length >= MAX_DISTINCT_ITEMS) {
        result = "cart-full";
        return prev;
      }
      return [
        ...prev,
        { ...item, quantity: Math.min(MAX_QTY_PER_ITEM, Math.max(1, quantity)) },
      ];
    });
    return result;
  }, []);

  const setQuantity = useCallback<CartContextValue["setQuantity"]>((productId, quantity) => {
    setItems((prev) => {
      if (quantity <= 0) return prev.filter((p) => p.productId !== productId);
      const clamped = Math.min(MAX_QTY_PER_ITEM, Math.floor(quantity));
      return prev.map((p) => (p.productId === productId ? { ...p, quantity: clamped } : p));
    });
  }, []);

  const remove = useCallback((productId: string) => {
    setItems((prev) => prev.filter((p) => p.productId !== productId));
  }, []);

  const clear = useCallback(() => setItems([]), []);

  const value = useMemo<CartContextValue>(() => {
    const count = items.reduce((n, i) => n + i.quantity, 0);
    const subtotalKobo = items.reduce((n, i) => n + i.priceKobo * i.quantity, 0);
    return {
      items,
      hydrated,
      count,
      subtotalKobo,
      add,
      setQuantity,
      remove,
      clear,
      has: (id) => items.some((i) => i.productId === id),
      quantityOf: (id) => items.find((i) => i.productId === id)?.quantity ?? 0,
    };
  }, [items, hydrated, add, setQuantity, remove, clear]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}
