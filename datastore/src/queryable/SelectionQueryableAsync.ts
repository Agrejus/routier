import { toPromise } from "@routier/core/results";
import { SelectionQueryable } from "./SelectionQueryable";
import { Filter, ParamsFilter } from "@routier/core/expressions";
import { GenericFunction } from "@routier/core/types";
import { ChangeTrackingType, CompiledSchema } from "@routier/core/schema";
import { SchemaCollection } from "@routier/core/collections";
import { QueryOptionsCollection } from "@routier/core/plugins";
import { QuerySource } from "./QuerySource";
import { DataBridge } from "../data-access/DataBridge";
import { ChangeTracker } from "../change-tracking/ChangeTracker";

export class SelectionQueryableAsync<Root extends {}, Shape> extends SelectionQueryable<Root, Shape, void> {

    constructor(
        schema: CompiledSchema<Root>,
        schemas: SchemaCollection,
        scopedQueryOptions: QueryOptionsCollection<Root>,
        changeTrackingType: ChangeTrackingType,
        options: {
            queryable?: QuerySource<Root, Shape>,
            dataBridge?: DataBridge<Root>,
            changeTracker?: ChangeTracker<Root>
        }) {
        super(schema, schemas, scopedQueryOptions, changeTrackingType, options);

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

    removeAsync(expression: Filter<Shape>): Promise<void>;
    removeAsync<P extends {}>(expression: ParamsFilter<Shape, P>, params: P): Promise<void>;
    removeAsync(): Promise<void>;
    removeAsync<P extends {} = never>(doneOrExpression?: Filter<Shape> | ParamsFilter<Shape, P>, params?: P): Promise<void> {

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

    toArrayAsync(): Promise<Shape[]> {
        return toPromise<Shape[]>(w => this.toArray(w));
    }

    firstAsync(expression: Filter<Shape>): Promise<Shape>;
    firstAsync<P extends {}>(expression: ParamsFilter<Shape, P>, params: P): Promise<Shape>;
    firstAsync(): Promise<Shape>;
    firstAsync<P extends {} = never>(expression?: Filter<Shape> | ParamsFilter<Shape, P>, params?: P): Promise<Shape> {
        return toPromise<Shape>(w => {

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
        return toPromise<Shape | undefined>(w => {

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
        return toPromise<boolean>(w => {

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
        return toPromise<boolean>(w => {

            if (params != null) {
                this.every(expression as ParamsFilter<Shape, P>, params, w);
                return
            }

            this.every(expression as Filter<Shape>, w);
        });
    }

    minAsync(selector: GenericFunction<Shape, number>): Promise<number> {
        return toPromise<number>(w => {
            this.min(selector, w);
        });
    }

    maxAsync(selector: GenericFunction<Shape, number>): Promise<number> {
        return toPromise<number>(w => {
            this.max(selector, w);
        });
    }

    sumAsync(selector: GenericFunction<Shape, number>): Promise<number> {
        return toPromise<number>(w => {
            this.sum(selector, w);
        });
    }

    countAsync(): Promise<number> {
        return toPromise<number>(w => {
            this.count(w);
        });
    }

    distinctAsync(): Promise<Shape[]> {
        return toPromise<Shape[]>(w => {
            this.distinct(w);
        });
    }
}
