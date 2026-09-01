import { describe, expect, it } from '@jest/globals';
import {
    ChunkEncoder,
    TRANSFER_VERSION,
    TransferEncoding,
    TransferPlan,
} from '@routier/core/transfer';
import { WorkerChannel, type WorkerLike } from '../drivers/wasmChannel';
import type { WorkerRequest, WorkerResponse } from '../drivers/wasmWorker';

/**
 * The main-thread half: many messages become one resolved request.
 *
 * Node has no `Worker`, so the channel takes one structurally and this supplies a fake that speaks
 * the real protocol and encodes with the real `ChunkEncoder`. What that leaves untested is the
 * platform itself — a genuine `postMessage`, real buffer detachment, a real CSP. Those need a
 * browser.
 */

const plan = (...columns: [string, TransferEncoding][]): TransferPlan => ({
    version: TRANSFER_VERSION,
    columns: columns.map(([name, encoding]) => ({ name, encoding })),
});

type Script = {
    /** Chunks to stream, each an array of positional row values. */
    chunks?: unknown[][][];
    /** Rows to answer with when the request carries no plan. */
    planless?: unknown[];
    /** Fail with this message instead of answering. */
    error?: string;
    /** Fail AFTER this many chunks, mid-stream. */
    errorAfterChunks?: number;
};

/**
 * A worker that answers from a script.
 *
 * Replies asynchronously, like the real one: a synchronous reply would resolve the pending entry
 * before `send` had registered it and hide an ordering bug.
 */
const fakeWorker = (script: (request: WorkerRequest) => Script) => {
    const requests: WorkerRequest[] = [];

    const worker: WorkerLike = {
        onmessage: null,
        onerror: null,
        postMessage(message: unknown) {
            const request = message as WorkerRequest;

            requests.push(request);

            const plannedRequest = request as Extract<WorkerRequest, { kind: 'all' }>;
            const step = script(request);

            const reply = (response: WorkerResponse) =>
                queueMicrotask(() => worker.onmessage?.({ data: response }));

            if (step.error != null) {
                reply({ id: request.id, ok: false, error: step.error });
                return;
            }

            if (plannedRequest.plan == null || step.chunks == null) {
                reply({ id: request.id, ok: true, rows: step.planless ?? [] });
                return;
            }

            const encoder = new ChunkEncoder(plannedRequest.plan);

            step.chunks.forEach((rows, index) => {
                if (step.errorAfterChunks != null && index === step.errorAfterChunks) {
                    reply({ id: request.id, ok: false, error: 'the read failed part way through' });
                    return;
                }

                rows.forEach(row => encoder.appendRow(row));

                reply({
                    id: request.id,
                    ok: true,
                    chunk: encoder.take().payload,
                    last: index === step.chunks!.length - 1,
                });
            });
        },
    };

    return { worker, requests };
};

const channelOver = (script: (request: WorkerRequest) => Script) => {
    const { worker, requests } = fakeWorker(script);

    return { channel: new WorkerChannel(worker), requests };
};

const idPlan = plan(['id', 'float64'], ['name', 'clone']);

const send = (channel: WorkerChannel, transferPlan?: TransferPlan) =>
    channel.send({ kind: 'all', databaseName: 'db', sql: 'SELECT 1', params: [], plan: transferPlan });

describe('accumulating a coded result', () => {

    it('resolves with the rows of a single chunk', async () => {
        const { channel } = channelOver(() => ({ chunks: [[[1, 'ada']]] }));

        await expect(send(channel, idPlan)).resolves.toEqual([{ id: 1, name: 'ada' }]);
    });

    it('joins several chunks in arrival order', async () => {
        const { channel } = channelOver(() => ({
            chunks: [[[1, 'a'], [2, 'b']], [[3, 'c']], [[4, 'd'], [5, 'e']]],
        }));

        await expect(send(channel, idPlan)).resolves.toEqual([
            { id: 1, name: 'a' }, { id: 2, name: 'b' }, { id: 3, name: 'c' },
            { id: 4, name: 'd' }, { id: 5, name: 'e' },
        ]);
    });

    it('resolves with nothing for a zero-row result', async () => {
        const { channel } = channelOver(() => ({ chunks: [[]] }));

        await expect(send(channel, idPlan)).resolves.toEqual([]);
    });

    /** Two requests in flight at once must not pool their chunks. */
    it('keeps concurrent requests apart', async () => {
        const { channel } = channelOver(request => ({
            chunks: (request as { sql: string }).sql === 'A'
                ? [[[1, 'a']], [[2, 'b']]]
                : [[[9, 'z']]],
        }));

        const [first, second] = await Promise.all([
            channel.send({ kind: 'all', databaseName: 'db', sql: 'A', params: [], plan: idPlan }),
            channel.send({ kind: 'all', databaseName: 'db', sql: 'B', params: [], plan: idPlan }),
        ]);

        expect(first).toEqual([{ id: 1, name: 'a' }, { id: 2, name: 'b' }]);
        expect(second).toEqual([{ id: 9, name: 'z' }]);
    });

    it('still handles an uncoded reply, which is every other request', async () => {
        const { channel } = channelOver(() => ({ planless: [{ id: 1, name: 'raw' }] }));

        await expect(send(channel)).resolves.toEqual([{ id: 1, name: 'raw' }]);
    });
});

describe('failures', () => {

    it('rejects with the message the worker sent, so a missing table stays classifiable', async () => {
        const { channel } = channelOver(() => ({ error: 'no such table: users' }));

        await expect(send(channel, idPlan)).rejects.toThrow('no such table: users');
    });

    /** Half a result is not a result. */
    it('rejects and discards the chunks already accumulated when the read fails mid-stream', async () => {
        const { channel } = channelOver(() => ({
            chunks: [[[1, 'a']], [[2, 'b']], [[3, 'c']]],
            errorAfterChunks: 1,
        }));

        await expect(send(channel, idPlan)).rejects.toThrow(/part way through/);
    });

    it('rejects a coded reply to a request that carried no plan, rather than guessing', async () => {
        // The channel would have no plan to decode against; answering anything would be a guess.
        const { worker } = fakeWorker(() => ({}));
        const channel = new WorkerChannel(worker);
        const pending = channel.send({ kind: 'all', databaseName: 'db', sql: 'x', params: [] });

        worker.onmessage?.({
            data: { id: 0, ok: true, chunk: { version: 1, rowCount: 0, columns: {} }, last: true } as WorkerResponse,
        });

        await expect(pending).rejects.toThrow(/carried no plan/);
    });

    it('fails every in-flight request when the worker cannot load', async () => {
        const { worker } = fakeWorker(() => ({ chunks: [[[1, 'a']]] }));
        const channel = new WorkerChannel(worker);

        // Registered but never answered, then the worker reports it never loaded.
        const pending = channel.send({ kind: 'all', databaseName: 'db', sql: 'x', params: [] });

        worker.onerror?.({ message: 'boom' });

        await expect(pending).rejects.toThrow(/failed to load/);
    });

    it('ignores a reply for a request it is not waiting on', async () => {
        const { worker } = fakeWorker(() => ({}));
        new WorkerChannel(worker);

        expect(() => worker.onmessage?.({ data: { id: 999, ok: true, rows: [] } })).not.toThrow();
    });
});

/**
 * The retry that makes a broken JSON column survivable.
 *
 * A column holding text that is not JSON poisons the chunk's joined document, and the worker
 * cannot notice without the second parse the joining exists to avoid. So the driver runs the
 * request again with no plan and takes the clone path, which parses row by row and tolerates it.
 */
describe('retrying without a plan', () => {

    type PlannedRequest = Extract<WorkerRequest, { kind: 'all' }>;

    const brokenJsonWorker = () => {
        const requests: PlannedRequest[] = [];

        const worker: WorkerLike = {
            onmessage: null,
            onerror: null,
            postMessage(message: unknown) {
                const request = message as PlannedRequest;

                requests.push(request);

                queueMicrotask(() => {
                    if (request.plan == null) {
                        worker.onmessage?.({
                            data: { id: request.id, ok: true, rows: [{ meta: 'not json at all' }] },
                        });
                        return;
                    }

                    // What the worker really emits for this data: the joined document contains a
                    // fragment that is not JSON, and only the decoder finds out.
                    worker.onmessage?.({
                        data: {
                            id: request.id,
                            ok: true,
                            last: true,
                            chunk: {
                                version: TRANSFER_VERSION,
                                rowCount: 1,
                                columns: { meta: { encoding: 'json', doc: '[not json at all]' } },
                            },
                        } as WorkerResponse,
                    });
                });
            },
        };

        return { worker, requests };
    };

    it('falls back to the clone path and returns the raw rows', async () => {
        const { worker, requests } = brokenJsonWorker();
        const channel = new WorkerChannel(worker);
        const jsonPlan = plan(['meta', 'json']);

        // First attempt carries the plan and fails in the decoder; the raw value survives the retry.
        await expect(
            channel.send({ kind: 'all', databaseName: 'db', sql: 'x', params: [], plan: jsonPlan })
        ).rejects.toThrow(/did not parse/);

        await expect(
            channel.send({ kind: 'all', databaseName: 'db', sql: 'x', params: [] })
        ).resolves.toEqual([{ meta: 'not json at all' }]);

        expect(requests[0].plan).toBeDefined();
        expect(requests[1].plan).toBeUndefined();
    });

    it('names the column in the failure, so the retry is attributable', async () => {
        const { worker } = brokenJsonWorker();
        const channel = new WorkerChannel(worker);

        await expect(
            channel.send({ kind: 'all', databaseName: 'db', sql: 'x', params: [], plan: plan(['meta', 'json']) })
        ).rejects.toThrow(/column 'meta'/);
    });
});
