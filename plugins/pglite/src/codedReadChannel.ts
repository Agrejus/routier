import { decodeChunk, TransferPlan } from '@routier/core/transfer';
import { CODED_READ, type CodedReadResponse } from './codedReads';

/**
 * The main-thread half of the coded-read channel.
 *
 * Sends a request on the worker's own `postMessage` and accumulates the chunks that come back,
 * decoding each as it arrives. PGlite's proxy traffic runs on a `BroadcastChannel` and never
 * reaches this listener; the tagged messages this does see are only its own.
 */

/** A worker that has not answered a coded read yet, or has said it cannot. */
export class CodedReadUnavailable extends Error {
    /** Read structurally, so a realm boundary cannot defeat the check. */
    readonly codedReadUnavailable = true;

    constructor(reason: string) {
        super(`coded reads are unavailable on this worker: ${reason}`);
    }
}

export const isCodedReadUnavailable = (error: unknown): error is CodedReadUnavailable =>
    (error as { codedReadUnavailable?: unknown } | null)?.codedReadUnavailable === true;

type Pending = {
    resolve: (rows: unknown[]) => void;
    reject: (error: Error) => void;
    plan: TransferPlan;
    rows: unknown[];
};

export type CodedReadChannel = {
    read(sql: string, params: readonly unknown[], plan: TransferPlan): Promise<unknown[]>;
};

export const codedReadChannel = (worker: Worker): CodedReadChannel => {
    const pending = new Map<number, Pending>();
    let nextId = 0;

    worker.addEventListener('message', (event: MessageEvent<unknown>) => {
        const message = event.data as CodedReadResponse | null;

        if (message?.type !== CODED_READ) {
            return;
        }

        const waiting = pending.get(message.id);

        if (waiting == null) {
            return;
        }

        if (message.ok === false) {
            pending.delete(message.id);
            waiting.reject('unavailable' in message
                ? new CodedReadUnavailable(message.error)
                : new Error(message.error));
            return;
        }

        try {
            for (const row of decodeChunk(waiting.plan, message.chunk as never)) {
                waiting.rows.push(row);
            }
        } catch (error) {
            // Half a result is not a result; the accumulated chunks go with the entry.
            pending.delete(message.id);
            waiting.reject(error as Error);
            return;
        }

        if (message.last) {
            pending.delete(message.id);
            waiting.resolve(waiting.rows);
        }
    });

    return {
        read(sql, params, plan) {
            const id = nextId++;

            return new Promise<unknown[]>((resolve, reject) => {
                pending.set(id, { resolve, reject, plan, rows: [] });
                worker.postMessage({ type: CODED_READ, id, sql, params, plan });
            });
        },
    };
};
