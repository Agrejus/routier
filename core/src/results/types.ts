type ErrorType = { error: any, ok: "error" };
type SuccessType<T> = { data: T, ok: "success" };
type PartialType<T> = { data: T, ok: "partial", error: any };
export type ResultType<T> = ErrorType | SuccessType<T>;
export type PartialResultType<T> = ErrorType | SuccessType<T> | PartialType<T>;
export type CallbackResult<TData, TCallbackResult = void> = (result: ResultType<TData>) => TCallbackResult;
export type CallbackPartialResult<TData, TCallbackResult = void> = (result: PartialResultType<TData>) => TCallbackResult;