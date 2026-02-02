/**
 * Default configuration for HttpSwrDbPlugin.
 * When offline (non-auth errors), retries are unbounded with exponential backoff capped at retryMaxDelayMs.
 */

export const SWR_DEFAULTS = {
    maxAgeMs: 60_000,
    bulkPersistRetryBaseDelayMs: 1000,
    bulkPersistRetryMaxDelayMs: 60_000,
    queryRetryBaseDelayMs: 1000,
    queryRetryMaxDelayMs: 60_000,
} as const;
