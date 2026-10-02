import { describe, expect, it, jest } from "@jest/globals";
import { createRoot, createSignal } from "solid-js";
import { Result, type LiveQuery, type ResultType } from "@routier/core/results";
import { createLiveQuery } from "./createLiveQuery";
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

function run<T>(query: LiveQuery<T>) {
  return createRoot((dispose) => ({ state: createLiveQuery(query), dispose }));
}

describe("createLiveQuery", () => {
  it("starts pending", () => {
    const { state } = run<string[]>(() => undefined);

    expect(state()).toEqual({ status: "pending", loading: true, isSuccess: false, isError: false });
  });

  it("runs the query once", () => {
    const { query } = capture<string[]>();

    run(query);

    expect(query).toHaveBeenCalledTimes(1);
  });

  it("follows every live update", () => {
    const { emits, query } = capture<string[]>();
    const { state } = run(query);

    emits[0](Result.success(["a"]));
    emits[0](Result.success(["a", "b"]));

    expect(state()).toEqual({ status: "success", loading: false, data: ["a", "b"], isSuccess: true, isError: false });
  });

  it("reports an error with its message", () => {
    const { state } = run<string[]>((callback) => callback(Result.error(new Error("boom"))));

    const current = state();

    expect(current.status === "error" && current.error.message).toBe("boom");
  });

  it("unsubscribes when its owner is disposed", () => {
    const { query, unsubscribe } = capture<string[]>();
    const { dispose } = run(query);

    dispose();

    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it("ignores results after its owner is disposed", () => {
    const { emits, query } = capture<string[]>();
    const { state, dispose } = run(query);

    dispose();
    emits[0](Result.success(["late"]));

    expect(state().status).toBe("pending");
  });

  it("re-queries when a signal the query reads changes, and stops the previous query", () => {
    const stops = [jest.fn(), jest.fn()];
    const [userId, setUserId] = createSignal(1);
    const { state } = createRoot(() => ({
      state: createLiveQuery<number>((callback) => {
        const id = userId();
        callback(Result.success(id));
        return stops[id - 1];
      }),
    }));

    setUserId(2);

    const current = state();

    expect(current.status === "success" && current.data).toBe(2);
    expect(stops[0]).toHaveBeenCalledTimes(1);
    expect(stops[1]).not.toHaveBeenCalled();
  });
});

describe("createLiveQuery with a real store", () => {
  it("follows adds to a collection", async () => {
    const store = createLiveTodoStore();
    const { state, dispose } = run<LiveTodo[]>((callback) => store.todos.subscribe().toArray(callback));

    await addTodo(store, "a");
    await waitUntil(() => {
      const current = state();
      return current.status === "success" && current.data.map((todo) => todo.title).join() === "a";
    });

    dispose();
    await store.destroyAsync();
  });
});
