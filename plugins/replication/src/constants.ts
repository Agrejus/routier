/**
 * Default configuration for HttpSwrDbPlugin.
 * Retries use exponential backoff capped at retryMaxDelayMs, up to bulkPersistRetryMaxAttempts / queryRetryMaxAttempts.
 */

export const SWR_DEFAULTS = {
    maxAgeMs: 60_000,
    bulkPersistRetryBaseDelayMs: 1000,
    bulkPersistRetryMaxDelayMs: 60_000,
    bulkPersistRetryMaxAttempts: 10,
    queryRetryBaseDelayMs: 1000,
    queryRetryMaxDelayMs: 60_000,
    queryRetryMaxAttempts: 10,
} as const;
