import { PartialResultType, ResultType } from "../types"

export class Result {

    static ERROR = "error" as const;
    static SUCCESS = "success" as const;
    static PARTIAL = "partial" as const;

    static success<T>(data: T): ResultType<T>;
    static success<T>(): ResultType<never>;
    static success<T>(data?: T): ResultType<T> {
        return {
            ok: Result.SUCCESS,
            data
        }
    }

    static error<T>(error: any): ResultType<T> {
        return {
            ok: Result.ERROR,
            error
        }
    }

    static resolve<T>(result: ResultType<T> | PartialResultType<T>, resolve: (data: T) => void, reject: (error?: any) => void) {
        if (result.ok === Result.SUCCESS) {
            resolve(result.data);
            return;
        }

        if (result.ok === Result.PARTIAL) {
            reject({
                partial: result.data,
                error: result.error
            });
            return;
        }

        reject(result.error);
    }

    static partial<T>(data: T, error: any): PartialResultType<T> {
        return {
            ok: Result.PARTIAL,
            data,
            error
        }
    }
}