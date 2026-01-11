/**
 * Supabase Retry Utility
 * Handles network errors and implements retry logic for Supabase queries
 */

interface RetryOptions {
  maxRetries?: number;
  delayMs?: number;
  exponentialBackoff?: boolean;
  onRetry?: (attempt: number, error: Error) => void;
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxRetries: 3,
  delayMs: 1000,
  exponentialBackoff: true,
  onRetry: () => {},
};

/**
 * Sleep utility for delays between retries
 */
const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Retry a Supabase operation with exponential backoff
 */
export async function retrySupabaseOperation<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= opts.maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      
      // Check if error is retryable (network errors, timeouts, 5xx)
      const isRetryable = isRetryableError(error);
      
      if (!isRetryable || attempt === opts.maxRetries) {
        throw error;
      }

      // Calculate delay with exponential backoff
      const delay = opts.exponentialBackoff
        ? opts.delayMs * Math.pow(2, attempt - 1)
        : opts.delayMs;

      console.log(
        `[SupabaseRetry] Attempt ${attempt}/${opts.maxRetries} failed. Retrying in ${delay}ms...`,
        error
      );

      opts.onRetry(attempt, lastError);
      await sleep(delay);
    }
  }

  throw lastError || new Error("Max retries exceeded");
}

/**
 * Check if an error is retryable
 */
function isRetryableError(error: unknown): boolean {
  if (!error) return false;

  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorStr = errorMessage.toLowerCase();

  // Network errors
  if (
    errorStr.includes("network") ||
    errorStr.includes("fetch") ||
    errorStr.includes("cors") ||
    errorStr.includes("timeout") ||
    errorStr.includes("econnrefused") ||
    errorStr.includes("enotfound")
  ) {
    return true;
  }

  // Check for status codes if available
  if (error && typeof error === "object" && "status" in error) {
    const status = (error as { status: number }).status;
    // Retry on 5xx server errors and 408 timeout
    if (status >= 500 || status === 408) {
      return true;
    }
  }

  return false;
}

/**
 * Get user with retry logic
 */
export async function getUserWithRetry(
  supabaseClient: any,
  options?: RetryOptions
) {
  return retrySupabaseOperation(
    async () => {
      const { data, error } = await supabaseClient.auth.getUser();
      if (error) throw error;
      return data;
    },
    {
      ...options,
      onRetry: (attempt, error) => {
        console.log(
          `[Auth] Failed to get user (attempt ${attempt}):`,
          error.message
        );
      },
    }
  );
}

/**
 * Get session with retry logic
 */
export async function getSessionWithRetry(
  supabaseClient: any,
  options?: RetryOptions
) {
  return retrySupabaseOperation(
    async () => {
      const { data, error } = await supabaseClient.auth.getSession();
      if (error) throw error;
      return data;
    },
    {
      ...options,
      onRetry: (attempt, error) => {
        console.log(
          `[Auth] Failed to get session (attempt ${attempt}):`,
          error.message
        );
      },
    }
  );
}