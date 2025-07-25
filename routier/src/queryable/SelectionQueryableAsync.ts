import { Filter, GenericFunction, ParamsFilter } from "routier-core";
import { SelectionQueryable } from "./SelectionQueryable";
import { createPromise } from "../utilities";

export class SelectionQueryableAsync<Root extends {}, Shape> extends SelectionQueryable<Root, Shape, void> {

    removeAsync(expression: Filter<Shape>): Promise<void>;
    removeAsync<P extends {}>(expression: ParamsFilter<Shape, P>, params: P): Promise<void>;
    removeAsync(): Promise<void>;
    removeAsync<P extends {} = never>(doneOrExpression?: Filter<Shape> | ParamsFilter<Shape, P>, params?: P): Promise<void> {

        if (params != null) {
            const paramsFilter = doneOrExpression as ParamsFilter<Shape, P>;
            return createPromise(w => {
                this.remove(paramsFilter, params, w);
            });
        }

        if (doneOrExpression != null) {
            const paramsFilter = doneOrExpression as Filter<Shape>;
            return createPromise(w => {
                this.remove(paramsFilter, w);
            });
        }

        return createPromise(w => {
            this.remove(w);
        });
    }

    toArrayAsync(): Promise<Shape[]> {
        return createPromise<Shape[]>(w => this.toArray(w));
    }

    firstAsync(expression: Filter<Shape>): Promise<Shape>;
    firstAsync<P extends {}>(expression: ParamsFilter<Shape, P>, params: P): Promise<Shape>;
    firstAsync(): Promise<Shape>;
    firstAsync<P extends {} = never>(expression?: Filter<Shape> | ParamsFilter<Shape, P>, params?: P): Promise<Shape> {
        return createPromise<Shape>(w => {

            if (params == null && expression == null) {
                this.first(w);
                return;
            }

            if (params != null) {
                this.first(expression as ParamsFilter<Shape, P>, params, w);
                return
            }

            this.first(expression as Filter<Shape>, w);
        });
    }

    firstOrUndefinedAsync(expression: Filter<Shape>): Promise<Shape | undefined>;
    firstOrUndefinedAsync<P extends {}>(expression: ParamsFilter<Shape, P>, params: P): Promise<Shape | undefined>;
    firstOrUndefinedAsync(): Promise<Shape | undefined>;
    firstOrUndefinedAsync<P extends {} = never>(expression?: Filter<Shape> | ParamsFilter<Shape, P>, params?: P): Promise<Shape | undefined> {
        return createPromise<Shape | undefined>(w => {

            if (params == null && expression == null) {
                this.firstOrUndefined(w);
                return;
            }

            if (params != null) {
                this.firstOrUndefined(expression as ParamsFilter<Shape, P>, params, w);
                return
            }

            this.firstOrUndefined(expression as Filter<Shape>, w);
        });
    }

    someAsync(expression: Filter<Shape>): Promise<boolean>;
    someAsync<P extends {}>(expression: ParamsFilter<Shape, P>, params: P): Promise<boolean>;
    someAsync(): Promise<boolean>;
    someAsync<P extends {} = never>(expression?: Filter<Shape> | ParamsFilter<Shape, P>, params?: P): Promise<boolean> {
        return createPromise<boolean>(w => {

            if (params == null && expression == null) {
                this.some(w);
                return;
            }

            if (params != null) {
                this.some(expression as ParamsFilter<Shape, P>, params, w);
                return
            }

            this.some(expression as Filter<Shape>, w);
        });
    }

    everyAsync(expression: Filter<Shape>): Promise<boolean>;
    everyAsync<P extends {}>(expression: ParamsFilter<Shape, P>, params: P): Promise<boolean>;
    everyAsync<P extends {} = never>(expression?: Filter<Shape> | ParamsFilter<Shape, P>, params?: P): Promise<boolean> {
        return createPromise<boolean>(w => {

            if (params != null) {
                this.every(expression as ParamsFilter<Shape, P>, params, w);
                return
            }

            this.every(expression as Filter<Shape>, w);
        });
    }

    minAsync(selector: GenericFunction<Shape, number>): Promise<number> {
        return createPromise<number>(w => {
            this.min(selector, w);
        });
    }

    maxAsync(selector: GenericFunction<Shape, number>): Promise<number> {
        return createPromise<number>(w => {
            this.max(selector, w);
        });
    }

    sumAsync(selector: GenericFunction<Shape, number>): Promise<number> {
        return createPromise<number>(w => {
            this.sum(selector, w);
        });
    }

    countAsync(): Promise<number> {
        return createPromise<number>(w => {
            this.count(w);
        });
    }

    distinctAsync(): Promise<Shape[]> {
        return createPromise<Shape[]>(w => {
            this.distinct(w);
        });
    }
}
