import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { createConnections, IDLE_CLOSE_MS, strategyFor } from '../connections';
import type { SqliteConnection } from '../drivers/types';

type Fake = SqliteConnection & { id: number; closed: boolean };

const fakes = () => {
    const opened: Fake[] = [];
    let failures = 0;

    const open = async (): Promise<SqliteConnection> => {
        if (failures > 0) {
            failures--;
            throw new Error('cannot open');
        }

        const connection: Fake = {
            id: opened.length,
            closed: false,
            all: async () => [],
            run: async (): Promise<void> => undefined,
            close: async () => { connection.closed = true; },
        };
        opened.push(connection);
        return connection;
    };

    return { open, opened, failNext: (count: number) => { failures = count; } };
};

const settle = () => new Promise<void>(resolve => setImmediate(resolve));

const idOf = async (use: (work: (connection: SqliteConnection) => Promise<number>) => Promise<number>) =>
    use(async connection => (connection as Fake).id);

beforeEach(() => {
    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });
});

afterEach(() => {
    jest.useRealTimers();
});

describe('kept connections', () => {
    it('reuses one reader and one writer', async () => {
        const { open, opened } = fakes();
        const connections = createConnections('writer-reader', open);

        const reads = [await idOf(work => connections.read(work)), await idOf(work => connections.read(work))];
        const writes = [await idOf(work => connections.write(work)), await idOf(work => connections.write(work))];

        expect(opened).toHaveLength(2);
        expect(reads[0]).toBe(reads[1]);
        expect(writes[0]).toBe(writes[1]);
        expect(reads[0]).not.toBe(writes[0]);
    });

    it('closes a connection once it has been idle for the whole period', async () => {
        const { open, opened } = fakes();
        const connections = createConnections('writer-reader', open);
        await connections.read(async (): Promise<void> => undefined);

        jest.advanceTimersByTime(IDLE_CLOSE_MS - 1);
        await settle();
        expect(opened[0].closed).toBe(false);

        jest.advanceTimersByTime(1);
        await settle();
        expect(opened[0].closed).toBe(true);
    });

    it('opens a fresh connection after an idle close', async () => {
        const { open, opened } = fakes();
        const connections = createConnections('writer-reader', open);
        await connections.read(async (): Promise<void> => undefined);
        jest.advanceTimersByTime(IDLE_CLOSE_MS);
        await settle();

        await connections.read(async (): Promise<void> => undefined);

        expect(opened).toHaveLength(2);
        expect(opened[1].closed).toBe(false);
    });

    it('does not close a connection while work on it is still running', async () => {
        const { open, opened } = fakes();
        const connections = createConnections('writer-reader', open);
        let finish = (): void => undefined;
        const slow = connections.read(() => new Promise<void>(resolve => { finish = resolve; }));
        await connections.read(async (): Promise<void> => undefined);

        jest.advanceTimersByTime(IDLE_CLOSE_MS * 2);
        await settle();
        expect(opened[0].closed).toBe(false);

        finish();
        await slow;
    });

    it('restarts the idle period when the connection is used again before it ends', async () => {
        const { open, opened } = fakes();
        const connections = createConnections('writer-reader', open);
        await connections.read(async (): Promise<void> => undefined);
        jest.advanceTimersByTime(IDLE_CLOSE_MS - 1);

        await connections.read(async (): Promise<void> => undefined);
        jest.advanceTimersByTime(IDLE_CLOSE_MS - 1);
        await settle();
        expect(opened[0].closed).toBe(false);

        jest.advanceTimersByTime(1);
        await settle();
        expect(opened[0].closed).toBe(true);
    });

    it('does not remember a failed open', async () => {
        const { open, opened, failNext } = fakes();
        const connections = createConnections('writer-reader', open);
        failNext(1);

        await expect(connections.read(async (): Promise<void> => undefined)).rejects.toThrow('cannot open');
        await connections.read(async (): Promise<void> => undefined);

        expect(opened).toHaveLength(1);
    });

    it('closes both connections on close', async () => {
        const { open, opened } = fakes();
        const connections = createConnections('writer-reader', open);
        await connections.read(async (): Promise<void> => undefined);
        await connections.write(async (): Promise<void> => undefined);

        await connections.close();

        expect(opened.map(connection => connection.closed)).toEqual([true, true]);
    });

    it('closes cleanly while an open that then fails is still pending', async () => {
        let fail = (): void => undefined;
        const connections = createConnections('writer-reader', () => new Promise<SqliteConnection>((_resolve, reject) => {
            fail = () => reject(new Error('cannot open'));
        }));
        const read = connections.read(async (): Promise<void> => undefined);

        const closing = connections.close();
        fail();

        await expect(closing).resolves.toBeUndefined();
        await expect(read).rejects.toThrow('cannot open');
    });

    it('closes nothing when nothing was opened', async () => {
        const { open, opened } = fakes();

        await createConnections('writer-reader', open).close();

        expect(opened).toHaveLength(0);
    });

    it('ignores a connection that fails to close', async () => {
        const { open } = fakes();
        const connections = createConnections('writer-reader', async () => ({ ...(await open()), close: () => Promise.reject(new Error('busy')) }));
        await connections.read(async (): Promise<void> => undefined);

        await expect(connections.close()).resolves.toBeUndefined();
    });
});

describe('a connection per operation', () => {
    it('opens and closes one for every operation', async () => {
        const { open, opened } = fakes();
        const connections = createConnections('per-operation', open);

        await connections.read(async (): Promise<void> => undefined);
        await connections.write(async (): Promise<void> => undefined);

        expect(opened.map(connection => connection.closed)).toEqual([true, true]);
    });

    it('closes the connection when the work fails', async () => {
        const { open, opened } = fakes();
        const connections = createConnections('per-operation', open);

        await expect(connections.read(async () => { throw new Error('work failed'); })).rejects.toThrow('work failed');

        expect(opened[0].closed).toBe(true);
    });

    it('has nothing to close', async () => {
        await expect(createConnections('per-operation', fakes().open).close()).resolves.toBeUndefined();
    });
});

describe('a single connection', () => {
    it('serves reads and writes from one connection', async () => {
        const { open, opened } = fakes();
        const connections = createConnections('single', open);

        const ids = [await idOf(connections.read), await idOf(connections.write), await idOf(connections.read)];

        expect(ids).toEqual([0, 0, 0]);
        expect(opened).toHaveLength(1);
    });

    it('runs one piece of work at a time', async () => {
        const { open } = fakes();
        const connections = createConnections('single', open);
        const events: string[] = [];
        let finishWrite = (): void => undefined;

        const write = connections.write(async () => {
            events.push('write started');
            await new Promise<void>(resolve => { finishWrite = resolve; });
            events.push('write finished');
        });
        const read = connections.read(async () => { events.push('read'); });
        await settle();
        finishWrite();
        await Promise.all([write, read]);

        expect(events).toEqual(['write started', 'write finished', 'read']);
    });

    it('carries on after a piece of work fails', async () => {
        const { open } = fakes();
        const connections = createConnections('single', open);

        await expect(connections.write(async () => { throw new Error('bad write'); })).rejects.toThrow('bad write');

        expect(await idOf(connections.read)).toBe(0);
    });

    it('never closes the connection for being idle', async () => {
        const { open, opened } = fakes();
        const connections = createConnections('single', open);
        await connections.read(async (): Promise<void> => undefined);

        jest.advanceTimersByTime(IDLE_CLOSE_MS * 10);
        await settle();

        expect(opened[0]?.closed).toBe(false);
        expect(await idOf(connections.read)).toBe(0);
    });

    it('does not remember a failed open', async () => {
        const { open, opened, failNext } = fakes();
        const connections = createConnections('single', open);
        failNext(1);

        await expect(connections.read(async (): Promise<void> => undefined)).rejects.toThrow('cannot open');
        await connections.read(async (): Promise<void> => undefined);

        expect(opened).toHaveLength(1);
    });

    it('closes the connection on close and opens a new one after', async () => {
        const { open, opened } = fakes();
        const connections = createConnections('single', open);
        await connections.read(async (): Promise<void> => undefined);

        await connections.close();

        expect(opened[0]?.closed).toBe(true);
        expect(await idOf(connections.read)).toBe(1);
    });

    it('closes nothing when nothing was opened', async () => {
        const { open, opened } = fakes();

        await createConnections('single', open).close();

        expect(opened).toHaveLength(0);
    });

    it('ignores a connection that fails to close', async () => {
        const { open } = fakes();
        const connections = createConnections('single', async () => ({ ...(await open()), close: () => Promise.reject(new Error('busy')) }));
        await connections.read(async (): Promise<void> => undefined);

        await expect(connections.close()).resolves.toBeUndefined();
    });
});

describe('choosing a strategy', () => {
    it.each([
        [false, 'app.sqlite', 'per-operation'],
        [false, ':memory:', 'per-operation'],
        [true, 'app.sqlite', 'writer-reader'],
        [true, ':memory:', 'single'],
    ])('keeps connections %s for %s: %s', (keepsConnections, databaseName, expected) => {
        expect(strategyFor(keepsConnections, databaseName)).toBe(expected);
    });
});
