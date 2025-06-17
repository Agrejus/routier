import { Filter, GenericFunction, InferType, ParamsFilter } from "routier-core";
import { NumberKeys } from "./types";
import { SelectionQueryable } from "./SelectionQueryable";
import { createPromise } from "../utilities";

export class SelectionQueryableAsync<T extends {}, U> extends SelectionQueryable<T, U> {

    toArrayAsync(): Promise<T[]> {
        return createPromise<T[]>(w => this.toArray(w));
    }

    firstAsync(expression: Filter<T>): Promise<T>;
    firstAsync<P extends {}>(expression: ParamsFilter<T, P>, params: P): Promise<T>;
    firstAsync(): Promise<T>;
    firstAsync<P extends {} = never>(expression?: Filter<T> | ParamsFilter<T, P>, params?: P): Promise<T> {
        return createPromise<T>(w => {

            if (params == null && expression == null) {
                this.first(w);
                return;
            }

            if (params != null) {
                this.first(expression as ParamsFilter<T, P>, params, w);
                return
            }

            this.first(expression as Filter<T>, w);
        });
    }

    firstOrUndefinedAsync(expression: Filter<T>): Promise<T | undefined>;
    firstOrUndefinedAsync<P extends {}>(expression: ParamsFilter<T, P>, params: P): Promise<T | undefined>;
    firstOrUndefinedAsync(): Promise<T | undefined>;
    firstOrUndefinedAsync<P extends {} = never>(expression?: Filter<T> | ParamsFilter<T, P>, params?: P): Promise<T | undefined> {
        return createPromise<T | undefined>(w => {

            if (params == null && expression == null) {
                this.firstOrUndefined(w);
                return;
            }

            if (params != null) {
                this.firstOrUndefined(expression as ParamsFilter<T, P>, params, w);
                return
            }

            this.firstOrUndefined(expression as Filter<T>, w);
        });
    }

    someAsync(expression: Filter<T>): Promise<boolean>;
    someAsync<P extends {}>(expression: ParamsFilter<T, P>, params: P): Promise<boolean>;
    someAsync(): Promise<boolean>;
    someAsync<P extends {} = never>(expression?: Filter<T> | ParamsFilter<T, P>, params?: P): Promise<boolean> {
        return createPromise<boolean>(w => {

            if (params == null && expression == null) {
                this.some(w);
                return;
            }

            if (params != null) {
                this.some(expression as ParamsFilter<T, P>, params, w);
                return
            }

            this.some(expression as Filter<T>, w);
        });
    }

    everyAsync(expression: Filter<T>): Promise<boolean>;
    everyAsync<P extends {}>(expression: ParamsFilter<T, P>, params: P): Promise<boolean>;
    everyAsync<P extends {} = never>(expression?: Filter<T> | ParamsFilter<T, P>, params?: P): Promise<boolean> {
        return createPromise<boolean>(w => {

            if (params != null) {
                this.every(expression as ParamsFilter<T, P>, params, w);
                return
            }

            this.every(expression as Filter<T>, w);
        });
    }

    minAsync<K extends NumberKeys<T>>(selector: GenericFunction<T, K>): Promise<number> {
        return createPromise<number>(w => {
            this.min(selector, w);
        });
    }

    maxAsync<K extends NumberKeys<T>>(selector: GenericFunction<T, K>): Promise<number> {
        return createPromise<number>(w => {
            this.max(selector, w);
        });
    }

    sumAsync<K extends NumberKeys<T>>(selector: GenericFunction<T, K>): Promise<number> {
        return createPromise<number>(w => {
            this.sum(selector, w);
        });
    }

    countAsync(): Promise<number> {
        return createPromise<number>(w => {
            this.count(w);
        });
    }

    distinctAsync(): Promise<T[]> {
        return createPromise<T[]>(w => {
            this.distinct(w);
        });
    }
}
