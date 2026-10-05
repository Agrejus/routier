import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { createRetry, defaultSync } from './retry';
import type { FailureKind, HttpRequestError, OptimisticRequestError, SwrRequestError } from './syncHooks';

const common = { collectionName: 'items', method: 'POST', url: 'https://api.test/items', error: new Error('failed') };

const http = (status: number, retryAfter: string | null = null): FailureKind => ({
    kind: 'http',
    status,
    headers: { get: (name: string) => (name === 'Retry-After' ? retryAfter : null) },
    body: null,
});

const network: FailureKind = { kind: 'network' };
const store: FailureKind = { kind: 'store' };

const actions = () => ({
    retry: jest.fn(async () => undefined),
    done: jest.fn(),
    useCached: jest.fn(),
    reject: jest.fn(),
    defer: jest.fn(),
});

const read = (kind: FailureKind, attempt = 1) => {
    const spies = actions();
    const error: HttpRequestError = { ...kind, ...common, operation: 'read', attempt, retry: spies.retry, done: spies.done };
    return { error, spies };
};

const queuedWrite = (kind: FailureKind, attempt = 1) => {
    const spies = actions();
    const error: SwrRequestError = { ...kind, ...common, operation: 'write', attempt, retry: spies.retry, reject: spies.reject, defer: spies.defer };
    return { error, spies };
};

const optimisticWrite = (kind: FailureKind, attempt = 1) => {
    const spies = actions();
    const error: OptimisticRequestError = { ...kind, ...common, operation: 'write', attempt, retry: spies.retry, reject: spies.reject };
    return { error, spies };
};

const called = (spies: ReturnType<typeof actions>) =>
    Object.entries(spies).filter(([, spy]) => spy.mock.calls.length > 0).map(([name]) => name);

describe('createRetry', () => {
    beforeEach(() => {
        jest.useFakeTimers();
        jest.spyOn(Math, 'random').mockReturnValue(0);
    });

    afterEach(() => {
        jest.useRealTimers();
        jest.restoreAllMocks();
    });

    it.each([
        ['a network failure', network],
        ['a 408', http(408)],
        ['a 429', http(429)],
        ['a 503', http(503)],
    ])('retries %s after the backoff', (_, kind) => {
        const { error, spies } = read(kind);

        createRetry({ baseDelayMs: 100 })(error);
        jest.advanceTimersByTime(49);
        const before = called(spies);
        jest.advanceTimersByTime(1);

        expect([before, called(spies)]).toEqual([[], ['retry']]);
    });

    it('doubles the delay with each attempt', () => {
        const { error, spies } = read(network, 3);

        createRetry({ baseDelayMs: 100, maxAttempts: 5 })(error);
        jest.advanceTimersByTime(199);
        const before = called(spies);
        jest.advanceTimersByTime(1);

        expect([before, called(spies)]).toEqual([[], ['retry']]);
    });

    it('caps the delay', () => {
        const { error, spies } = read(network, 4);

        createRetry({ baseDelayMs: 100, maxDelayMs: 200, maxAttempts: 5 })(error);
        jest.advanceTimersByTime(100);

        expect(called(spies)).toEqual(['retry']);
    });

    it('waits for the server Retry-After instead of the backoff', () => {
        const { error, spies } = read(http(503, '2'));

        createRetry({ baseDelayMs: 100 })(error);
        jest.advanceTimersByTime(1_999);
        const before = called(spies);
        jest.advanceTimersByTime(1);

        expect([before, called(spies)]).toEqual([[], ['retry']]);
    });

    it('uses the documented defaults', () => {
        const { error, spies } = read(network, 3);

        createRetry()(error);
        jest.runAllTimers();

        expect(called(spies)).toEqual(['done']);
    });

    it('waits the default base delay', () => {
        const { error, spies } = read(network);

        createRetry()(error);
        jest.advanceTimersByTime(249);
        const before = called(spies);
        jest.advanceTimersByTime(1);

        expect([before, called(spies)]).toEqual([[], ['retry']]);
    });

    it('caps at the default maximum delay', () => {
        const { error, spies } = read(network, 10);

        createRetry({ maxAttempts: 11 })(error);
        jest.advanceTimersByTime(15_000);

        expect(called(spies)).toEqual(['retry']);
    });

    it.each([
        ['a read', read],
        ['a queued write', queuedWrite],
        ['an optimistic write', optimisticWrite],
    ])('gives up on %s once attempts run out', (_, make) => {
        const { error, spies } = make(network, 3);

        createRetry({ maxAttempts: 3 })(error);
        jest.runAllTimers();

        expect(called(spies)).toEqual([make === read ? 'done' : make === queuedWrite ? 'defer' : 'reject']);
    });

    it.each([
        ['ends a read', read, http(404), 'done'],
        ['rejects a queued write', queuedWrite, http(422), 'reject'],
        ['rejects an optimistic write', optimisticWrite, http(400), 'reject'],
    ])('%s the server refused', (_, make, kind, action) => {
        const { error, spies } = make(kind);

        createRetry()(error);
        jest.runAllTimers();

        expect(called(spies)).toEqual([action]);
    });

    it.each([
        ['a read', read, 'done'],
        ['a queued write', queuedWrite, 'defer'],
        ['an optimistic write', optimisticWrite, 'reject'],
    ])('does not retry an auth failure on %s', (_, make, action) => {
        const { error, spies } = make(http(401));

        createRetry()(error);
        jest.runAllTimers();

        expect(called(spies)).toEqual([action]);
    });

    it('keeps a queued write that failed in its store for the next sync', () => {
        const { error, spies } = queuedWrite(store);

        createRetry()(error);
        jest.runAllTimers();

        expect(called(spies)).toEqual(['defer']);
    });
});

describe('defaultSync', () => {
    it('turns on background sync and the default retry', () => {
        const options = defaultSync();

        expect([options.autoSync, typeof options.onError]).toEqual([true, 'function']);
    });
});
