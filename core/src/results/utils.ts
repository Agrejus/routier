import { Result } from "./Result";
import { CallbackResult } from "./types";

export function toPromise<T>(fn: (callback: CallbackResult<T>) => void) {
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
