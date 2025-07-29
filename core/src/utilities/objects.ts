export const cast = <TIn, TOut>(item: TIn) => {
    return item as unknown as TOut;
}

export function clone<T extends {}>(data: T): T {
    return JSON.parse(JSON.stringify(data)) as T;
}