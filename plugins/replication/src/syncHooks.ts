import { logger } from '@routier/core/utilities';

export type RejectedChange = { kind: 'add' | 'update' | 'remove'; entity: unknown };

export type ReadEvent =
    | { type: 'read'; ok: true; collectionName: string; status: number | null }
    | { type: 'read'; ok: false; collectionName: string; status: number | null; error: Error };

export type ChangesRejectedEvent = {
    type: 'changes-rejected';
    collectionName: string;
    changes: RejectedChange[];
    conflict: boolean;
    status: number | null;
    error: Error;
};

export type SyncedEvent = { type: 'synced'; sent: number; failed: number; rejected: number };

export type SyncEvent = ReadEvent | ChangesRejectedEvent | SyncedEvent;

export type ResponseHeaders = { get(name: string): string | null };

export type FailureKind =
    | { kind: 'http'; status: number; headers: ResponseHeaders; body: unknown }
    | { kind: 'network' }
    | { kind: 'store' };

export type FailureDetails<TOperation extends 'read' | 'write'> = FailureKind & {
    operation: TOperation;
    collectionName: string;
    method: string | null;
    url: string | null;
    attempt: number;
    error: Error;
};

export type RetryAction = { retry(): Promise<void> };
export type DoneAction = { done(): void };
export type UseCachedAction = { useCached(): void };
export type RejectAction = { reject(): void };
export type DeferAction = { defer(): void };

export type HttpRequestError =
    | FailureDetails<'read'> & RetryAction & DoneAction
    | FailureDetails<'write'> & RetryAction & DoneAction;

export type SwrRequestError =
    | FailureDetails<'read'> & RetryAction & DoneAction & UseCachedAction
    | FailureDetails<'write'> & RetryAction & RejectAction & DeferAction;

export type OptimisticRequestError =
    | FailureDetails<'read'> & RetryAction & DoneAction & UseCachedAction
    | FailureDetails<'write'> & RetryAction & RejectAction;

export type AnyRequestError = HttpRequestError | SwrRequestError | OptimisticRequestError;

export interface SyncHooks<TError> {
    onEvent?: (event: SyncEvent) => void;
    onError?: (error: TError) => void;
}

export const emitEvent = (onEvent: ((event: SyncEvent) => void) | undefined, event: SyncEvent): void => {
    try {
        onEvent?.(event);
    } catch (error) {
        logger.error('[Routier] onEvent threw', { type: event.type, error });
    }
};

export const rejectedChangesOf = (changes: { adds: unknown[]; updates: unknown[]; removes: unknown[] }): RejectedChange[] => [
    ...changes.adds.map((entity): RejectedChange => ({ kind: 'add', entity })),
    ...changes.updates.map((entity): RejectedChange => ({ kind: 'update', entity })),
    ...changes.removes.map((entity): RejectedChange => ({ kind: 'remove', entity })),
];
