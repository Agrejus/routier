import { effect, signal, type Injector, type Signal } from "@angular/core";
import { pendingLiveQueryState, subscribeLiveQuery, type LiveQuery, type LiveQueryState } from "@routier/core/results";

export type { LiveQuery, LiveQueryState } from "@routier/core/results";

export type InjectLiveQueryOptions = {
  injector?: Injector;
};

export function injectLiveQuery<T>(query: LiveQuery<T>, options: InjectLiveQueryOptions = {}): Signal<LiveQueryState<T>> {
  const state = signal<LiveQueryState<T>>(pendingLiveQueryState());

  effect((onCleanup) => {
    state.set(pendingLiveQueryState());
    onCleanup(subscribeLiveQuery(query, (next) => state.set(next)));
  }, { injector: options.injector });

  return state.asReadonly();
}
