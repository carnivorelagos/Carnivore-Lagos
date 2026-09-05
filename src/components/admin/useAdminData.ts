"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { isApiError } from "@/lib/client/api";
import { useAsyncData } from "@/lib/client/useAsyncData";

/**
 * useAsyncData for admin pages: any 401 from the fetch means the session
 * expired -> bounce to /admin/login (Section 31).
 */
export function useAdminData<T>(
  fetcher: () => Promise<T>,
  deps: React.DependencyList = [],
) {
  const router = useRouter();
  const state = useAsyncData<T>(fetcher, deps);

  useEffect(() => {
    if (isApiError(state.error) && (state.error.status === 401 || state.error.code === "UNAUTHORIZED")) {
      router.replace("/admin/login");
    }
  }, [state.error, router]);

  return state;
}
