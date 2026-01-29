import { useEffect, useRef, useState } from "react";
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

export function useQuery<T>(
  query: (callback: (result: ResultType<T>) => void) => void | (() => void),
  deps: any[] = []
): LiveQueryState<T> {
  const [state, setState] = useState<LiveQueryState<T>>({
    status: "pending",
    loading: true,
    isError: false,
    isSuccess: false,
  });

  const unsubscribeRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    setState({
      status: "pending",
      loading: true,
      isError: false,
      isSuccess: false,
    });

    const unsubscribe = query((result) => {
      if (result.ok === Result.SUCCESS) {
        setState({
          status: "success",
          loading: false,
          data: result.data,
          isError: false,
          isSuccess: true,
        });
      } else {
        setState({
          status: "error",
          loading: false,
          error: new Error(result.error?.message || "Unknown error"),
          isError: true,
          isSuccess: false,
        });
      }
    });

    if (unsubscribe && typeof unsubscribe === "function") {
      unsubscribeRef.current = unsubscribe;
    }

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
    };
  }, deps);

  return state;
}
