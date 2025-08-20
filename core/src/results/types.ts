export type ErrorType<Extra extends {} = {}> = { error: any, ok: "error" } & Extra;
export type SuccessType<T, Extra extends {} = {}> = { data: T, ok: "success" } & Extra;
export type PartialType<T, Extra extends {} = {}> = { data: T, ok: "partial", error: any } & Extra;
export type ResultType<T, Extra extends {} = {}> = ErrorType<Extra> | SuccessType<T, Extra>;
export type PartialResultType<T, Extra extends {} = {}> = ErrorType<Extra> | SuccessType<T, Extra> | PartialType<T, Extra>;
export type CallbackResult<TData, TCallbackResult = void> = (result: ResultType<TData>) => TCallbackResult;
export type CallbackPartialResult<TData, TCallbackResult = void> = (result: PartialResultType<TData>) => TCallbackResult;


type IdentifiedType = { id: string }
export type PluginEventErrorType = ErrorType<IdentifiedType>;
export type PluginEventSuccessType<T> = SuccessType<T, IdentifiedType>;
export type PluginEventPartialType<T> = PartialType<T, IdentifiedType>;
export type PluginEventResultType<T> = PluginEventErrorType | PluginEventSuccessType<T>;
export type PluginEventPartialResultType<T> = PluginEventErrorType | PluginEventSuccessType<T> | PluginEventPartialType<T>;
export type PluginEventCallbackResult<TData, TCallbackResult = void> = (result: PluginEventResultType<TData>) => TCallbackResult;
export type PluginEventCallbackPartialResult<TData, TCallbackResult = void> = (result: PluginEventPartialResultType<TData>) => TCallbackResult;