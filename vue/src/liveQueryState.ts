import { Result, type ResultType } from "@routier/core/results";

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

export const pendingState = <T>(): LiveQueryState<T> => ({
  status: "pending",
  loading: true,
  isSuccess: false,
  isError: false,
});

export const stateFromResult = <T>(result: ResultType<T>): LiveQueryState<T> =>
  result.ok === Result.SUCCESS
    ? { status: "success", loading: false, data: result.data, isSuccess: true, isError: false }
    : {
        status: "error",
        loading: false,
        error: new Error(result.error?.message || "Unknown error"),
        isSuccess: false,
        isError: true,
      };
