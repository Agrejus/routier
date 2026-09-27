import { describe, expect, it, jest } from "@jest/globals";
import { Result } from "./Result";
import { ResultType } from "./types";
import { LiveQuery, LiveQueryState, pendingLiveQueryState, subscribeLiveQuery, toLiveQueryState } from "./liveQuery";

describe("pendingLiveQueryState", () => {
    it("is pending and loading", () => {
        expect(pendingLiveQueryState()).toEqual({ status: "pending", loading: true, isSuccess: false, isError: false });
    });
});

describe("toLiveQueryState", () => {
    it("maps a success to data", () => {
        expect(toLiveQueryState(Result.success(["a"]))).toEqual({ status: "success", loading: false, data: ["a"], isSuccess: true, isError: false });
    });

    it("keeps a falsy success value as data", () => {
        const state = toLiveQueryState(Result.success(0));

        expect(state.status === "success" && state.data).toBe(0);
    });

    it("maps an error to an Error carrying its message", () => {
        const state = toLiveQueryState<string[]>(Result.error(new Error("boom")));

        expect(state).toEqual({ status: "error", loading: false, error: new Error("boom"), isSuccess: false, isError: true });
    });

    it.each([undefined, null, {}])("falls back to a generic message for %p", (error) => {
        const state = toLiveQueryState<string[]>(Result.error(error));

        expect(state.status === "error" && state.error.message).toBe("Unknown error");
    });
});

describe("subscribeLiveQuery", () => {
    const capture = <T>() => {
        const emits: ((result: ResultType<T>) => void)[] = [];
        const unsubscribe = jest.fn();
        const query: LiveQuery<T> = (callback) => {
            emits.push(callback);
            return unsubscribe;
        };

        return { emits, unsubscribe, query };
    };

    it("delivers every result as a state", () => {
        const { emits, query } = capture<number>();
        const states: LiveQueryState<number>[] = [];

        subscribeLiveQuery(query, (state) => states.push(state));
        emits[0](Result.success(1));
        emits[0](Result.success(2));

        expect(states.map((state) => state.status === "success" && state.data)).toEqual([1, 2]);
    });

    it("calls the query's unsubscribe when stopped", () => {
        const { unsubscribe, query } = capture<number>();

        subscribeLiveQuery(query, () => undefined)();

        expect(unsubscribe).toHaveBeenCalledTimes(1);
    });

    it("ignores results that arrive after it is stopped", () => {
        const { emits, query } = capture<number>();
        const onState = jest.fn();

        subscribeLiveQuery(query, onState)();
        emits[0](Result.success(1));

        expect(onState).not.toHaveBeenCalled();
    });

    it("stops cleanly when the query returns no unsubscribe", () => {
        const stop = subscribeLiveQuery<number>(() => undefined, () => undefined);

        expect(stop).not.toThrow();
    });

    it("delivers a result the query emits synchronously", () => {
        const onState = jest.fn();

        subscribeLiveQuery<number>((callback) => callback(Result.success(7)), onState);

        expect(onState).toHaveBeenCalledWith({ status: "success", loading: false, data: 7, isSuccess: true, isError: false });
    });
});
