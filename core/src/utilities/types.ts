export type UnknownRecord = Record<string, unknown>;
export type Tagged<T, Tag extends string> = T & { readonly __tag: Tag };