/**
 * Cache utilities for handling Vercel production cache issues
 * Ensures data is always fresh after mutations
 */

/**
 * Get cached data from localStorage
 */
export const getCachedData = <T>(key: string, maxAge: number): T | null => {
  if (typeof window === "undefined") return null;
  
  try {
    const cached = localStorage.getItem(key);
    if (!cached) return null;
    
    const { data, timestamp } = JSON.parse(cached);
    const age = Date.now() - timestamp;
    
    if (age > maxAge) {
      localStorage.removeItem(key);
      return null;
    }
    
    return data as T;
  } catch {
    return null;
  }
};

/**
 * Set cached data in localStorage
 */
export const setCachedData = <T>(key: string, data: T): void => {
  if (typeof window === "undefined") return;
  
  try {
    localStorage.setItem(
      key,
      JSON.stringify({
        data,
        timestamp: Date.now(),
      })
    );
  } catch (error) {
    console.error("Error caching data:", error);
  }
};

/**
 * Force revalidate a specific path in Next.js
 * @param path - The path to revalidate (e.g., '/dashboard', '/leads')
 */
export const revalidatePath = async (path: string) => {
  if (typeof window !== "undefined") {
    // Client-side: Use router to force refresh
    // This is handled by calling reload callbacks
    return;
  }
  
  // Server-side revalidation would go here
  // For now, we rely on client-side data refetching
};

/**
 * Clear all Supabase query caches
 * Use this after mutations to ensure fresh data
 */
export const clearSupabaseCache = () => {
  // Clear any cached Supabase queries
  // This is a placeholder for potential future cache implementation
  if (typeof window !== "undefined") {
    // Force service worker to clear caches if present
    if ("caches" in window) {
      caches.keys().then((names) => {
        names.forEach((name) => {
          if (name.includes("supabase")) {
            caches.delete(name);
          }
        });
      });
    }
  }
};

/**
 * Add cache-busting parameter to avoid stale data
 * @param url - The URL to add cache busting to
 */
export const addCacheBuster = (url: string): string => {
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}_t=${Date.now()}`;
};

/**
 * Configure fetch with no-cache headers for production
 */
export const getNoCacheHeaders = (): HeadersInit => {
  return {
    "Cache-Control": "no-cache, no-store, must-revalidate",
    "Pragma": "no-cache",
    "Expires": "0",
  };
};

/**
 * Wrapper for fetch that bypasses cache in production
 */
export const fetchWithNoCache = async (
  url: string,
  options?: RequestInit
): Promise<Response> => {
  return fetch(addCacheBuster(url), {
    ...options,
    headers: {
      ...options?.headers,
      ...getNoCacheHeaders(),
    },
  });
};