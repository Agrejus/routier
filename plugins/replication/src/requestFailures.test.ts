import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { logger } from '@routier/core/utilities';
import { HttpStatusError, NetworkError } from './httpUtils';
import { conflictOf, runWithOnError, statusOf, type ActionKit, type FailureContext, type Settlement } from './requestFailures';
import type { FailureDetails } from './syncHooks';

type Actions = { retry(): Promise<void>; done(): void; useCached(): void };
type Payload = FailureDetails<'read'> & Actions;

const readContext: FailureContext<'read'> = { operation: 'read', collectionName: 'items', method: 'GET', url: 'https://api.test/items', storeSource: false };

const actions = (kit: ActionKit): Actions => ({ retry: kit.retry, done: kit.done, useCached: kit.useCached });

const endWithDone = (kit: ActionKit) => kit.done();

const failingWith = (...errors: Error[]) => {
    const queue = [...errors];
    return jest.fn(async () => {
        const next = queue.shift();
        if (next != null) {
            throw next;
        }
        return 'rows';
    });
};

const run = (attempt: () => Promise<string>, onError: ((error: Payload) => void) | undefined, context: FailureContext<'read'> = readContext): Promise<Settlement<string>> =>
    runWithOnError({ attempt, context, onError, actions, unhandled: endWithDone });

const http = (status: number, body: unknown = null) => new HttpStatusError(status, 'status', null, body, { get: (name: string) => (name === 'Retry-After' ? '5' : null) });

describe('runWithOnError', () => {
    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('settles with the value when the first attempt succeeds', async () => {
        expect(await run(failingWith(), undefined)).toEqual({ outcome: 'success', value: 'rows' });
    });

    it('settles with the unhandled ending when there is no onError', async () => {
        const error = http(503);

        expect(await run(failingWith(error), undefined)).toEqual({ outcome: 'done', error });
    });

    it('does not ask about an error that is not a request failure', async () => {
        const onError = jest.fn();
        const error = new Error('could not parse');

        expect(await run(failingWith(error), onError)).toEqual({ outcome: 'done', error });
        expect(onError).not.toHaveBeenCalled();
    });

    it('describes an HTTP failure with its status, headers and body', async () => {
        const seen: Payload[] = [];
        const error = http(409, { code: 'stale' });

        await run(failingWith(error), payload => {
            seen.push(payload);
            payload.done();
        });

        const [payload] = seen;
        expect(payload?.kind === 'http' ? [payload.status, payload.headers.get('Retry-After'), payload.body] : null).toEqual([409, '5', { code: 'stale' }]);
        expect([payload?.operation, payload?.collectionName, payload?.method, payload?.url, payload?.attempt, payload?.error]).toEqual(['read', 'items', 'GET', 'https://api.test/items', 1, error]);
    });

    it('describes a failure with no response as network', async () => {
        const kinds: string[] = [];

        await run(failingWith(new NetworkError(new TypeError('fetch failed'))), payload => {
            kinds.push(payload.kind);
            payload.done();
        });

        expect(kinds).toEqual(['network']);
    });

    it('describes any other failure as store when the source is not HTTP', async () => {
        const kinds: string[] = [];

        await run(failingWith(new Error('disk full')), payload => {
            kinds.push(payload.kind);
            payload.done();
        }, { ...readContext, storeSource: true });

        expect(kinds).toEqual(['store']);
    });

    it('settles with the value a retry produced', async () => {
        expect(await run(failingWith(http(503)), payload => void payload.retry())).toEqual({ outcome: 'success', value: 'rows' });
    });

    it('asks again, with the next attempt number, when a retry fails', async () => {
        const attempts: number[] = [];

        const settled = await run(failingWith(http(503), http(503)), payload => {
            attempts.push(payload.attempt);
            void payload.retry();
        });

        expect([attempts, settled.outcome]).toEqual([[1, 2], 'success']);
    });

    it('resolves retry once the retried attempt has finished', async () => {
        const attempt = failingWith(http(503));
        let hookFinished: Promise<number> = Promise.resolve(0);

        await run(attempt, payload => {
            hookFinished = payload.retry().then(() => attempt.mock.calls.length);
        });

        expect(await hookFinished).toBe(2);
    });

    it.each([
        ['done', (payload: Payload) => payload.done(), 'done'],
        ['useCached', (payload: Payload) => payload.useCached(), 'cached'],
    ])('settles with the ending %s chose', async (_, choose, outcome) => {
        const error = http(503);

        expect(await run(failingWith(error), choose)).toEqual({ outcome, error });
    });

    it('waits for an action called after onError has returned', async () => {
        let later: Payload | undefined;
        const settled = run(failingWith(http(503)), payload => {
            later = payload;
        });

        await new Promise(resolve => setTimeout(resolve, 10));
        later?.useCached();

        expect((await settled).outcome).toBe('cached');
    });

    it('counts only the first action called', async () => {
        const attempt = failingWith(http(503));

        const settled = await run(attempt, payload => {
            payload.done();
            void payload.retry();
            payload.useCached();
        });

        expect([settled.outcome, attempt.mock.calls.length]).toEqual(['done', 1]);
    });

    it('ends with the unhandled ending and logs when onError throws', async () => {
        const logged = jest.spyOn(logger, 'error').mockImplementation(() => undefined);

        const settled = await run(failingWith(http(503)), () => {
            throw new Error('hook broke');
        });

        expect([settled.outcome, logged.mock.calls[0]]).toEqual(['done', ['[Routier] onError threw', { collectionName: 'items', error: new Error('hook broke') }]]);
    });

    it('ends with the unhandled ending when an async onError rejects', async () => {
        jest.spyOn(logger, 'error').mockImplementation(() => undefined);

        const settled = await run(failingWith(http(503)), async () => {
            throw new Error('hook broke');
        });

        expect(settled.outcome).toBe('done');
    });

    it('keeps the action an async onError chose before it rejected', async () => {
        jest.spyOn(logger, 'error').mockImplementation(() => undefined);

        const settled = await run(failingWith(http(503)), async payload => {
            payload.useCached();
            throw new Error('hook broke after choosing');
        });

        expect(settled.outcome).toBe('cached');
    });

    it('starts from a failure that already happened, without attempting first', async () => {
        const attempt = failingWith();
        const error = http(503);
        const seen: number[] = [];

        const settled = await runWithOnError({
            attempt,
            context: readContext,
            onError: (payload: Payload) => { seen.push(payload.attempt); void payload.retry(); },
            actions,
            unhandled: endWithDone,
            firstFailure: error,
        });

        expect([settled.outcome, seen, attempt.mock.calls.length]).toEqual(['success', [1], 1]);
    });

    it('settles a failure that already happened with the unhandled ending when there is no onError', async () => {
        const attempt = failingWith();
        const error = http(503);

        const settled = await runWithOnError({ attempt, context: readContext, onError: undefined, actions, unhandled: endWithDone, firstFailure: error });

        expect([settled, attempt.mock.calls.length]).toEqual([{ outcome: 'done', error }, 0]);
    });

    it.each([
        ['reject', (kit: ActionKit) => kit.reject(), 'rejected'],
        ['defer', (kit: ActionKit) => kit.defer(), 'deferred'],
    ])('settles with the ending %s chose', async (_, choose, outcome) => {
        const error = http(503);

        const settled = await runWithOnError({
            attempt: failingWith(error),
            context: readContext,
            onError: (payload: FailureDetails<'read'> & { choose: () => void }) => payload.choose(),
            actions: (kit: ActionKit) => ({ choose: () => choose(kit) }),
            unhandled: endWithDone,
        });

        expect(settled).toEqual({ outcome, error });
    });

    it.each([
        ['an object', {}],
        ['null', null],
        ['a number', 7],
    ])('waits for a later action when onError returns %s', async (_, value) => {
        let later: Payload | undefined;
        const settled = run(failingWith(http(503)), (payload => {
            later = payload;
            return value;
        }) as (payload: Payload) => void);

        await new Promise(resolve => setTimeout(resolve, 10));
        later?.useCached();

        expect((await settled).outcome).toBe('cached');
    });

    it('logs nothing when there is no onError', async () => {
        const logged = jest.spyOn(logger, 'error');

        await run(failingWith(http(503)), undefined);

        expect(logged).not.toHaveBeenCalled();
    });

    it('turns a thrown non-error into an error', async () => {
        const attempt = jest.fn(async (): Promise<string> => {
            throw 'plain string';
        });

        const settled = await run(attempt, undefined);

        expect(settled.outcome === 'success' ? null : settled.error.message).toBe('plain string');
    });
});

describe('statusOf', () => {
    it.each([
        [http(429), 429],
        [new NetworkError('offline'), null],
        [new Error('other'), null],
    ])('reads the status of %p', (error, status) => {
        expect(statusOf(error)).toBe(status);
    });
});

describe('conflictOf', () => {
    it.each([
        [http(409), true],
        [http(412), false],
        [new NetworkError('offline'), false],
    ])('tells whether %p is a conflict', (error, conflict) => {
        expect(conflictOf(error)).toBe(conflict);
    });
});
