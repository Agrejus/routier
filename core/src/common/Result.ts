import { ResultType } from "../types"

export class Result {
    static success<T>(data: T): ResultType<T>
    static success<T>(): ResultType<never>
    static success<T>(data?: T): ResultType<T> {
        return {
            ok: true,
            data
        }
    }

    static error<T>(error: any): ResultType<T> {
        return {
            ok: false,
            error
        }
    }

    static resolve<T>(result: ResultType<T>, resolve: (data: T) => void, reject: (error?: any) => void) {
        if (result.ok === true) {
            resolve(result.data);
            return;
        }

        reject(result.error);
    }
}