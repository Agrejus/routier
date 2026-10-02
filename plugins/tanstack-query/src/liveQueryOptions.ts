import type { QueryFunctionContext, QueryKey } from "@tanstack/query-core";
import { subscribeLiveQuery, type LiveQuery } from "@routier/core/results";
import { replaceSubscription } from "./subscriptions";

export type { LiveQuery } from "@routier/core/results";

export type LiveQueryOptions<T, TKey extends QueryKey> = {
    queryKey: TKey;
    queryFn: (context: QueryFunctionContext<TKey>) => Promise<T>;
    staleTime: number;
};

export function liveQueryOptions<T, TKey extends QueryKey>(options: { queryKey: TKey; query: LiveQuery<T> }): LiveQueryOptions<T, TKey> {
    return {
        queryKey: options.queryKey,
        staleTime: Infinity,
        queryFn: ({ client, queryKey }) => new Promise<T>((resolve, reject) => {
            let settled = false;

            const stop = subscribeLiveQuery(options.query, (state) => {
                if (settled === false) {
                    settled = true;

                    if (state.status === "success") {
                        resolve(state.data);
                    } else {
                        reject(state.error);
                    }

                    return;
                }

                if (state.status === "success") {
                    client.setQueryData<T>(queryKey, state.data);
                } else {
                    client.invalidateQueries({ queryKey, exact: true });
                }
            });

            replaceSubscription(client, queryKey, stop);
        }),
    };
}
