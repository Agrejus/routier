import { Filter, ParamsFilter } from "@routier/core/expressions";
import { SelectionQueryableAsync } from "./SelectionQueryableAsync";
import { SubscribedTakeQueryable } from "./SubscribedTakeQueryable";
import { GenericFunction } from "@routier/core/types";
import { QueryOrdering } from "@routier/core/plugins";
import { QueryableContainer } from "./IoC/QueryableContainer";

export class TakeQueryableAsync<Root extends {}, Shape> extends SelectionQueryableAsync<Root, Shape> {

    constructor(container: QueryableContainer<Root>) {
        super(container);

        this.where = this.where.bind(this);
        this.map = this.map.bind(this);
        this.sort = this.sort.bind(this);
        this.sortDescending = this.sortDescending.bind(this);
        this.subscribe = this.subscribe.bind(this);
    }

    where(expression: Filter<Shape>): TakeQueryableAsync<Root, Shape>;
    where<P extends {}>(selector: ParamsFilter<Shape, P>, params: P): TakeQueryableAsync<Root, Shape>;
    where<P extends {} = never>(selector: ParamsFilter<Shape, P> | Filter<Shape>, params?: P) {
        this.setFiltersQueryOption(selector, params);
        return new TakeQueryableAsync<Root, Shape>(this.container);
    }

    map<R extends Shape[keyof Shape] | Partial<Shape>>(expression: GenericFunction<Shape, R>) {
        this.setMapQueryOption(expression);
        return new TakeQueryableAsync<Root, R>(this.container);
    }

    sort(expression: GenericFunction<Shape, Shape[keyof Shape]>) {
        this.setSortQueryOption(expression, QueryOrdering.Ascending);
        return new TakeQueryableAsync<Root, Shape>(this.container);
    }

    sortDescending(expression: GenericFunction<Shape, Shape[keyof Shape]>) {
        this.setSortQueryOption(expression, QueryOrdering.Descending);
        return new TakeQueryableAsync<Root, Shape>(this.container);
    }

    subscribe() {
        this.container.register("isSubScribed", true);
        return new SubscribedTakeQueryable<Root, Shape, () => void>(this.container);
    }
}