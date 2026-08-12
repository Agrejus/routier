import { useQuery, LiveQueryState } from '@routier/react';
import { ResultType } from '@routier/core/results';
import { metrics } from './metrics';

/**
 * useQuery, with every delivery counted — subscription traffic is one of the numbers this
 * app exists to measure.
 */
export function useLiveQuery<T>(
    query: (callback: (result: ResultType<T>) => void) => void | (() => void),
    deps: unknown[] = [],
): LiveQueryState<T> {
    return useQuery<T>(callback => query(result => {
        metrics.noteDelivery();
        callback(result);
    }), deps);
}

export const money = (n: number) =>
    n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
