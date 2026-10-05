import { backoffDelayMs, isAuthStatus, isPermanentStatus, readRetryAfterMs } from './httpUtils';
import type { AnyRequestError } from './syncHooks';

export type RetryOptions = {
    maxAttempts?: number;
    baseDelayMs?: number;
    maxDelayMs?: number;
};

const DEFAULT_MAX_ATTEMPTS = 3;
const DEFAULT_BASE_DELAY_MS = 500;
const DEFAULT_MAX_DELAY_MS = 30_000;

const retryAfterFor = (error: AnyRequestError): number | null | false => {
    if (error.kind === 'http') {
        return isAuthStatus(error.status) || isPermanentStatus(error.status) ? false : readRetryAfterMs(error);
    }

    return error.kind === 'network' ? null : false;
};

const isRefused = (error: AnyRequestError): boolean => error.kind === 'http' && isPermanentStatus(error.status);

const giveUp = (error: AnyRequestError): void => {
    if ('done' in error) {
        error.done();
        return;
    }

    if ('defer' in error && !isRefused(error)) {
        error.defer();
        return;
    }

    error.reject();
};

export const createRetry = (options: RetryOptions = {}): (error: AnyRequestError) => void => {
    const maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
    const baseDelayMs = options.baseDelayMs ?? DEFAULT_BASE_DELAY_MS;
    const maxDelayMs = options.maxDelayMs ?? DEFAULT_MAX_DELAY_MS;

    return (error) => {
        const retryAfterMs = retryAfterFor(error);

        if (retryAfterMs === false || error.attempt >= maxAttempts) {
            giveUp(error);
            return;
        }

        setTimeout(() => void error.retry(), backoffDelayMs(error.attempt - 1, baseDelayMs, maxDelayMs, retryAfterMs));
    };
};

export const defaultSync = (): { onError: (error: AnyRequestError) => void; autoSync: true } => ({
    onError: createRetry(),
    autoSync: true,
});
