import { describe, expect, it, jest } from "@jest/globals";
import { derived, get, writable } from "svelte/store";
import { Result, type LiveQuery, type LiveQueryState, type ResultType } from "@routier/core/results";
import { liveQuery } from "./liveQuery";
import { addTodo, createLiveTodoStore, waitUntil, type LiveTodo } from "@routier/test-utils";

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

function collect<T>(store: { subscribe: (run: (value: LiveQueryState<T>) => void) => () => void }) {
  const states: LiveQueryState<T>[] = [];
  const stop = store.subscribe((state) => states.push(state));
  return { states, stop };
}

describe("liveQuery", () => {
  it("starts pending and does not run the query until subscribed", () => {
    const { query } = capture<string[]>();
    const store = liveQuery(query);

    expect(query).not.toHaveBeenCalled();
    expect(get(store).status).toBe("pending");
  });

  it("delivers every live update to a subscriber", () => {
    const { emits, query } = capture<string[]>();
    const { states } = collect(liveQuery(query));

    emits[0](Result.success(["a"]));
    emits[0](Result.success(["a", "b"]));

    expect(states.map((state) => state.status === "success" && state.data)).toEqual([false, ["a"], ["a", "b"]]);
  });

  it("reports an error with its message", () => {
    const store = liveQuery<string[]>((callback) => callback(Result.error(new Error("boom"))));

    const state = get(store);

    expect(state.status === "error" && state.error.message).toBe("boom");
  });

  it("shares one query between subscribers", () => {
    const { query } = capture<string[]>();
    const store = liveQuery(query);

    const first = collect(store);
    const second = collect(store);

    expect(query).toHaveBeenCalledTimes(1);
    first.stop();
    second.stop();
  });

  it("unsubscribes when the last subscriber leaves", () => {
    const { query, unsubscribe } = capture<string[]>();
    const store = liveQuery(query);

    const first = collect(store);
    const second = collect(store);
    first.stop();

    expect(unsubscribe).not.toHaveBeenCalled();
    second.stop();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it("restarts pending when subscribed again after everyone left", () => {
    const { emits, query } = capture<string[]>();
    const store = liveQuery(query);

    const first = collect(store);
    emits[0](Result.success(["a"]));
    first.stop();

    const second = collect(store);

    expect(second.states[0].status).toBe("pending");
    expect(query).toHaveBeenCalledTimes(2);
  });

  it("ignores results from a stopped subscription", () => {
    const { emits, query } = capture<string[]>();
    const store = liveQuery(query);

    const { states, stop } = collect(store);
    stop();
    emits[0](Result.success(["late"]));

    expect(states.map((state) => state.status)).toEqual(["pending"]);
  });

  it("re-queries when a derived parameter changes, and stops the previous query", () => {
    const stops = [jest.fn(), jest.fn()];
    const queryFor = (id: number): LiveQuery<number> => (callback) => {
      callback(Result.success(id));
      return stops[id - 1];
    };
    const userId = writable(1);
    const store = derived<typeof userId, LiveQueryState<number>>(userId, (id, set) => liveQuery(queryFor(id)).subscribe(set));
    const { states } = collect(store);

    userId.set(2);

    expect(states.filter((state) => state.status === "success").map((state) => state.status === "success" && state.data)).toEqual([1, 2]);
    expect(stops[0]).toHaveBeenCalledTimes(1);
    expect(stops[1]).not.toHaveBeenCalled();
  });
});

describe("liveQuery with a real store", () => {
  it("follows adds to a collection", async () => {
    const store = createLiveTodoStore();
    const { states, stop } = collect(liveQuery<LiveTodo[]>((callback) => store.todos.subscribe().toArray(callback)));

    await addTodo(store, "a");
    await waitUntil(() => {
      const last = states[states.length - 1];
      return last.status === "success" && last.data.map((todo) => todo.title).join() === "a";
    });

    stop();
    await store.destroyAsync();
  });
});
