import { afterEach, describe, expect, it, jest } from "@jest/globals";
import { Injector, signal } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { Result, type LiveQuery, type ResultType } from "@routier/core/results";
import { injectLiveQuery } from "./injectLiveQuery";
import { addTodo, createLiveTodoStore, waitUntil, type LiveTodo } from "@routier/test-utils";

type Emit<T> = (result: ResultType<T>) => void;

function capture<T>() {
  const emits: Emit<T>[] = [];
  const stops: jest.Mock<() => void>[] = [];
  const query = jest.fn<LiveQuery<T>>((callback) => {
    emits.push(callback);
    const stop = jest.fn<() => void>();
    stops.push(stop);
    return stop;
  });
  return { emits, stops, query };
}

const inContext = <R>(run: () => R) => TestBed.runInInjectionContext(run);

afterEach(() => {
  TestBed.resetTestingModule();
});

describe("injectLiveQuery", () => {
  it("starts pending", () => {
    const state = inContext(() => injectLiveQuery<string[]>(() => undefined));

    expect(state()).toEqual({ status: "pending", loading: true, isSuccess: false, isError: false });
  });

  it("queries once effects run, and follows every live update", () => {
    const { emits, query } = capture<string[]>();
    const state = inContext(() => injectLiveQuery(query));

    TestBed.tick();
    emits[0](Result.success(["a"]));
    emits[0](Result.success(["a", "b"]));

    expect(query).toHaveBeenCalledTimes(1);
    expect(state()).toEqual({ status: "success", loading: false, data: ["a", "b"], isSuccess: true, isError: false });
  });

  it("reports an error with its message", () => {
    const state = inContext(() => injectLiveQuery<string[]>((callback) => callback(Result.error(new Error("boom")))));

    TestBed.tick();
    const current = state();

    expect(current.status === "error" && current.error.message).toBe("boom");
  });

  it("re-queries when a signal the query reads changes, and stops the previous query", () => {
    const stops = [jest.fn(), jest.fn()];
    const userId = signal(1);
    const state = inContext(() => injectLiveQuery<number>((callback) => {
      const id = userId();
      callback(Result.success(id));
      return stops[id - 1];
    }));

    TestBed.tick();
    userId.set(2);
    TestBed.tick();

    const current = state();

    expect(current.status === "success" && current.data).toBe(2);
    expect(stops[0]).toHaveBeenCalledTimes(1);
    expect(stops[1]).not.toHaveBeenCalled();
  });

  it("stops the query and ignores later results when its injector is destroyed", () => {
    const { emits, stops, query } = capture<string[]>();
    const state = inContext(() => injectLiveQuery(query));

    TestBed.tick();
    TestBed.resetTestingModule();
    emits[0](Result.success(["late"]));

    expect(stops[0]).toHaveBeenCalledTimes(1);
    expect(state().status).toBe("pending");
  });

  it("runs outside an injection context when given an injector", () => {
    const { query } = capture<string[]>();
    const injector = TestBed.inject(Injector);

    injectLiveQuery(query, { injector });
    TestBed.tick();

    expect(query).toHaveBeenCalledTimes(1);
  });
});

describe("injectLiveQuery with a real store", () => {
  it("follows adds to a collection", async () => {
    const store = createLiveTodoStore();
    const state = inContext(() => injectLiveQuery<LiveTodo[]>((callback) => store.todos.subscribe().toArray(callback)));

    TestBed.tick();
    await addTodo(store, "a");
    await waitUntil(() => {
      const current = state();
      return current.status === "success" && current.data.map((todo) => todo.title).join() === "a";
    });

    await store.destroyAsync();
  });
});
