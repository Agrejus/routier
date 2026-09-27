import { Result } from "./Result";
import { ResultType } from "./types";

export type LiveQuery<T> = (callback: (result: ResultType<T>) => void) => void | (() => void);

export type LiveQueryState<T> =
    | {
        status: "pending";
        loading: true;
        isSuccess: false;
        isError: false;
    }
    | {
        status: "error";
        loading: false;
        error: Error;
        isSuccess: false;
        isError: true;
    }
    | {
        status: "success";
        loading: false;
        data: T;
        isSuccess: true;
        isError: false;
    };

export type SettledLiveQueryState<T> = Exclude<LiveQueryState<T>, { status: "pending" }>;

export const pendingLiveQueryState = <T>(): LiveQueryState<T> => ({
    status: "pending",
    loading: true,
    isSuccess: false,
    isError: false,
});

export const toLiveQueryState = <T>(result: ResultType<T>): SettledLiveQueryState<T> =>
    result.ok === Result.SUCCESS
        ? { status: "success", loading: false, data: result.data, isSuccess: true, isError: false }
        : {
            status: "error",
            loading: false,
            error: new Error(result.error?.message || "Unknown error"),
            isSuccess: false,
            isError: true,
        };

export const subscribeLiveQuery = <T>(query: LiveQuery<T>, onState: (state: SettledLiveQueryState<T>) => void): (() => void) => {
    let active = true;

    const unsubscribe = query((result) => {
        if (active) {
            onState(toLiveQueryState(result));
        }
    });

    return () => {
        active = false;

        if (typeof unsubscribe === "function") {
            unsubscribe();
        }
    };
};
