import { QueryResult } from "../types";

export function createPromise<T>(fn: (callback: QueryResult<T>) => void) {
    return new Promise<T>((resolve, reject) => {
        fn((r, e) => {
            if (!e) {
                resolve(r);
                return;
            }

            reject(e);
        })
    });
}
