import { Observable } from "rxjs";
import { pendingLiveQueryState, subscribeLiveQuery, type LiveQuery, type LiveQueryState } from "@routier/core/results";

export function fromLiveQuery<T>(query: LiveQuery<T>): Observable<LiveQueryState<T>> {
  return new Observable<LiveQueryState<T>>((subscriber) => {
    subscriber.next(pendingLiveQueryState());

    return subscribeLiveQuery(query, (next) => subscriber.next(next));
  });
}
