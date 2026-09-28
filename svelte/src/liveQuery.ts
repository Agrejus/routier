import { readable, type Readable } from "svelte/store";
import { pendingLiveQueryState, subscribeLiveQuery, type LiveQuery, type LiveQueryState } from "@routier/core/results";

export type { LiveQuery, LiveQueryState } from "@routier/core/results";

export function liveQuery<T>(query: LiveQuery<T>): Readable<LiveQueryState<T>> {
  return readable(pendingLiveQueryState<T>(), (set) => {
    set(pendingLiveQueryState());

    return subscribeLiveQuery(query, set);
  });
}
