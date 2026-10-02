export type LiveState<T> =
  | { readonly status: "loading" }
  | { readonly status: "success"; readonly value: T }
  | { readonly status: "error"; readonly message: string };

export const loadingState: LiveState<never> = { status: "loading" };

export function successState<T>(value: T): LiveState<T> {
  return { status: "success", value };
}

export function errorState(error: Error): LiveState<never> {
  return { status: "error", message: error.message };
}
