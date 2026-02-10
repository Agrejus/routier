import { SelectionQueryable } from "./SelectionQueryable";
import { Filter, ParamsFilter } from "@routier/core/expressions";
import { GenericFunction } from "@routier/core/types";
import { QueryOrdering } from "@routier/core/plugins";
import { SubscribedQueryable } from './SubscribedQueryable';
import { CollectionDependencies, RequestContext } from "../collections/types";
import { CompiledSchema, InferType } from "@routier/core/schema";
import { QueryableComposer } from "./composers/QueryableComposer";

export class Queryable<Root extends {}, Shape, U> extends SelectionQueryable<Root, Shape, U> {

    constructor(dependencies: CollectionDependencies<Root>, request: RequestContext<Root>) {
        super(dependencies, request);

        this.where = this.where.bind(this);
        this.map = this.map.bind(this);
        this.skip = this.skip.bind(this);
        this.take = this.take.bind(this);
        this.sort = this.sort.bind(this);
        this.sortDescending = this.sortDescending.bind(this);
        this.subscribe = this.subscribe.bind(this);
    }

    static compose<TEntity extends {}>(schema: CompiledSchema<TEntity>) {
        return new QueryableComposer<TEntity, InferType<TEntity>, void>({
            schema
        }, new RequestContext<TEntity>());
    }

    where(expression: Filter<Shape>): Queryable<Root, Shape, U>;
    where<P extends {}>(selector: ParamsFilter<Shape, P>, params: P): Queryable<Root, Shape, U>;
    where<P extends {} = never>(selector: ParamsFilter<Shape, P> | Filter<Shape>, params?: P) {
        this.setFiltersQueryOption(selector, params);
        // We don't need a params queryable.  Params are localized to the where clause and do not
        // matter to the rest of the query
        return this.create(Queryable<Root, Shape, U>);
    }

    map<R extends Shape[keyof Shape] | Partial<Shape>>(expression: GenericFunction<Shape, R>) {

        this.setMapQueryOption(expression);
        return this.create(Queryable<Root, R, U>);
    }

    skip(amount: number) {
        this.setSkipQueryOption(amount);
        return this.create(Queryable<Root, Shape, U>);
    }

    take(amount: number) {
        this.setTakeQueryOption(amount);
        return this.create(Queryable<Root, Shape, U>);
    }

    sort(expression: GenericFunction<Shape, Shape[keyof Shape]>) {
        this.setSortQueryOption(expression, QueryOrdering.Ascending);
        return this.create(Queryable<Root, Shape, U>);
    }

    sortDescending(expression: GenericFunction<Shape, Shape[keyof Shape]>) {
        this.setSortQueryOption(expression, QueryOrdering.Descending);
        return this.create(Queryable<Root, Shape, U>);
    }

    subscribe() {
        this.request.isSubScribed = true;
        return this.create(SubscribedQueryable<Root, Shape, () => void>);
    }
}
