/**
 * Auth error detection and notification for HTTP plugins.
 * Used when the remote returns 401 Unauthorized or 403 Forbidden.
 */

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

export function isAuthError(error: unknown): boolean {
    const message = error instanceof Error ? error.message : String(error);
    return message.includes('HTTP 401') || message.includes('HTTP 403');
}

export function getAuthStatusFromError(error: unknown): 401 | 403 | null {
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
    const status = getAuthStatusFromError(error);
    if (status == null) {
        return null;
    }
    const originalError = error instanceof Error ? error : new Error(String(error));
    const message = originalError.message;
    return { status, message, originalError, context };
}
