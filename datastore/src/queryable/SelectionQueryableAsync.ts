import { toPromise } from "@routier/core/results";
import { SelectionQueryable } from "./SelectionQueryable";
import { Filter, ParamsFilter } from "@routier/core/expressions";
import { GenericFunction } from "@routier/core/types";
import { IdType, InferType } from "@routier/core/schema";
import { CollectionDependencies } from "../collections/types";
import { SimpleContainer } from "../ioc/SimpleContainer";

export class SelectionQueryableAsync<Root extends {}, Shape> extends SelectionQueryable<Root, Shape, void> {

    constructor(container: SimpleContainer<CollectionDependencies<Root>>) {
        super(container);

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

    removeAsync(expression: Filter<InferType<Shape>>): Promise<void>;
    removeAsync<P extends {}>(expression: ParamsFilter<InferType<Shape>, P>, params: P): Promise<void>;
    removeAsync(): Promise<void>;
    removeAsync<P extends {} = never>(doneOrExpression?: Filter<InferType<Shape>> | ParamsFilter<InferType<Shape>, P>, params?: P): Promise<void> {

        if (params != null) {
            const paramsFilter = doneOrExpression as ParamsFilter<InferType<Shape>, P>;
            return toPromise(w => {
                this.remove(paramsFilter, params, w);
            });
        }

        if (doneOrExpression != null) {
            const paramsFilter = doneOrExpression as Filter<InferType<Shape>>;
            return toPromise(w => {
                this.remove(paramsFilter, w);
            });
        }

        return toPromise(w => {
            this.remove(w);
        });
    }

    toArrayAsync(): Promise<InferType<Shape>[]> {
        return toPromise<InferType<Shape>[]>(w => this.toArray(w));
    }

    toGroupAsync<R extends InferType<Shape>[keyof InferType<Shape>] & IdType>(selector: GenericFunction<InferType<Shape>, R>): Promise<Record<R, InferType<Shape>[]>> {
        return toPromise<Record<R, InferType<Shape>[]>>(w => this.toGroup(selector, w));
    }

    firstAsync(expression: Filter<InferType<Shape>>): Promise<InferType<Shape>>;
    firstAsync<P extends {}>(expression: ParamsFilter<InferType<Shape>, P>, params: P): Promise<InferType<Shape>>;
    firstAsync(): Promise<InferType<Shape>>;
    firstAsync<P extends {} = never>(expression?: Filter<InferType<Shape>> | ParamsFilter<InferType<Shape>, P>, params?: P): Promise<InferType<Shape>> {
        return toPromise<InferType<Shape>>(w => {

            if (params == null && expression == null) {
                this.first(w);
                return;
            }

            if (params != null) {
                this.first(expression as ParamsFilter<InferType<Shape>, P>, params, w);
                return
            }

            this.first(expression as Filter<InferType<Shape>>, w);
        });
    }

    firstOrUndefinedAsync(expression: Filter<InferType<Shape>>): Promise<InferType<Shape> | undefined>;
    firstOrUndefinedAsync<P extends {}>(expression: ParamsFilter<InferType<Shape>, P>, params: P): Promise<InferType<Shape> | undefined>;
    firstOrUndefinedAsync(): Promise<InferType<Shape> | undefined>;
    firstOrUndefinedAsync<P extends {} = never>(expression?: Filter<InferType<Shape>> | ParamsFilter<InferType<Shape>, P>, params?: P): Promise<InferType<Shape> | undefined> {
        return toPromise<InferType<Shape> | undefined>(w => {

            if (params == null && expression == null) {
                this.firstOrUndefined(w);
                return;
            }

            if (params != null) {
                this.firstOrUndefined(expression as ParamsFilter<InferType<Shape>, P>, params, w);
                return
            }

            this.firstOrUndefined(expression as Filter<InferType<Shape>>, w);
        });
    }

    someAsync(expression: Filter<InferType<Shape>>): Promise<boolean>;
    someAsync<P extends {}>(expression: ParamsFilter<InferType<Shape>, P>, params: P): Promise<boolean>;
    someAsync(): Promise<boolean>;
    someAsync<P extends {} = never>(expression?: Filter<InferType<Shape>> | ParamsFilter<InferType<Shape>, P>, params?: P): Promise<boolean> {
        return toPromise<boolean>(w => {

            if (params == null && expression == null) {
                this.some(w);
                return;
            }

            if (params != null) {
                this.some(expression as ParamsFilter<InferType<Shape>, P>, params, w);
                return
            }

            this.some(expression as Filter<InferType<Shape>>, w);
        });
    }

    everyAsync(expression: Filter<InferType<Shape>>): Promise<boolean>;
    everyAsync<P extends {}>(expression: ParamsFilter<InferType<Shape>, P>, params: P): Promise<boolean>;
    everyAsync<P extends {} = never>(expression?: Filter<InferType<Shape>> | ParamsFilter<InferType<Shape>, P>, params?: P): Promise<boolean> {
        return toPromise<boolean>(w => {

            if (params != null) {
                this.every(expression as ParamsFilter<InferType<Shape>, P>, params, w);
                return
            }

            this.every(expression as Filter<InferType<Shape>>, w);
        });
    }

    minAsync(selector: GenericFunction<InferType<Shape>, number>): Promise<number> {
        return toPromise<number>(w => {
            this.min(selector, w);
        });
    }

    maxAsync(selector: GenericFunction<InferType<Shape>, number>): Promise<number> {
        return toPromise<number>(w => {
            this.max(selector, w);
        });
    }

    sumAsync(selector: GenericFunction<InferType<Shape>, number>): Promise<number> {
        return toPromise<number>(w => {
            this.sum(selector, w);
        });
    }

    countAsync(): Promise<number> {
        return toPromise<number>(w => {
            this.count(w);
        });
    }

    distinctAsync(): Promise<InferType<Shape>[]> {
        return toPromise<InferType<Shape>[]>(w => {
            this.distinct(w);
        });
    }
}
