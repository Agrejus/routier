import { afterEach, describe, expect, it, jest } from '@jest/globals';

type LoggerModule = typeof import('./logger');

const freshCopy = (): LoggerModule => {
    let loaded: LoggerModule | undefined;

    jest.isolateModules(() => {
        loaded = jest.requireActual<LoggerModule>('./logger');
    });

    return loaded!;
};

describe('the log level shared by every copy of the logger', () => {
    afterEach(() => {
        freshCopy().resetLogLevel();
        jest.restoreAllMocks();
    });

    it('applies a level set through one copy to another copy', () => {
        const setter = freshCopy();
        const other = freshCopy();

        setter.setLogLevel('error');

        expect(other.getLogLevel()).toBe('error');
    });

    it('silences a warning from another copy', () => {
        const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
        const setter = freshCopy();
        const other = freshCopy();

        setter.setLogLevel('error');
        other.logger.warn('quiet');

        expect(warn).not.toHaveBeenCalled();
    });

    it('lets a copy loaded later see a level set earlier', () => {
        freshCopy().setLogLevel('debug');

        expect(freshCopy().getLogLevel()).toBe('debug');
    });

    it('resets every copy together', () => {
        const setter = freshCopy();
        const other = freshCopy();
        setter.setLogLevel('silent');

        other.resetLogLevel();

        expect(setter.getLogLevel()).toBe(other.getLogLevel());
        expect(setter.getLogLevel()).not.toBe('silent');
    });

    it('keeps the level under a key every version of the library agrees on', () => {
        freshCopy().setLogLevel('error');

        expect((globalThis as Record<symbol, unknown>)[Symbol.for('routier.logLevel')]).toEqual({ level: 'error', rank: 1 });
    });
});
