import type { StopWatching } from "@routier/datastore";
import { attempt } from "../errors/attempt";
import { reportError } from "../errors/reportError";
import { errorState, successState, type LiveState } from "./liveState";

export type WatchOutcome<T> =
  | { readonly status: "success"; readonly value: T }
  | { readonly status: "error"; readonly error: Error };

export type StartWatching<T> = (deliver: (outcome: WatchOutcome<T>) => void) => StopWatching;

const stopNothing: StopWatching = () => undefined;

export function watchSafely<T>(
  start: StartWatching<T>,
  context: string,
  show: (state: LiveState<T>) => void,
): StopWatching {
  const deliver = (outcome: WatchOutcome<T>) =>
    show(outcome.status === "success" ? successState(outcome.value) : errorState(reportError(context, outcome.error)));
  const stop = attempt(() => start(deliver), context, (error) => {
    show(errorState(error));
    return stopNothing;
  });
  return () => attempt(stop, context, () => undefined);
}
