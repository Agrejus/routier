import { shallowRef, watchEffect, type ShallowRef } from "vue";
import type { ResultType } from "@routier/core/results";
import { pendingState, stateFromResult, type LiveQueryState } from "./liveQueryState";

export type { LiveQueryState } from "./liveQueryState";

export type LiveQuery<T> = (callback: (result: ResultType<T>) => void) => void | (() => void);

export function useQuery<T>(query: LiveQuery<T>): Readonly<ShallowRef<LiveQueryState<T>>> {
  const state = shallowRef<LiveQueryState<T>>(pendingState());

  watchEffect((onCleanup) => {
    let active = true;
    state.value = pendingState();
    const unsubscribe = query((result) => {
      if (active) state.value = stateFromResult(result);
    });
    onCleanup(() => {
      active = false;
      if (typeof unsubscribe === "function") unsubscribe();
    });
  });

  return state;
}
