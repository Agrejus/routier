import { shallowRef, watchEffect, type ShallowRef } from "vue";
import { pendingLiveQueryState, subscribeLiveQuery, type LiveQuery, type LiveQueryState } from "@routier/core/results";

export type { LiveQuery, LiveQueryState } from "@routier/core/results";

export function useQuery<T>(query: LiveQuery<T>): Readonly<ShallowRef<LiveQueryState<T>>> {
  const state = shallowRef<LiveQueryState<T>>(pendingLiveQueryState());

  watchEffect((onCleanup) => {
    state.value = pendingLiveQueryState();
    onCleanup(subscribeLiveQuery(query, (next) => {
      state.value = next;
    }));
  });

  return state;
}
