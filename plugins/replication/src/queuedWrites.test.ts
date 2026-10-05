import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { logger, uuid } from '@routier/core/utilities';
import { MemoryPlugin } from '@routier/memory-plugin';
import { HttpStatusError, NetworkError } from './httpUtils';
import { addOutcomes, bodyForUnits, NOTHING_DELIVERED, QueuedWriteSender } from './queuedWrites';
import type { SwrRequestError, SyncEvent } from './syncHooks';
import { UnsyncedQueue, type UnsyncedFlushUnit } from './UnsyncedQueue';
import { testSchema } from './__tests__/httpTestKit';

const COLLECTION = 'swrHardening';
const URL = 'https://api.test/swrHardening';

type Post = (url: string, body: string, collectionName: string) => Promise<unknown>;

const refuse = (status: number, body: unknown = null) => new HttpStatusError(status, 'refused', null, body, { get: () => null });

const postsOf = (post: jest.Mock<Post>) => post.mock.calls.map(([, body]) => JSON.parse(body) as { adds: { id: string }[]; meta: { opIds: { adds: string[] } } });

describe('QueuedWriteSender', () => {
    let queue: UnsyncedQueue;
    let events: SyncEvent[];
    let afterSent: jest.Mock<(collectionName: string, responseBody: unknown) => Promise<void>>;
    let afterRejected: jest.Mock<(collectionName: string) => void>;

    const sender = (post: Post, onError?: (error: SwrRequestError) => void) => new QueuedWriteSender({
        queue,
        post,
        formatBody: (_collectionName, units) => bodyForUnits(units),
        onError,
        onEvent: event => events.push(event),
        afterSent,
        afterRejected,
    });

    const queued = async (...ids: string[]): Promise<UnsyncedFlushUnit[]> => {
        for (const id of ids) {
            await queue.add(testSchema as never, { id, name: id }, 'add');
        }
        return (await queue.getUnsyncedEntitiesForFlush(COLLECTION)).units;
    };

    const rejectWrites = (error: SwrRequestError) => {
        if (error.operation === 'write') {
            error.reject();
        }
    };

    beforeEach(() => {
        queue = new UnsyncedQueue(new MemoryPlugin(`queue-${uuid(8)}`));
        events = [];
        afterSent = jest.fn(async () => undefined);
        afterRejected = jest.fn();
    });

    it('sends the batch, dequeues it and hands on the response', async () => {
        const post = jest.fn<Post>(async () => ({ saved: true }));

        const outcome = await sender(post).send(COLLECTION, URL, await queued('a', 'b'));

        expect(outcome).toEqual({ sent: 2, failed: 0, rejected: 0 });
        expect([await queue.getPendingCount(), afterSent.mock.calls]).toEqual([0, [[COLLECTION, { saved: true }]]]);
    });

    it('keeps the batch queued, counting the attempt, when there is no onError', async () => {
        const post = jest.fn<Post>(async () => { throw refuse(500); });

        const outcome = await sender(post).send(COLLECTION, URL, await queued('a'));

        expect(outcome).toEqual({ sent: 0, failed: 1, rejected: 0 });
        expect((await queue.getUnsyncedEntitiesForFlush(COLLECTION)).rows.map(row => row.attempts)).toEqual([1]);
    });

    it('keeps the batch queued when onError defers it', async () => {
        const post = jest.fn<Post>(async () => { throw refuse(503); });

        const outcome = await sender(post, error => { if (error.operation === 'write') error.defer(); }).send(COLLECTION, URL, await queued('a'));

        expect([outcome, await queue.getPendingCount()]).toEqual([{ sent: 0, failed: 1, rejected: 0 }, 1]);
    });

    it('describes the failed batch as a write with retry, reject and defer', async () => {
        const seen: SwrRequestError[] = [];
        const post = jest.fn<Post>(async () => { throw new NetworkError('offline'); });

        await sender(post, error => { seen.push(error); if (error.operation === 'write') error.defer(); }).send(COLLECTION, URL, await queued('a'));

        const [error] = seen;
        expect([error?.kind, error?.operation, error?.collectionName, error?.method, error?.url, typeof (error && 'defer' in error ? error.defer : null)])
            .toEqual(['network', 'write', COLLECTION, 'POST', URL, 'function']);
    });

    it('sends the batch again when onError retries it', async () => {
        let calls = 0;
        const post = jest.fn<Post>(async () => {
            if (++calls === 1) throw refuse(503);
            return null;
        });

        const outcome = await sender(post, error => void error.retry()).send(COLLECTION, URL, await queued('a'));

        expect([outcome, post.mock.calls.length]).toEqual([{ sent: 1, failed: 0, rejected: 0 }, 2]);
    });

    it('dead-letters and reports a single change onError rejects', async () => {
        const post = jest.fn<Post>(async () => { throw refuse(409); });

        const outcome = await sender(post, rejectWrites).send(COLLECTION, URL, await queued('a'));

        expect(outcome).toEqual({ sent: 0, failed: 0, rejected: 1 });
        expect(await queue.getDeadLetters()).toHaveLength(1);
        expect(afterRejected).toHaveBeenCalledWith(COLLECTION);
        expect(events).toEqual([{
            type: 'changes-rejected',
            collectionName: COLLECTION,
            changes: [{ kind: 'add', entity: expect.objectContaining({ id: 'a' }) }],
            conflict: true,
            status: 409,
            error: expect.any(HttpStatusError),
        }]);
    });

    it('does not call a refusal that is not a 409 a conflict', async () => {
        const post = jest.fn<Post>(async () => { throw refuse(422); });

        await sender(post, rejectWrites).send(COLLECTION, URL, await queued('a'));

        expect(events.map(event => (event.type === 'changes-rejected' ? event.conflict : null))).toEqual([false]);
    });

    it('rejects only the changes the server named, and sends the rest', async () => {
        const units = await queued('a', 'b', 'c');
        const named = units[1]?.opId ?? '';
        let calls = 0;
        const post = jest.fn<Post>(async () => {
            if (++calls === 1) throw refuse(422, { rejectedOpIds: [named, 42] });
            return null;
        });

        const outcome = await sender(post, rejectWrites).send(COLLECTION, URL, units);

        expect(outcome).toEqual({ sent: 2, failed: 0, rejected: 1 });
        expect(postsOf(post)[1]?.adds.map(add => add.id)).toEqual(['a', 'c']);
    });

    it('rejects the whole batch when the server says the batch was refused', async () => {
        const post = jest.fn<Post>(async () => { throw refuse(403, { rejectionScope: 'batch' }); });

        const outcome = await sender(post, rejectWrites).send(COLLECTION, URL, await queued('a', 'b'));

        expect([outcome, post.mock.calls.length]).toEqual([{ sent: 0, failed: 0, rejected: 2 }, 1]);
    });

    it.each([
        ['names no changes', { rejectedOpIds: [] }],
        ['names changes that are not in the batch', { rejectedOpIds: ['someone-else'] }],
        ['sends no body', null],
        ['sends a body that is not an object', 'refused'],
    ])('sends each change on its own when the server %s', async (_, body) => {
        const units = await queued('a', 'b');
        const post = jest.fn<Post>(async (_url, sent) => {
            const adds = (JSON.parse(sent) as { adds: { id: string }[] }).adds;
            if (adds.length > 1 || adds[0]?.id === 'b') throw refuse(422, body);
            return null;
        });

        const outcome = await sender(post, rejectWrites).send(COLLECTION, URL, units);

        expect(outcome).toEqual({ sent: 1, failed: 0, rejected: 1 });
        expect(postsOf(post).map(sent => sent.adds.map(add => add.id))).toEqual([['a', 'b'], ['a'], ['b']]);
    });

    it('sends each change on its own when a network failure is rejected', async () => {
        let calls = 0;
        const post = jest.fn<Post>(async () => {
            if (++calls === 1) throw new NetworkError('offline');
            return null;
        });

        const outcome = await sender(post, rejectWrites).send(COLLECTION, URL, await queued('a', 'b'));

        expect(outcome).toEqual({ sent: 2, failed: 0, rejected: 0 });
    });

    it('reports a change whose other queued row was edited again while it was being sent', async () => {
        await queue.add(testSchema as never, { id: 'a', name: 'added' }, 'add');
        await queue.add(testSchema as never, { id: 'a', name: 'updated' }, 'update');
        const units = (await queue.getUnsyncedEntitiesForFlush(COLLECTION)).units;
        await queue.add(testSchema as never, { id: 'a', name: 'updated again' }, 'update');
        const post = jest.fn<Post>(async () => { throw refuse(422); });

        const outcome = await sender(post, rejectWrites).send(COLLECTION, URL, units);

        expect([units.length, units[0]?.rows.length, outcome]).toEqual([1, 2, { sent: 0, failed: 0, rejected: 1 }]);
    });

    it('does not ask onError about a failure that is not a request failure', async () => {
        const onError = jest.fn();
        const post = jest.fn<Post>(async () => { throw new Error('could not build the body'); });

        const outcome = await sender(post, onError).send(COLLECTION, URL, await queued('a'));

        expect([onError.mock.calls.length, outcome]).toEqual([0, { sent: 0, failed: 1, rejected: 0 }]);
    });

    it('does not report a change that was edited again while it was being sent', async () => {
        const units = await queued('a');
        await queue.add(testSchema as never, { id: 'a', name: 'edited again' }, 'add');
        const post = jest.fn<Post>(async () => { throw refuse(422); });

        const outcome = await sender(post, rejectWrites).send(COLLECTION, URL, units);

        expect([outcome, events, await queue.getPendingCount()]).toEqual([{ sent: 0, failed: 1, rejected: 0 }, [], 1]);
    });

    it('keeps rejected changes queued when they cannot be dead-lettered', async () => {
        const error = jest.spyOn(logger, 'error').mockImplementation(() => undefined);
        const units = await queued('a');
        jest.spyOn(queue, 'deadLetter').mockRejectedValue(new Error('disk full'));
        const post = jest.fn<Post>(async () => { throw refuse(422); });

        const outcome = await sender(post, rejectWrites).send(COLLECTION, URL, units);

        expect([outcome, events]).toEqual([{ sent: 0, failed: 1, rejected: 0 }, []]);
        expect(error).toHaveBeenCalledWith('[HttpSwrDbPlugin] could not record rejected changes; they stay queued', { collectionName: COLLECTION, error: expect.any(Error) });
        error.mockRestore();
    });

    it('still counts a sent batch when reconciling the response fails', async () => {
        const warn = jest.spyOn(logger, 'warn').mockImplementation(() => undefined);
        afterSent.mockRejectedValue(new Error('bad echo'));

        const outcome = await sender(jest.fn<Post>(async () => null)).send(COLLECTION, URL, await queued('a'));

        expect(outcome.sent).toBe(1);
        expect(warn).toHaveBeenCalledWith('[HttpSwrDbPlugin] could not reconcile the server response', { collectionName: COLLECTION, error: expect.any(Error) });
        warn.mockRestore();
    });

    it('logs when a failed attempt cannot be recorded', async () => {
        const warn = jest.spyOn(logger, 'warn').mockImplementation(() => undefined);
        const units = await queued('a');
        jest.spyOn(queue, 'recordFailedAttempt').mockRejectedValue(new Error('disk full'));

        const outcome = await sender(jest.fn<Post>(async () => { throw refuse(500); })).send(COLLECTION, URL, units);

        expect(outcome.failed).toBe(1);
        expect(warn).toHaveBeenCalledWith('[HttpSwrDbPlugin] could not record a failed attempt', { collectionName: COLLECTION, error: expect.any(Error) });
        warn.mockRestore();
    });
});

describe('bodyForUnits', () => {
    it('groups changes by kind with their idempotency keys', () => {
        const unit = (kind: UnsyncedFlushUnit['kind'], id: string, opId: string | null): UnsyncedFlushUnit => ({ rows: [], kind, entity: { id }, payload: { id }, opId });

        const units = [unit('add', 'a', 'op-a'), unit('add', 'b', null), unit('update', 'u', 'op-u'), unit('update', 'v', null), unit('remove', 'r', 'op-r'), unit('remove', 's', null)];

        expect(JSON.parse(bodyForUnits(units))).toEqual({
            adds: [{ id: 'a' }, { id: 'b' }],
            updates: [{ id: 'u' }, { id: 'v' }],
            removes: [{ id: 'r' }, { id: 's' }],
            meta: { opIds: { adds: ['op-a', ''], updates: ['op-u', ''], removes: ['op-r', ''] } },
        });
    });
});

describe('addOutcomes', () => {
    it('adds each count', () => {
        expect(addOutcomes({ sent: 1, failed: 2, rejected: 3 }, { sent: 10, failed: 20, rejected: 30 })).toEqual({ sent: 11, failed: 22, rejected: 33 });
    });

    it('starts from nothing', () => {
        expect(NOTHING_DELIVERED).toEqual({ sent: 0, failed: 0, rejected: 0 });
    });
});
