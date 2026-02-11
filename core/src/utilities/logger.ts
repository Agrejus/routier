/**
 * Enable logging by setting `globalThis.__ROUTIER_DEBUG__ = true` before any routier code runs.
 * Vite apps: add to main.tsx - `if (import.meta.env?.DEV) (globalThis as any).__ROUTIER_DEBUG__ = true`
 */
const shouldLog = (): boolean => {
    if (typeof globalThis !== 'undefined') {
        const g = globalThis as { __ROUTIER_DEBUG__?: boolean };
        if (g.__ROUTIER_DEBUG__ === true) return true;
    }
    if (typeof process !== 'undefined' && process.env != null) {
        const debug = process.env.DEBUG;
        if (debug === 'routier' || debug === '*') return true;
        const env = process.env.NODE_ENV?.toLowerCase();
        if (env === 'dev' || env === 'development' || env === 'test') return true;
    }
    const env = (import.meta as { env?: { DEV?: boolean; MODE?: string } }).env;
    if (env != null) {
        if (env.DEV === true) return true;
        const mode = env.MODE?.toLowerCase();
        if (mode === 'dev' || mode === 'development' || mode === 'test') return true;
    }
    return false;
};

type LogMethods = "log" | "info" | "warn" | "error" | "debug" | "table";
const tryLog = (type: LogMethods, ...args: unknown[]) => {
    if (shouldLog()) {
        (console[type] as (...args: unknown[]) => void)(...args);
    }
};

export const logger = {
    log: (...args: unknown[]): void => {
        tryLog("log", ...args);
    },
    info: (...args: unknown[]): void => {
        tryLog("info", ...args);
    },
    warn: (...args: unknown[]): void => {
        tryLog("warn", ...args);
    },
    error: (...args: unknown[]): void => {
        tryLog("error", ...args);
    },
    debug: (...args: unknown[]): void => {
        tryLog("debug", ...args);
    },
    table: (...args: unknown[]): void => {
        tryLog("table", ...args);
    },
};

