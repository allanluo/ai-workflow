// Error taxonomy for workflow execution

export type ErrorClassification = "transient" | "permanent" | "user_error";
export type RetryPolicy = "fail_fast" | "retry_3x" | "retry_with_backoff";

export interface ExecutionError {
  code: string;
  message: string;
  classification: ErrorClassification;
  retry_policy: RetryPolicy;
  original_error?: Error;
}

export interface RetryConfig {
  max_attempts: number;
  base_delay_ms: number;
  max_delay_ms: number;
  backoff_multiplier: number;
}

export const ERROR_CLASSIFICATIONS: Record<string, ErrorClassification> = {
  // Transient errors (safe to retry)
  TIMEOUT: "transient",
  NETWORK_ERROR: "transient",
  SERVICE_UNAVAILABLE: "transient",
  RATE_LIMIT: "transient",
  TEMPORARY_FAILURE: "transient",

  // Permanent errors (don't retry)
  INVALID_INPUT: "permanent",
  INVALID_MODEL: "permanent",
  UNSUPPORTED_FEATURE: "permanent",
  CONFIGURATION_ERROR: "permanent",
  AUTHENTICATION_FAILED: "permanent",

  // User errors (user should fix)
  ASSET_NOT_FOUND: "user_error",
  INVALID_ASSET_VERSION: "user_error",
  PERMISSION_DENIED: "user_error",
  INVALID_WORKFLOW: "user_error"
};

export const RETRY_POLICIES: Record<ErrorClassification, RetryPolicy> = {
  transient: "retry_with_backoff",
  permanent: "fail_fast",
  user_error: "fail_fast"
};

export const RETRY_CONFIGS: Record<RetryPolicy, RetryConfig> = {
  fail_fast: {
    max_attempts: 1,
    base_delay_ms: 0,
    max_delay_ms: 0,
    backoff_multiplier: 1
  },
  retry_3x: {
    max_attempts: 3,
    base_delay_ms: 1000,
    max_delay_ms: 5000,
    backoff_multiplier: 2
  },
  retry_with_backoff: {
    max_attempts: 5,
    base_delay_ms: 500,
    max_delay_ms: 30000,
    backoff_multiplier: 2
  }
};

export function classifyError(errorCode: string): ErrorClassification {
  return ERROR_CLASSIFICATIONS[errorCode] ?? "permanent";
}

export function getRetryPolicy(classification: ErrorClassification): RetryPolicy {
  return RETRY_POLICIES[classification];
}

export function getRetryConfig(policy: RetryPolicy): RetryConfig {
  return RETRY_CONFIGS[policy];
}

export async function executeWithRetry<T>(
  fn: () => Promise<T>,
  policy: RetryPolicy,
  onRetry?: (attempt: number, error: Error) => void
): Promise<T> {
  const config = getRetryConfig(policy);
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= config.max_attempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt < config.max_attempts) {
        const delay = Math.min(
          config.base_delay_ms * Math.pow(config.backoff_multiplier, attempt - 1),
          config.max_delay_ms
        );

        if (onRetry) {
          onRetry(attempt, lastError);
        }

        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError ?? new Error("Execution failed after all retries");
}
