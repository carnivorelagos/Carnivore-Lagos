"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Status = "loading" | "error" | "ready";

export type AsyncData<T> = {
  data: T | undefined;
  error: unknown;
  status: Status;
  /** Re-run the fetcher. `quiet` keeps the current data visible. */
  reload: (quiet?: boolean) => void;
  setData: (updater: T | ((prev: T | undefined) => T)) => void;
};

/**
 * Small data hook every client data-page uses: runs `fetcher` on mount
 * and whenever a value in `deps` changes, tracks loading / error / ready,
 * and ignores results from stale runs.
 */
export function useAsyncData<T>(
  fetcher: () => Promise<T>,
  deps: React.DependencyList = [],
  opts: { enabled?: boolean } = {},
): AsyncData<T> {
  const enabled = opts.enabled ?? true;
  const [data, setDataState] = useState<T | undefined>(undefined);
  const [error, setError] = useState<unknown>(null);
  const [status, setStatus] = useState<Status>(enabled ? "loading" : "ready");
  const runId = useRef(0);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const run = useCallback(
    async (quiet = false) => {
      if (!enabled) return;
      const id = ++runId.current;
      if (!quiet) setStatus("loading");
      setError(null);
      try {
        const result = await fetcherRef.current();
        if (id === runId.current) {
          setDataState(result);
          setStatus("ready");
        }
      } catch (e) {
        if (id === runId.current) {
          setError(e);
          setStatus("error");
        }
      }
    },
    [enabled],
  );

  useEffect(() => {
    void run();
    return () => {
      runId.current++;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run, ...deps]);

  const setData = useCallback((updater: T | ((prev: T | undefined) => T)) => {
    setDataState((prev) =>
      typeof updater === "function" ? (updater as (p: T | undefined) => T)(prev) : updater,
    );
  }, []);

  return { data, error, status, reload: run, setData };
}
