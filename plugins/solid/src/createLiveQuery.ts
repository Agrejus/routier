import { createEffect, createSignal, onCleanup, type Accessor } from "solid-js";
import { pendingLiveQueryState, subscribeLiveQuery, type LiveQuery, type LiveQueryState } from "@routier/core/results";

export type { LiveQuery, LiveQueryState } from "@routier/core/results";

export function createLiveQuery<T>(query: LiveQuery<T>): Accessor<LiveQueryState<T>> {
  const [state, setState] = createSignal<LiveQueryState<T>>(pendingLiveQueryState());

  createEffect(() => {
    setState(pendingLiveQueryState<T>);
    onCleanup(subscribeLiveQuery(query, (next) => setState(() => next)));
  });

  return state;
}
