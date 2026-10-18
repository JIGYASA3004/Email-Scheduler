import { useCallback, useEffect, useRef, useState } from 'react';

interface Fetched<T> {
  data: T | undefined;
  error: string | null;
  /** true only for the first load (or after deps change), not for background refreshes */
  pending: boolean;
  refresh: () => void;
}

/** Loads data from `loader`, reloading when `deps` change and, optionally, every `everyMs`. */
export function useFetched<T>(loader: () => Promise<T>, deps: unknown[], everyMs?: number): Fetched<T> {
  const [data, setData] = useState<T>();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(true);
  const generation = useRef(0);

  const run = useCallback(
    (quiet: boolean) => {
      const mine = ++generation.current;
      if (!quiet) setPending(true);
      loader()
        .then((value) => {
          if (mine !== generation.current) return;
          setData(value);
          setError(null);
        })
        .catch((err: Error) => mine === generation.current && setError(err.message))
        .finally(() => mine === generation.current && setPending(false));
    },
    deps,
  );

  useEffect(() => {
    run(false);
    if (!everyMs) return;
    const timer = window.setInterval(() => run(true), everyMs);
    return () => window.clearInterval(timer);
  }, [run, everyMs]);

  return { data, error, pending, refresh: () => run(true) };
}
