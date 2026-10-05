import { logger } from '@routier/core/utilities';
import { HttpStatusError, isConflictStatus, NetworkError } from './httpUtils';
import type { FailureDetails, FailureKind } from './syncHooks';

export type Ending = 'done' | 'cached' | 'rejected' | 'deferred';

export type Settlement<T> =
    | { outcome: 'success'; value: T }
    | { outcome: Ending; error: Error };

export type ActionKit = {
    retry: () => Promise<void>;
    done: () => void;
    useCached: () => void;
    reject: () => void;
    defer: () => void;
};

export type FailureContext<TOperation extends 'read' | 'write'> = {
    operation: TOperation;
    collectionName: string;
    method: string | null;
    url: string | null;
    storeSource: boolean;
};

export type RunOptions<T, TOperation extends 'read' | 'write', TActions> = {
    attempt: () => Promise<T>;
    context: FailureContext<TOperation>;
    onError: NoInfer<((error: FailureDetails<TOperation> & TActions) => void) | undefined>;
    actions: (kit: ActionKit) => TActions;
    unhandled: (kit: ActionKit) => void;
    firstFailure?: Error;
};

export const asError = (thrown: unknown): Error => (thrown instanceof Error ? thrown : new Error(String(thrown)));

export const statusOf = (error: Error): number | null => (error instanceof HttpStatusError ? error.status : null);

export const conflictOf = (error: Error): boolean => isConflictStatus(statusOf(error) ?? 0);

const kindOf = (error: Error, storeSource: boolean): FailureKind | null => {
    if (error instanceof HttpStatusError) {
        return { kind: 'http', status: error.status, headers: error.headers, body: error.responseBody };
    }

    if (error instanceof NetworkError) {
        return { kind: 'network' };
    }

    return storeSource ? { kind: 'store' } : null;
};

export const runWithOnError = <T, TOperation extends 'read' | 'write', TActions>(
    options: RunOptions<T, TOperation, TActions>
): Promise<Settlement<T>> => new Promise((resolve) => {
    const { context, onError } = options;

    const fail = (attempt: number, error: Error): void => {
        let claimed = false;
        const claim = (): boolean => {
            const first = !claimed;
            claimed = true;
            return first;
        };
        const end = (outcome: Ending) => () => {
            if (claim()) {
                resolve({ outcome, error });
            }
        };
        const kit: ActionKit = {
            retry: () => (claim() ? run(attempt + 1) : Promise.resolve()),
            done: end('done'),
            useCached: end('cached'),
            reject: end('rejected'),
            defer: end('deferred'),
        };
        const kind = kindOf(error, context.storeSource);

        if (onError == null || kind == null) {
            options.unhandled(kit);
            return;
        }

        const giveUp = (hookError: unknown) => {
            logger.error('[Routier] onError threw', { collectionName: context.collectionName, error: hookError });
            options.unhandled(kit);
        };

        try {
            const returned: unknown = onError({
                ...kind,
                operation: context.operation,
                collectionName: context.collectionName,
                method: context.method,
                url: context.url,
                attempt,
                error,
                ...options.actions(kit),
            });

            if (returned instanceof Promise) {
                returned.then(undefined, giveUp);
            }
        } catch (hookError) {
            giveUp(hookError);
        }
    };

    const run = async (attempt: number): Promise<void> => {
        let value: T;

        try {
            value = await options.attempt();
        } catch (thrown) {
            fail(attempt, asError(thrown));
            return;
        }

        resolve({ outcome: 'success', value });
    };

    if (options.firstFailure != null) {
        fail(1, options.firstFailure);
        return;
    }

    void run(1);
});
