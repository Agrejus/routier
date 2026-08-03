/**
 * Levelled logging, resolved once.
 *
 * Three things about the previous implementation drove this shape:
 *
 *  - **There was no way to turn logging off.** `globalThis.__ROUTIER_DEBUG__` was only ever
 *    compared against `true`, so setting it to `false` did nothing — while
 *    `docs/how-to/debug-logging.md` documented exactly that as the way to force logging off.
 *    A documented switch that silently does nothing is worse than no switch.
 *  - **`NODE_ENV === 'test'` enabled it.** Every Jest run therefore logged, because Jest always
 *    sets `NODE_ENV=test`. Measured on the S7 stress scenario, which drives ~2,000 saves through
 *    a plugin that logs three lines per query: 12.4s with logging, ~6s without. Test runners also
 *    capture console output by snapshotting a stack trace per call, so the cost is far above what
 *    writing to a terminal would suggest — and the output buries whatever the failure was.
 *  - **It was all-or-nothing, and re-resolved per call.** An error could not be kept while debug
 *    was dropped, and every one of the ~97 call sites re-read `globalThis` and `process.env`.
 *
 * Levels are compared numerically against a value cached at module load. Measured against a
 * no-op console at 200k calls: an enabled call costs ~70ns, a call rejected by the gate ~3ns.
 * Building the arguments the call site passes in accounts for ~0.2ns of that 3ns, which is why
 * this keeps the ordinary `logger.debug(msg, payload)` signature instead of taking a thunk —
 * a lazy API would recover 0.3% of an enabled call's cost and would have to change every call
 * site to do it.
 */

/** Ordered from most severe to most verbose. `silent` discards everything. */
export const LOG_LEVELS = ['silent', 'error', 'warn', 'info', 'debug'] as const;

export type LogLevel = (typeof LOG_LEVELS)[number];

/** Numeric rank, so a gate is one integer comparison. */
const RANK: Record<LogLevel, number> = {
    silent: 0,
    error: 1,
    warn: 2,
    info: 3,
    debug: 4,
};

const isLogLevel = (value: unknown): value is LogLevel =>
    typeof value === 'string' && (LOG_LEVELS as readonly string[]).includes(value);

/**
 * Resolves the configured level, in precedence order.
 *
 * Ordered most specific first: an explicit level beats a boolean flag, a boolean flag beats an
 * environment variable, and an environment variable beats an inference from `NODE_ENV`. Anything
 * unrecognised is ignored rather than treated as an error — a typo'd level should not take down
 * an application, and `silent` is the safe direction to fall back to.
 */
const resolveLevel = (): LogLevel => {
    if (typeof globalThis !== 'undefined') {
        const g = globalThis as { __ROUTIER_LOG_LEVEL__?: unknown; __ROUTIER_DEBUG__?: unknown };

        if (isLogLevel(g.__ROUTIER_LOG_LEVEL__)) {
            return g.__ROUTIER_LOG_LEVEL__;
        }

        // Both directions honoured. `=== false` used to fall through to the NODE_ENV checks
        // below and re-enable the logging it was asked to suppress.
        if (g.__ROUTIER_DEBUG__ === true) return 'debug';
        if (g.__ROUTIER_DEBUG__ === false) return 'silent';
    }

    // There is deliberately no `import.meta.env` branch, although the documentation used to
    // promise one. It could never work: this package is bundled with rspack, which replaces
    // `import.meta` with `undefined`, so the check would read the *library's* build-time
    // environment rather than the application's — and referencing `import.meta` at all is a parse
    // error under a CommonJS build target, which is how the test suite loads this file. Vite and
    // similar apps set `__ROUTIER_LOG_LEVEL__` or `__ROUTIER_DEBUG__` from their own
    // `import.meta.env`, which is what the docs now describe.
    if (typeof process !== 'undefined' && process.env != null) {
        if (isLogLevel(process.env.ROUTIER_LOG_LEVEL)) {
            return process.env.ROUTIER_LOG_LEVEL as LogLevel;
        }

        const debug = process.env.DEBUG;
        if (debug === 'routier' || debug === '*') return 'debug';

        const env = process.env.NODE_ENV?.toLowerCase();

        // `test` is deliberately absent. It used to be here, which meant no test suite anywhere
        // could run Routier quietly. Opt in with DEBUG=routier or ROUTIER_LOG_LEVEL when a test
        // needs the output.
        if (env === 'dev' || env === 'development') return 'debug';
    }

    return 'silent';
};

let level: LogLevel = resolveLevel();
let rank = RANK[level];

/**
 * Overrides the level for the rest of the process.
 *
 * The configuration above is read once, at import, which is what makes the gate cheap — but it
 * also means an application that decides its verbosity after startup, or a test that wants to
 * assert on output, has no way in. This is that way in.
 */
export const setLogLevel = (next: LogLevel): void => {
    if (isLogLevel(next) === false) {
        throw new Error(`Unknown log level "${next}". Expected one of: ${LOG_LEVELS.join(', ')}`);
    }

    level = next;
    rank = RANK[next];
};

export const getLogLevel = (): LogLevel => level;

/** Re-reads the environment. For tests that change it after this module was imported. */
export const resetLogLevel = (): void => {
    level = resolveLevel();
    rank = RANK[level];
};

/**
 * Whether a message at this level would be emitted.
 *
 * For the rare call site whose *arguments* are expensive to build — a serialization, a deep
 * clone, a join over a large collection. An ordinary payload object is not worth guarding; see
 * the measurement in the header.
 */
export const isLogLevelEnabled = (at: LogLevel): boolean => rank >= RANK[at];

type ConsoleMethod = 'log' | 'info' | 'warn' | 'error' | 'debug' | 'table';

const emit = (at: LogLevel, method: ConsoleMethod, args: unknown[]) => {
    if (rank < RANK[at]) {
        return;
    }

    // Resolved at call time rather than captured once: test harnesses and browser devtools both
    // replace console methods after modules have loaded, and a captured reference would keep
    // writing past the replacement.
    (console[method] as (...a: unknown[]) => void)(...args);
};

export const logger = {
    /** General-purpose output. Carried at `info`, since `log` names a console method, not a level. */
    log: (...args: unknown[]): void => emit('info', 'log', args),
    info: (...args: unknown[]): void => emit('info', 'info', args),
    warn: (...args: unknown[]): void => emit('warn', 'warn', args),
    error: (...args: unknown[]): void => emit('error', 'error', args),
    debug: (...args: unknown[]): void => emit('debug', 'debug', args),
    /** Diagnostic tabular output; verbose by nature, so it sits at `debug`. */
    table: (...args: unknown[]): void => emit('debug', 'table', args),
};
