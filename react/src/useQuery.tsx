import { useEffect, useState, type DependencyList } from "react";
import { pendingLiveQueryState, subscribeLiveQuery, type LiveQuery, type LiveQueryState } from "@routier/core/results";

export type { LiveQuery, LiveQueryState } from "@routier/core/results";

export function useQuery<T>(query: LiveQuery<T>, deps: DependencyList = []): LiveQueryState<T> {
  const [state, setState] = useState<LiveQueryState<T>>(pendingLiveQueryState);

  useEffect(() => {
    setState(pendingLiveQueryState());

    return subscribeLiveQuery(query, setState);
  }, deps);

  return state;
}
