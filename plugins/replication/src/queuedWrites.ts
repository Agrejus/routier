import { logger } from '@routier/core/utilities';
import { HttpStatusError } from './httpUtils';
import { conflictOf, runWithOnError, statusOf, type ActionKit } from './requestFailures';
import { emitEvent, type SwrRequestError, type SyncEvent } from './syncHooks';
import type { UnsyncedFlushUnit, UnsyncedQueue } from './UnsyncedQueue';

export type DeliveryOutcome = { sent: number; failed: number; rejected: number };

export const NOTHING_DELIVERED: DeliveryOutcome = { sent: 0, failed: 0, rejected: 0 };

export const addOutcomes = (a: DeliveryOutcome, b: DeliveryOutcome): DeliveryOutcome => ({
    sent: a.sent + b.sent,
    failed: a.failed + b.failed,
    rejected: a.rejected + b.rejected,
});

export type QueuedWriteSenderOptions = {
    queue: UnsyncedQueue;
    post: (url: string, body: string, collectionName: string) => Promise<unknown>;
    formatBody: (collectionName: string, units: UnsyncedFlushUnit[]) => string;
    onError?: (error: SwrRequestError) => void;
    onEvent?: (event: SyncEvent) => void;
    afterSent: (collectionName: string, responseBody: unknown) => Promise<void>;
    afterRejected: (collectionName: string) => void;
};

const refusedBy = (error: Error, units: UnsyncedFlushUnit[]): UnsyncedFlushUnit[] => {
    const body = error instanceof HttpStatusError ? error.responseBody : null;

    if (body == null || typeof body !== 'object') {
        return [];
    }

    if (Reflect.get(body, 'rejectionScope') === 'batch') {
        return units;
    }

    const named: unknown = Reflect.get(body, 'rejectedOpIds');
    return Array.isArray(named) ? units.filter(unit => named.includes(unit.opId)) : [];
};

export const bodyForUnits = (units: UnsyncedFlushUnit[]): string => {
    const byKind = (kind: UnsyncedFlushUnit['kind']) => units.filter(unit => unit.kind === kind);
    const adds = byKind('add');
    const updates = byKind('update');
    const removes = byKind('remove');

    return JSON.stringify({
        adds: adds.map(unit => unit.payload),
        updates: updates.map(unit => unit.payload),
        removes: removes.map(unit => unit.payload),
        meta: {
            opIds: {
                adds: adds.map(unit => unit.opId ?? ''),
                updates: updates.map(unit => unit.opId ?? ''),
                removes: removes.map(unit => unit.opId ?? ''),
            },
        },
    });
};

export class QueuedWriteSender {
    private readonly options: QueuedWriteSenderOptions;

    constructor(options: QueuedWriteSenderOptions) {
        this.options = options;
    }

    async send(collectionName: string, url: string, units: UnsyncedFlushUnit[]): Promise<DeliveryOutcome> {
        const rows = units.flatMap(unit => unit.rows);
        const settled = await runWithOnError({
            attempt: () => this.options.post(url, this.options.formatBody(collectionName, units), collectionName),
            context: { operation: 'write', collectionName, method: 'POST', url, storeSource: false },
            onError: this.options.onError,
            actions: ({ retry, reject, defer }: ActionKit) => ({ retry, reject, defer }),
            unhandled: (kit: ActionKit) => kit.defer(),
        });

        if (settled.outcome === 'success') {
            await this.options.queue.removeRows(rows);
            await this.options.afterSent(collectionName, settled.value).catch(error =>
                logger.warn('[HttpSwrDbPlugin] could not reconcile the server response', { collectionName, error }));
            return { sent: units.length, failed: 0, rejected: 0 };
        }

        if (settled.outcome === 'rejected') {
            return this.narrow(collectionName, url, units, settled.error);
        }

        await this.options.queue.recordFailedAttempt(rows).catch(error =>
            logger.warn('[HttpSwrDbPlugin] could not record a failed attempt', { collectionName, error }));
        return { sent: 0, failed: units.length, rejected: 0 };
    }

    private async narrow(collectionName: string, url: string, units: UnsyncedFlushUnit[], error: Error): Promise<DeliveryOutcome> {
        if (units.length === 1) {
            return this.reject(collectionName, units, error);
        }

        const refused = refusedBy(error, units);

        if (refused.length === 0) {
            return this.oneAtATime(collectionName, url, units);
        }

        const rest = units.filter(unit => !refused.includes(unit));
        const rejected = await this.reject(collectionName, refused, error);

        return rest.length === 0 ? rejected : addOutcomes(rejected, await this.send(collectionName, url, rest));
    }

    private async oneAtATime(collectionName: string, url: string, units: UnsyncedFlushUnit[]): Promise<DeliveryOutcome> {
        let outcome = NOTHING_DELIVERED;

        for (const unit of units) {
            outcome = addOutcomes(outcome, await this.send(collectionName, url, [unit]));
        }

        return outcome;
    }

    private async reject(collectionName: string, units: UnsyncedFlushUnit[], error: Error): Promise<DeliveryOutcome> {
        let deadRowIds: Set<string>;

        try {
            deadRowIds = new Set((await this.options.queue.deadLetter(units.flatMap(unit => unit.rows))).map(row => row.id));
        } catch (writeError) {
            logger.error('[HttpSwrDbPlugin] could not record rejected changes; they stay queued', { collectionName, error: writeError });
            return { sent: 0, failed: units.length, rejected: 0 };
        }

        const refused = units.filter(unit => unit.rows.some(row => deadRowIds.has(row.id)));
        const superseded = units.length - refused.length;

        if (refused.length === 0) {
            return { sent: 0, failed: superseded, rejected: 0 };
        }

        this.options.afterRejected(collectionName);
        emitEvent(this.options.onEvent, {
            type: 'changes-rejected',
            collectionName,
            changes: refused.map(unit => ({ kind: unit.kind, entity: unit.entity })),
            conflict: conflictOf(error),
            status: statusOf(error),
            error,
        });

        return { sent: 0, failed: superseded, rejected: refused.length };
    }
}
