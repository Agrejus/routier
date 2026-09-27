import { describe, expect, it, jest } from "@jest/globals";
import { Result, type LiveQuery, type LiveQueryState, type ResultType } from "@routier/core/results";
import { fromLiveQuery } from "./fromLiveQuery";

type Emit<T> = (result: ResultType<T>) => void;

function capture<T>() {
  const emits: Emit<T>[] = [];
  const unsubscribe = jest.fn();
  const query = jest.fn<LiveQuery<T>>((callback) => {
    emits.push(callback);
    return unsubscribe;
  });
  return { emits, unsubscribe, query };
}

describe("fromLiveQuery", () => {
  it("does not query until subscribed", () => {
    const { query } = capture<string[]>();

    fromLiveQuery(query);

    expect(query).not.toHaveBeenCalled();
  });

  it("emits pending, then every live update", () => {
    const { emits, query } = capture<string[]>();
    const states: LiveQueryState<string[]>[] = [];

    fromLiveQuery(query).subscribe((state) => states.push(state));
    emits[0](Result.success(["a"]));
    emits[0](Result.success(["a", "b"]));

    expect(states.map((state) => state.status === "success" ? state.data : state.status)).toEqual(["pending", ["a"], ["a", "b"]]);
  });

  it("emits an error as a state rather than erroring the stream", () => {
    const states: LiveQueryState<string[]>[] = [];
    const error = jest.fn();

    fromLiveQuery<string[]>((callback) => callback(Result.error(new Error("boom")))).subscribe({ next: (state) => states.push(state), error });

    const last = states[states.length - 1];

    expect(last.status === "error" && last.error.message).toBe("boom");
    expect(error).not.toHaveBeenCalled();
  });

  it("runs one query per subscriber", () => {
    const { query } = capture<string[]>();
    const observable = fromLiveQuery(query);

    observable.subscribe(() => undefined);
    observable.subscribe(() => undefined);

    expect(query).toHaveBeenCalledTimes(2);
  });

  it("stops the query on unsubscribe and ignores later results", () => {
    const { emits, unsubscribe, query } = capture<string[]>();
    const next = jest.fn();

    const subscription = fromLiveQuery(query).subscribe(next);
    subscription.unsubscribe();
    emits[0](Result.success(["late"]));

    expect(unsubscribe).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledTimes(1);
  });
});
