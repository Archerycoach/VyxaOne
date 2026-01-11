import { useEffect, useState, useCallback } from "react";

interface QueryOptions {
  cacheKey?: string;
  cacheDuration?: number;
  enableCache?: boolean;
}

/**
 * Simple retry logic for queries
 */
async function retryQuery<T>(
  queryFn: () => Promise<T>,
  maxRetries = 3,
  delay = 1000
): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await queryFn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await new Promise((resolve) => setTimeout(resolve, delay * (i + 1)));
    }
  }
  throw new Error("Max retries reached");
}

/**
 * Custom hook for optimized Supabase queries with caching and retry logic
 */
export function useOptimizedQuery<T>(
  queryFn: () => Promise<T>,
  dependencies: any[] = [],
  options: QueryOptions = {}
) {
  const { 
    cacheKey, 
    cacheDuration = 5 * 60 * 1000, // 5 minutes default
    enableCache = true 
  } = options;

  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Check cache if enabled
      if (enableCache && cacheKey) {
        const cachedData = localStorage.getItem(cacheKey);
        if (cachedData) {
          const { data: cached, timestamp } = JSON.parse(cachedData);
          if (Date.now() - timestamp < cacheDuration) {
            setData(cached);
            setLoading(false);
            return;
          }
        }
      }

      // Execute query with retry logic
      const result = await retryQuery(queryFn);
      setData(result);

      // Cache result if enabled
      if (enableCache && cacheKey) {
        localStorage.setItem(
          cacheKey,
          JSON.stringify({
            data: result,
            timestamp: Date.now(),
          })
        );
      }
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, dependencies);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const refetch = useCallback(() => {
    if (cacheKey) {
      localStorage.removeItem(cacheKey);
    }
    return fetchData();
  }, [fetchData, cacheKey]);

  return { data, loading, error, refetch };
}