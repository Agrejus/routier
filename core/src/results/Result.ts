import { PartialResultType, PluginEventPartialResultType, PluginEventResultType, ResultType } from "./types";

abstract class BaseResult {
    static ERROR = "error" as const;
    static SUCCESS = "success" as const;
    static PARTIAL = "partial" as const;

    static resolve<T>(result: ResultType<T> | PartialResultType<T>, resolve: (data: T) => void, reject: (error?: any) => void) {
        if (result.ok === BaseResult.SUCCESS) {
            resolve(result.data);
            return;
        }

        if (result.ok === BaseResult.PARTIAL) {
            reject({
                partial: result.data,
                error: result.error
            });
            return;
        }

        reject(result.error);
    }

    static assertSuccess<T>(result: any): asserts result is { ok: "success"; data: T } {
        if (result.ok !== BaseResult.SUCCESS) {
            throw new Error(`Expected success result, but got ${result.ok}: ${result.error}`);
        }
    }
}

export class Result extends BaseResult {
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

    static partial<T>(data: T, error: any): PartialResultType<T> {
        return {
            ok: Result.PARTIAL,
            data,
            error
        }
    }
}

export class PluginEventResult extends BaseResult {
    static success<T>(id: string, data: T): PluginEventResultType<T>;
    static success<T>(id: string): PluginEventResultType<never>;
    static success<T>(id: string, data?: T): PluginEventResultType<T> {
        return {
            id,
            ok: Result.SUCCESS,
            data
        }
    }

    static error<T>(id: string, error: any): PluginEventResultType<T> {
        return {
            id,
            ok: Result.ERROR,
            error
        }
    }

    static partial<T>(id: string, data: T, error: any): PluginEventPartialResultType<T> {
        return {
            id,
            ok: Result.PARTIAL,
            data,
            error
        }
    }

    static assertSuccess<T>(result: PluginEventResultType<T>): asserts result is { ok: "success"; data: T; id: string } {
        if (result.ok !== Result.SUCCESS) {
            throw new Error(`Expected success result, but got ${result.ok}: ${result.error}`);
        }
    }
}
