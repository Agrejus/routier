export type IdType = string | number;
export type DeepPartial<T> = T extends object ? {
    [P in keyof T]?: DeepPartial<T[P]>;
} : T;

export type DefaultValue<T, I = never> = T | ((injected: I) => T);
export type FunctionBody<TEntity, TResult> = (entity: TEntity, collectionName: string) => TResult;
export type GenericFunction<T, R> = (value: T) => R;
type ErrorType = { error: any, ok: false };
type SuccessType<T> = { data: T, ok: true };
export type ResultType<T> = ErrorType | SuccessType<T>;
export type CallbackResult<TData, TCallbackResult = void> = (result: ResultType<TData>) => TCallbackResult;