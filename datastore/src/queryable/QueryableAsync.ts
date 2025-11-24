import { SelectionQueryableAsync } from "./SelectionQueryableAsync";
import { Queryable } from "./Queryable";
import { SkippedQueryableAsync } from "./SkippedQueryableAsync";
import { TakeQueryableAsync } from "./TakeQueryableAsync";
import { Filter, ParamsFilter } from "@routier/core/expressions";
import { GenericFunction } from "@routier/core/types";
import { QueryOrdering } from "@routier/core/plugins";
import { QueryableContainer } from "./IoC/QueryableContainer";

export class QueryableAsync<Root extends {}, Shape> extends SelectionQueryableAsync<Root, Shape> {

    constructor(container: QueryableContainer<Root>) {
        super(container);

        this.where = this.where.bind(this);
        this.map = this.map.bind(this);
        this.skip = this.skip.bind(this);
        this.take = this.take.bind(this);
        this.sort = this.sort.bind(this);
        this.sortDescending = this.sortDescending.bind(this);
        this.subscribe = this.subscribe.bind(this);
    }

    where(expression: Filter<Shape>): QueryableAsync<Root, Shape>;
    where<P extends {}>(selector: ParamsFilter<Shape, P>, params: P): QueryableAsync<Root, Shape>;
    where<P extends {} = never>(selector: ParamsFilter<Shape, P> | Filter<Shape>, params?: P) {
        this.setFiltersQueryOption(selector, params);
        // We don't need a params queryable.  Params are localized to the where clause and do not
        // matter to the rest of the query
        return new QueryableAsync<Root, Shape>(this.container);
    }

    map<R extends Shape[keyof Shape] | Partial<Shape>>(expression: GenericFunction<Shape, R>) {

        this.setMapQueryOption(expression);

        return new QueryableAsync<Root, R>(this.container);
    }

    skip(amount: number) {
        this.setSkipQueryOption(amount);
        return new SkippedQueryableAsync<Root, Shape>(this.container);
    }

    take(amount: number) {
        this.setTakeQueryOption(amount);
        return new TakeQueryableAsync<Root, Shape>(this.container);
    }

    sort(expression: GenericFunction<Shape, Shape[keyof Shape]>) {
        this.setSortQueryOption(expression, QueryOrdering.Ascending);
        return new QueryableAsync<Root, Shape>(this.container);
    }

    sortDescending(expression: GenericFunction<Shape, Shape[keyof Shape]>) {
        this.setSortQueryOption(expression, QueryOrdering.Descending);
        return new QueryableAsync<Root, Shape>(this.container);
    }

    // does not allow for async functions due to the subscription
    subscribe() {
        this.container.register("isSubScribed", true);
        return new Queryable<Root, Shape, () => void>(this.container);
    }
}
