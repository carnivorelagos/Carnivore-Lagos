import { clsx, type ClassValue } from "clsx";

/** Conditional className join. Keep class lists non-conflicting by hand
 * (no tailwind-merge dependency). */
export function cn(...inputs: ClassValue[]): string {
  return clsx(inputs);
}
