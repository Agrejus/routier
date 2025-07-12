import { CallbackResult, Result } from "routier-core";

export function createPromise<T>(fn: (callback: CallbackResult<T>) => void) {
    return new Promise<T>((resolve, reject) => {
        fn((r) => {
            if (r.ok === Result.ERROR) {
                reject(r.error);
                return;
            }

            resolve(r.data);
        });
    });
}

export function clone<T extends {}>(data: T): T {
    return JSON.parse(JSON.stringify(data)) as T;
}
