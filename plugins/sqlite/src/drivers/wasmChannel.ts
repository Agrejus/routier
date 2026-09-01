import type { WorkerRequest, WorkerResponse } from './wasmWorker';
import { decodeChunk, TransferPlan } from '@routier/core/transfer';

/**
 * The main-thread half of the worker protocol.
 *
 * Separate from `wasm.ts` for one reason: that file contains
 * `new Worker(new URL('./wasmWorker.js', import.meta.url))`, which a bundler detects by matching
 * the literal expression — and `import.meta` cannot be compiled to CommonJS, so a Node test
 * importing it fails to parse. The channel is where a dropped or mis-ordered chunk would surface,
 * so it is the half most worth testing.
 */

/**
 * `Omit` over a union collapses it to the properties every member shares, which here is only
 * `kind` and `databaseName`. Distributing keeps each request shape intact.
 */
type WithoutId<T> = T extends unknown ? Omit<T, 'id'> : never;

/**
 * A request awaiting its response, by id.
 *
 * A coded read answers with many messages, so `rows` accumulates across them and `plan` is what
 * decodes each chunk. An uncoded read has no plan and resolves on its single message.
 */
type Pending = {
    resolve: (rows: unknown[]) => void;
    reject: (error: Error) => void;
    plan?: TransferPlan;
    rows?: unknown[];
};

/**
 * The part of `Worker` this uses, so a test can stand in for one.
 *
 * Node has no `Worker`, and the accumulate-decode-retry logic below is the half of the codec most
 * worth testing — it is where a dropped chunk or a mis-ordered one would surface.
 */
export type WorkerLike = {
    postMessage(message: unknown, transfer?: unknown[]): void;
    onmessage: ((event: { data: WorkerResponse }) => void) | null;
    onerror: ((event: { message?: string }) => void) | null;
};

export class WorkerChannel {

    private readonly pending = new Map<number, Pending>();
    private nextId = 0;
    private worker: WorkerLike;

    /** The worker is CONSTRUCTED by the caller; see this module's header for why. */
    constructor(worker: WorkerLike) {
        this.worker = worker;

        this.worker.onmessage = (event) => this.receive(event.data);

        this.worker.onerror = (event) => {
            // A worker that fails to load never answers, so every in-flight request would hang
            // forever. Fail them all with something that names the cause.
            const error = new Error(
                `The SQLite worker failed to load (${event.message ?? 'no message'}). ` +
                'Check that your bundler emitted it and that the .wasm asset is served.'
            );

            for (const [, waiting] of this.pending) {
                waiting.reject(error);
            }

            this.pending.clear();
        };
    }

    /**
     * One message. A coded read sends several, so this only settles the request on the last of
     * them — or on the first failure, whichever comes first.
     *
     * Message order from one worker to one page is guaranteed by the platform, so chunk *k*
     * cannot overtake *k-1* and the accumulated rows are in result order.
     */
    private receive(response: WorkerResponse): void {
        const waiting = this.pending.get(response.id);

        if (waiting == null) {
            return;
        }

        if (response.ok === false) {
            // Whatever partial chunks arrived are dropped with the entry. Half a result is not a
            // result, and rebuilding the Error here matters because the plugin classifies a
            // missing table by reading `message`.
            this.pending.delete(response.id);
            waiting.reject(new Error(response.error));
            return;
        }

        if ('chunk' in response) {
            this.accumulate(response.id, waiting, response.chunk, response.last);
            return;
        }

        this.pending.delete(response.id);
        waiting.resolve(response.rows ?? []);
    }

    private accumulate(id: number, waiting: Pending, chunk: unknown, last: boolean): void {
        if (waiting.plan == null) {
            this.pending.delete(id);
            waiting.reject(new Error('The worker streamed a coded result for a request that carried no plan.'));
            return;
        }

        try {
            const rows = waiting.rows ?? [];

            rows.push(...decodeChunk(waiting.plan, chunk as never));
            waiting.rows = rows;
        } catch (error) {
            this.pending.delete(id);
            waiting.reject(error as Error);
            return;
        }

        if (last) {
            this.pending.delete(id);
            waiting.resolve(waiting.rows ?? []);
        }
    }

    send(request: WithoutId<WorkerRequest>): Promise<unknown[]> {
        const id = this.nextId++;
        const plan = 'plan' in request ? request.plan : undefined;

        return new Promise<unknown[]>((resolve, reject) => {
            this.pending.set(id, { resolve, reject, plan });
            this.worker.postMessage({ ...request, id } as WorkerRequest);
        });
    }
}

