import { TakeQueryable } from "./TakeQueryable";
import { SkippedQueryable } from "./SkippedQueryable";
import { SelectionQueryable } from "./SelectionQueryable";
import { Filter, ParamsFilter } from "@routier/core/expressions";
import { GenericFunction } from "@routier/core/types";
import { QueryOrdering } from "@routier/core/plugins";
import { SubscribedQueryable } from './SubscribedQueryable';
import { QueryableContainer } from "./IoC/QueryableContainer";

export class Queryable<Root extends {}, Shape, U> extends SelectionQueryable<Root, Shape, U> {

    constructor(container: QueryableContainer<Root>) {
        super(container);

        this.where = this.where.bind(this);
        this.map = this.map.bind(this);
        this.skip = this.skip.bind(this);
        this.take = this.take.bind(this);
        this.sort = this.sort.bind(this);
        this.sortDescending = this.sortDescending.bind(this);
        this.subscribe = this.subscribe.bind(this);
        this.defer = this.defer.bind(this);
    }

    where(expression: Filter<Shape>): Queryable<Root, Shape, U>;
    where<P extends {}>(selector: ParamsFilter<Shape, P>, params: P): Queryable<Root, Shape, U>;
    where<P extends {} = never>(selector: ParamsFilter<Shape, P> | Filter<Shape>, params?: P) {
        this.setFiltersQueryOption(selector, params);
        // We don't need a params queryable.  Params are localized to the where clause and do not
        // matter to the rest of the query
        return new Queryable<Root, Shape, U>(this.container);
    }

    map<R extends Shape[keyof Shape] | Partial<Shape>>(expression: GenericFunction<Shape, R>) {
        this.setMapQueryOption(expression);
        return new Queryable<Root, R, U>(this.container);
    }

    skip(amount: number) {
        this.setSkipQueryOption(amount);
        return new SkippedQueryable<Root, Shape, U>(this.container);
    }

    // cannot to a skip after a take
    take(amount: number) {
        this.setTakeQueryOption(amount);
        return new TakeQueryable<Root, Shape, U>(this.container);
    }

    sort(expression: GenericFunction<Shape, Shape[keyof Shape]>) {
        this.setSortQueryOption(expression, QueryOrdering.Ascending);
        return new Queryable<Root, Shape, U>(this.container);
    }

    sortDescending(expression: GenericFunction<Shape, Shape[keyof Shape]>) {
        this.setSortQueryOption(expression, QueryOrdering.Descending);
        return new Queryable<Root, Shape, U>(this.container);
    }

    subscribe() {
        this.container.register("isSubScribed", true);
        return new SubscribedQueryable<Root, Shape, () => void>(this.container);
    }

    defer() {
        this.container.register("skipInitialQuery", true);
        return new Queryable<Root, Shape, U>(this.container);
    }
}
