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

export function createVoidPromise(fn: (callback: (error?: any) => void) => void) {
    return new Promise<void>((resolve, reject) => {
        fn((e) => {
            if (!e) {
                resolve();
                return;
            }

            reject(e);
        })
    });
}

