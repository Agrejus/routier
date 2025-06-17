export type NumberKeys<T> = T extends number ? T : T extends object ? {
    [K in keyof T]: T[K] extends number ? K : never;
}[keyof T] : never;