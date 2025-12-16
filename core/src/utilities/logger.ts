const isDevelopment = (): boolean => {
    if (typeof process === 'undefined' || process.env == null) {
        return false;
    }
    const env = process.env.NODE_ENV?.toLowerCase();
    return env === 'dev' || env === 'development' || env === 'test';
};

type LogMethods = "log" | "info" | "warn" | "error" | "debug" | "table";
const shouldLog = isDevelopment();
const tryLog = (type: LogMethods, ...args: unknown[]) => {
    if (shouldLog) {
        console[type](...args);
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

