import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import {
    LOG_LEVELS,
    getLogLevel,
    isLogLevelEnabled,
    logger,
    resetLogLevel,
    setLogLevel,
} from './logger';

/**
 * The logger is configuration plus one integer comparison, and both halves have bitten before:
 * a documented off switch that did nothing, and an auto-enable under `NODE_ENV=test` that made
 * every test suite in the repository pay for logging it never asked for. Those are the two things
 * these tests exist to hold still.
 *
 * `resolveLevel` runs once at import, so anything testing configuration has to change the
 * environment and then call `resetLogLevel()`.
 */

type Spies = Record<'log' | 'info' | 'warn' | 'error' | 'debug' | 'table', jest.Spied<any>>;

let spies: Spies;

const spyOnConsole = (): Spies => ({
    log: jest.spyOn(console, 'log').mockImplementation(() => undefined),
    info: jest.spyOn(console, 'info').mockImplementation(() => undefined),
    warn: jest.spyOn(console, 'warn').mockImplementation(() => undefined),
    error: jest.spyOn(console, 'error').mockImplementation(() => undefined),
    debug: jest.spyOn(console, 'debug').mockImplementation(() => undefined),
    table: jest.spyOn(console, 'table').mockImplementation(() => undefined),
});

/** Everything `resolveLevel` reads, so each test starts from a known environment. */
const cleared = () => {
    const g = globalThis as any;
    const saved = {
        globalLevel: g.__ROUTIER_LOG_LEVEL__,
        globalDebug: g.__ROUTIER_DEBUG__,
        envLevel: process.env.ROUTIER_LOG_LEVEL,
        debug: process.env.DEBUG,
        nodeEnv: process.env.NODE_ENV,
    };

    delete g.__ROUTIER_LOG_LEVEL__;
    delete g.__ROUTIER_DEBUG__;
    delete process.env.ROUTIER_LOG_LEVEL;
    delete process.env.DEBUG;

    return () => {
        if (saved.globalLevel === undefined) delete g.__ROUTIER_LOG_LEVEL__; else g.__ROUTIER_LOG_LEVEL__ = saved.globalLevel;
        if (saved.globalDebug === undefined) delete g.__ROUTIER_DEBUG__; else g.__ROUTIER_DEBUG__ = saved.globalDebug;
        if (saved.envLevel === undefined) delete process.env.ROUTIER_LOG_LEVEL; else process.env.ROUTIER_LOG_LEVEL = saved.envLevel;
        if (saved.debug === undefined) delete process.env.DEBUG; else process.env.DEBUG = saved.debug;
        if (saved.nodeEnv === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = saved.nodeEnv;
    };
};

let restoreEnvironment: () => void;

beforeEach(() => {
    restoreEnvironment = cleared();
    spies = spyOnConsole();
});

afterEach(() => {
    restoreEnvironment();
    resetLogLevel();
    jest.restoreAllMocks();
});

describe('level resolution', () => {
    it('is silent when nothing is configured', () => {
        process.env.NODE_ENV = 'production';
        resetLogLevel();

        expect(getLogLevel()).toBe('silent');
    });

    it('is silent under NODE_ENV=test', () => {
        // The defect this replaces: `test` used to auto-enable, so every Jest run logged. Nothing
        // asks for that, and the cost is real — the S7 stress scenario ran 12.4s with logging and
        // ~6s without.
        process.env.NODE_ENV = 'test';
        resetLogLevel();

        expect(getLogLevel()).toBe('silent');
    });

    it('is debug under NODE_ENV=development', () => {
        process.env.NODE_ENV = 'development';
        resetLogLevel();

        expect(getLogLevel()).toBe('debug');
    });

    it.each(['dev', 'development', 'DEVELOPMENT'])('treats NODE_ENV=%s as development', env => {
        process.env.NODE_ENV = env;
        resetLogLevel();

        expect(getLogLevel()).toBe('debug');
    });

    it.each(['routier', '*'])('is debug when DEBUG=%s', value => {
        process.env.NODE_ENV = 'production';
        process.env.DEBUG = value;
        resetLogLevel();

        expect(getLogLevel()).toBe('debug');
    });

    it('ignores a DEBUG value naming someone else', () => {
        process.env.NODE_ENV = 'production';
        process.env.DEBUG = 'some-other-library';
        resetLogLevel();

        expect(getLogLevel()).toBe('silent');
    });

    it('honours ROUTIER_LOG_LEVEL', () => {
        process.env.NODE_ENV = 'production';
        process.env.ROUTIER_LOG_LEVEL = 'warn';
        resetLogLevel();

        expect(getLogLevel()).toBe('warn');
    });

    it('lets ROUTIER_LOG_LEVEL override DEBUG', () => {
        process.env.DEBUG = 'routier';
        process.env.ROUTIER_LOG_LEVEL = 'error';
        resetLogLevel();

        expect(getLogLevel()).toBe('error');
    });

    it('ignores an unrecognised ROUTIER_LOG_LEVEL rather than throwing', () => {
        // A typo in configuration must not take an application down, and silent is the safe
        // direction to fall back to.
        process.env.NODE_ENV = 'production';
        process.env.ROUTIER_LOG_LEVEL = 'verbose';
        resetLogLevel();

        expect(getLogLevel()).toBe('silent');
    });

    it('honours __ROUTIER_LOG_LEVEL__ above every environment variable', () => {
        process.env.DEBUG = 'routier';
        process.env.ROUTIER_LOG_LEVEL = 'debug';
        (globalThis as any).__ROUTIER_LOG_LEVEL__ = 'warn';
        resetLogLevel();

        expect(getLogLevel()).toBe('warn');
    });
});

describe('__ROUTIER_DEBUG__', () => {
    it('turns logging on', () => {
        process.env.NODE_ENV = 'production';
        (globalThis as any).__ROUTIER_DEBUG__ = true;
        resetLogLevel();

        expect(getLogLevel()).toBe('debug');
    });

    it('turns logging OFF, overriding a development environment', () => {
        // The bug this replaces. `docs/how-to/debug-logging.md` documented `= false` as the way to
        // force logging off; the old implementation only compared against `true`, so `false` fell
        // through to the NODE_ENV check and re-enabled the logging it was asked to suppress.
        process.env.NODE_ENV = 'development';
        (globalThis as any).__ROUTIER_DEBUG__ = false;
        resetLogLevel();

        expect(getLogLevel()).toBe('silent');

        logger.error('should not appear');
        expect(spies.error).not.toHaveBeenCalled();
    });

    it('turns logging off even when DEBUG asks for it', () => {
        process.env.DEBUG = 'routier';
        (globalThis as any).__ROUTIER_DEBUG__ = false;
        resetLogLevel();

        expect(getLogLevel()).toBe('silent');
    });

    it('is ignored when set to something that is not a boolean', () => {
        process.env.NODE_ENV = 'production';
        (globalThis as any).__ROUTIER_DEBUG__ = 'yes';
        resetLogLevel();

        expect(getLogLevel()).toBe('silent');
    });
});

describe('setLogLevel', () => {
    it('overrides whatever the environment resolved to', () => {
        process.env.NODE_ENV = 'production';
        resetLogLevel();
        setLogLevel('debug');

        logger.debug('now visible');

        expect(getLogLevel()).toBe('debug');
        expect(spies.debug).toHaveBeenCalledWith('now visible');
    });

    it('rejects an unknown level loudly', () => {
        // Unlike configuration, this is a programming error at a call site — the caller passed a
        // literal, and failing silently would leave them wondering why nothing logged.
        expect(() => setLogLevel('verbose' as any)).toThrow('Unknown log level');
    });

    it('names the valid levels in the error', () => {
        expect(() => setLogLevel('loud' as any)).toThrow('silent, error, warn, info, debug');
    });
});

describe('level filtering', () => {
    it('discards everything at silent', () => {
        setLogLevel('silent');

        logger.error('e');
        logger.warn('w');
        logger.info('i');
        logger.log('l');
        logger.debug('d');
        logger.table([{ a: 1 }]);

        Object.values(spies).forEach(spy => expect(spy).not.toHaveBeenCalled());
    });

    it('keeps errors while dropping everything more verbose', () => {
        // The capability the old all-or-nothing logger could not express, and the reason a
        // production application had to choose between silence and every debug line.
        setLogLevel('error');

        logger.error('e');
        logger.warn('w');
        logger.debug('d');

        expect(spies.error).toHaveBeenCalledWith('e');
        expect(spies.warn).not.toHaveBeenCalled();
        expect(spies.debug).not.toHaveBeenCalled();
    });

    it('includes every level at or above the configured one', () => {
        setLogLevel('info');

        logger.error('e');
        logger.warn('w');
        logger.info('i');
        logger.log('l');
        logger.debug('d');

        expect(spies.error).toHaveBeenCalled();
        expect(spies.warn).toHaveBeenCalled();
        expect(spies.info).toHaveBeenCalled();
        expect(spies.log).toHaveBeenCalled();
        // `log` is carried at info, so it survives here while debug does not.
        expect(spies.debug).not.toHaveBeenCalled();
    });

    it('carries table at debug', () => {
        setLogLevel('info');
        logger.table([{ a: 1 }]);
        expect(spies.table).not.toHaveBeenCalled();

        setLogLevel('debug');
        logger.table([{ a: 1 }]);
        expect(spies.table).toHaveBeenCalled();
    });

    it('passes every argument through unchanged', () => {
        setLogLevel('debug');
        const payload = { eventId: 'abc', count: 2 };

        logger.debug('[Plugin] start', payload, 42);

        expect(spies.debug).toHaveBeenCalledWith('[Plugin] start', payload, 42);
    });

    it('writes to whichever console method is installed at call time', () => {
        // Test harnesses and devtools replace console methods after modules load. Capturing a
        // reference at import would keep writing past the replacement.
        setLogLevel('debug');
        jest.restoreAllMocks();
        const replaced = jest.spyOn(console, 'debug').mockImplementation(() => undefined);

        logger.debug('late');

        expect(replaced).toHaveBeenCalledWith('late');
    });
});

describe('isLogLevelEnabled', () => {
    it('reports what would be emitted', () => {
        setLogLevel('warn');

        expect(isLogLevelEnabled('error')).toBe(true);
        expect(isLogLevelEnabled('warn')).toBe(true);
        expect(isLogLevelEnabled('info')).toBe(false);
        expect(isLogLevelEnabled('debug')).toBe(false);
    });

    it('reports nothing enabled at silent', () => {
        setLogLevel('silent');

        expect(LOG_LEVELS.filter(l => l !== 'silent').some(isLogLevelEnabled)).toBe(false);
    });
});
