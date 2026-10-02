import { describe, expect, it, jest } from "@jest/globals";
import { effectScope, nextTick, ref, type EffectScope } from "vue";
import { Result, type ResultType } from "@routier/core/results";
import { useQuery, type LiveQuery } from "./useQuery";

type Emit<T> = (result: ResultType<T>) => void;

function capture<T>() {
  const emits: Emit<T>[] = [];
  const unsubscribe = jest.fn();
  const query: LiveQuery<T> = (callback) => {
    emits.push(callback);
    return unsubscribe;
  };
  return { emits, unsubscribe, query };
}

function run<T>(query: LiveQuery<T>) {
  const scope: EffectScope = effectScope();
  const state = scope.run(() => useQuery(query));
  if (!state) throw new Error("useQuery did not return state");
  return { state, scope };
}

describe("useQuery initial state", () => {
  it("starts pending before the query calls back", () => {
    const { state } = run<string[]>(() => undefined);

    expect(state.value).toEqual({ status: "pending", loading: true, isSuccess: false, isError: false });
  });

  it("runs the query once on creation", () => {
    const query = jest.fn<LiveQuery<string[]>>();

    run(query);

    expect(query).toHaveBeenCalledTimes(1);
  });
});

describe("useQuery results", () => {
  it("exposes data once the query succeeds", () => {
    const { emits, query } = capture<string[]>();
    const { state } = run(query);

    emits[0](Result.success(["a", "b"]));

    expect(state.value).toEqual({ status: "success", loading: false, data: ["a", "b"], isSuccess: true, isError: false });
  });

  it("treats an empty result as success", () => {
    const { state } = run<string[]>((callback) => callback(Result.success([])));

    expect(state.value.status).toBe("success");
    expect(state.value.status === "success" && state.value.data).toEqual([]);
  });

  it("treats a zero count as success", () => {
    const { state } = run<number>((callback) => callback(Result.success(0)));

    expect(state.value.status === "success" && state.value.data).toBe(0);
  });

  it("reports an error with the original message", () => {
    const { state } = run<string[]>((callback) => callback(Result.error(new Error("boom"))));

    expect(state.value.status).toBe("error");
    expect(state.value.loading).toBe(false);
    expect(state.value.isError).toBe(true);
    expect(state.value.isSuccess).toBe(false);
    expect(state.value.status === "error" && state.value.error.message).toBe("boom");
  });

  it("falls back to a generic message when the error has none", () => {
    const { state } = run<string[]>((callback) => callback(Result.error(undefined)));

    expect(state.value.status === "error" && state.value.error.message).toBe("Unknown error");
  });

  it("follows every live update", () => {
    const { emits, query } = capture<number>();
    const { state } = run(query);

    emits[0](Result.success(1));
    emits[0](Result.error(new Error("lost")));
    emits[0](Result.success(2));

    expect(state.value.status === "success" && state.value.data).toBe(2);
  });
});

describe("useQuery reactivity", () => {
  it("reruns and resets to pending when a reactive dependency changes", async () => {
    const page = ref(1);
    const pages: number[] = [];
    const { emits, unsubscribe } = capture<number>();
    const { state } = run<number>((callback) => {
      pages.push(page.value);
      emits.push(callback);
      return unsubscribe;
    });
    emits[0](Result.success(10));

    page.value = 2;
    await nextTick();

    expect(pages).toEqual([1, 2]);
    expect(unsubscribe).toHaveBeenCalledTimes(1);
    expect(state.value.status).toBe("pending");
  });

  it("ignores results from a query that has been replaced", async () => {
    const page = ref(1);
    const { emits, query } = capture<number>();
    const { state } = run<number>((callback) => {
      void page.value;
      return query(callback);
    });

    page.value = 2;
    await nextTick();
    emits[0](Result.success(1));

    expect(state.value.status).toBe("pending");

    emits[1](Result.success(2));

    expect(state.value.status === "success" && state.value.data).toBe(2);
  });

  it("does not rerun when an unrelated ref changes", async () => {
    const unrelated = ref(0);
    const query = jest.fn<LiveQuery<number>>();
    run(query);

    unrelated.value = 1;
    await nextTick();

    expect(query).toHaveBeenCalledTimes(1);
  });
});

describe("useQuery cleanup", () => {
  it("unsubscribes when its scope stops", () => {
    const { unsubscribe, query } = capture<number>();
    const { scope } = run(query);

    scope.stop();

    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it("stops quietly when the query returns no unsubscribe function", () => {
    const { scope, state } = run<number>(() => undefined);

    expect(() => scope.stop()).not.toThrow();
    expect(state.value.status).toBe("pending");
  });

  it("ignores results that arrive after the scope stops", () => {
    const { emits, query } = capture<number>();
    const { scope, state } = run(query);

    scope.stop();
    emits[0](Result.success(5));

    expect(state.value.status).toBe("pending");
  });
});
