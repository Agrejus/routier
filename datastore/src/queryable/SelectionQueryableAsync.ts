import { toPromise } from "@routier/core/results";
import { SelectionQueryable } from "./SelectionQueryable";
import { Filter, ParamsFilter } from "@routier/core/expressions";
import { GenericFunction } from "@routier/core/types";
import { IdType } from "@routier/core/schema";
import { CollectionDependencies, RequestContext } from "../collections/types";
import { Explainable } from "./explained";

export class SelectionQueryableAsync<Root extends {}, Shape, E extends boolean = false> extends SelectionQueryable<Root, Shape, void, E> {

    constructor(dependencies: CollectionDependencies<Root>, request: RequestContext<Root>) {
        super(dependencies, request);

        this.removeAsync = this.removeAsync.bind(this);
        this.toArrayAsync = this.toArrayAsync.bind(this);
        this.firstAsync = this.firstAsync.bind(this);
        this.firstOrUndefinedAsync = this.firstOrUndefinedAsync.bind(this);
        this.someAsync = this.someAsync.bind(this);
        this.everyAsync = this.everyAsync.bind(this);
        this.minAsync = this.minAsync.bind(this);
        this.maxAsync = this.maxAsync.bind(this);
        this.sumAsync = this.sumAsync.bind(this);
        this.countAsync = this.countAsync.bind(this);
        this.distinctAsync = this.distinctAsync.bind(this);
    }

    removeAsync(expression: Filter<Shape>): Promise<Explainable<E, Shape[]>>;
    removeAsync<P extends {}>(expression: ParamsFilter<Shape, P>, params: P): Promise<Explainable<E, Shape[]>>;
    removeAsync(): Promise<Explainable<E, Shape[]>>;
    removeAsync<P extends {} = never>(doneOrExpression?: Filter<Shape> | ParamsFilter<Shape, P>, params?: P): Promise<Explainable<E, Shape[]>> {

        if (params != null) {
            const paramsFilter = doneOrExpression as ParamsFilter<Shape, P>;
            return toPromise(w => {
                this.remove(paramsFilter, params, w);
            });
        }

        if (doneOrExpression != null) {
            const paramsFilter = doneOrExpression as Filter<Shape>;
            return toPromise(w => {
                this.remove(paramsFilter, w);
            });
        }

        return toPromise(w => {
            this.remove(w);
        });
    }

    toArrayAsync(): Promise<Explainable<E, Shape[]>> {
        return toPromise<Explainable<E, Shape[]>>(w => this.toArray(w));
    }

    toGroupAsync<R extends Shape[keyof Shape] & IdType>(selector: GenericFunction<Shape, R>): Promise<Explainable<E, Record<R, Shape[]>>> {
        return toPromise<Explainable<E, Record<R, Shape[]>>>(w => this.toGroup(selector, w));
    }

    firstAsync(expression: Filter<Shape>): Promise<Explainable<E, Shape>>;
    firstAsync<P extends {}>(expression: ParamsFilter<Shape, P>, params: P): Promise<Explainable<E, Shape>>;
    firstAsync(): Promise<Explainable<E, Shape>>;
    firstAsync<P extends {} = never>(expression?: Filter<Shape> | ParamsFilter<Shape, P>, params?: P): Promise<Explainable<E, Shape>> {
        return toPromise<Explainable<E, Shape>>(w => {

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

    firstOrUndefinedAsync(expression: Filter<Shape>): Promise<Explainable<E, Shape | undefined>>;
    firstOrUndefinedAsync<P extends {}>(expression: ParamsFilter<Shape, P>, params: P): Promise<Explainable<E, Shape | undefined>>;
    firstOrUndefinedAsync(): Promise<Explainable<E, Shape | undefined>>;
    firstOrUndefinedAsync<P extends {} = never>(expression?: Filter<Shape> | ParamsFilter<Shape, P>, params?: P): Promise<Explainable<E, Shape | undefined>> {
        return toPromise<Explainable<E, Shape | undefined>>(w => {

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

    someAsync(expression: Filter<Shape>): Promise<Explainable<E, boolean>>;
    someAsync<P extends {}>(expression: ParamsFilter<Shape, P>, params: P): Promise<Explainable<E, boolean>>;
    someAsync(): Promise<Explainable<E, boolean>>;
    someAsync<P extends {} = never>(expression?: Filter<Shape> | ParamsFilter<Shape, P>, params?: P): Promise<Explainable<E, boolean>> {
        return toPromise<Explainable<E, boolean>>(w => {

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

    everyAsync(expression: Filter<Shape>): Promise<Explainable<E, boolean>>;
    everyAsync<P extends {}>(expression: ParamsFilter<Shape, P>, params: P): Promise<Explainable<E, boolean>>;
    everyAsync<P extends {} = never>(expression?: Filter<Shape> | ParamsFilter<Shape, P>, params?: P): Promise<Explainable<E, boolean>> {
        return toPromise<Explainable<E, boolean>>(w => {

            if (params != null) {
                this.every(expression as ParamsFilter<Shape, P>, params, w);
                return
            }

            this.every(expression as Filter<Shape>, w);
        });
    }

    minAsync(selector: GenericFunction<Shape, number>): Promise<Explainable<E, number>> {
        return toPromise<Explainable<E, number>>(w => {
            this.min(selector, w);
        });
    }

    maxAsync(selector: GenericFunction<Shape, number>): Promise<Explainable<E, number>> {
        return toPromise<Explainable<E, number>>(w => {
            this.max(selector, w);
        });
    }

    sumAsync(selector: GenericFunction<Shape, number>): Promise<Explainable<E, number>> {
        return toPromise<Explainable<E, number>>(w => {
            this.sum(selector, w);
        });
    }

    countAsync(): Promise<Explainable<E, number>> {
        return toPromise<Explainable<E, number>>(w => {
            this.count(w);
        });
    }

    distinctAsync(): Promise<Explainable<E, Shape[]>> {
        return toPromise<Explainable<E, Shape[]>>(w => {
            this.distinct(w);
        });
    }
}
