import { useCallback, useEffect, useRef, useState } from 'react';
import { getApiErrorMessage } from '../utils/apiError';

interface UseAsyncDataOptions<T> {
  /** Skip fetching (e.g. only fetch in edit mode). Default true. */
  enabled?: boolean;
  errorMessage?: string;
  /** Runs after a successful fetch — e.g. to derive multiple pieces of local state from one payload. */
  onSuccess?: (data: T) => void;
}

interface UseAsyncDataResult<T> {
  data: T | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  setData: React.Dispatch<React.SetStateAction<T | null>>;
}

/** Fetch-on-mount/deps-change with loading/error state and stale-response guarding. */
export function useAsyncData<T>(
  fetcher: () => Promise<T>,
  deps: React.DependencyList,
  options: UseAsyncDataOptions<T> = {}
): UseAsyncDataResult<T> {
  const { enabled = true, errorMessage = 'Failed to load data', onSuccess } = options;

  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);

  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  const onSuccessRef = useRef(onSuccess);
  onSuccessRef.current = onSuccess;
  const requestId = useRef(0);

  const load = useCallback(async () => {
    const id = ++requestId.current;
    setIsLoading(true);
    setError(null);
    try {
      const result = await fetcherRef.current();
      if (requestId.current !== id) return;
      setData(result);
      onSuccessRef.current?.(result);
    } catch (err) {
      if (requestId.current !== id) return;
      setError(getApiErrorMessage(err, errorMessage));
    } finally {
      if (requestId.current === id) setIsLoading(false);
    }
  }, [errorMessage]);

  useEffect(() => {
    if (!enabled) {
      requestId.current++;
      setIsLoading(false);
      return;
    }
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, load, ...deps]);

  return { data, isLoading, error, refetch: load, setData };
}
