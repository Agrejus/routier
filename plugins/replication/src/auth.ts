/**
 * Auth error detection and notification for HTTP plugins.
 * Used when the remote returns 401 Unauthorized or 403 Forbidden.
 */

import { HttpStatusError, isAuthStatus } from './httpUtils';

/**
 * Event passed to onAuthError when the remote returns 401 Unauthorized or 403 Forbidden.
 * Higher-level code can use this to trigger re-authentication (e.g. refresh token, redirect to login).
 */
export interface AuthErrorEvent {
    /** HTTP status that triggered the event. */
    status: 401 | 403;
    /** Human-readable message (e.g. from response statusText). */
    message: string;
    /** The error thrown or constructed from the response. */
    originalError: Error;
    /** Whether this came from a query (GET) or bulkPersist (POST). */
    context: 'query' | 'bulkPersist';
}

/**
 * Handler invoked when the remote returns 401/403. May return (or resolve to)
 * `true` to signal that re-authentication succeeded — e.g. a token refresh —
 * in which case the failed operation is retried ONCE with fresh headers.
 */
export type AuthErrorHandler = (event: AuthErrorEvent) => void | boolean | Promise<void | boolean>;

/**
 * The auth status behind a failure, or null if it is not an auth failure.
 *
 * An HttpStatusError carries the status, which is the only reliable source. The message check
 * is a fallback for an error that lost its type on the way here — one rebuilt from a string by
 * a composed plugin, or crossed a worker boundary. It matches the `HTTP <status>: <text>`
 * shape HttpStatusError produces, so the two stay in step.
 */
function authStatusOf(error: unknown): 401 | 403 | null {
    // Stryker disable next-line ConditionalExpression,BlockStatement: deliberately redundant.
    // HttpStatusError's message embeds the same status this branch reads, so removing the branch
    // reaches the identical answer through the fallback below — no test can tell them apart.
    // Kept because reading the field is exact, while the fallback is string matching.
    if (error instanceof HttpStatusError) {
        return isAuthStatus(error.status) ? (error.status as 401 | 403) : null;
    }

    const message = error instanceof Error ? error.message : String(error);
    if (message.includes('HTTP 401')) {
        return 401;
    }
    if (message.includes('HTTP 403')) {
        return 403;
    }
    return null;
}

export function buildAuthErrorEvent(
    error: unknown,
    context: AuthErrorEvent['context']
): AuthErrorEvent | null {
    const status = authStatusOf(error);
    if (status == null) {
        return null;
    }
    const originalError = error instanceof Error ? error : new Error(String(error));
    const message = originalError.message;
    return { status, message, originalError, context };
}
